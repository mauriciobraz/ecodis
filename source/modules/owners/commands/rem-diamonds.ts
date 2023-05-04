import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'rem-diamantes',
	aliases: ['rem-diamonds'],
	preconditions: ['OnlyOwners']
})
export class RemDiamondsCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const user = await args.pick('user');
		const amount = await args.pick('number');

		const { diamonds } = await this.container.database.user.upsert({
			where: {
				discordId: user.id
			},
			create: {
				discordId: user.id,
				diamonds: amount
			},
			update: {
				diamonds: {
					decrement: amount
				}
			},
			select: {
				diamonds: true
			}
		});

		await message.reply({
			content: `O usuário ${user} agora tem ${diamonds} diamantes após a remoção de ${amount}.`
		});
	}
}
