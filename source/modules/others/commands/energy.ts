import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { time, type Message } from 'discord.js';
import dedent from 'ts-dedent';

import { CONFIG } from '../../../utils/constants/config';

@ApplyOptions<Command.Options>({
	name: 'energia',
	aliases: ['energy'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class EnergyCommand extends Command {
	public override async messageRun(message: Message) {
		const userRecord = await this.container.database.user.upsert({
			where: { discordId: message.author.id },
			create: { discordId: message.author.id },
			select: { energy: true, energyUpdatedAt: true },
			update: {}
		});

		const nextUpdateIn = new Date(
			(userRecord.energyUpdatedAt ?? new Date()).getTime() + CONFIG.ENERGY_RESET_TIME
		);

		await message.reply({
			content: dedent`
				Energia: ${userRecord.energy}/${CONFIG.MAX_ENERGY}
				Faltam ${time(nextUpdateIn)} para recarregar sua energia.
			`
		});
	}
}
