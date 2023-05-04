import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'add-editor',
	preconditions: ['GuildOnly'],
	requiredUserPermissions: ['Administrator']
})
export class AddEditorCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const user = await args.pick('user');

		const isAlreadyEditor =
			(await this.container.database.guild.count({
				where: {
					discordId: message.guild.id,
					editors: { some: { discordId: user.id } }
				}
			})) > 0;

		if (isAlreadyEditor) {
			await message.reply({
				content:
					'Esse usuário já é um editor. Caso você queira remover ele, use o comando `remove-editor`.'
			});

			return;
		}

		const userDb = await this.container.database.user.upsert({
			where: { discordId: user.id },
			create: { discordId: user.id },
			update: {},
			select: {
				id: true
			}
		});

		await this.container.database.guild.upsert({
			where: {
				discordId: message.guild.id
			},
			create: {
				discordId: message.guild.id,
				editors: { connect: { id: userDb.id } }
			},
			update: { editors: { connect: { id: userDb.id } } }
		});

		await message.reply({
			content: 'O usuário foi adicionado na lista de editores.'
		});
	}
}
