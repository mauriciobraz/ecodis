import { container } from '@sapphire/pieces';
import { Result } from '@sapphire/result';

import type { Prisma } from '@prisma/client';

/**
 * Utility functions for interacting with the database.
 */
export namespace UserQueries {
	/**
	 * Represents the options for updating the balance of a user in a guild.
	 */
	export interface UpdateBalanceOptions {
		userId: string;
		guildId: string;

		balance?: [keyof Prisma.FloatFieldUpdateOperationsInput, number];
		bankBalance?: [keyof Prisma.FloatFieldUpdateOperationsInput, number];
		dirtyBalance?: [keyof Prisma.FloatFieldUpdateOperationsInput, number];
	}

	/** Represents the result of updating the balance of a user in a guild. */
	export interface UpdateBalanceResult {
		updatedBalance: number;
		updatedBankBalance: number;
		updatedDirtyBalance: number;
	}

	/**
	 * Updates the balance of a user in a guild.
	 * @param operation What operation to perform on the balance.
	 * @param options The options to update the balance with.
	 * @returns The updated balance and dirty balance.
	 */
	export async function updateBalance(
		options: UpdateBalanceOptions
	): Promise<UpdateBalanceResult> {
		const {
			userGuildDatas: [userGuildBalance]
		} = await container.database.user.upsert({
			where: {
				discordId: options.userId
			},
			create: {
				discordId: options.userId,
				guilds: {
					connectOrCreate: {
						create: {
							discordId: options.guildId
						},
						where: {
							discordId: options.guildId
						}
					}
				}
			},
			update: {},
			select: {
				userGuildDatas: {
					where: {
						guild: {
							discordId: options.guildId
						}
					},
					select: {
						id: true
					}
				}
			}
		});

		const updateData: Prisma.UserGuildDataUpdateInput = {};

		if (options.balance) {
			updateData.balance = {
				[options.balance[0]]: options.balance[1]
			};
		}

		if (options.bankBalance) {
			updateData.bankBalance = {
				[options.bankBalance[0]]: options.bankBalance[1]
			};
		}

		if (options.dirtyBalance) {
			updateData.dirtyBalance = {
				[options.dirtyBalance[0]]: options.dirtyBalance[1]
			};
		}

		const updatedUserGuildBalance = await container.database.userGuildData.update({
			where: {
				id: userGuildBalance.id
			},
			data: updateData,
			select: {
				balance: true,
				bankBalance: true,
				dirtyBalance: true
			}
		});

		return {
			updatedBalance: updatedUserGuildBalance.balance,
			updatedBankBalance: updatedUserGuildBalance.bankBalance,
			updatedDirtyBalance: updatedUserGuildBalance.dirtyBalance
		};
	}

	/** Represents the options for retrieving user balances. */
	export interface GetUserBalancesOptions {
		userId: string;
		guildId?: string;
	}

	/** Represents the result of retrieving user balances. */
	export interface GetUserBalancesResult {
		diamonds: number;
		balance: number;
		dirtyBalance: number;
		balanceInBank: number;
	}

	/**
	 * Retrieves the balances of a user in a guild.
	 * @param options The options to retrieve user balances.
	 * @returns All balances a user have in the determined context.
	 */
	export async function getUserBalances(
		options: GetUserBalancesOptions
	): Promise<GetUserBalancesResult> {
		const {
			diamonds,
			userGuildDatas: [userGuildBalance]
		} = await container.database.user.upsert({
			where: {
				discordId: options.userId
			},
			create: {
				discordId: options.userId,
				...(options.guildId && {
					guilds: {
						connectOrCreate: {
							create: { discordId: options.guildId },
							where: { discordId: options.guildId }
						}
					}
				})
			},
			update: {},
			select: {
				diamonds: true,
				userGuildDatas: {
					where: {
						guild: {
							discordId: options.guildId
						}
					},
					select: {
						balance: true,
						bankBalance: true,
						dirtyBalance: true
					}
				}
			}
		});

		return {
			diamonds,
			balance: userGuildBalance?.balance ?? 0,
			dirtyBalance: userGuildBalance?.dirtyBalance ?? 0,
			balanceInBank: userGuildBalance?.bankBalance ?? 0
		};
	}

	export type TransferMoneyKind = 'balance' | 'dirtyBalance';

