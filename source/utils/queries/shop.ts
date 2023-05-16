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
	export async function buyItem(options: BuyItemOptions) {
		const { amount, guildId, itemId, userId } = options;

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
					amount: {
						increment: amount
					}
				}
			});
		} else {
			await container.database.inventoryItem.create({
				data: {
					amount,
					itemId,
					inventoryId: inventory.id
				}
			});
		}

		return Result.ok({
			message: 'Item successfully purchased.'
		});
	}
}
