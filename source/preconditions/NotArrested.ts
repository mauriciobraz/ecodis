import { ApplyOptions } from '@sapphire/decorators';
import { Precondition } from '@sapphire/framework';
import { time } from 'discord.js';

import type { PreconditionResult } from '@sapphire/framework';
import type { CommandInteraction, ContextMenuCommandInteraction, Message } from 'discord.js';
import { addMilliseconds } from 'date-fns';

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
		const guild = await this.container.database.guild.upsert({
			where: { discordId: guildId },
			create: { discordId: guildId },
			update: {},
			select: { id: true }
		});

		const user = await this.container.database.user.upsert({
			where: { discordId: userId },
			create: { discordId: userId },
			update: {},
			select: { id: true }
		});

		const isArrested = await this.container.database.userPrison.findUnique({
			where: {
				userId_guildId: {
					guildId: guild.id,
					userId: user.id
				}
			}
		});

		console.log({
			isArrested,
			all: await this.container.database.userPrison.findMany(),
			userId_guildId: {
				guildId: guild.id,
				userId: user.id
			}
		});

		if (isArrested) {
			const remainingTime = isArrested.createdAt.getTime() + 86400000 - Date.now();

			return this.error({
				identifier: 'NotArrested',
				message: `Você está preso(a) e não pode usar este comando. Você será solto(a) ${time(
					addMilliseconds(new Date(), remainingTime),
					'R'
				)}.`
			});
		}

		return this.ok();
	}
}
