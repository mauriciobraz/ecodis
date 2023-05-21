import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { EmbedBuilder, time, type Message } from 'discord.js';
import dedent from 'ts-dedent';

import { CONFIG } from '../../../utils/constants/config';

@ApplyOptions<Command.Options>({
	name: 'energia',
	aliases: ['energy'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class EnergyCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const guildDatabase = await this.container.database.guild.upsert({
			where: { discordId: message.guildId },
			create: { discordId: message.guildId },
			update: {},
			select: {
				id: true
			}
		});

		const userDatabase = await this.container.database.user.upsert({
			where: { discordId: message.author.id },
			create: { discordId: message.author.id },
			update: {},
			select: {
				id: true
			}
		});

		const oldUserGuildData = await this.container.database.userGuildData.upsert({
			where: {
				userId_guildId: {
					guildId: guildDatabase.id,
					userId: userDatabase.id
				}
			},
			create: {
				guildId: guildDatabase.id,
				userId: userDatabase.id
			},
			update: {},
			select: {
				id: true
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

		const maxEnergy = 1000;
		const progressBarLength = 21;
		const energyRatio = energy / maxEnergy;

		const filledBlocks = Math.floor(energyRatio * progressBarLength);
		const emptyBlocks = progressBarLength - filledBlocks;

		const progressBar = '🟩'.repeat(filledBlocks) + '⬛'.repeat(emptyBlocks);

		await message.reply({
			embeds: [
				new EmbedBuilder()
					.setTitle(`Energia de ${message.author.tag}`)
					.setDescription(
						dedent`
							🕐 Faltam ${time(nextUpdateIn, 'R')} para recarregar sua energia.
						`
					)
					.setColor(0x2b2d31)
					.setFooter({
						text: `${(energyRatio * 100).toFixed(0)}% | ${progressBar}`
					})
			]
		});
	}
}
