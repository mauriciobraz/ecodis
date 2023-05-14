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

import type { ChatInputCommandInteraction } from 'discord.js';
import { ZodParsers, getItemId } from '../../../utils/items';

type CachedInGuild = 'cached' | 'raw';

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

const MineItemProbability = {
	[MineItem.Sapphire]: /* 10% */ 0.1,
	[MineItem.Amethyst]: /* 30% */ 0.3,
	[MineItem.Diamond]: /* 0.5% */ 0.005,
	[MineItem.Emerald]: /* 5% */ 0.05,
	[MineItem.Ruby]: /* 20% */ 0.2
};

interface GridItem {
	item: MineItem;
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
}

const DEFAULT_GENERATE_GRID_OPTIONS: GenerateGridOptions = {
	gridSize: 3,
	maxItems: 1
};

/** There is a limit of 5x5 for the grid size because of Discord's limitations. */
const MAX_GRID_SIZE = 5;

/** The amount of time in milliseconds to wait for a response from the user. */
const RESPONSE_TIMEOUT = 3e3;

@ApplyOptions<Command.Options>({
	name: 'mina',
	description: 'Inicia uma partida de mina.',
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
		await MineCommand.start(message);
	}

	public override async chatInputRun(interaction: ChatInputCommandInteraction<CachedInGuild>) {
		await MineCommand.start(interaction);
	}

	public static async start(interactionOrMessage: RepliableInteraction | Message) {
		if (!interactionOrMessage.channelId) {
			throw new Error('Unexpected: The channel was not cached nor could be fetched.');
		}

		// Polyfills

		const userId =
			'author' in interactionOrMessage
				? interactionOrMessage.author.id
				: interactionOrMessage.user.id;

		const pickaxe = await MineCommand.getUserPickaxe(userId);

		if (!pickaxe) {
			const missingPickaxeContent =
				'Você não tem uma picareta para minerar! Compre uma na loja.';

			if (interactionOrMessage instanceof Message)
				await interactionOrMessage.reply({
					content: missingPickaxeContent
				});
			else
				await interactionOrMessage.reply({
					content: missingPickaxeContent,
					ephemeral: true
				});

			return;
		}

		if (pickaxe.durability <= 0) {
			const brokenPickaxeContent = 'Sua picareta está quebrada! Compre uma nova na loja.';

			if (interactionOrMessage instanceof Message)
				await interactionOrMessage.reply({
					content: brokenPickaxeContent
				});
			else
				await interactionOrMessage.reply({
					content: brokenPickaxeContent,
					ephemeral: true
				});

			return;
		}

		const grid = MineCommand.generateGrid();
		const gridComponents = MineCommand.parseGridToDiscordComponents(grid);

		const gameEndsAt = time(addMilliseconds(new Date(), RESPONSE_TIMEOUT), 'R');
		const gameStartedContent = `Esta partida acabará ${gameEndsAt} (durabilidade da picareta: ${pickaxe.durability})`;

		let message: Message | null = null;

		if (interactionOrMessage instanceof Message)
			message = await interactionOrMessage.reply({
				components: gridComponents,
				content: gameStartedContent
			});
		else
			await interactionOrMessage.reply({
				components: gridComponents,
				content: gameStartedContent,
				ephemeral: true
			});

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
			const timeoutContent = 'A partida foi cancelada por inatividade!';

			if (interactionOrMessage instanceof Message) {
				if (!message) throw new Error('Message was not cached on message command context.');

				await message.edit({
					content: timeoutContent,
					components: []
				});
			} else
				await interactionOrMessage.editReply({
					content: timeoutContent,
					components: []
				});

			return;
		}

		const componentInteraction = collectorResult.unwrap();
		const [_, item, rawX, rawY] = componentInteraction.customId.split('&');

		const [x, y] = [Number(rawX), Number(rawY)];

		if (x > grid.length || y > grid.length) {
			throw new Error('Unexpected: The button was out of bounds.');
		}

		// FIXME: There is something wrong with this function.
		await MineCommand.handleDurabilityLoss(pickaxe.inventoryItemId);

		// TODO: await MineCommand.handleItemFound();

		if (item === MineItem.Stone) {
			const lostContent = 'Você perdeu! Mais sorte na próxima vez!';

			if (interactionOrMessage instanceof Message) {
				if (!message) throw new Error('Message was not cached on message command context.');

				await message.edit({
					content: lostContent,
					components: []
				});
			} else
				await interactionOrMessage.editReply({
					content: lostContent,
					components: []
				});
		}

		const wonContent = `Você encontrou um(a) ${item}!`;

		if (interactionOrMessage instanceof Message) {
			if (!message) throw new Error('Message was not cached on message command context.');

			await message.edit({
				content: wonContent,
				components: []
			});
		} else
			await interactionOrMessage.editReply({
				content: wonContent,
				components: []
			});
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
	public static async handleItemFound() {
		throw new Error('Not implemented.');
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
				row.map(({ item }, y) =>
					new ButtonBuilder()
						.setCustomId(`MINE&${item}&${x}&${y}`)
						.setStyle(ButtonStyle.Secondary)
						.setEmoji(MineItemEmoji[item])
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

		const oresGrids = Array.from({ length: options.maxItems }, () => ({
			x: Math.floor(Math.random() * options.gridSize),
			y: Math.floor(Math.random() * options.gridSize)
		}));

		return Array.from({ length: options.gridSize }, (_, x) =>
			Array.from({ length: options.gridSize }, (_, y) => {
				if (oresGrids.some((ore) => ore.x === x && ore.y === y)) {
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
						)
					};
				}

				return {
					item: MineItem.Stone
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
