import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'dar-dinheiro',
	aliases: ['add-money', 'adicionar-dinheiro'],
	preconditions: ['EditorOnly']
})
export class AddMoneyCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const user = await args.pick('user');
		const amount = await args.pick('number');

		if (amount < 0) {
			await message.reply({
				content: 'Você não pode dar uma quantidade negativa de dinheiro!'
			});
			return;
		}

		const existingUserGuildBalance = await this.container.database.userGuildBalance.findFirst({
			where: {
				user: { discordId: user.id },
				guild: { discordId: message.guildId }
			}
		});

		let userGuildBalanceId: string;

		if (existingUserGuildBalance === null) {
			const createdUserGuildBalance = await this.container.database.userGuildBalance.create({
				data: {
					user: {
						connectOrCreate: {
							where: { discordId: message.author.id },
							create: { discordId: message.author.id }
						}
					},
					guild: {
						connectOrCreate: {
							where: { discordId: message.guildId },
							create: { discordId: message.guildId }
						}
					}
				},
				select: {
					id: true
				}
			});

			userGuildBalanceId = createdUserGuildBalance.id;
		} else {
			userGuildBalanceId = existingUserGuildBalance.id;
		}

		const updatedUser = await this.container.database.userGuildBalance.upsert({
			where: {
				id: userGuildBalanceId
			},
			create: {
				user: {
					connectOrCreate: {
						where: { discordId: message.author.id },
						create: { discordId: message.author.id }
					}
				},
				guild: {
					connectOrCreate: {
						where: { discordId: message.guildId },
						create: { discordId: message.guildId }
					}
				},
				balance: amount
			},
			update: {
				balance: {
					increment: amount
				}
			},
			select: {
				balance: true
			}
		});

		await message.reply({
			content: `Você adicionou **${amount}** moedas para <@${user.id}>. Agora ele tem **${updatedUser.balance}** moedas.`
		});
	}
}
