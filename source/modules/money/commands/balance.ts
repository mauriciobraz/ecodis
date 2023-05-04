import { ApplyOptions } from '@sapphire/decorators';
import { Command, container } from '@sapphire/framework';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

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

		await message.reply({
			content: `O usuário ${userResult} tem ${user?.balance} moedas, ${user?.diamonds} diamantes, ${user?.dirtyBalance} moedas sujas e ${transactionResult._sum.amount} moedas no banco.`
		});
	}
}
