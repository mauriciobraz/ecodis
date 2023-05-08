import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { Time } from '@sapphire/time-utilities';
import { time, type Message } from 'discord.js';

import { CONFIG } from '../../../utils/constants/config';

const DAILY_TIMEOUT = Time.Day;

@ApplyOptions<Command.Options>({
	name: 'daily',
	description: 'Claim your daily money',
	preconditions: ['GuildOnly']
})
export class DailyCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const alreadyClaimed = await this.container.database.user.findUnique({
			where: {
				discordId: message.author.id
			},
			select: {
				lastDaily: true
			}
		});

		if (
			alreadyClaimed?.lastDaily &&
			alreadyClaimed.lastDaily.getTime() + DAILY_TIMEOUT > Date.now()
		) {
			await message.reply({
				content: `Você já coletou seu dinheiro diário. Tente novamente em ${time(
					alreadyClaimed.lastDaily
				)}.`
			});

			return;
		}

		await this.container.database.user.update({
			where: {
				discordId: message.author.id
			},
			data: {
				lastDaily: new Date(),
				balance: {
					increment: CONFIG.DAILY_AMOUNT
				}
			}
		});

		await message.reply({
			content: `Você coletou seu dinheiro diário de ${CONFIG.DAILY_AMOUNT} moedas.`
		});
	}
}
