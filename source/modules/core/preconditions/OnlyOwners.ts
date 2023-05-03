import { ApplyOptions } from '@sapphire/decorators';
import { Precondition } from '@sapphire/framework';
import type { CommandInteraction, ContextMenuCommandInteraction, Message } from 'discord.js';

import { CONFIG } from '../../../utils/constants/config';

@ApplyOptions<Precondition.Options>({
	name: 'OnlyOwners',
	position: 0
})
export class OnlyOwnersPrecondition extends Precondition {
	public override messageRun(message: Message) {
		return this.doCheckOwners(message.author.id);
	}

	public override chatInputRun(interaction: CommandInteraction) {
		return this.doCheckOwners(interaction.user.id);
	}

	public override contextMenuRun(interaction: ContextMenuCommandInteraction) {
		return this.doCheckOwners(interaction.user.id);
	}

	private doCheckOwners(userId: string) {
		return CONFIG.OWNERS?.includes(userId)
			? this.ok()
			: this.error({
					identifier: 'OnlyOwners',
					message: 'Apenas os donos do bot podem usar esse comando.'
			  });
	}
}
