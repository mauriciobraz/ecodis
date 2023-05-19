import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { time, type Message } from 'discord.js';

import { DiscordJSUtils } from '../../../utils/discordjs';
import { UserQueries } from '../../../utils/queries/user';

@ApplyOptions<Command.Options>({
	name: 'work',
	description: 'Trabalhe para ganhar dinheiro.',

	detailedDescription:
		'O comando de trabalho permite que você trabalhe para ganhar dinheiro. Você pode executar este comando uma vez a cada período definido (como a cada hora, dependendo do sistema de seu servidor) para receber uma quantidade fixa ou aleatória de dinheiro. Alguns sistemas também podem ter diferentes "trabalhos" que você pode fazer, cada um com diferentes pagamentos ou requisitos.',

	aliases: ['trabalhar', 'emprego', 'job'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class WorkCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const user = await UserQueries.getOrCreate(message.author.id);

		const guild = await this.container.database.guild.upsert({
			where: { discordId: message.guildId },
			create: { discordId: message.guildId },
			update: {},
			select: { id: true }
		});

		const userGuildData = await this.container.database.userGuildData.findUnique({
			where: {
				userId_guildId: {
					userId: user.id,
					guildId: guild.id
				}
			},
			select: {
				job: {
					select: {
						cooldown: true
					}
				},
				workedAt: true
			}
		});

		if (!userGuildData?.job) {
			return DiscordJSUtils.replyAndDelete(
				message,
				'Para trabalhar, você precisa de um emprego.',
				5
			);
		}

		const now = new Date();

		if (userGuildData.workedAt) {
			const workedAt = new Date(userGuildData.workedAt);
			const diffMs = now.getTime() - workedAt.getTime();
			const diffMins = Math.floor(diffMs / 60000);

			const cooldownMs = userGuildData.job.cooldown * 60000;
			const cooldownMins = Math.floor(cooldownMs / 60000);

			if (diffMins < cooldownMins) {
				const futureTime = new Date(now.getTime() + (cooldownMins - diffMins) * 60000);

				return DiscordJSUtils.replyAndDelete(
					message,
					`Você já trabalhou recentemente. Tente novamente ${time(futureTime, 'R')}.`,
					30
				);
			}
		}

		await this.container.database.userGuildData.upsert({
			where: {
				userId_guildId: {
					userId: user.id,
					guildId: guild.id
				}
			},
			update: {
				workedAt: now
			},
			create: {
				userId: message.author.id,
				guildId: message.guild.id,
				workedAt: now
			}
		});

		return DiscordJSUtils.replyAndDelete(message, 'Você trabalhou com sucesso!', 30);
	}
}
