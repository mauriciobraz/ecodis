import { ApplyOptions } from '@sapphire/decorators';
import { Command, Result } from '@sapphire/framework';
import { createCanvas } from 'canvas';
import {
	ActionRowBuilder,
	ComponentType,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	type Message
} from 'discord.js';
import dedent from 'ts-dedent';

import {
	PlantDataGridSchema,
	PurchasedAreaSchema,
	SEEDS_SLUGS,
	type PlantData,
	type PlantDataGrid,
	type PurchasedArea
} from '../../../utils/greenhouse';
import { ItemSlug } from '../../../utils/items';
import { ShopQueries } from '../../../utils/queries/shop';

import type { Greenhouse } from '@prisma/client';
import type { StringSelectMenuInteraction } from 'discord.js';
import type { z } from 'zod';

const DEFAULT_PURCHASED_AREA: PurchasedArea = [
	[true, false, false],
	[false, false, false],
	[false, false, false]
];

const DEFAULT_PLANT_DATA_GRID: PlantDataGrid = [
	[null, null, null],
	[null, null, null],
	[null, null, null]
];

const PLANT_COLORS = {
	[ItemSlug.Strawberry]: '#ff3333',
	[ItemSlug.RedBerries]: '#f24646'
};

const CUSTOM_IDS = {
	GREENHOUSE_CONTROL_SELECT_MENU: 'GREENHOUSE:MENU',
	GREENHOUSE_SEED_SELECT_MENU: 'GREENHOUSE:SEED:MENU'
};

type GreenhouseControlSelectMenuValue =
	| 'plant_all'
	| 'harvest_all'
	| `plant_${number}_${number}`
	| `harvest_${number}_${number}`;

interface GetOrCreateGreenhouseOptions {
	userId: string;
	guildId: string;
}

type ParsedGreenhouse = Greenhouse & {
	createdAt: Date;
	plantData: PlantDataGrid;
	purchasedArea: PurchasedArea;
};

type ParseGreenhouseJsonFieldsResult = Result<ParsedGreenhouse, z.ZodError>;

@ApplyOptions<Command.Options>({
	name: 'mina',
	description: 'Inicie uma aventura de mineração!',

	detailedDescription: dedent`
		A mina é um mini-jogo onde você pode explorar um mapa de mineração, desenterrar minérios e vender os recursos coletados por dinheiro.
		Você gosta de arriscar suas chances para encontrar minérios valiosos? Sem problemas! Na mina, você pode experimentar a emoção da descoberta a cada quadrado escolhido para mineração.

		\`1.\` Para comprar uma picareta, selecione a categoria \`Mina\` e escolha a picareta que você deseja comprar.
		\`2.\` A cada uso do comando, você minerará um quadrado do mapa. O progresso é mostrado no mapa da mina, ou seja, basta apenas usar o comando \`/mina\` novamente para ver o progresso.
	`,

	preconditions: ['GuildOnly', 'NotArrested']
})
export default class GreenhouseCommand extends Command {
	public override async messageRun(message: Message<true>) {
		let msg: Message<true> | null = null;
		let continueLoop = true;

		while (continueLoop) {
			// Verificar ou criar estufa para o usuário
			const greenhouseResult = await this.getOrCreateGreenhouse({
				guildId: message.guildId,
				userId: message.author.id
			});

			if (greenhouseResult.isErr()) {
				this.container.logger.error(greenhouseResult.unwrapErr());

				await message.reply({
					content:
						'Houve um erro inesperado ao criar/buscar sua estufa. Por favor contate um administrador e informe o ocorrido.'
				});

				continueLoop = false;

				break;
			}

			const greenhouse = greenhouseResult.unwrap();

			const greenhouseImage = this.generateGreenhouseImage(greenhouse.plantData);
			const controlsSelectMenu = this.createControlsSelectMenu();

			if (!msg) {
				msg = await message.reply({
					components: [controlsSelectMenu],
					files: [greenhouseImage]
				});
			}

			const collectedInteractionResponse = await Result.fromAsync(
				message.channel.awaitMessageComponent({
					componentType: ComponentType.StringSelect,
					filter: (i) =>
						i.member.id === message.author.id &&
						i.customId === CUSTOM_IDS.GREENHOUSE_CONTROL_SELECT_MENU,
					time: 60_000
				})
			);

			if (collectedInteractionResponse.isErr()) {
				await message.delete();
				continueLoop = false;

				break;
			}

			const collectedInteraction = collectedInteractionResponse.unwrap();

			const greenhouseControlSelectMenuValue = collectedInteraction
				.values[0] as GreenhouseControlSelectMenuValue;

			let newPlantData: PlantDataGrid | undefined;

			if (greenhouseControlSelectMenuValue === 'plant_all') {
				newPlantData = await this.plantAll(collectedInteraction, greenhouse);
			} else if (greenhouseControlSelectMenuValue === 'harvest_all') {
				newPlantData = await this.harvestAll(collectedInteraction, greenhouse);
			}

			// Update the greenhouse with the new image.
			await msg.edit({
				components: [controlsSelectMenu],
				...(newPlantData && {
					files: [this.generateGreenhouseImage(newPlantData)]
				})
			});
		}
	}

