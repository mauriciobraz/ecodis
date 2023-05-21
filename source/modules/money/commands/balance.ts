import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import dedent from 'ts-dedent';

import { UserQueries } from '../../../utils/queries/user';

import type { Args } from '@sapphire/framework';
import type { Message, User } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'saldo',
	description: 'Mostra seu saldo atual.',

	aliases: ['balance', 'bal', 'dinheiro', 'cash'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class BalanceCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const userResult = await args.pickResult('user');
		const user: User = userResult.unwrapOr(message.author);

		const userBalances = await UserQueries.getUserBalances({
			userId: user.id,
			guildId: message.guildId
		});

		const embed = new EmbedBuilder()
			.setColor('Blurple')
			.setAuthor({
				name: user.tag,
				iconURL: user.displayAvatarURL()
			})
			.setDescription(
				dedent`
					💵 **Carteira**: $${userBalances.balance}
					🏦 **Banco**: $${userBalances.balanceInBank}
					💰 **Dinheiro sujo**: $${userBalances.dirtyBalance}
					💠 **Diamantes**: ${userBalances.diamonds}
				`
			);

		await message.reply({
			embeds: [embed]
		});
	}
}
