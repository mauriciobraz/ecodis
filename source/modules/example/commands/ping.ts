import { Command, type ChatInputCommand } from '@sapphire/framework';

export class PingCommand extends Command {
	public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder.setName('ping').setDescription("Check the bot's ping.")
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const message = await interaction.reply({
			content: 'Ping?',
			ephemeral: true,
			fetchReply: true
		});

		const diff = message.createdTimestamp - interaction.createdTimestamp;
		const ping = Math.round(this.container.client.ws.ping);

		await interaction.editReply({
			content: `Pong 🏓! (Round trip took: ${diff}ms. Heartbeat: ${ping}ms.)`
		});
	}
}
