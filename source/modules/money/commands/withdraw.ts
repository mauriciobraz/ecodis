/* eslint-disable @typescript-eslint/require-await */

import { TransactionType } from '@prisma/client';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'sacar',
	aliases: ['withdraw']
})
export class DepositCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const amountResult = await args.pickResult('string');

		if (amountResult.isErr()) {
			await message.reply({
				content: 'Você precisa especificar um valor para sacar.'
			});

			return;
		}

		const amount = amountResult.unwrap();
		const numberAmount = parseInt(amount, 10);

		if (numberAmount < 1) {
			await message.reply({
				content: 'Você não pode sacar menos que 1 moeda!'
			});

			return;
		}

		if (isNaN(numberAmount) && amount !== 'tudo') {
			await message.reply({
				content: 'Você precisa especificar um valor para sacar ou "tudo" para sacar tudo.'
			});

			return;
		}

		const transactionResult = await this.container.database.transaction.aggregate({
			where: { user: { discordId: message.author.id } },
			_sum: { amount: true }
		});

		if (
			transactionResult._sum.amount === null ||
			transactionResult._sum.amount < numberAmount
		) {
			await message.reply({
				content: 'Você não tem moedas suficientes para sacar.'
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

		if (typeof amount === 'number' && currentBalance.balance < amount) {
			await message.reply({
				content: 'Você não tem moedas suficientes para sacar.'
			});

			return;
		}

		await this.container.database.user.update({
			where: {
				discordId: message.author.id
			},
			data: {
				balance: {
					increment: amount === 'tudo' ? transactionResult._sum.amount : numberAmount
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
						amount: amount === 'tudo' ? -transactionResult._sum.amount : -numberAmount
					}
				}
			}
		});

		await message.reply({
			content: `Você sacou ${
				typeof amount === 'number' ? amount : transactionResult._sum.amount
			} moedas!`
		});
	}
}
