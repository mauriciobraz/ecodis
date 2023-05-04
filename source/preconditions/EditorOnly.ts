import { ApplyOptions } from '@sapphire/decorators';
import { Precondition } from '@sapphire/framework';
import type {
	CommandInteraction,
	ContextMenuCommandInteraction,
	Guild,
	Message,
	User
} from 'discord.js';

@ApplyOptions<Precondition.Options>({
	name: 'EditorOnly'
})
export class EditorOnlyPrecondition extends Precondition {
	public override async messageRun(message: Message<true>) {
		return this.isEditor(message.author, message.guild);
	}

	public override async chatInputRun(interaction: CommandInteraction) {
		if (!interaction.guildId) {
			return this.error({
				identifier: 'DeveloperError',
				message: 'This command can only be used in servers.'
			});
		}

		const guild =
			interaction.guild ?? (await this.container.client.guilds.fetch(interaction.guildId));

		return this.isEditor(interaction.user, guild);
	}

	public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
		if (!interaction.guildId) {
			return this.error({
				identifier: 'DeveloperError',
				message: 'This command can only be used in servers.'
			});
		}

		const guild =
			interaction.guild ?? (await this.container.client.guilds.fetch(interaction.guildId));

		return this.isEditor(interaction.user, guild);
	}

	private async isEditor(user: User, guild: Guild) {
		const isEditor = await this.container.database.guild.count({
			where: {
				discordId: guild.id,
				editors: {
					some: {
						discordId: user.id
					}
				}
			}
		});

		return isEditor > 0
			? this.ok()
			: this.error({
					identifier: 'EditorOnly',
					message: 'Apenas editores podem usar este comando.'
			  });
	}
}
