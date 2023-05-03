import { Command, type ChatInputCommand } from '@sapphire/framework';

export class DiceCommand extends Command {
	public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder.setName('dice').setDescription('Rolls a dice')
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const number = Math.floor(Math.random() * 6) + 1;
		await interaction.reply(`🎲 ${number}`);
	}
}
