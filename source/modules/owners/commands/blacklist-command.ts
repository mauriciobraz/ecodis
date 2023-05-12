import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'blacklist-c',
	aliases: ['blacklist-command', 'bloquear-comando', 'desbloquear-comando'],
	preconditions: ['OnlyOwners', 'GuildOnly']
})
export class BlacklistCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		// const isAll = args.getFlags('all');
		const guildId = await args.pick('string');

		// const commandKeys = Array.from(this.container.stores.get('commands').keys());

		// console.log({
		// 	isAll,
		// 	commandKeys
		// });

		// await this.container.database.guild.upsert({
		// 	where: {
		// 		discordId: guildId
		// 	},
		// 	create: {
		// 		discordId: guildId,
		// 		blacklistedCommands: isAll ? commandKeys : []
		// 	},
		// 	update: {
		// 		blacklistedCommands: isAll ? commandKeys : []
		// 	}
		// });

		// if (isAll) {
		// 	await message.reply({
		// 		content: 'Todos os comandos foram adicionados à blacklist deste servidor.'
		// 	});

		// 	return;
		// }

		const guild = await this.container.database.guild.findUnique({
			where: {
				discordId: guildId
			},
			select: {
				blacklistedCommands: true
			}
		});

		const selectMenuCommands = new StringSelectMenuBuilder()
			.setPlaceholder('Selecione um comando')
			.setCustomId(`blacklist:command:${guildId}`)
			.addOptions(
				this.container.stores
					.get('commands')
					.sort((a) =>
						guild?.blacklistedCommands.some(
							(blacklistedCommand) => blacklistedCommand === a.name
						)
							? -1
							: 1
					)
					.map((command) => ({
						label: command.name,
						value: `${command.name}:${
							guild?.blacklistedCommands.some(
								(blacklistedCommand) => blacklistedCommand === command.name
							)
								? 'remove'
								: 'add'
						}`,
						description: guild?.blacklistedCommands.some(
							(blacklistedCommand) => blacklistedCommand === command.name
						)
							? '🚫 Clique aqui para desbloqueá-lo'
							: '🔒 Clique aqui para bloqueá-lo'
					}))
			);

		const selectMenuRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			selectMenuCommands
		);

		await message.reply({
			components: [selectMenuRow]
		});
	}
}
