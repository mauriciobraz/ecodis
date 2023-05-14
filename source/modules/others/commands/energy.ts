import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { time } from 'discord.js';
import dedent from 'ts-dedent';

import { CONFIG } from '../../../utils/constants/config';

@ApplyOptions<Command.Options>({
	name: 'energia',
	aliases: ['energy'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class EnergyCommand extends Command {
	public override async messageRun(message: Message) {
		const userId = message.author.id;
		const guildId = message.guildId!; // Assuming guildId is always available in a guild context

		const {
			userGuildDatas: [oldUserGuildData]
		} = await this.container.database.user.upsert({
			where: { discordId: userId },
			create: { discordId: userId },
			update: {},
			select: {
				userGuildDatas: {
					where: {
						guild: {
							discordId: guildId
						}
					},
					select: {
						id: true
					}
				}
			}
		});

		const userGuildData = await this.container.database.userGuildData.findUnique({
			where: {
				id: oldUserGuildData.id
			},
			select: {
				energy: true,
				energyUpdatedAt: true
			}
		});

		const { energy, energyUpdatedAt } = userGuildData || { energy: 0, energyUpdatedAt: null };

		const nextUpdateIn = new Date(
			(energyUpdatedAt ?? new Date()).getTime() + CONFIG.ENERGY_RESET_TIME
		);

		await message.reply({
			content: dedent`
				Energia: ${energy}/${CONFIG.MAX_ENERGY}
				Faltam ${time(nextUpdateIn)} para recarregar sua energia.
			`
		});
	}
}
