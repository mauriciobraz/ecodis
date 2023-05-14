import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { EmbedBuilder } from 'discord.js';

import { UserQueries } from '../../../utils/queries/user';

const TOP_USERS_COUNT = 15;

@ApplyOptions<Command.Options>({
	name: 'top-diamonds',
	aliases: ['topd'],
	description: 'Displays the top 15 users with the most diamonds globally.',
	preconditions: ['GuildOnly']
})
export class TopDiamondsCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const topUsers = await UserQueries.getTopUsersByField(
			null, // No need to specify guildId for global ranking
			TOP_USERS_COUNT,
			'diamonds'
		);

		if (topUsers.length === 0) {
			await message.reply({
				content: 'Nenhum usuário encontrado.'
			});
			return;
		}

		const topDiamondsEmbed = new EmbedBuilder()
			.setTitle(`Top ${TOP_USERS_COUNT} usuários com mais diamantes`)
			.setDescription(
				topUsers
					.map((user, index) => `**#${index + 1}** <@${user.userId}>: ${user.value}`)
					.join('\n')
			)
			.setColor(0x2b2d31);

		await message.reply({
			embeds: [topDiamondsEmbed]
		});
	}
}
