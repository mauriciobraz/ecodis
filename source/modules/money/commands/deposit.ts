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
		const amountResult = await args.pickResult('string');

		if (amountResult.isErr()) {
			await message.reply({
				content: 'Você precisa especificar um valor para depositar.'
			});

			return;
		}

		const amount = amountResult.unwrap();
		const numberAmount = Number(amount);

		if (!isNaN(numberAmount) && numberAmount < 1) {
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

		const transactionResult = await this.container.database.transaction.aggregate({
			where: { user: { discordId: message.author.id } },
			_sum: { amount: true }
		});

		const balanceInBank = transactionResult._sum.amount ?? 0;

		if (
			amount !== 'tudo' &&
			(balanceInBank === 0 || balanceInBank < numberAmount) &&
			currentBalance.balance < numberAmount
		) {
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
					decrement: amount === 'tudo' ? currentBalance.balance : numberAmount
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
						amount: amount === 'tudo' ? currentBalance.balance : numberAmount
					}
				}
			}
		});

		await message.reply({
			content:
				amount === 'tudo'
					? 'Você depositou todas as suas moedas com sucesso!'
					: `Você depositou **${amount}** moedas com sucesso!`
		});
	}
}
