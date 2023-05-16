import { ItemType } from '@prisma/client';
import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes, Result } from '@sapphire/framework';
import {
	ActionRowBuilder,
	ComponentType,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	type GuildTextBasedChannel,
	type StringSelectMenuInteraction
} from 'discord.js';

import type { ItemSlug } from '../../../utils/items';
import { DEFAULT_ITEM_DATA, userHasMoreThanOneUniqueItem } from '../../../utils/items';
import { UserQueries } from '../../../utils/queries/user';
import { ItemTypeEmoji, ItemTypeNames } from '../commands/shop';

import type { Option } from '@sapphire/framework';
import { ShopQueries } from '../../../utils/queries/shop';

const ItemTypeDescription = {
	[ItemType.Armor]: '↓ Lista de armaduras',
	[ItemType.Farm]: '↓ Itens para sua fazenda',
	[ItemType.Food]: '↓ Lista de comidas',
	[ItemType.Ore]: '↓ Lista de minerais',
	[ItemType.Tool]: '↓ Lista de ferramentas',
	[ItemType.Weapon]: '↓ Compre uma licença antes de uma arma',
	[ItemType.Greenhouse]: '↓ Compre itens para sua estufa'
};

/** The amount of time in milliseconds to wait for a response from the user. */
const RESPONSE_TIMEOUT = 240e3;

interface SelectMenuInteractionHandlerParsedData {
	category: ItemType | 'IGNORE';
}

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.SelectMenu,
	name: 'SelectMenuInteractionHandler'
})
export class SelectMenuInteractionHandler extends InteractionHandler {
	public override parse(
		interaction: StringSelectMenuInteraction
	): Option<SelectMenuInteractionHandlerParsedData> {
		if (interaction.customId !== 'shop:category') {
			return this.none();
		}

		return this.some({
			category: interaction.values.shift() as ItemType | 'IGNORE'
		} as SelectMenuInteractionHandlerParsedData);
	}

