/* eslint-disable @typescript-eslint/require-await */

import { TransactionType } from '@prisma/client';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'depositar',
	aliases: ['deposit']
})
export class DepositCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const amountResult = await args.pickResult('number');

		if (amountResult.isErr()) {
			await message.reply({
				content: 'Você precisa especificar um valor para depositar.'
			});

			return;
		}

		const amount = amountResult.unwrap();

		if (amount <= 0) {
			await message.reply({
				content: 'Você não pode depositar menos que 1 moeda!'
			});

			return;
		}

		const currentBalance = await this.container.database.user.upsert({
			where: {
				discordId: message.author.id
			},
			create: {
				discordId: message.author.id
			},
			update: {},
			select: {
				balance: true
			}
		});

		if (currentBalance.balance < amount) {
			await message.reply({
				content: 'Você não tem moedas suficientes para depositar.'
			});

			return;
		}

		await this.container.database.user.update({
			where: {
				discordId: message.author.id
			},
			data: {
				balance: {
					decrement: amount
				},
				transactions: {
					create: {
						type: TransactionType.Deposit,
						guild: {
							connectOrCreate: {
								where: { discordId: message.guildId },
								create: { discordId: message.guildId }
							}
						},
						amount
					}
				}
			}
		});

		await message.reply({
			content: `Você depositou **${amount}** moedas com sucesso!`
		});
	}
}
