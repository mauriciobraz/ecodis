import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { EmbedBuilder, type Message } from 'discord.js';

const TOP_USERS_COUNT = 15;

@ApplyOptions<Command.Options>({
	name: 'top',
	aliases: ['topbalance', 'topbal'],
	description: `Mostra os ${TOP_USERS_COUNT} usuário com maior saldo do servidor.`,
	preconditions: ['GuildOnly']
})
export class TopBalanceCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const topUsers = await this.container.database.user.findMany({
			where: {
				balance: {
					gt: 0
				}
			},
			orderBy: {
				balance: 'desc'
			},
			take: TOP_USERS_COUNT
		});

		if (topUsers.length === 0) {
			await message.reply({
				content: 'Nenhum usuário encontrado.'
			});

			return;
		}

		const topBalanceEmbed = new EmbedBuilder()
			.setTitle(`Top ${TOP_USERS_COUNT} Users with the Highest Balance`)
			.setDescription(
				topUsers
					.map(
						(user, index) =>
							`**#${index + 1}** <@${user.discordId}>: ${user.balance.toFixed(2)}`
					)
					.join('\n')
			)
			.setColor(0x2b2d31);

		await message.reply({
			embeds: [topBalanceEmbed]
		});
	}
}
