import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { calculatePrize } from '../utilities';

import type { Message } from 'discord.js';

const CRIME_ENERGY_COST = 100;
const PERCENTAGE_TO_GET_CAUGHT = 0.05;

@ApplyOptions<Command.Options>({
	name: 'crime',
	description:
		'Quer ganhar dinheiro fácil? Cometa um crime *~~(mas cuidado para não ser preso)~~*!',

	preconditions: ['GuildOnly', 'NotArrested']
})
export class CrimeCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const userId = message.author.id;
		const { guildId } = message;

		const guild = await this.container.database.guild.upsert({
			where: { discordId: guildId },
			create: { discordId: guildId },
			update: {},
			select: {
				id: true
			}
		});

		const user = await this.container.database.user.upsert({
			where: { discordId: userId },
			create: { discordId: userId },
			update: {},
			select: {
				id: true
			}
		});
		const userGuildData = await this.container.database.userGuildData.upsert({
			where: {
				userId_guildId: {
					guildId: guild.id,
					userId: user.id
				}
			},
			create: {
				user: {
					connectOrCreate: {
						where: { discordId: userId },
						create: { discordId: userId }
					}
				},
				guild: {
					connectOrCreate: {
						where: { discordId: guildId },
						create: { discordId: guildId }
					}
				}
			},
			update: {},
			select: {
				id: true,
				balance: true,
				energy: true
			}
		});

		if (!userGuildData || userGuildData.energy < CRIME_ENERGY_COST) {
			await message.reply(
				`Não tens energia suficiente para cometer um crime (custo: ${CRIME_ENERGY_COST}).`
			);
			return;
		}

		const didUserGetCaught = Math.random() < PERCENTAGE_TO_GET_CAUGHT;

		if (didUserGetCaught) {
			await this.container.database.user.update({
				where: {
					discordId: userId
				},
				data: {
					guildPrisoners: {
						create: {
							guild: {
								connectOrCreate: {
									where: { discordId: guildId },
									create: { discordId: guildId }
								}
							}
						}
					}
				}
			});

			await message.reply(
				'Foste apanhado a cometer um crime e foste preso! Perdeste **100** de energia.'
			);
			return;
		}

		const prize = calculatePrize();

		await this.container.database.userGuildData.update({
			where: {
				id: userGuildData.id
			},
			data: {
				dirtyBalance: { increment: prize },
				energy: { decrement: CRIME_ENERGY_COST }
			}
		});

		await message.reply(`Cometeste um crime e ganhaste **${prize}** moedas!`);
	}
}
