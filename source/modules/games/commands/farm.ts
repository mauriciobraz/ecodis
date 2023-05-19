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
} from '../../../utils/farm';
import { ItemSlug } from '../../../utils/items';
import { ShopQueries } from '../../../utils/queries/shop';

import type { Animal, Farm, FarmAnimal, Item } from '@prisma/client';
import type { StringSelectMenuInteraction } from 'discord.js';
import type { z } from 'zod';

export const DEFAULT_PURCHASED_AREA: PurchasedArea = [
	[true, false, false],
	[false, false, false],
	[false, false, false]
];

export const DEFAULT_PLANT_DATA_GRID: PlantDataGrid = [
	[null, null, null],
	[null, null, null],
	[null, null, null]
];

const PLANT_COLORS = {
	[ItemSlug.Soy]: '#8BC34A',
	[ItemSlug.Wheat]: '#FFEB3B',
	[ItemSlug.Beans]: '#4CAF50',
	[ItemSlug.Pumpkin]: '#FF9800',
	[ItemSlug.Cannabis]: '#4CAF50'
};

const CUSTOM_IDS = {
	FARM_CONTROL_SELECT_MENU: 'FARM:MENU',
	FARM_SEED_SELECT_MENU: 'FARM:SEED:MENU'
};

type FarmControlSelectMenuValue =
	| 'plant_all'
	| 'harvest_all'
	| `plant_${number}_${number}`
	| `harvest_${number}_${number}`;

interface GetOrCreateFarmOptions {
	userId: string;
	guildId: string;
}

type ParseFarmJsonFieldsResult<T> = Result<T, z.ZodError>;

type FarmWithAnimals = Farm & {
	createdAt: Date;
	plantData: PlantDataGrid;
	purchasedArea: PurchasedArea;
	farmAnimals: (FarmAnimal & {
		animal: Animal & {
			item: Item | null;
		};
	})[];
};

