import { container } from '@sapphire/pieces';
import { Result } from '@sapphire/result';
import { UserQueries } from './user';
import { DEFAULT_PLANT_DATA_GRID, DEFAULT_PURCHASED_AREA } from '../../modules/games/commands/farm';

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
		const user = await UserQueries.getOrCreate(userId);

		const userGuildData = await container.database.userGuildData.findFirst({
			where: {
				userId: user.id,
				guild: { discordId: guildId }
			},
			include: {
				inventory: true
			}
		});

		if (!userGuildData) {
			return {
				userId,
				items: []
			};
		}

		const { inventory } = userGuildData;

		if (!inventory) {
			return {
				userId,
				items: []
			};
		}

		const inventoryItems = await container.database.inventoryItem.findMany({
			where: {
				inventoryId: inventory.id
			},
			select: {
				amount: true,
				item: {
					select: {
						id: true,
						name: true,
						description: true,
						price: true,
						emoji: true,
						slug: true
					}
				}
			}
		});

		const items = inventoryItems.map((inventoryItem) => ({
			id: inventoryItem.item.id,
			name: inventoryItem.item.name,
			description: inventoryItem.item.description,
			price: inventoryItem.item.price,
			amount: inventoryItem.amount,
			emoji: inventoryItem.item.emoji,
			slug: inventoryItem.item.slug
		}));

		return {
			userId,
			items
		};
	}

	export interface BuyItemOptions {
		data?: any;
		userId: string;
		guildId: string;
		itemId?: string;
		animalId?: string;
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
	export async function buyItem(options: BuyItemOptions) {
		const { amount, guildId, itemId, animalId, userId, data } = options;

		let price: number | null = null;

		if (itemId) {
			const item = await container.database.item.findUnique({
				where: {
					id: itemId
				},
				select: {
					price: true
				}
			});

			price = item?.price ?? -1;
		} else if (animalId) {
			const animal = await container.database.animal.findUnique({
				where: {
					id: animalId
				},
				select: {
					price: true
				}
			});

			price = animal?.price ?? -1;
		}

		if (price === null || price === -1) {
			return Result.err('Not found.');
		}

		// Calculate the total price
		const totalPrice = price * amount;

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

		const guild = await container.database.guild.upsert({
			where: { discordId: guildId },
			create: { discordId: guildId },
			update: {},
			select: {
				id: true
			}
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
						guildId: guild.id
					}
				}
			},
			update: {},
			select: {
				id: true,
				userGuildDatas: {
					where: {
						guildId: guild.id
					}
				}
			}
		});

		// Add the item to the user's inventory

		if (itemId) {
			let inventory = await container.database.inventory.findUnique({
				where: { userId: userGuildData.id }
			});

			if (!inventory) {
				inventory = await container.database.inventory.create({
					data: {
						userId: userGuildData.id
					}
				});
			}

			const existingItem = await container.database.inventoryItem.findFirst({
				where: {
					itemId,
					inventoryId: inventory.id
				}
			});

			if (existingItem) {
				await container.database.inventoryItem.update({
					where: {
						id: existingItem.id
					},
					data: {
						data,
						amount: {
							increment: amount
						}
					}
				});
			} else {
				await container.database.inventoryItem.create({
					data: {
						data,
						amount: amount ?? 1,
						item: { connect: { id: itemId } },
						inventory: { connect: { id: inventory.id } }
					}
				});
			}
		} else if (animalId) {
			let farm = await container.database.farm.findUnique({
				where: {
					userGuildDataId: userGuildData.id
				}
			});

			if (!farm) {
				farm = await container.database.farm.create({
					data: {
						userGuildDataId: userGuildData.id,
						purchasedArea: DEFAULT_PURCHASED_AREA,
						plantData: DEFAULT_PLANT_DATA_GRID
					}
				});
			}

			// Add the animal to the user's farm
			await container.database.farmAnimal.create({
				data: {
					animalId,
					farmId: farm.id
				}
			});
		}

		return Result.ok({
			message: 'Item successfully purchased.'
		});
	}

	interface SellItemOptions {
		userId: string;
		guildId: string;
		itemId?: string;
		animalId?: string;
		amount?: number;
		sellAll?: boolean;
	}

	/**
	 * Sells an item for a user in a specific guild.
	 * @param userId The ID of the user who wants to sell the item.
	 * @param guildId The ID of the guild where the user wants to sell the item.
	 * @param itemId The ID of the item to be sold.
	 * @param animalId The ID of the animal to be sold.
	 * @param amount The number of items to be sold.
	 * @param sellAll A boolean indicating whether all items of this type should be sold.
	 * @returns A message indicating whether the sale was successful or not.
	 */
	export async function sellItem(options: SellItemOptions) {
		const { amount, guildId, itemId, animalId, userId, sellAll } = options;

		if (!amount && !sellAll) {
			return Result.err('You must specify an amount to sell.');
		}

		if (amount && sellAll) {
			return Result.err('You cannot specify both an amount and sell all.');
		}

		if (animalId && itemId) {
			return Result.err('You cannot specify both an animal ID and an item ID.');
		}

		let price: number | null = null;

		if (itemId) {
			const item = await container.database.item.findUnique({
				where: {
					id: itemId
				},
				select: {
					price: true
				}
			});

			price = item?.price ?? -1;
		} else if (animalId) {
			const animal = await container.database.animal.findUnique({
				where: {
					id: animalId
				},
				select: {
					price: true
				}
			});

			price = animal?.price ?? -1;
		} else {
			return Result.err('You must specify either an item ID or an animal ID.');
		}

		if (price === null || price === -1) {
			return Result.err('Item not found.');
		}

		const guild = await container.database.guild.upsert({
			where: { discordId: guildId },
			create: { discordId: guildId },
			update: {},
			select: {
				id: true
			}
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
						guildId: guild.id
					}
				}
			},
			update: {},
			select: {
				id: true,
				userGuildDatas: {
					where: {
						guildId: guild.id
					}
				}
			}
		});

		let inventory = await container.database.inventory.findUnique({
			where: { userId: userGuildData.id }
		});

		if (!inventory) {
			inventory = await container.database.inventory.create({
				data: {
					userId: userGuildData.id
				}
			});
		}

		const inventoryId = inventory.id;

		if (itemId) {
			const inventoryItem = await container.database.inventoryItem.findUnique({
				where: {
					itemId_inventoryId: {
						itemId,
						inventoryId
					}
				},
				select: { amount: true }
			});

			if (!inventoryItem || (inventoryItem.amount < amount! && !sellAll)) {
				return Result.err('Not enough items to sell.');
			}

			const totalAmount = sellAll ? inventoryItem.amount : amount!;

			const totalPrice = price * totalAmount;

			await UserQueries.updateBalance({
				userId,
				guildId,
				balance: ['increment', totalPrice]
			});

			if (sellAll) {
				await container.database.inventoryItem.delete({
					where: {
						itemId_inventoryId: {
							itemId,
							inventoryId
						}
					}
				});
			} else {
				await container.database.inventoryItem.update({
					where: {
						itemId_inventoryId: {
							itemId,
							inventoryId
						}
					},
					data: {
						amount: {
							decrement: amount
						}
					}
				});
			}
		} else if (animalId) {
			return Result.err('Not implemented.');
		}

		return Result.ok({
			message: 'Item successfully sold.'
		});
	}
}
