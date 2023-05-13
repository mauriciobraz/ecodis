import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'revistar',
	description: 'Revista um usuário em busca de itens ilegais',
	preconditions: ['GuildOnly']
})
export class RevistarCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const user = message.mentions.users.first();
		if (!user) {
			await message.reply({
				content: 'Você precisa mencionar um usuário para revistar.'
			});

			return;
		}

		const targetInventory = await this.container.database.inventory.findUnique({
			where: {
				userId: user.id
			},
			include: {
				items: true
			}
		});

		if (!targetInventory) {
			await message.reply({
				content: 'O usuário não possui um inventário.'
			});

			return;
		}

		const illegalItems = targetInventory.items.filter(
			(item) =>
				item.data &&
				typeof item.data === 'object' &&
				'illegal' in item.data! &&
				item.data?.illegal
		);

		if (illegalItems.length === 0) {
			await message.reply({
				content: 'O usuário não possui itens ilegais.'
			});
			return;
		}

		const itemNames = illegalItems.map((item) => item.id);

		await message.reply(
			`O usuário possui os seguintes itens ilegais: **${itemNames.join(', ')}**.`
		);
	}
}
