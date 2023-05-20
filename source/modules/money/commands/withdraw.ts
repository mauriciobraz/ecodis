import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

import { UserQueries } from '../../../utils/queries/user';

@ApplyOptions<Command.Options>({
	name: 'sacar',
	description: 'Saque dinheiro da sua conta.',

	aliases: ['withdraw', 'wd', 'retirar'],
	preconditions: ['GuildOnly', 'NotArrested']
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

		const { balanceInBank, balance } = await UserQueries.getUserBalances({
			userId: message.author.id,
			guildId: message.guildId
		});

		const withdrawAmount = ['tudo', 'all'].includes(amount) ? balance : numberAmount;

		if (
			amount !== 'tudo' &&
			(balanceInBank === 0 || balanceInBank < numberAmount) &&
			balance < numberAmount
		) {
			await message.reply({
				content: 'Você não tem moedas suficientes para sacar.'
			});

			return;
		}

		const { updatedBalance, updatedBankBalance } = await UserQueries.updateBalance({
			userId: message.author.id,
			guildId: message.guildId,
			balance: ['increment', withdrawAmount],
			bankBalance: ['decrement', withdrawAmount]
		});

		await message.reply({
			content: `Você sacou ${
				typeof numberAmount === 'number' ? numberAmount : 'todas'
			} moedas! Seu saldo agora é ${updatedBalance} e seu saldo no banco é ${updatedBankBalance}.`
		});
	}
}
