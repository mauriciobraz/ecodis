import { TransactionStatus, TransactionType } from '@prisma/client';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { MAXIMUM_BET_PRIZE, calculatePrize } from '../utilities';

import type { Message } from 'discord.js';

const CRIME_ENERGY_COST = 100;
const PERCENTAGE_TO_GET_CAUGHT = /* 80% */ 0.8;

@ApplyOptions<Command.Options>({
	name: 'crime',
	description: 'Comete um crime para ganhar dinheiro (e gastar energia).',
	preconditions: ['GuildOnly', 'NotArrested']
})
export class CrimeCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const user = await this.container.database.user.upsert({
			where: {
				discordId: message.author.id
			},
			create: {
				discordId: message.author.id,
				userGuildBalances: {
					create: {
						guild: {
							connectOrCreate: {
								where: { discordId: message.guildId },
								create: { discordId: message.guildId }
							}
						}
					}
				}
			},
			update: {},
			select: {
				userGuildBalances: {
					select: {
						id: true,
						balance: true
					}
				},
				energy: true
			}
		});

		const userGuildBalance = user.userGuildBalances[0];

		if (user.energy < CRIME_ENERGY_COST) {
			await message.reply({
				content: `Não tens energia suficiente para cometer um crime (custo: ${CRIME_ENERGY_COST}).`
			});

			return;
		}

		const didUserGetCaught = Math.random() < PERCENTAGE_TO_GET_CAUGHT;

		if (didUserGetCaught) {
			await this.container.database.user.update({
				where: {
					discordId: message.author.id
				},
				data: {
					energy: {
						decrement: CRIME_ENERGY_COST
					},
					transactions: {
						create: {
							type: TransactionType.Crime,
							status: TransactionStatus.Failed,
							amount: -MAXIMUM_BET_PRIZE,
							guild: {
								connectOrCreate: {
									where: { discordId: message.guildId },
									create: { discordId: message.guildId }
								}
							}
						}
					},
					guildPrisoners: {
						create: {
							guild: {
								connectOrCreate: {
									where: { discordId: message.guildId },
									create: { discordId: message.guildId }
								}
							}
						}
					}
				}
			});

			await message.reply({
				content:
					'Foste apanhado a cometer um crime e foste preso! Perdeste **100** de energia.'
			});

			return;
		}

		const prize = calculatePrize();

		await this.container.database.user.update({
			where: {
				discordId: message.author.id
			},
			data: {
				energy: {
					decrement: CRIME_ENERGY_COST
				},
				userGuildBalances: {
					upsert: {
						where: {
							id: userGuildBalance?.id
						},
						create: {
							dirtyBalance: prize,
							guild: {
								connectOrCreate: {
									where: { discordId: message.guildId },
									create: { discordId: message.guildId }
								}
							}
						},
						update: {
							dirtyBalance: {
								increment: prize
							}
						}
					}
				},
				transactions: {
					create: {
						type: TransactionType.Crime,
						status: TransactionStatus.Success,
						amount: prize,
						guild: {
							connectOrCreate: {
								where: { discordId: message.guildId },
								create: { discordId: message.guildId }
							}
						}
					}
				}
			}
		});

		await message.reply({
			content: `Cometeste um crime e ganhaste **${prize}** moedas!`
		});
	}
}
