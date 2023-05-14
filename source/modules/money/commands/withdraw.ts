import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

import { UserQueries } from '../../../utils/queries/user';

@ApplyOptions<Command.Options>({
	name: 'sacar',
	aliases: ['withdraw']
})
export class WithdrawCommand extends Command {
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

		let withdrawAmount: number | undefined;

		if (amount === 'tudo') {
			const userBalances = await UserQueries.getUserBalances({
				userId: message.author.id,
				guildId: message.guildId
			});

			withdrawAmount = userBalances.balance;
		} else {
			withdrawAmount = numberAmount;
		}
		const { updatedBalance, updatedBankBalance } = await UserQueries.updateBalance({
			userId: message.author.id,
			guildId: message.guildId,
			balance: ['decrement', withdrawAmount],
			bankBalance: ['increment', withdrawAmount]
		});

		await message.reply({
			content: `Você sacou ${numberAmount} moedas! Seu saldo agora é ${updatedBalance} e seu saldo no banco é ${updatedBankBalance}.`
		});
	}
}
