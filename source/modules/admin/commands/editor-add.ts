import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'add-editor',
	description: 'Adiciona um usuário na lista de editores deste servidor.',

	aliases: ['add-edit', 'add-editors', 'add-editores', 'add-editora', 'add-editoras'],
	generateDashLessAliases: true,
	generateUnderscoreLessAliases: true,

	preconditions: ['GuildOnly'],
	requiredUserPermissions: [PermissionFlagsBits.Administrator]
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
					'O usuário selecionado já é um editor neste servidor. Talvez você queira remover ele, use o comando `remove-editor`.'
			});

			return;
		}

		const userDb = await this.container.database.user.upsert({
			where: { discordId: user.id },
			create: {
				discordId: user.id,
				userGuildDatas: {
					create: {
						guild: {
							connectOrCreate: {
								where: { discordId: message.guildId },
								create: { discordId: message.guildId }
							}
						},
						inventory: {
							create: {}
						}
					}
				}
			},
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
			content:
				'O usuário foi adicionado na lista de editores deste servidor. Para remover, use o comando `remove-editor`.'
		});
	}
}
