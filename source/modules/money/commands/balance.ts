import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import dedent from 'ts-dedent';

import { UserQueries } from '../../../utils/queries/user';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'saldo',
	aliases: ['balance']
})
export class BalanceCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const userResult = await args.pick('user').catch(() => message.author);

		const userBalances = await UserQueries.getUserBalances({
			userId: userResult.id,
			guildId: message.guildId
		});

		const embed = new EmbedBuilder()
			.setColor('Blurple')
			.setAuthor({
				name: userResult.tag,
				iconURL: userResult.displayAvatarURL()
			})
			.setDescription(
				dedent`
					💵 | Carteira: $${userBalances.balance}
					🏦 | Banco: $${userBalances.balanceInBank}
					💰 | Dinheiro sujo: $${userBalances.dirtyBalance}
					💠 | Diamantes: ${userBalances.diamonds}
					🏅 | ~~Rank: **NO RANK**~~
				`
			);

		await message.reply({
			embeds: [embed]
		});
	}
}
