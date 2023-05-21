import { ApplyOptions } from '@sapphire/decorators';
import { Command, Result, container, type ChatInputCommand } from '@sapphire/framework';
import { addMilliseconds } from 'date-fns';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	Message,
	time,
	type GuildTextBasedChannel,
	type RepliableInteraction
} from 'discord.js';

import dedent from 'ts-dedent';
import type { z } from 'zod';
import type { ItemSlug } from '../../../utils/items';
import { ZodParsers, getItemId } from '../../../utils/items';

enum MineItem {
	Sapphire = 'Sapphire',
	Amethyst = 'Amethyst',
	Diamond = 'Diamond',
	Emerald = 'Emerald',
	Stone = 'Stone',
	Ruby = 'Ruby'
}

const MineItemEmoji = {
	[MineItem.Sapphire]: '<:sapphire:1105483574091731064>',
	[MineItem.Amethyst]: '<:amethyst:1105483608891863132>',
	[MineItem.Diamond]: '<a:diamond:1105483643863969822>',
	[MineItem.Emerald]: '<:emerald:1105483669952536596>',
	[MineItem.Stone]: '<:invisible:1105675442813403137>',
	[MineItem.Ruby]: '<:ruby:1105483530672279592>'
};

const MineFakeItemEmoji = {
	[MineItem.Sapphire]: '<:sapphire_fake:1109120121164812369>',
	[MineItem.Amethyst]: '<:amethyst_fake:1109120114265182239>',
	[MineItem.Emerald]: '<:emerald_fake:1109120115892572191>',
	[MineItem.Ruby]: '<:ruby_fake:1109120118623051917>',

	// This is in case the user mines a stone and for some reason it's marked as a fake item.
	[MineItem.Diamond]: '<a:diamond:1105483643863969822>',
	[MineItem.Stone]: '<:invisible:1105675442813403137>'
};

const MineItemProbability = {
	[MineItem.Sapphire]: /* 10% */ 0.1,
	[MineItem.Amethyst]: /* 30% */ 0.3,
	[MineItem.Diamond]: /* 0.5% */ 0.005,
	[MineItem.Emerald]: /* 5% */ 0.05,
	[MineItem.Ruby]: /* 20% */ 0.2
};

interface GridItem {
	item: MineItem;
	isFake?: boolean;
}

type Grid = GridItem[][];

interface GenerateGridOptions {
	/**
	 * The size of the grid.
	 * @default 3
	 */
	gridSize: number;

	/**
	 * The maximum amount of items that can be in the grid.
	 * @default 1
	 */
	maxItems: number;

	/**
	 * Percentages of each item to be in the grid.
	 * @default {}
	 */
	percentages?: { [key in MineItem]: number };
}

const DEFAULT_GENERATE_GRID_OPTIONS: GenerateGridOptions = {
	gridSize: 3,
	maxItems: 1,
	percentages: {
		Amethyst: 0.3,
		Diamond: 0.005,
		Emerald: 0.05,
		Ruby: 0.2,
		Sapphire: 0.1,
		Stone: 0.0
	}
};

/** There is a limit of 5x5 for the grid size because of Discord's limitations. */
const MAX_GRID_SIZE = 5;

/** The amount of time in milliseconds to wait for a response from the user. */
const RESPONSE_TIMEOUT = 3e3;