	/**
	 * Gets or creates a greenhouse for the given user/guild.
	 * @param options Guild and user ID of the user that owns the greenhouse.
	 * @returns The greenhouse object or an error if it could not be created or found.
	 */
	private async getOrCreateGreenhouse({ guildId, userId }: GetOrCreateGreenhouseOptions) {
		// First, we try to find the user and his/her guild data
		let userGuildData = await this.container.database.userGuildData.findFirst({
			where: {
				user: { discordId: userId },
				guild: { discordId: guildId }
			}
		});

		// If the userGuildData does not exist, create it
		if (!userGuildData) {
			userGuildData = await this.container.database.userGuildData.create({
				data: {
					user: {
						connectOrCreate: {
							where: { discordId: userId },
							create: { discordId: userId }
						}
					},
					guild: {
						connectOrCreate: {
							where: { discordId: guildId },
							create: { discordId: guildId }
						}
					}
				}
			});
		}

		// Try to find the greenhouse for the user
		let greenhouse = await this.container.database.greenhouse.findFirst({
			where: {
				userGuildDataId: userGuildData.id
			}
		});

		// If the greenhouse does not exist, create a new one
		if (!greenhouse) {
			greenhouse = await this.container.database.greenhouse.create({
				data: {
					userGuildDataId: userGuildData.id,
					purchasedArea: DEFAULT_PURCHASED_AREA,
					plantData: DEFAULT_PLANT_DATA_GRID
				}
			});
		}

		return this.parseGreenhouseJsonFields(greenhouse);
	}

	/**
	 * Parses the JSON values from `Greenhouse`.
	 * @param greenhouse Greenhouse object that are being parsed.
	 * @returns The new object with the parsed fields.
	 */
	private parseGreenhouseJsonFields(greenhouse: Greenhouse): ParseGreenhouseJsonFieldsResult {
		const safelyParsedPlantData = PlantDataGridSchema.safeParse(greenhouse?.plantData);
		const safelyParsedPurchasedArea = PurchasedAreaSchema.safeParse(greenhouse?.purchasedArea);

		if (!safelyParsedPlantData.success) {
			return Result.err(safelyParsedPlantData.error);
		}

		if (!safelyParsedPurchasedArea.success) {
			return Result.err(safelyParsedPurchasedArea.error);
		}

		return Result.ok({
			...greenhouse,
			plantData: safelyParsedPlantData.data,
			purchasedArea: safelyParsedPurchasedArea.data
		});
	}

	/**
	 * Generates an image for the given plant data using `canvas`.
	 * @param plantData Data to generate image from.
	 * @returns Buffer of the generated image.
	 */
	private generateGreenhouseImage(plantData: PlantDataGrid): Buffer {
		const canvasWidth = 400;
		const canvasHeight = 300;

		const canvas = createCanvas(canvasWidth, canvasHeight);
		const ctx = canvas.getContext('2d');

		// Draw background (you can use a custom image or fill with color)
		ctx.fillStyle = '#cebfff';
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);

		// Draw greenhouse grid and plants
		const gridWidth = plantData[0].length;
		const gridHeight = plantData.length;

		const cellWidth = canvasWidth / gridWidth;
		const cellHeight = canvasHeight / gridHeight;

