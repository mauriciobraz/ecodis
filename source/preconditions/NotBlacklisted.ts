import { ApplyOptions } from '@sapphire/decorators';
import { Precondition, type PreconditionResult } from '@sapphire/framework';
import type { CommandInteraction, ContextMenuCommandInteraction, Message } from 'discord.js';

@ApplyOptions<Precondition.Options>({
	name: 'NotBlacklisted',
	position: 1
})
export class NotBlacklistedPrecondition extends Precondition {
	public override messageRun(message: Message): PreconditionResult {
		return this.handleNotBlacklisted(message.content.split(' ')[0].slice(1), message.guildId!);
	}

	public override chatInputRun(interaction: CommandInteraction): PreconditionResult {
		return this.handleNotBlacklisted(interaction.commandName, interaction.guildId!);
	}

	public override contextMenuRun(interaction: ContextMenuCommandInteraction): PreconditionResult {
		return this.handleNotBlacklisted(interaction.commandName, interaction.guildId!);
	}

	private async handleNotBlacklisted(command: string, guildId: string) {
		const guild = await this.container.database.guild.findUnique({
			where: {
				discordId: guildId
			},
			select: {
				blacklistedCommands: true
			}
		});

		if (guild?.blacklistedCommands.some((c) => c === command)) {
			return this.error({
				message: 'Este comando está desativado neste servidor.',
				context: {
					silent: true
				}
			});
		}

		return this.ok();
	}
}
