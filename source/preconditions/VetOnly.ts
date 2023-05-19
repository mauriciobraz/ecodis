import { JobType } from '@prisma/client';
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
	name: 'VetOnly'
})
export class VetOnlyPrecondition extends Precondition {
	public override async messageRun(message: Message<true>) {
		return this.isVet(message.author, message.guild);
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

		return this.isVet(interaction.user, guild);
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

		return this.isVet(interaction.user, guild);
	}

	private async isVet(discordUser: User, discordGuild: Guild) {
		const user = await this.container.database.user.findUnique({
			where: { discordId: discordUser.id }
		});

		const guild = await this.container.database.guild.findUnique({
			where: { discordId: discordGuild.id }
		});

		// If the user or guild doesn't exist, it means that the user is not a vet.
		if (!user || !guild) {
			return this.ok();
		}

		const userGuildData = await this.container.database.userGuildData.findUnique({
			where: {
				userId_guildId: {
					guildId: guild.id,
					userId: user.id
				}
			},
			select: {
				job: {
					select: {
						type: true
					}
				}
			}
		});

		return userGuildData?.job?.type === JobType.Vet
			? this.ok()
			: this.error({
					identifier: 'VetOnly',
					message: 'Apenas doutores podem usar este comando.'
			  });
	}
}
