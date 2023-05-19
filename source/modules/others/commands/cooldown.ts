import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { EmbedBuilder, time, type Message } from 'discord.js';
import { DiscordJSUtils } from '../../../utils/discordjs';
import { addMilliseconds, addSeconds } from 'date-fns';
import { CRIME_COOLDOWN, ROBBERY_COOLDOWN } from '../../../utils/constants';
import dedent from 'ts-dedent';

@ApplyOptions<Command.Options>({
	name: 'cooldown',
	description: 'Mostra o tempo de espera restante em outras funcionalidades do bot.',

	aliases: ['cd'],
	preconditions: ['GuildOnly']
})
export class CooldownCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const user = await this.container.database.user.upsert({
			where: { discordId: message.author.id },
			create: { discordId: message.author.id },
			update: {}
		});

		const guild = await this.container.database.guild.upsert({
			where: { discordId: message.guild.id },
			create: { discordId: message.guild.id },
			update: {}
		});

		const userGuildData = await this.container.database.userGuildData.findUnique({
			where: {
				userId_guildId: {
					guildId: guild.id,
					userId: user.id
				}
			},
			include: {
				job: true
			}
		});

		const workCooldownDate = addSeconds(
			userGuildData?.workedAt ?? new Date(),
			userGuildData?.job?.cooldown ?? 0
		);

		const workCooldown =
			workCooldownDate > new Date() ? time(workCooldownDate, 'R') : 'Pronto para uso.';

		const crimeCooldownDate = userGuildData?.committedCrimeAt
			? addMilliseconds(userGuildData?.committedCrimeAt, CRIME_COOLDOWN)
			: -1;

		const crimeCooldown =
			crimeCooldownDate > new Date() && crimeCooldownDate !== -1
				? time(crimeCooldownDate, 'R')
				: 'Pronto para uso.';

		const robberyCooldownDate = userGuildData?.robbedAt
			? addMilliseconds(userGuildData.robbedAt, ROBBERY_COOLDOWN)
			: -1;

		const robberyCooldown =
			robberyCooldownDate > new Date() && robberyCooldownDate !== -1
				? time(robberyCooldownDate, 'R')
				: 'Pronto para uso.';

		const dailyCooldownDate = userGuildData?.lastDaily
			? addSeconds(userGuildData.lastDaily, 86400)
			: -1;

		const dailyCooldown =
			dailyCooldownDate > new Date() && dailyCooldownDate !== -1
				? time(dailyCooldownDate, 'R')
				: 'Pronto para uso.';

		await DiscordJSUtils.replyAndDelete(
			message,
			{
				embeds: [
					new EmbedBuilder()
						.setTitle('Tempos de recarga')
						.setColor(0x2b2d31)
						.setDescription(
							dedent`
								🧑 **Trabalho** ${workCooldown}
								💰 **Diário** ${dailyCooldown}
								🔫 **Crime** ${crimeCooldown}
								🏃 **Roubo** ${robberyCooldown}
							`
						)
				]
			},
			60
		);
	}
}
