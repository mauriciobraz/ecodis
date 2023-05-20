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
	[ItemType.Greenhouse]: '↓ Compre itens para sua estufa',
	Animal: '↓ Compre animais para sua fazenda'
};

/** The amount of time in milliseconds to wait for a response from the user. */
const RESPONSE_TIMEOUT = 240e3;

interface SelectMenuInteractionHandlerParsedData {
	category: ItemType | 'IGNORE' | 'Animal';
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
			category: interaction.values.shift() as ItemType | 'IGNORE' | 'Animal'
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

		const selectMenu = new StringSelectMenuBuilder();

		if (category === 'Animal') {
			const availableAnimals = await this.container.database.animal.findMany();

			this.container.logger.info({
				availableAnimals
			});

			selectMenu
				.setCustomId(`SHOP:${interaction.id}`)
				.addOptions([
					new StringSelectMenuOptionBuilder()
						.setValue('IGNORE')
						.setEmoji('🐮')
						.setLabel('Escolha um animal para comprar')
						.setDescription('↓ Lista de animais disponíveis')
						.setDefault(true),
					...availableAnimals.map((animal) =>
						new StringSelectMenuOptionBuilder()
							.setValue(animal.id)
							.setLabel(animal.name)
							.setEmoji(animal.emoji)
							.setDescription(`→ 💰 ${animal.price}`)
					)
				]);
		} else {
			const itemsFromCategory = await this.container.database.item.findMany({
				where: {
					type: category
				}
			});

			selectMenu.setCustomId(`SHOP:${interaction.id}`).addOptions([
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
		}

		const selectMenuActionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			selectMenu
		);

		await interaction.reply({
			components: [selectMenuActionRow],
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

		let selectedId;
		let selectedData;
		let selectedSlug;
		let selectedType: 'Animal' | ItemType;

		let selectedName;
		let selectedPrice;

		let selectedQuantity = '1';
		let selectedPriceInDiamonds = false;

		if (category === 'Animal') {
			const selectedAnimal = await this.container.database.animal.findFirst({
				where: {
					id: selection.values.shift()
				}
			});

			if (!selectedAnimal) {
				throw new Error('Unexpected: The animal was not cached nor could be fetched.');
			}

			selectedId = selectedAnimal.id;
			selectedSlug = selectedAnimal.type;
			selectedType = 'Animal';

			selectedName = selectedAnimal.name;
			selectedPrice = selectedAnimal.price;
		} else {
			const selectedItem = await this.container.database.item.findFirst({
				where: {
					id: selection.values.shift()
				}
			});

			if (!selectedItem) {
				throw new Error('Unexpected: The item was not cached nor could be fetched.');
			}

			selectedId = selectedItem.id;
			selectedSlug = selectedItem.slug;
			selectedType = selectedItem.type;

			selectedName = selectedItem.name;
			selectedPrice = selectedItem.price;

			selectedPriceInDiamonds = selectedItem.priceInDiamonds;
			selectedData = selectedItem.data;
		}

		if (!(selectedData as Record<any, any>)?.unique && category !== 'Animal') {
			const quantitySelectMenu = this.buildQuantitySelectMenu(
				`QUANTITY:${interaction.id}`,
				selectedPrice,
				selectedPriceInDiamonds,
				[ItemType.Farm, ItemType.Ore].includes(selectedType)
			);

			const quantitySelectMenuActionRow =
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(quantitySelectMenu);

			await interaction.editReply({
				content: `Selecione a quantidade do item **${selectedName}** que deseja comprar:`,
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
			selectedQuantity = quantitySelection.values.shift() as string;
		}

		// Check if the user has enough money.
		const { balance, diamonds } = await UserQueries.getUserBalances({
			userId: interaction.user.id,
			guildId: interaction.guildId
		});

		if (selectedQuantity === 'SELL_ALL') {
			const guild = await this.container.database.guild.upsert({
				where: { discordId: interaction.guildId },
				create: { discordId: interaction.guildId },
				update: {},
				select: {
					id: true
				}
			});

			const {
				userGuildDatas: [userGuildData]
			} = await this.container.database.user.upsert({
				where: {
					discordId: interaction.user.id
				},
				create: {
					discordId: interaction.user.id,
					userGuildDatas: {
						create: {
							guildId: guild.id
						}
					}
				},
				update: {},
				select: {
					id: true,
					userGuildDatas: {
						where: {
							guildId: guild.id
						}
					}
				}
			});

			let inventory = await this.container.database.inventory.findUnique({
				where: { userId: userGuildData.id }
			});

			if (!inventory) {
				inventory = await this.container.database.inventory.create({
					data: {
						userId: userGuildData.id
					}
				});
			}

			const amountOfItem = await this.container.database.inventoryItem.findUnique({
				where: {
					itemId_inventoryId: {
						itemId: selectedId,
						inventoryId: inventory.id
					}
				},
				select: {
					amount: true
				}
			});

			if (!amountOfItem) {
				await interaction.editReply({
					content: `Você não tem nenhum item **${selectedName}** para vender!`,
					components: []
				});

				return;
			}

			await ShopQueries.sellItem({
				guildId: interaction.guildId,
				userId: interaction.user.id,
				itemId: selectedId,
				sellAll: true
			});

			await UserQueries.updateBalance({
				userId: interaction.user.id,
				guildId: interaction.guildId,
				[selectedPriceInDiamonds ? 'diamonds' : 'balance']: [
					'increment',
					selectedPrice * amountOfItem.amount
				]
			});

			await interaction.editReply({
				content: `Você vendeu todos os seus itens **${selectedName}** por ${
					selectedPriceInDiamonds ? '💎' : '💰'
				} ${selectedPrice * amountOfItem.amount}!`,
				components: []
			});

			return;
		}

		const selectedQuantityAsNumber = parseInt(selectedQuantity, 10);

		if (
			selectedPriceInDiamonds
				? diamonds < selectedPrice * selectedQuantityAsNumber
				: balance < selectedPrice * selectedQuantityAsNumber
		) {
			await interaction.editReply({
				content: `Você não tem dinheiro suficiente para comprar o item **${selectedName}**.`,
				components: []
			});

			return;
		}
		if (selectedData && typeof selectedData === 'object' && 'unique' in selectedData) {
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
			balance: ['decrement', selectedPrice * selectedQuantityAsNumber]
		});

		await ShopQueries.buyItem({
			amount: selectedQuantityAsNumber,
			guildId: interaction.guildId,
			userId: interaction.user.id,
			data: DEFAULT_ITEM_DATA[selectedSlug as ItemSlug],
			[category === 'Animal' ? 'animalId' : 'itemId']: selectedId
		});

		await interaction.editReply({
			content: `Você comprou o item ${selectedName}!`,
			components: []
		});
	}

	private buildQuantitySelectMenu(
		customId: string,
		singlePrice: number,
		priceInDiamonds: boolean,
		showSellAllButton: boolean
	) {
		const AMOUNTS = [1, 3, 6, 9];

		return new StringSelectMenuBuilder()
			.setCustomId(customId)
			.setPlaceholder('Selecione uma quantidade desejada')
			.addOptions([
				...(showSellAllButton
					? [
							new StringSelectMenuOptionBuilder()
								.setEmoji('🛒')
								.setValue('SELL_ALL')
								.setLabel('Vender tudo')
								.setDescription(
									`→ Você venderá todos os seus itens e receberá em ${
										priceInDiamonds ? '💎' : '💰'
									}.`
								)
					  ]
					: []),
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