@ApplyOptions<Command.Options>({
	name: 'fazenda',
	description: 'Gerencia sua fazenda, onde você pode plantar e colher suas sementes.',

	detailedDescription: dedent`
		Bem-vindo à nossa fazenda interativa! Este mini-jogo oferece a oportunidade de administrar a sua própria fazenda virtual. Aqui, você pode plantar e colher diversas sementes, criar animais e vender os produtos de sua fazenda para ganhar dinheiro.

		Adora animais? Ótimo! Aqui você tem a chance de adquirir animais adoráveis para sua fazenda. Esses animais não só trazem vida à sua fazenda, mas também ajudam na produção de itens especiais. Só não se esqueça de alimentá-los!

		**# Instruções passo a passo**

			\`1.\` Comprando Sementes: Antes de tudo, você precisa de sementes para plantar. Para comprar sementes, use o comando /loja. No menu da loja, selecione a categoria Fazenda e escolha a semente que você deseja comprar.

			\`2.\` Plantando Sementes: Após a compra, é hora de plantar suas sementes! Use o comando /fazenda e selecione Plantar (Todos). Se preferir, você também pode escolher uma área específica para plantar.

			\`3.\` Crescimento das plantas: As plantas precisam de um tempo para crescer. Você pode verificar o progresso do crescimento das suas plantas a qualquer momento utilizando o comando /fazenda. O crescimento será visível na imagem da sua fazenda.

		**# Amplie sua fazenda com animais**

		Se desejar adicionar um toque extra à sua fazenda, visite a categoria Animais na loja. Lá você pode comprar animais que irão automaticamente produzir itens para você. Por exemplo, um cavalo pode produzir adubo, essencial para o crescimento saudável de suas plantas na estufa.

		Assim, você pode se transformar em um verdadeiro fazendeiro virtual, gerenciando plantas e animais na sua fazenda. Desfrute deste mini-jogo relaxante e agradável, e boa sorte na sua jornada agrícola!
	`,

	aliases: ['farm'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export default class FarmCommand extends Command {
	public override async messageRun(message: Message<true>) {
		let msg: Message<true> | null = null;
		let continueLoop = true;

		while (continueLoop) {
			// Verificar ou criar fazenda para o usuário
			const farmResult = await this.getOrCreateFarm({
				guildId: message.guildId,
				userId: message.author.id
			});

			if (farmResult.isErr()) {
				this.container.logger.error(farmResult.unwrapErr());

				await message.reply({
					content:
						'Houve um erro inesperado ao criar/buscar sua fazenda. Por favor contate um administrador e informe o ocorrido.'
				});

				continueLoop = false;

				break;
			}

			const farm = farmResult.unwrap() as FarmWithAnimals;

			const farmImage = this.generateFarmImage(farm);
			const controlsSelectMenu = this.createControlsSelectMenu(farm.plantData);

			if (!msg) {
				msg = await message.reply({
					content: `**Fazenda de ${message.author.username}**\n\nAnimais: ${
						farm.farmAnimals.length > 0
							? farm.farmAnimals
									.map(
										(farmAnimal) =>
											`${farmAnimal.animal?.emoji} ${farmAnimal.animal?.name}`
									)
									.join(', ')
							: 'Nenhum'
					}`,
					components: [controlsSelectMenu],
					files: [farmImage]
				});
			}

			const collectedInteractionResponse = await Result.fromAsync(
				message.channel.awaitMessageComponent({
					componentType: ComponentType.StringSelect,
					filter: (i) =>
						i.member.id === message.author.id &&
						i.customId === CUSTOM_IDS.FARM_CONTROL_SELECT_MENU,
					time: 60_000
				})
			);

			if (collectedInteractionResponse.isErr()) {
				await message.delete();
				continueLoop = false;

				break;
			}

			const collectedInteraction = collectedInteractionResponse.unwrap();

			const farmControlSelectMenuValue = collectedInteraction
				.values[0] as FarmControlSelectMenuValue;

			let newPlantData: PlantDataGrid | undefined;

			if (farmControlSelectMenuValue === 'plant_all') {
				newPlantData = await this.plantAll(collectedInteraction, farm);
			} else if (farmControlSelectMenuValue === 'harvest_all') {
				newPlantData = await this.harvestAll(collectedInteraction, farm);
			} else {
				const [method, rawPlantRow, rawPlantCol] = farmControlSelectMenuValue.split(
					'_'
				) as ['plant' | 'harvest', string, string];

				const plantRow = Number(rawPlantRow);
				const plantCol = Number(rawPlantCol);

				newPlantData = await this[method](collectedInteraction, farm, plantRow, plantCol);
			}

			// Update the farm with the new image.
			await msg.edit({
				content: `**Fazenda de ${message.author.username}**\n\nAnimais: ${
					farm.farmAnimals.length > 0
						? farm.farmAnimals
								.map(
									(farmAnimal) =>
										`${farmAnimal.animal?.emoji} ${farmAnimal.animal?.name}`
								)
								.join(', ')
						: 'Nenhum'
				}`,
				components: [controlsSelectMenu],
				...(newPlantData && {
					files: [
						this.generateFarmImage({
							...farm,
							plantData: newPlantData
						})
					]
				})
			});
		}
	}

	/**
	 * Gets or creates a farm for the given user/guild.
	 * @param options Guild and user ID of the user that owns the farm.
	 * @returns The farm object or an error if it could not be created or found.
	 */
	private async getOrCreateFarm({ guildId, userId }: GetOrCreateFarmOptions) {
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

		// Try to find the farm for the user
		let farm = await this.container.database.farm.findFirst({
			where: {
				userGuildDataId: userGuildData.id
			},
			include: {
				farmAnimals: {
					include: {
						animal: {
							include: {
								item: true
							}
						}
					}
				}
			}
		});

		// If the farm does not exist, create a new one
		if (!farm) {
			farm = await this.container.database.farm.create({
				data: {
					userGuildDataId: userGuildData.id,
					purchasedArea: DEFAULT_PURCHASED_AREA,
					plantData: DEFAULT_PLANT_DATA_GRID
				},
				include: {
					farmAnimals: {
						include: {
							animal: {
								include: {
									item: true
								}
							}
						}
					}
				}
			});
		}

		return this.parseFarmJsonFields(farm);
	}

	/**
	 * Parses the JSON values from `Farm`.
	 * @param farm Farm object that are being parsed.
	 * @returns The new object with the parsed fields.
	 */
	private parseFarmJsonFields<T extends Farm>(farm: T): ParseFarmJsonFieldsResult<T> {
		const safelyParsedPlantData = PlantDataGridSchema.safeParse(farm?.plantData);
		const safelyParsedPurchasedArea = PurchasedAreaSchema.safeParse(farm?.purchasedArea);

		if (!safelyParsedPlantData.success) {
			return Result.err(safelyParsedPlantData.error);
		}

		if (!safelyParsedPurchasedArea.success) {
			return Result.err(safelyParsedPurchasedArea.error);
		}

		return Result.ok({
			...farm,
			plantData: safelyParsedPlantData.data,
			purchasedArea: safelyParsedPurchasedArea.data
		});
	}

	/**
	 * Generates an image for the given plant data using `canvas`.
	 * @param plantData Data to generate image from.
	 * @returns Buffer of the generated image.
	 */
	private generateFarmImage(farm: FarmWithAnimals): Buffer {
		const canvasWidth = 400;
		const canvasHeight = 300;

		const canvas = createCanvas(canvasWidth, canvasHeight);
		const ctx = canvas.getContext('2d');

		// Draw background (you can use a custom image or fill with color)
		ctx.fillStyle = '#d3ebd3';
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);

		// Draw farm grid and plants
		const gridWidth = farm.plantData[0].length;
		const gridHeight = farm.plantData.length;

		const cellWidth = canvasWidth / gridWidth;
		const cellHeight = canvasHeight / gridHeight;

		for (let y = 0; y < gridHeight; y++) {
			for (let x = 0; x < gridWidth; x++) {
				// Draw grid cell
				ctx.strokeStyle = 'white';
				ctx.strokeRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);

				// Draw plant if there is one
				const plant = farm.plantData[y][x];

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
	private createControlsSelectMenu(plantData: PlantDataGrid) {
		return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId(CUSTOM_IDS.FARM_CONTROL_SELECT_MENU)
				.setPlaceholder('Selecione uma ação')
				.setOptions([
					new StringSelectMenuOptionBuilder()
						.setLabel('Plantar (Todos)')
						.setValue('plant_all')
						.setEmoji('🧑‍🌾'),
					new StringSelectMenuOptionBuilder()
						.setLabel('Colher (Todos)')
						.setValue('harvest_all')
						.setEmoji('🚜'),
					...plantData.flatMap((row, y) =>
						row.map((plant, x) => {
							const currentIndex = y * row.length + x + 1;

							return plant
								? new StringSelectMenuOptionBuilder()
										.setLabel(`Colher (${currentIndex})`)
										.setValue(`harvest_${x}_${y}`)
										.setEmoji('🌾')
								: new StringSelectMenuOptionBuilder()
										.setLabel(`Plantar (${currentIndex})`)
										.setValue(`plant_${x}_${y}`)
										.setEmoji('🌱');
						})
					)
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

		const userSeeds = inventory.items.filter((item) =>
			SEEDS_SLUGS.some((seed) => seed === item.slug)
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
			.setCustomId(CUSTOM_IDS.FARM_SEED_SELECT_MENU)
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
					i.customId === CUSTOM_IDS.FARM_SEED_SELECT_MENU,
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

	private async plantAll(interaction: StringSelectMenuInteraction, farm: FarmWithAnimals) {
		const seed = await this.askForSeedId(interaction);

		if (!seed) {
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

		for (const row of farm.plantData) {
			for (const cell of row) {
				if (!cell) {
					emptyCells++;
				}
			}
		}

		let seedsPlanted = 0;
		const seedsToPlant = Math.min(emptyCells, seedInventoryItem.amount);

		const updatedPlantData = farm.plantData.map((row) =>
			row.map((cell) => {
				if (!cell && seedsPlanted < seedsToPlant) {
					seedsPlanted++;

					return {
						growthRate: 0,
						itemId: seedId,
						createdAt: new Date().toISOString(),
						itemSlug: seedInventoryItem.item.slug
					} as PlantData;
				}

				return cell;
			})
		);

		await this.container.database.farm.update({
			where: { id: farm.id },
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

		await interaction.deleteReply();

		return updatedPlantData;
	}

	private async harvestAll(interaction: StringSelectMenuInteraction, farm: FarmWithAnimals) {
		const harvestedItems: { [itemId: string]: number } = {};

		// eslint-disable-next-line @typescript-eslint/prefer-for-of
		for (let y = 0; y < farm.plantData.length; y++) {
			for (let x = 0; x < farm.plantData[y].length; x++) {
				const cell = farm.plantData[y][x];
				if (cell === null || cell.growthRate < 100) {
					continue;
				}

				const { itemId } = cell;
				harvestedItems[itemId] = (harvestedItems[itemId] || 0) + 1;
				farm.plantData[y][x] = null;
			}
		}

		// Update the farm in the database.
		await this.container.database.farm.update({
			where: { id: farm.id },
			data: {
				plantData: farm.plantData,
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

		return farm.plantData;
	}

	private async plant(
		interaction: StringSelectMenuInteraction,
		farm: FarmWithAnimals,
		plantRow: number,
		plantCol: number,
		ignoreEmptyCell = false
	) {
		if (farm.plantData[plantRow][plantCol] && !ignoreEmptyCell) {
			await interaction.editReply({
				content: 'A célula selecionada já possui uma semente. Por favor, escolha outra.',
				components: []
			});

			return;
		}

		const seed = await this.askForSeedId(interaction);

		if (!seed) {
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
			const content = 'A semente selecionada não foi encontrada no seu inventário.';

			if (interaction.deferred)
				await interaction.editReply({
					content,
					components: []
				});
			else
				await interaction.reply({
					content
				});

			return;
		}

		await this.container.database.inventoryItem.update({
			where: {
				id: seedInventoryItem.id
			},
			data: {
				amount: {
					decrement: 1
				}
			}
		});

		const updatedPlantData = farm.plantData.map((row, y) =>
			row.map((cell, x) =>
				y === plantRow && x === plantCol
					? ({
							growthRate: 0,
							itemId: seedId,
							createdAt: new Date().toISOString(),
							itemSlug: seedInventoryItem.item.slug
					  } as PlantData)
					: cell
			)
		);

		await this.container.database.farm.update({
			where: { id: farm.id },
			data: {
				plantData: updatedPlantData
			}
		});

		await interaction.deleteReply();

		return updatedPlantData;
	}

	private async harvest(
		interaction: StringSelectMenuInteraction,
		farm: FarmWithAnimals,
		plantRow: number,
		plantCol: number
	) {
		const cell = farm.plantData[plantRow][plantCol];

		if (cell === null || cell.growthRate < 100) {
			return; // Do not harvest if there's no plant or if the growthRate is less than 100.
		}

		const userId = interaction.user.id;
		const guildId = interaction.guildId!;

		const { itemId } = cell;
		const amount = 1;

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

		// Remove the harvested plant from the farm.
		farm.plantData[plantRow][plantCol] = null;

		// Update the farm in the database.
		await this.container.database.farm.update({
			where: { id: farm.id },
			data: {
				plantData: farm.plantData,
				updatedAt: new Date()
			}
		});

		await interaction.deleteReply();

		return farm.plantData;
	}
}
