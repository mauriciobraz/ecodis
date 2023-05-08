import { ApplyOptions } from '@sapphire/decorators';
import { Command, container } from '@sapphire/framework';

import type { Args } from '@sapphire/framework';
import { EmbedBuilder, type Message } from 'discord.js';
import dedent from 'ts-dedent';

@ApplyOptions<Command.Options>({
	name: 'saldo',
	aliases: ['balance']
})
export class BalanceCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const userResult = await args.pick('user').catch(() => message.author);

		const user = await this.container.database.user.findUnique({
			where: {
				discordId: userResult.id
			},
			select: {
				balance: true,
				diamonds: true,
				dirtyBalance: true
			}
		});

		const transactionResult = await container.database.transaction.aggregate({
			where: { user: { discordId: userResult.id } },
			_sum: { amount: true }
		});

		const embed = new EmbedBuilder()
			.setColor('Blurple')
			.setAuthor({
				name: userResult.tag,
				iconURL: userResult.displayAvatarURL()
			})
			.setDescription(
				dedent`
					💵 | Carteira: $${user?.balance ?? 0}
					🏦 | Banco: $${transactionResult._sum.amount ?? 0}
					💰 | Dinheiro sujo: $${user?.dirtyBalance ?? 0}
					💠 | Diamantes: ${user?.diamonds}
					🏅 | ~~Rank: **NO RANK**~~
				`
			);

		await message.reply({
			embeds: [embed]
		});
	}
}