	export interface TransferOptions {
		amount: number;
		moneyKind: TransferMoneyKind;

		guildId: string;
		senderId: string;
		recipientId: string;
	}

	type TransferResult = Result<{ senderBalance: number; recipientBalance: number }, string>;

	/**
	 * Transfers an amount of money to an user.
	 * @param options Options for transferring money.
	 * @returns The updated balances of the sender and recipient.
	 */
	export async function transfer(options: TransferOptions): Promise<TransferResult> {
		const { senderId, recipientId, amount, moneyKind, guildId } = options;

		const senderBalances = await getUserBalances({
			userId: senderId,
			guildId
		});

		if (senderBalances[moneyKind] < amount) {
			return Result.err('The sender does not have enough money to transfer this amount');
		}

		const senderUpdatedBalance = await updateBalance({
			userId: senderId,
			guildId,
			[moneyKind]: ['decrement', amount]
		});

		const recipientUpdatedBalance = await updateBalance({
			userId: recipientId,
			guildId,
			[moneyKind]: ['increment', amount]
		});

		return Result.ok({
			senderBalance: senderUpdatedBalance.updatedBalance,
			recipientBalance: recipientUpdatedBalance.updatedBalance
		});
	}

	/**
	 * Retrieves the last daily claim timestamp of a user in a guild.
	 * @param userId The ID of the user.
	 * @param guildId The ID of the guild.
	 * @returns The last daily claim timestamp or null if not found.
	 */
	export async function getLastDaily(userId: string, guildId: string): Promise<Date | null> {
		const user = await container.database.user.upsert({
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
						lastDaily: true
					}
				}
			}
		});

		return user?.userGuildDatas[0]?.lastDaily ?? null;
	}

	/**
	 * Updates the last daily claim timestamp of a user in a guild to the current timestamp.
	 * @param userId The ID of the user.
	 * @param guildId The ID of the guild.
	 */
	export async function updateLastDaily(userId: string, guildId: string): Promise<void> {
		const userGuildData = await container.database.userGuildData.findFirst({
			where: {
				guild: {
					discordId: guildId
				},
				user: {
					discordId: userId
				}
			},
			select: {
				id: true
			}
		});

		if (userGuildData) {
			await container.database.userGuildData.update({
				where: {
					id: userGuildData.id
				},
				data: {
					lastDaily: new Date()
				}
			});
		} else {
			await container.database.userGuildData.create({
				data: {
					user: {
						connectOrCreate: {
							create: { discordId: userId },
							where: { discordId: userId }
						}
					},
					guild: {
						connectOrCreate: {
							create: { discordId: guildId },
							where: { discordId: guildId }
						}
					},
					lastDaily: new Date()
				}
			});
		}
	}

	/**
	 * Retrieves the top users with the highest value for the specified field in a guild.
	 * @param guildId The ID of the guild (pass null to check globally)
	 * @param limit The maximum number of users to retrieve.
	 * @param field The field to use for sorting and retrieving top users (e.g., 'balance', 'bankBalance', 'dirtyBalance', 'diamonds').
	 * @returns An array of user objects with their field value, sorted in descending order.
	 */
	export async function getTopUsersByField(
		guildId: string | null,
		limit: number,
		field: 'balance' | 'bankBalance' | 'dirtyBalance' | 'diamonds'
	): Promise<{ userId: string; value: number }[]> {
		console.log({
			guildId,
			limit,
			field
		});

		const topUsers = await container.database.user.findMany({
			take: limit,
			where: {
				...(field === 'diamonds'
					? { diamonds: { not: 0 } }
					: {
							userGuildDatas: {
								some: {
									[field]: { not: 0 }
								}
							}
					  })
			},
			select: {
				...(field === 'diamonds'
					? { diamonds: true }
					: {
							userGuildDatas: {
								select: {
									[field]: true
								},
								...(guildId && {
									where: {
										guild: {
											discordId: guildId
										}
									}
								})
							}
					  }),
				discordId: true
			}
		});

		return topUsers.map(
			(user: {
				discordId: string;
				diamonds?: number;
				userGuildDatas?: { [key: string]: number }[];
			}) => ({
				userId: user.discordId,
				value: field === 'diamonds' ? user.diamonds! : user.userGuildDatas![0][field]
			})
		);
	}
}