		for (let y = 0; y < gridHeight; y++) {
			for (let x = 0; x < gridWidth; x++) {
				// Draw grid cell
				ctx.strokeStyle = 'white';
				ctx.strokeRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);

				// Draw plant if there is one
				const plant = plantData[y][x];
				if (plant) {
					const plantColor = PLANT_COLORS[plant.itemSlug];

					const plantWidth = (cellWidth * plant.growthRate) / 100;
					const plantHeight = (cellHeight * plant.growthRate) / 100;

					const offsetX = (cellWidth - plantWidth) / 2;
					const offsetY = (cellHeight - plantHeight) / 2;

					// Set plant color and opacity based on growth rate
					ctx.fillStyle = plantColor;
					ctx.globalAlpha = plant.growthRate / 100;

					// Draw plant
					ctx.fillRect(
						x * cellWidth + offsetX,
						y * cellHeight + offsetY,
						plantWidth,
						plantHeight
					);

					// Reset global alpha
					ctx.globalAlpha = 1;

					// Draw growth percentage
					ctx.fillStyle = 'black';
					ctx.font = '14px Arial';
					ctx.fillText(
						`${plant.growthRate.toFixed(0)}% (${plant.itemSlug})`,
						x * cellWidth + 5,
						y * cellHeight + cellHeight - 5
					);
				} else {
					// Draw "NONE" when plant data is null
					ctx.fillStyle = 'black';
					ctx.font = '14px Arial';
					ctx.fillText(`NONE`, x * cellWidth + 5, y * cellHeight + cellHeight - 5);

					// Draw default gray color for empty cell
					ctx.fillStyle = '#D4D4D4';
					ctx.globalAlpha = 0.5;
					ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);

					// Reset global alpha
					ctx.globalAlpha = 1;
				}
			}
		}

		return canvas.toBuffer();
	}

	/**
	 * Creates a select menu with the given plant data.
	 * @param plantData Data to generate the select menu from.
	 * @returns An action row containing a select menu with the given plant data.
	 */
	private createControlsSelectMenu() {
		return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId(CUSTOM_IDS.GREENHOUSE_CONTROL_SELECT_MENU)
				.setPlaceholder('Selecione uma ação')
				.setOptions([
					new StringSelectMenuOptionBuilder()
						.setLabel('Plantar em todos os vasos')
						.setDescription(
							'Se você não tiver fertilizante, compre com o comando loja!'
						)
						.setValue('plant_all')
						.setEmoji('🪴'),
					new StringSelectMenuOptionBuilder()
						.setLabel('Colher em todos os vasos')
						.setValue('harvest_all')
						.setEmoji('🛻')
				])
		);
	}

	/**
	 * Handles the input for which seed the user needs.
	 * @param interaction Interaction to use.
	 * @returns The selected seed ID.
	 */
	private async askForSeedId(interaction: StringSelectMenuInteraction) {
		if (!interaction.guildId) {
			throw new Error('`askForSeed` can only be used in a guild context.');
		}

		const inventory = await ShopQueries.getInventory(interaction.user.id, interaction.guildId);

		const userSeeds = inventory.items.filter(
			(item) => SEEDS_SLUGS.some((seed) => seed === item.slug) && item.amount > 0
		);

		if (!userSeeds.length) {
			const content = 'Você não tem nenhuma semente no inventário.';

			if (interaction.replied) {
				await interaction.editReply({ content });
			} else {
				await interaction.reply({ content, ephemeral: true });
			}

			return;
		}

		const userSeedsSelectMenu = new StringSelectMenuBuilder()
			.setCustomId(CUSTOM_IDS.GREENHOUSE_SEED_SELECT_MENU)
			.setPlaceholder('Selecione um semente')
			.setOptions(
				userSeeds.map((item) =>
					new StringSelectMenuOptionBuilder()
						.setLabel(`${item.name} (x${item.amount})`)
						.setEmoji(item.emoji)
						.setValue(item.id)
				)
			);

		const userSeedsRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			userSeedsSelectMenu
		);

		if (interaction.replied) {
			await interaction.editReply({
				components: [userSeedsRow]
			});
		} else {
			await interaction.reply({
				components: [userSeedsRow],
				ephemeral: true
			});
		}

		const channel =
			interaction.channel ??
			(await this.container.client.channels.fetch(interaction.channelId));

		if (!channel?.isTextBased()) {
			throw new Error('`askForSeed` can only be used in a text channel context.');
		}

		const collectedInteractionResult = await Result.fromAsync(
			channel.awaitMessageComponent({
				componentType: ComponentType.StringSelect,
				filter: (i) =>
					i.user.id === interaction.user.id &&
					i.customId === CUSTOM_IDS.GREENHOUSE_SEED_SELECT_MENU,
				time: 60_000
			})
		);

		if (collectedInteractionResult.isErr()) {
			await interaction.deleteReply();
			throw collectedInteractionResult.unwrapErr();
		}

		const seedId = collectedInteractionResult.unwrap().values[0];

		return {
			id: seedId,
			amount: userSeeds.find((item) => item.id === seedId)?.amount ?? 0
		};
	}

	private async plantAll(interaction: StringSelectMenuInteraction, greenhouse: ParsedGreenhouse) {
		const seed = await this.askForSeedId(interaction);

		if (!seed) {
			return;
		}

		const fertilizerInventoryItem = await this.container.database.inventoryItem.findFirst({
			where: {
				item: {
					slug: ItemSlug.Fertilizer
				},
				amount: {
					gt: 0
				}
			},
			select: {
				id: true,
				amount: true,
				item: {
					select: {
						name: true,
						slug: true
					}
				}
			}
		});

		if (!fertilizerInventoryItem) {
			await interaction.editReply({
				content: 'Você não tem fertilizante suficiente no seu inventário.',
				components: []
			});

			return;
		}

		const seedId = seed.id;

		const seedInventoryItem = await this.container.database.inventoryItem.findFirst({
			where: {
				itemId: seedId,
				amount: {
					gt: 0
				}
			},
			select: {
				id: true,
				amount: true,
				item: {
					select: {
						name: true,
						slug: true
					}
				}
			}
		});

		if (!seedInventoryItem) {
			await interaction.editReply({
				content: 'A semente selecionada não foi encontrada no seu inventário.',
				components: []
			});

			return;
		}

		let emptyCells = 0;

		for (const row of greenhouse.plantData) {
			for (const cell of row) {
				if (!cell) {
					emptyCells++;
				}
			}
		}

		if (seedInventoryItem.amount < emptyCells) {
			await interaction.editReply({
				content: `Você não tem sementes suficientes para plantar em todas as células vazias.`,
				components: []
			});

			return;
		}

		const updatedPlantData = greenhouse.plantData.map((row) =>
			row.map((cell) =>
				cell
					? cell
					: ({
							growthRate: 0,
							itemId: seedId,
							createdAt: new Date().toISOString(),
							itemSlug: seedInventoryItem.item.slug
					  } as PlantData)
			)
		);

		await this.container.database.greenhouse.update({
			where: { id: greenhouse.id },
			data: {
				plantData: updatedPlantData
			}
		});

		await this.container.database.inventoryItem.update({
			where: {
				id: seedInventoryItem.id
			},
			data: {
				amount: {
					decrement: emptyCells
				}
			}
		});

		await this.container.database.inventoryItem.update({
			where: {
				id: fertilizerInventoryItem.id
			},
			data: {
				amount: {
					decrement: 1
				}
			}
		});

		await interaction.deleteReply();
		return updatedPlantData;
	}

	private async harvestAll(
		interaction: StringSelectMenuInteraction,
		greenhouse: ParsedGreenhouse
	) {
		const harvestedItems: { [itemId: string]: number } = {};

		// eslint-disable-next-line @typescript-eslint/prefer-for-of
		for (let y = 0; y < greenhouse.plantData.length; y++) {
			for (let x = 0; x < greenhouse.plantData[y].length; x++) {
				const cell = greenhouse.plantData[y][x];
				if (cell === null || cell.growthRate < 100) {
					continue;
				}

				const { itemId } = cell;
				harvestedItems[itemId] = (harvestedItems[itemId] || 0) + 1;
				greenhouse.plantData[y][x] = null;
			}
		}

		// Update the greenhouse in the database.
		await this.container.database.greenhouse.update({
			where: { id: greenhouse.id },
			data: {
				plantData: greenhouse.plantData,
				updatedAt: new Date()
			}
		});

		// Now we can update the user's inventory with the collected harvested items.
		const userId = interaction.user.id;
		const guildId = interaction.guildId!;

		// Check if the user has a corresponding userGuildData and inventory.
		const {
			userGuildDatas: [userGuildData]
		} = await this.container.database.user.upsert({
			where: { discordId: userId },
			create: {
				discordId: userId,
				userGuildDatas: {
					create: {
						guild: {
							connectOrCreate: {
								where: { discordId: guildId },
								create: { discordId: guildId }
							}
						},
						inventory: {
							create: {}
						}
					}
				}
			},
			update: {},
			select: {
				userGuildDatas: {
					where: { guild: { discordId: guildId } },
					select: {
						id: true,
						inventory: {
							select: {
								id: true
							}
						}
					}
				}
			}
		});

		if (!userGuildData) {
			throw new Error('User guild data not found.');
		}

		// eslint-disable-next-line guard-for-in
		for (const itemId in harvestedItems) {
			const amount = harvestedItems[itemId];

			const inventoryItem = await this.container.database.inventoryItem.findFirst({
				where: {
					inventoryId: userGuildData.inventory?.id,
					itemId
				}
			});

			if (inventoryItem) {
				// Update the existing item's amount
				await this.container.database.inventoryItem.update({
					where: {
						id: inventoryItem.id
					},
					data: {
						amount: {
							increment: amount
						}
					}
				});
			} else {
				// Connect the harvested item to the userGuildData's inventory
				await this.container.database.inventoryItem.create({
					data: {
						amount,
						item: {
							connect: {
								id: itemId
							}
						},
						inventory: {
							connect: {
								id: userGuildData.inventory?.id
							}
						}
					}
				});
			}
		}

		await interaction.deleteReply();
		return greenhouse.plantData;
	}
}
