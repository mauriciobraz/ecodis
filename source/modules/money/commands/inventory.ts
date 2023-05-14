import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';

import { ShopQueries } from '../../../utils/queries/shop';

import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'inventory',
	aliases: ['inv'],
	description: 'Displays your inventory.',
	preconditions: ['GuildOnly', 'NotArrested']
})
export class InventoryCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const userId = message.author.id;
		const { guildId } = message;

		const userInventory = await ShopQueries.getInventory(userId, guildId);

		if (!userInventory || userInventory.items.length === 0) {
			await message.reply({
				content: 'Seu inventário está vazio! Compre algum item com o comando `!loja`!'
			});
			return;
		}

		const inventoryEmbed = new EmbedBuilder()
			.setTitle(`Inventário de ${message.author.tag}`)
			.setDescription(
				userInventory.items
					.map(({ amount, emoji, name }) => `• ${emoji} ${name} **x${amount}**`)
					.join('\n')
			);

		await message.reply({
			embeds: [inventoryEmbed]
		});
	}
}
