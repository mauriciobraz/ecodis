import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

import { ShopQueries } from '../../../utils/queries/shop';

import type { Message } from 'discord.js';
import { DiscordJSUtils } from '../../../utils/discordjs';

@ApplyOptions<Command.Options>({
	name: 'inventory',
	description: 'Exibe seu inventário.',

	aliases: ['inv', 'inventario', 'itens'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class InventoryCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const userId = message.author.id;
		const { guildId } = message;

		const openInventoryButton = new ButtonBuilder()
			.setStyle(ButtonStyle.Primary)
			.setLabel('Abrir inventário')
			.setCustomId('openInventory')
			.setEmoji('<a:Chest:1109826595872587949>');

		const openInventoryRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			openInventoryButton
		);

		await DiscordJSUtils.replyAndDelete(message, {
			components: [openInventoryRow]
		});

		const collector = message.channel.createMessageComponentCollector({
			filter: (i) => i.user.id === userId && i.customId === 'openInventory',
			time: 60000
		});

		collector.on('collect', async (btnInteraction) => {
			const userInventory = await ShopQueries.getInventory(userId, guildId);

			if (!userInventory || userInventory.items?.length <= 0) {
				await btnInteraction.reply({
					content: 'Seu inventário está vazio! Compre algum item com o comando `!loja`!',
					ephemeral: true
				});

				return;
			}

			const description = userInventory.items
				?.filter(({ amount }) => amount > 0)
				.map(({ amount, emoji, name }) => `• ${emoji} ${name} **x${amount}**`)
				.join('\n');

			const inventoryEmbed = new EmbedBuilder()
				.setTitle(`Inventário de ${message.author.tag}`)
				.setDescription(
					description === '' || description === undefined
						? 'Seu inventário está vazio! Compre algum item com o comando `!loja`!'
						: description
				)
				.setColor(0x2b2d31);

			await btnInteraction.reply({
				embeds: [inventoryEmbed],
				ephemeral: true
			});

			collector.stop();
		});
	}
}
