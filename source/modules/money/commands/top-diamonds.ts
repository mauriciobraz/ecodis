import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { EmbedBuilder, type Message } from 'discord.js';

const TOP_USERS_COUNT = 15;

@ApplyOptions<Command.Options>({
	name: 'top-diamonds',
	aliases: ['topd'],
	description: 'Displays the top 15 users with the most diamonds globally.',
	preconditions: ['GuildOnly']
})
export class TopDiamondsCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const topUsers = await this.container.database.user.findMany({
			orderBy: {
				diamonds: 'desc'
			},
			take: TOP_USERS_COUNT
		});

		if (topUsers.length === 0) {
			await message.reply({
				content: 'Nenhum usuário encontrado.'
			});

			return;
		}

		const topDiamondsEmbed = new EmbedBuilder()
			.setTitle(`Top ${TOP_USERS_COUNT} Users with the Most Diamonds`)
			.setDescription(
				topUsers
					.map((user, index) => `#${index + 1} - <@${user.discordId}>: ${user.diamonds}`)
					.join('\n')
			)
			.setColor(0x2b2d31);

		await message.reply({
			embeds: [topDiamondsEmbed]
		});
	}
}
