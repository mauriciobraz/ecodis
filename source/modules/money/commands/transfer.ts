import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

import { UserQueries } from '../../../utils/queries/user';

@ApplyOptions<Command.Options>({
	name: 'transferir',
	description: 'Transfira dinheiro para outro usuário.',

	aliases: ['transfer', 'trans', 'enviar', 'pagar'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class TransferCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const recipientResult = await args.pickResult('user');
		const amountResult = await args.pickResult('string');

		if (recipientResult.isErr() || amountResult.isErr()) {
			await message.reply({
				content: 'Você precisa especificar um destinatário e uma quantia para transferir.'
			});
			return;
		}

		const recipient = recipientResult.unwrap();
		const amount = amountResult.unwrap();
		const numberAmount = Number(amount);

		if (!isNaN(numberAmount) && numberAmount < 1) {
			await message.reply({
				content: 'Você não pode transferir menos que 1 moeda!'
			});
			return;
		}

		if (message.author.id === recipient.id) {
			await message.reply({
				content: 'Você não pode transferir moedas para si mesmo!'
			});
			return;
		}

		const transferResult = await UserQueries.transfer({
			amount: numberAmount,
			moneyKind: 'balance',
			guildId: message.guildId,
			senderId: message.author.id,
			recipientId: recipient.id
		});

		if (transferResult.isErr()) {
			await message.reply({
				content: 'Erro ao transferir as moedas.'
			});
			return;
		}

		await message.reply({
			content: `Você transferiu **${amount}** moedas com sucesso para ${recipient}!`
		});
	}
}
