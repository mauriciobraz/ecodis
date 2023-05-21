import { ApplyOptions } from '@sapphire/decorators';
import type { Args } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'revistar',
	description: 'Reviste um usuário para verificar a presença de itens ilegais.',

	detailedDescription:
		'O comando revistar permite que você verifique o inventário de outro usuário em busca de itens ilegais. É uma ferramenta útil para aplicação da lei e moderação do servidor.',

	aliases: ['revistar-inventario', 'revistar-inventário', 'revistar-inventory'],
	preconditions: ['GuildOnly']
})
export class RevistarCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const userResult = await args.pickResult('user');

		if (userResult.isErr()) {
			await message.reply({
				content: 'Por favor, mencione um usuário para revistar.'
			});

			return;
		}

		const user = userResult.unwrap();

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
				content: `${user.username} não possui um inventário para ser revistado.`
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
				content: `${user.username} não possui itens ilegais em seu inventário.`
			});
			return;
		}

		const itemNames = illegalItems.map((item) => item.id);

		await message.reply(
			`${
				user.username
			} possui os seguintes itens ilegais em seu inventário: **${itemNames.join(', ')}**.`
		);
	}
}
