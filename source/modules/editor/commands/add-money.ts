import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'dar-dinheiro',
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

		const { balance } = await this.container.database.user.upsert({
			where: {
				discordId: user.id
			},
			create: {
				balance: amount,
				discordId: user.id
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
			content: `Você adicionou **${amount}** moedas para <@${user.id}>. Agora ele tem **${balance}** moedas.`
		});
	}
}