	public override async run(
		interaction: StringSelectMenuInteraction,
		{ category }: SelectMenuInteractionHandlerParsedData
	) {
		if (category === 'IGNORE') {
			await interaction.deferUpdate();
			return;
		}

		if (!interaction.channelId) {
			throw new Error('Unexpected: The channel was not cached nor could be fetched.');
		}

		if (!interaction.inGuild()) {
			throw new Error('Unexpected: The command is not being called from a guild');
		}

		const itemsFromCategory = await this.container.database.item.findMany({
			where: {
				type: category
			}
		});

		const itensSelectMenu = new StringSelectMenuBuilder()
			.setCustomId(`SHOP:${interaction.id}`)
			.addOptions([
				new StringSelectMenuOptionBuilder()
					.setValue('IGNORE')
					.setEmoji(ItemTypeNames[category])
					.setEmoji(ItemTypeEmoji[category])
					.setLabel('Escolha uma categoria para ver os itens')
					.setDescription(ItemTypeDescription[category])
					.setDefault(true),

				...itemsFromCategory.map((item) =>
					new StringSelectMenuOptionBuilder()
						.setValue(item.id)
						.setLabel(item.name)
						.setEmoji(item.emoji)
						.setDescription(item.description)
						.setDescription(`→ ${item.priceInDiamonds ? '💎' : '💰'} ${item.price}`)
				)
			]);

		const itemsSelectMenuActionRow =
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(itensSelectMenu);

		await interaction.reply({
			components: [itemsSelectMenuActionRow],
			ephemeral: true
		});

		const channel =
			interaction.channel ??
			((await interaction.client.channels.fetch(
				interaction.channelId
			)) as GuildTextBasedChannel | null);

		if (!channel) {
			throw new Error('Unexpected: The channel was not cached nor could be fetched.');
		}

		const selectionResult = await Result.fromAsync(
			channel.awaitMessageComponent({
				componentType: ComponentType.StringSelect,
				filter: (componentInteraction) =>
					componentInteraction.user.id === interaction.user.id &&
					componentInteraction.customId === `SHOP:${interaction.id}`,
				time: RESPONSE_TIMEOUT
			})
		);

		if (selectionResult.isErr()) {
			await interaction.deleteReply();
			return;
		}

		const selection = selectionResult.unwrap();
		await selection.deferUpdate();

		const selectedItem = await this.container.database.item.findFirst({
			where: {
				id: selection.values.shift()
			}
		});

		if (!selectedItem) {
			throw new Error('Unexpected: The item was not cached nor could be fetched.');
		}

		let selectedQuantity = 1;

		if (!(selectedItem.data as Record<any, any>)?.unique) {
			// Adicione um menu de seleção de quantidade após selecionar um item
			const quantitySelectMenu = this.buildQuantitySelectMenu(
				`QUANTITY:${interaction.id}`,
				selectedItem.price,
				selectedItem.priceInDiamonds
			);

			const quantitySelectMenuActionRow =
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(quantitySelectMenu);

			await interaction.editReply({
				content: `Selecione a quantidade do item **${selectedItem.name}** que deseja comprar:`,
				components: [quantitySelectMenuActionRow]
			});

			const quantitySelectionResult = await Result.fromAsync(
				channel.awaitMessageComponent({
					componentType: ComponentType.StringSelect,
					filter: (componentInteraction) =>
						componentInteraction.user.id === interaction.user.id &&
						componentInteraction.customId === `QUANTITY:${interaction.id}`,
					time: RESPONSE_TIMEOUT
				})
			);

			if (quantitySelectionResult.isErr()) {
				await interaction.deleteReply();
				return;
			}

			const quantitySelection = quantitySelectionResult.unwrap();
			selectedQuantity = parseInt(quantitySelection.values.shift()!, 10);
		}

		// Check if the user has enough money.
		const { balance, diamonds } = await UserQueries.getUserBalances({
			userId: interaction.user.id,
			guildId: interaction.guildId
		});

		if (
			selectedItem.priceInDiamonds
				? diamonds < selectedItem.price * selectedQuantity
				: balance < selectedItem.price * selectedQuantity
		) {
			await interaction.editReply({
				content: `Você não tem dinheiro suficiente para comprar o item **${selectedItem.name}**.`,
				components: []
			});

			return;
		}
		if (
			selectedItem.data &&
			typeof selectedItem.data === 'object' &&
			'unique' in selectedItem.data
		) {
			const alreadyHavePickaxe = await userHasMoreThanOneUniqueItem(
				['IronPickaxe', 'DiamondPickaxe'],
				interaction.user.id
			);

			if (alreadyHavePickaxe) {
				await interaction.editReply({
					content:
						'Você já tem uma picareta e não pode comprar mais de uma! Compre uma quando a sua quebrar.',
					components: []
				});

				return;
			}
		}

		await UserQueries.updateBalance({
			userId: interaction.user.id,
			guildId: interaction.guildId,
			balance: ['decrement', selectedItem.price * selectedQuantity]
		});

		await ShopQueries.buyItem({
			amount: selectedQuantity,
			guildId: interaction.guildId,
			userId: interaction.user.id,
			itemId: selectedItem.id,
			data: DEFAULT_ITEM_DATA[selectedItem.slug as ItemSlug]
		});

		await interaction.editReply({
			content: `Você comprou o item ${selectedItem.name}!`,
			components: []
		});
	}

	private buildQuantitySelectMenu(
		customId: string,
		singlePrice: number,
		priceInDiamonds: boolean
	) {
		const AMOUNTS = [1, 3, 6, 9];

		return new StringSelectMenuBuilder()
			.setCustomId(customId)
			.setPlaceholder('Selecione uma quantidade desejada')
			.addOptions([
				...AMOUNTS.map((amount) =>
					new StringSelectMenuOptionBuilder()
						.setValue(`${amount}`)
						.setLabel(`Comprar x${amount}`)
						.setDescription(
							`→ Esta compra sairá por ${priceInDiamonds ? '💎' : '💰'} ${
								amount * singlePrice
							}`
						)
				)
			]);
	}
}
