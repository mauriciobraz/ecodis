import { ApplyOptions } from '@sapphire/decorators';
import type { Args } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'rem-editor',
	description: 'Remove um usuário da lista de editores deste servidor.',
	preconditions: ['GuildOnly'],
	requiredUserPermissions: [PermissionFlagsBits.Administrator]
})
export class AddEditorCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const user = await args.pick('user');

		const isNotEditor =
			(await this.container.database.guild.count({
				where: {
					discordId: message.guild.id,
					editors: {
						some: {
							discordId: user.id
						}
					}
				}
			})) === 0;

		if (isNotEditor) {
			await message.reply({
				content:
					'Esse usuário não é um editor. Caso você queira adicionar ele, use o comando `add-editor`'
			});

			return;
		}

		await this.container.database.user.upsert({
			where: {
				discordId: user.id
			},
			create: {
				discordId: user.id
			},
			update: {
				guildsEditors: {
					disconnect: {
						discordId: message.guild.id
					}
				}
			},
			select: {
				id: true
			}
		});

		await message.reply({
			content: 'O usuário foi removido da lista de editores.'
		});
	}
}
