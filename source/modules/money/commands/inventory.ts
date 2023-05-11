import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { EmbedBuilder, type Message } from 'discord.js';
import { ItemSlug } from '../../../utils/items';

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

		if (!user.inventory?.items.length) {
			await message.reply({
				content: 'Seu inventário está vazio! Compre algum item com o comando `!loja`!'
			});

			return;
		}

		const inventoryEmbed = new EmbedBuilder()
			.setTitle(`Inventário de ${message.author.tag}`)
			.setDescription(
				user.inventory.items
					.map(({ item, amount }) => `• ${item.emoji} ${item.name} **x${amount}**`)
					.join('\n')
			);

		await message.reply({
			embeds: [inventoryEmbed]
		});
	}
}
