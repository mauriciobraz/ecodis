import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'inventory',
	aliases: ['inv'],
	description: 'Displays your inventory.',
	preconditions: ['GuildOnly', 'NotArrested']
})
export class InventoryCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const user = await this.container.database.user.upsert({
			where: {
				discordId: message.author.id
			},
			create: {
				discordId: message.author.id,
				inventory: {
					create: {}
				}
			},
			update: {},
			include: {
				inventory: {
					include: {
						items: {
							include: {
								item: true
							}
						}
					}
				}
			}
		});

		console.log({
			user
		});

		await message.reply({
			content: `Your inventory:\n${user.inventory?.items
				.map((item) => `- ${item.item.name} x${item.amount}`)
				.join('\n')}`
		});
	}
}
