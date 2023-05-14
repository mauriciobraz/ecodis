import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { EmbedBuilder } from 'discord.js';

import { UserQueries } from '../../../utils/queries/user';

const TOP_USERS_COUNT = 15;

@ApplyOptions<Command.Options>({
	name: 'top',
	aliases: ['topbalance', 'topbal'],
	description: `Mostra os ${TOP_USERS_COUNT} usuários com maior saldo do servidor.`,
	preconditions: ['GuildOnly']
})
export class TopBalanceCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const topUsers = await UserQueries.getTopUsersByField(
			message.guildId,
			TOP_USERS_COUNT,
			'balance'
		);

		if (topUsers.length === 0) {
			await message.reply({
				content: 'Nenhum usuário encontrado.'
			});
			return;
		}

		const topBalanceEmbed = new EmbedBuilder()
			.setTitle(`Top ${TOP_USERS_COUNT} usuários com mais dinheiro`)
			.setDescription(
				topUsers
					.map(
						(user, index) =>
							`**#${index + 1}** <@${user.userId}>: ${user.value.toFixed(2)}`
					)
					.join('\n')
			)
			.setColor(0x2b2d31);

		await message.reply({
			embeds: [topBalanceEmbed]
		});
	}
}
