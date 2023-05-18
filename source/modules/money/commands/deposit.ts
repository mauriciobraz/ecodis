import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { UserQueries } from '../../../utils/queries/user';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'depositar',
	description: 'Deposite dinheiro em sua conta.',

	aliases: ['deposit', 'dep', 'deposito'],
	preconditions: ['GuildOnly', 'NotArrested']
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

		const userBalances = await UserQueries.getUserBalances({
			userId: message.author.id,
			guildId: message.guildId
		});

		const { balanceInBank } = userBalances;

		if (
			amount !== 'tudo' &&
			(balanceInBank === 0 || balanceInBank < numberAmount) &&
			userBalances.balance < numberAmount
		) {
			await message.reply({
				content: 'Você não tem moedas suficientes para depositar.'
			});

			return;
		}

		const depositAmount = amount === 'tudo' ? userBalances.balance : numberAmount;

		await UserQueries.updateBalance({
			userId: message.author.id,
			guildId: message.guildId,
			balance: ['decrement', depositAmount],
			bankBalance: ['increment', depositAmount]
		});

		await message.reply({
			content:
				amount === 'tudo'
					? `Você depositou todas as suas moedas com sucesso!`
					: `Você depositou **${amount}** moedas com sucesso!`
		});
	}
}
