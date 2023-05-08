import { ApplyOptions } from '@sapphire/decorators';
import { Precondition, Result } from '@sapphire/framework';

import type { PreconditionResult } from '@sapphire/framework';
import type { CommandInteraction, ContextMenuCommandInteraction, Message } from 'discord.js';

@ApplyOptions<Precondition.Options>({
	name: 'NotArrested'
})
export class NotArrestedPrecondition extends Precondition {
	public override messageRun(message: Message): PreconditionResult {
		return this.handleNotArrested(message.author.id);
	}

	public override chatInputRun(interaction: CommandInteraction): PreconditionResult {
		return this.handleNotArrested(interaction.user.id);
	}

	public override contextMenuRun(interaction: ContextMenuCommandInteraction): PreconditionResult {
		return this.handleNotArrested(interaction.user.id);
	}

	private async handleNotArrested(userId: string) {
		const user = await this.container.database.user.findUnique({
			where: { discordId: userId },
			select: { arrestedAt: true }
		});

		if (user?.arrestedAt !== null) {
			return this.error({
				identifier: 'NotArrested',
				message: 'Você está preso e não pode usar esse comando.'
			});
		}

		return this.ok();
	}
}
