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

import { DEFAULT_ITEM_DATA, userHasMoreThanOneUniqueItem } from '../../../utils/items';
import { ItemTypeEmoji, ItemTypeNames } from '../commands/shop';

import type { Option } from '@sapphire/framework';

const ItemTypeDescription = {
	[ItemType.Armor]: '↓ Lista de armaduras',
	[ItemType.Farm]: '↓ Itens para sua fazenda',
	[ItemType.Food]: '↓ Lista de comidas',
	[ItemType.Ore]: '↓ Lista de minerais',
	[ItemType.Tool]: '↓ Lista de ferramentas',
	[ItemType.Weapon]: '↓ Compre uma licença antes de uma arma'
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

		const selectedItem = await this.container.database.item.findFirst({
			where: {
				id: selection.values.shift()
			}
		});

		if (!selectedItem) {
			throw new Error('Unexpected: The item was not cached nor could be fetched.');
		}

		// Check if the user has enough money.
		const user = await this.container.database.user.upsert({
			where: {
				discordId: interaction.user.id
			},
			create: {
				discordId: interaction.user.id,
				inventory: {
					create: {}
				}
			},
			update: {},
			select: {
				id: true,
				balance: true,
				diamonds: true
			}
		});

		if (
			selectedItem.priceInDiamonds
				? user.diamonds < selectedItem.price
				: user.balance < selectedItem.price
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

		if (!user) {
			throw new Error('Unexpected: The user was not in database');
		}

		await this.container.database.$transaction([
			this.container.database.user.update({
				where: {
					discordId: interaction.user.id
				},
				data: {
					[selectedItem.priceInDiamonds ? 'diamonds' : 'balance']: {
						decrement: selectedItem.price
					}
				}
			}),

			this.container.database.inventory.upsert({
				where: {
					userId: user.id
				},
				create: {
					items: {
						create: {
							itemId: selectedItem.id,
							data: DEFAULT_ITEM_DATA[selectedItem.slug]
						}
					},
					userId: user.id
				},
				update: {
					items: {
						create: {
							itemId: selectedItem.id,
							data: DEFAULT_ITEM_DATA[selectedItem.slug]
						}
					},
					userId: user.id
				}
			})
		]);

		await interaction.editReply({
			content: `Você comprou o item ${selectedItem.name}!`,
			components: []
		});
	}
}