@ApplyOptions<Command.Options>({
	name: 'mina',
	description: 'Inicia uma partida de mina.',

	detailedDescription: dedent`
		O comando Mina permite que você participe de um divertido e envolvente jogo de mineração direto no seu servidor Discord.
		Para jogar, você precisará de uma picareta que pode ser obtida na loja.
		Cada vez que você minera, a durabilidade da sua picareta diminui - se chegar a zero, sua picareta estará quebrada e você precisará de uma nova.
		Na grade de mineração, os minérios e minerais são colocados aleatoriamente. Cada quadrado que você escolher para minar pode potencialmente descobrir itens valiosos ou simples pedras.
		Seja sábio com suas escolhas e tente encontrar os recursos mais valiosos antes que sua picareta quebre ou o tempo acabe.
		Aproveite a emoção da mineração sem sair do seu servidor Discord!
	`,

	preconditions: ['GuildOnly', 'NotArrested']
})
export class MineCommand extends Command {
	public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
		registry.registerChatInputCommand(
			(builder) => builder.setName(this.name).setDescription(this.description),
			{ idHints: ['1105845674433597480'] }
		);
	}

	public override async messageRun(message: Message<boolean>) {
		const pickaxe = await MineCommand.getUserPickaxe(message.author.id);

		if (!pickaxe) {
			const missingPickaxeContent =
				'Você não tem uma picareta para minerar! Compre uma na loja.';

			await message.reply({
				content: missingPickaxeContent
			});

			return;
		}

		let messageToEdit: Message | null = null;

		if (pickaxe.durability <= 0) {
			const brokenPickaxeContent = 'Sua picareta está quebrada! Compre uma nova na loja.';

			await message.reply({
				content: brokenPickaxeContent
			});

			return;
		}

		let status = 'Continue';

		while (pickaxe.durability > 0 && status === 'Continue') {
			const result = await MineCommand.start(
				message,
				pickaxe,
				pickaxe.durability - 1,
				messageToEdit
			);

			pickaxe.durability--;
			messageToEdit ??= result.message;
			status = result.status;

			switch (result.status) {
				case 'Lost':
				case 'Timeout':
				case 'Continue':
				case 'PickaxeBroke':
					break;

				default:
					throw new Error('Unexpected: The result is not valid.');
			}
		}

		switch (status) {
			case 'Lost':
				await messageToEdit?.edit({
					content: 'Você perdeu! Mais sorte na próxima vez!',
					components: []
				});

				break;

			case 'Timeout':
				await messageToEdit?.edit({
					content: 'A partida foi cancelada por inatividade!',
					components: []
				});

				break;

			case 'PickaxeBroke':
				await messageToEdit?.edit({
					content: 'Sua picareta quebrou! Compre uma nova na loja.',
					components: []
				});

				break;

			default:
				throw new Error(`Unexpected: The status "${status}" is not valid.`);
		}
	}

	public static async start(
		interactionOrMessage: RepliableInteraction | Message,
		pickaxe: z.infer<typeof ZodParsers.UserPickaxe> & { inventoryItemId: string },
		currentRound = 0,
		messageToEdit: Message | null = null
	) {
		if (!interactionOrMessage.channelId) {
			throw new Error('Unexpected: The channel was not cached nor could be fetched.');
		}

		// Polyfills

		const userId =
			'author' in interactionOrMessage
				? interactionOrMessage.author.id
				: interactionOrMessage.user.id;

		const gridSize = 3;

		const maxItems = Math.max(0, Math.min(Math.floor(Math.random() * (gridSize ** 2 + 1)), 4));

		const grid = MineCommand.generateGrid({
			gridSize,
			maxItems
		});

		const gridComponents = MineCommand.parseGridToDiscordComponents(grid);

		const gameEndsAt = time(addMilliseconds(new Date(), RESPONSE_TIMEOUT * currentRound), 'R');
		const gameStartedContent = `Esta partida acabará ${gameEndsAt} (durabilidade da picareta: ${pickaxe.durability})`;

		let message: Message | null = null;

		if (interactionOrMessage instanceof Message) {
			if (messageToEdit) {
				message = await messageToEdit.edit({
					components: gridComponents,
					content: gameStartedContent
				});
			} else {
				message = await interactionOrMessage.reply({
					components: gridComponents,
					content: gameStartedContent
				});
			}
		} else {
			if (!interactionOrMessage.deferred)
				await interactionOrMessage.deferReply({ ephemeral: true });

			await interactionOrMessage.editReply({
				components: gridComponents,
				content: gameStartedContent
			});
		}

		const channel =
			interactionOrMessage.channel ??
			((await interactionOrMessage.client.channels.fetch(
				interactionOrMessage.channelId
			)) as GuildTextBasedChannel | null);

		if (!channel) {
			throw new Error('Unexpected: The channel was not cached nor could be fetched.');
		}

		const collectorResult = await Result.fromAsync(
			channel.awaitMessageComponent({
				componentType: ComponentType.Button,
				filter: (componentInteraction) =>
					componentInteraction.user.id === userId &&
					componentInteraction.customId.startsWith('MINE&'),
				time: RESPONSE_TIMEOUT
			})
		);

		if (collectorResult.isErr()) {
			return { status: 'Timeout' as const, message };
		}

		const componentInteraction = collectorResult.unwrap();
		const [_, item, rawX, rawY] = componentInteraction.customId.split('&');

		const [x, y] = [Number(rawX), Number(rawY)];

		if (x > grid.length || y > grid.length) {
			throw new Error('Unexpected: The button was out of bounds.');
		}

		await componentInteraction.deferUpdate();
		await MineCommand.handleDurabilityLoss(pickaxe.inventoryItemId);

		if (grid[x][y].isFake || grid[x][y].item === MineItem.Stone) {
			return { status: 'Lost' as const, message };
		}

		await MineCommand.handleItemFound(item as ItemSlug, userId, interactionOrMessage.guildId!);

		if (item === MineItem.Stone) {
			return {
				status: 'Lost' as const,
				message
			};
		}

		return {
			status: pickaxe.durability === 1 ? 'PickaxeBroke' : 'Continue',
			message
		};
	}

	/**
	 * Gets the user's pickaxe data from the database.
	 * @param userId User ID to get the pickaxe from.
	 * @returns The user's pickaxe data or `null` if the user doesn't have a pickaxe.
	 */
	public static async getUserPickaxe(userId: string) {
		const pickaxesIds = [await getItemId('IronPickaxe'), await getItemId('DiamondPickaxe')];

		const userHasPickaxe = await container.database.inventoryItem.findFirst({
			where: {
				inventory: {
					user: {
						user: {
							discordId: userId
						}
					}
				},
				itemId: {
					in: pickaxesIds
				}
			},
			select: {
				id: true,
				data: true
			}
		});

		if (!userHasPickaxe) return null;

		console.log(userHasPickaxe.data);

		const pickaxe = ZodParsers.UserPickaxe.safeParse(userHasPickaxe.data);

		if (!pickaxe.success) {
			throw new Error('Unexpected: The pickaxe data is not valid.');
		}

		return {
			...pickaxe.data,
			inventoryItemId: userHasPickaxe.id
		};
	}

	/**
	 * Updates the user's pickaxe durability on the database.
	 * @param inventoryItemId Inventory item ID to update the durability from.
	 */
	public static async handleDurabilityLoss(inventoryItemId: string) {
		const oldItem = await container.database.inventoryItem.findFirst({
			where: { id: inventoryItemId },
			select: { data: true }
		});

		const pickaxe = ZodParsers.UserPickaxe.safeParse(oldItem?.data);

		if (!pickaxe.success) {
			throw new Error('Unexpected: The pickaxe data is not valid.');
		}

		if (pickaxe.data.durability === 1) {
			await container.database.inventoryItem.delete({
				where: {
					id: inventoryItemId
				}
			});

			return;
		}

		await container.database.inventoryItem.update({
			where: {
				id: inventoryItemId
			},
			data: {
				data: {
					durability: pickaxe.data.durability - 1
				}
			}
		});
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public static async handleItemFound(item: ItemSlug, userId: string, guildId: string) {
		const itemId = await getItemId(item as any);

		const guild = await container.database.guild.upsert({
			where: { discordId: guildId },
			create: { discordId: guildId },
			update: {},
			select: {
				id: true
			}
		});

		const {
			userGuildDatas: [userGuildData]
		} = await container.database.user.upsert({
			where: {
				discordId: userId
			},
			create: {
				discordId: userId,
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

		let inventory = await container.database.inventory.findUnique({
			where: { userId: userGuildData.id }
		});

		if (!inventory) {
			inventory = await container.database.inventory.create({
				data: {
					userId: userGuildData.id
				}
			});
		}

		const existingItem = await container.database.inventoryItem.findFirst({
			where: {
				itemId,
				inventoryId: inventory.id
			}
		});

		if (existingItem) {
			await container.database.inventoryItem.update({
				where: {
					id: existingItem.id
				},
				data: {
					amount: {
						increment: 1
					}
				}
			});
		} else {
			await container.database.inventoryItem.create({
				data: {
					amount: 1,
					itemId,
					inventoryId: inventory.id
				}
			});
		}
	}

	/**
	 * Parses a grid to Discord components.
	 * @param grid Grid to parse to Discord components.
	 * @returns The parsed matrix grid to Discord components.
	 */
	public static parseGridToDiscordComponents(grid: Grid) {
		if (grid.length > MAX_GRID_SIZE) {
			throw new Error(`The grid size cannot be bigger than ${MAX_GRID_SIZE}.`);
		}

		return grid.map((row, x) =>
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				row.map(({ item, isFake }, y) =>
					new ButtonBuilder()
						.setCustomId(`MINE&${item}&${x}&${y}`)
						.setStyle(ButtonStyle.Secondary)
						.setEmoji(isFake ? MineFakeItemEmoji[item] : MineItemEmoji[item])
				)
			)
		);
	}

	/**
	 * Generates a grid for the mine game.
	 * @param options Options to use for generating the grid.
	 * @returns A matrix grid with the items and ores randomly placed.
	 */
	public static generateGrid(options: GenerateGridOptions = DEFAULT_GENERATE_GRID_OPTIONS): Grid {
		if (options.gridSize > MAX_GRID_SIZE) {
			throw new Error(`The grid size cannot be bigger than ${MAX_GRID_SIZE}.`);
		}

		// Create one true ore
		const trueOre = {
			x: Math.floor(Math.random() * options.gridSize),
			y: Math.floor(Math.random() * options.gridSize)
		};

		let fakeOresCount = 0;

		const maxFakeOresCount = Math.min(3, Math.floor(options.gridSize ** 2 * 0.4));
		const fakeOres: { x: number; y: number }[] = [];

		// Generate random fake ores
		while (fakeOresCount < maxFakeOresCount) {
			const fakeOre = {
				x: Math.floor(Math.random() * options.gridSize),
				y: Math.floor(Math.random() * options.gridSize)
			};

			// Make sure that the fake ore is not in the same position as the true ore
			if (fakeOre.x !== trueOre.x || fakeOre.y !== trueOre.y) {
				fakeOres.push(fakeOre);
				fakeOresCount++;
			}
		}

		return Array.from({ length: options.gridSize }, (_, x) =>
			Array.from({ length: options.gridSize }, (_, y): GridItem => {
				if (trueOre.x === x && trueOre.y === y) {
					return {
						item: MineCommand.pickRandom(
							Object.values(
								Object.fromEntries(
									Object.entries(MineItem).filter(
										([_, item]) => item !== MineItem.Stone
									)
								)
							),
							Object.values(MineItemProbability)
						),
						isFake: false
					};
				}

				if (fakeOres.some((ore) => ore.x === x && ore.y === y)) {
					return {
						item: MineCommand.pickRandom(
							Object.values(
								Object.fromEntries(
									Object.entries(MineItem).filter(
										([_, item]) =>
											item !== MineItem.Stone && item !== MineItem.Diamond
									)
								)
							),
							Object.values(MineItemProbability)
						),
						isFake: true
					};
				}

				return {
					item: MineItem.Stone,
					isFake: false
				};
			})
		);
	}

	/**
	 * Picks a random item from an array.
	 * @param array Array to pick a random item from.
	 * @param weights Weights to use for the random item.
	 * @returns A random item from the array based on the weights.
	 */
	private static pickRandom<T>(array: T[], weights?: number[]): T {
		if (weights) {
			const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);
			let rand = Math.random() * totalWeight;

			for (let i = 0; i < array.length; i++) {
				rand -= weights[i];
				if (rand < 0) return array[i];
			}

			return array[Math.floor(Math.random() * array.length)];
		}

		return array[Math.floor(Math.random() * array.length)];
	}
}
