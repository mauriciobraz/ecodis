import { ApplyOptions } from '@sapphire/decorators';
import { Precondition } from '@sapphire/framework';

import type { PreconditionResult } from '@sapphire/framework';
import type { CommandInteraction, ContextMenuCommandInteraction, Message } from 'discord.js';

@ApplyOptions<Precondition.Options>({
	name: 'NotArrested'
})
export class NotArrestedPrecondition extends Precondition {
	public override messageRun(message: Message): PreconditionResult {
		return this.handleNotArrested(message.author.id, message.guildId!);
	}

	public override chatInputRun(interaction: CommandInteraction): PreconditionResult {
		return this.handleNotArrested(interaction.user.id, interaction.guildId!);
	}

	public override contextMenuRun(interaction: ContextMenuCommandInteraction): PreconditionResult {
		return this.handleNotArrested(interaction.user.id, interaction.guildId!);
	}

	private async handleNotArrested(userId: string, guildId: string) {
		const user = await this.container.database.user.findUnique({
			where: {
				discordId: userId
			},
			select: {
				guildPrisoners: {
					where: {
						guild: {
							discordId: guildId
						},
						releasedAt: {
							not: null
						}
					},
					// We order by createdAt in descending order so we can get the latest
					// prison this user is in, and then we take only one.
					orderBy: { createdAt: 'desc' },
					take: 1
				}
			}
		});

		const isArrested = user?.guildPrisoners.length;

		if (isArrested) {
			return this.error({
				identifier: 'NotArrested',
				message: 'Estás preso(a) e não podes usar este comando.'
			});
		}

		return this.ok();
	}
}
