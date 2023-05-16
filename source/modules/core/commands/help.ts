import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { Colors, EmbedBuilder } from 'discord.js';

import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'help',
	description: 'Mostra todos os comandos disponíveis.'
})
export class HelpCommand extends Command {
	public override async messageRun(message: Message) {
		const commands = this.container.stores.get('commands').filter((cmd) => cmd.enabled);
		const sortedCommands = commands.sort((a, b) => a.name.localeCompare(b.name));

		const embed = new EmbedBuilder()
			.setColor(Colors.Blurple)
			.setTitle('Comandos disponíveis (ALPHA)')
			.setDescription(
				sortedCommands
					.map(
						(cmd) =>
							`**${cmd.name}** - ${cmd.description || 'Sem descrição disponível.'}`
					)
					.join('\n')
			);

		await message.reply({
			embeds: [embed]
		});
	}
}
