import { container } from '@sapphire/pieces';
import { Result } from '@sapphire/result';
import { UserQueries } from './user';

/**
 * Utility functions for interacting with the database for shop and inventory.
 */
export namespace ShopQueries {
	/** Represents the result of retrieving the inventory of a user. */
	export interface GetInventoryResult {
		userId: string;
		items: Array<{
			itemId: string;
			name: string;
			description: string;
			price: number;
			quantity: number;
		}>;
	}

	export interface GetInventoryItemData {
		id: string;
		name: string;
		description: string;
		price: number;
		amount: number;
		emoji: string;
		slug: string;
	}

	/**
	 * Retrieves the inventory of a user in a specific guild.
	 * @param userId The ID of the user whose inventory to retrieve.
	 * @param guildId The ID of the guild to get the user's inventory from.
	 * @returns The user's inventory in the specified guild.
	 */
	export async function getInventory(userId: string, guildId: string) {
		const {
			userGuildDatas: [userGuildData]
		} = await container.database.user.upsert({
			where: {
				discordId: userId
			},
			create: {
				discordId: userId,
				userGuildDatas: {
					create: {
						guild: {
							connectOrCreate: {
								where: { discordId: guildId },
								create: { discordId: guildId }
							}
						},
						inventory: {
							create: {}
						}
					}
				}
			},
			update: {},
			select: {
				userGuildDatas: {
					where: {
						guild: {
							discordId: guildId
						}
					},
					select: {
						inventory: {
							select: {
								items: {
									select: {
										amount: true,
										item: true
									}
								}
							}
						}
					}
				}
			}
		});

		if (!userGuildData) {
			return {
				userId,
				items: []
			};
		}

		return {
			userId,
			items: (userGuildData.inventory?.items || []).map(
				(item) =>
					({
						id: item.item.id,
						name: item.item.name,
						description: item.item.description,
						price: item.item.price,
						amount: item.amount,
						emoji: item.item.emoji,
						slug: item.item.slug
					} as GetInventoryItemData)
			)
		};
	}

	export interface BuyItemOptions {
		userId: string;
		guildId: string;
		itemId: string;
		amount: number;
	}

	/**
	 * Buys an item for a user in a specific guild.
	 * @param userId The ID of the user who wants to buy the item.
	 * @param guildId The ID of the guild where the user wants to buy the item.
	 * @param itemId The ID of the item to be purchased.
	 * @param amount The number of items to be purchased.
	 * @returns A message indicating whether the purchase was successful or not.
	 */
	export async function buyItem({ amount, guildId, itemId, userId }: BuyItemOptions) {
		// Fetch item information
		const item = await container.database.item.findUnique({
			where: {
				id: itemId
			}
		});

		if (!item) {
			return Result.err('Item not found.');
		}

		// Calculate the total price
		const totalPrice = item.price * amount;

		// Get the user's balance
		const userBalances = await UserQueries.getUserBalances({
			userId,
			guildId
		});

		// Check if the user has enough balance to buy the item
		if (userBalances.balance < totalPrice) {
			return Result.err('Insufficient balance.');
		}

		// Deduct the total price from the user's balance
		await UserQueries.updateBalance({
			userId,
			guildId,
			balance: ['decrement', totalPrice]
		});

		const {
			userGuildDatas: [userGuildData]
		} = await container.database.user.upsert({
			where: {
				discordId: userId
			},
			create: {
				discordId: userId,
				userGuildDatas: {
					create: {
						guild: {
							connectOrCreate: {
								create: { discordId: guildId },
								where: { discordId: guildId }
							}
						},
						inventory: {
							create: {}
						}
					}
				}
			},
			update: {},
			select: {
				userGuildDatas: {
					where: {
						guild: {
							discordId: guildId
						}
					},
					select: {
						id: true,
						inventory: {
							select: {
								id: true
							}
						}
					}
				}
			}
		});

		if (!userGuildData) {
			return Result.err('User guild data not found.');
		}

		const inventoryItem = await container.database.inventoryItem.findFirst({
			where: {
				inventoryId: userGuildData.inventory?.id,
				itemId
			}
		});

		if (inventoryItem) {
			// Update the existing item's amount
			await container.database.inventoryItem.update({
				where: {
					id: inventoryItem.id
				},
				data: {
					amount: {
						increment: amount
					}
				}
			});
		} else {
			// Connect the purchased item to the userGuildData's inventory
			await container.database.inventoryItem.create({
				data: {
					amount,
					item: {
						connect: {
							id: itemId
						}
					},
					inventory: {
						connect: {
							id: userGuildData.inventory?.id
						}
					}
				}
			});
		}

		return Result.ok({ message: 'Item successfully purchased.' });
	}
}
