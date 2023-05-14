import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { UserQueries } from '../../../utils/queries/user';

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

		const updatedUser = await UserQueries.updateBalance({
			userId: user.id,
			guildId: message.guildId,
			balance: ['increment', amount]
		});

		await message.reply({
			content: `Você adicionou **${amount}** moedas para <@${user.id}>. Agora ele tem **${updatedUser.updatedBalance}** moedas.`
		});
	}
}
