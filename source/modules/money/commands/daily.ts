import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { Time } from '@sapphire/time-utilities';
import { time, type Message } from 'discord.js';

import { CONFIG } from '../../../utils/constants/config';
import { UserQueries } from '../../../utils/queries/user';

const DAILY_TIMEOUT = Time.Day;

@ApplyOptions<Command.Options>({
	name: 'diário',
	description: 'Reivindique seu dinheiro diário.',

	aliases: ['diario', 'daily', 'bonus', 'daily-bonus'],
	generateDashLessAliases: true,
	generateUnderscoreLessAliases: true,

	preconditions: ['GuildOnly', 'NotArrested']
})
export class DailyCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const alreadyClaimed = await UserQueries.getLastDaily(message.author.id, message.guildId);

		if (alreadyClaimed && alreadyClaimed.getTime() + DAILY_TIMEOUT > Date.now()) {
			await message.reply({
				content: `Você já coletou seu dinheiro diário. Tente novamente em ${time(
					alreadyClaimed
				)}.`
			});

			return;
		}

		await UserQueries.updateLastDaily(message.author.id, message.guildId);

		await UserQueries.updateBalance({
			userId: message.author.id,
			guildId: message.guildId,
			balance: ['increment', CONFIG.DAILY_AMOUNT]
		});

		await message.reply({
			content: `Você coletou seu dinheiro diário de ${CONFIG.DAILY_AMOUNT} moedas.`
		});
	}
}
