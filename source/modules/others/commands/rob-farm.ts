import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { time } from 'discord.js';

import { FARM_ROBBERY_AMOUNT, FARM_ROBBERY_COOLDOWN } from '../../../utils/constants';
import { DiscordJSUtils } from '../../../utils/discordjs';
import { PlantDataGridSchema, type PlantData } from '../../../utils/farm';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { addSeconds } from 'date-fns';

const ENERGY_COST = 250;

@ApplyOptions<Command.Options>({
	name: 'roubar-fazenda',
	description: 'Rouba uma fazenda de alguém. Cuidado, você pode ser pego!',

	aliases: ['rob-farm', 'roubar-fazenda', 'roubar-farm'],
	generateDashLessAliases: true,
	generateUnderscoreLessAliases: true,

	preconditions: ['GuildOnly', 'NotArrested']
})
export class RobFarmCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const guildDatabase = await this.container.database.guild.upsert({
			where: { discordId: message.guildId },
			create: { discordId: message.guildId },
			update: {},
			select: {
				id: true
			}
		});

		const userDatabase = await this.container.database.user.upsert({
			where: { discordId: message.author.id },
			create: { discordId: message.author.id },
			update: {},
			select: {
				id: true
			}
		});

		const userGuildData = await this.container.database.userGuildData.upsert({
			where: {
				userId_guildId: {
					guildId: guildDatabase.id,
					userId: userDatabase.id
				}
			},
			create: {
				userId: userDatabase.id,
				guildId: guildDatabase.id
			},
			update: {},
			select: {
				id: true,
				balance: true,
				energy: true,
				committedCrimeAt: true
			}
		});

		console.log({ committedCrimeAt: userGuildData.committedCrimeAt });

		const cooldownDate = userGuildData.committedCrimeAt
			? addSeconds(userGuildData.committedCrimeAt, FARM_ROBBERY_COOLDOWN)
			: new Date(0);

		if (cooldownDate > new Date()) {
			await DiscordJSUtils.replyAndDelete(message, {
				content: `Você só poderá roubar outra fazenda ${time(cooldownDate, 'R')}.`
			});

			return;
		}

		const userResult = await args.pickResult('user');

		if (userResult.isErr()) {
			await DiscordJSUtils.replyAndDelete(message, {
				content: 'Você precisa mencionar alguém para roubar a fazenda dele!'
			});

			return;
		}

		const user = userResult.unwrap();

		// Check if the target user has the amount of plants required to be stolen.

		const { userGuildDatas } = await this.container.database.user.upsert({
			where: { discordId: user.id },
			create: { discordId: user.id },
			update: {},
			select: {
				userGuildDatas: {
					select: {
						farm: {
							select: {
								id: true,
								plantData: true
							}
						}
					}
				}
			}
		});

		const { farm: targetFarm } = userGuildDatas[0];

		if (!targetFarm) {
			await DiscordJSUtils.replyAndDelete(message, {
				content: `**${user.tag}** não tem uma fazenda para roubar!`
			});

			return;
		}

		const plantDataParsed = PlantDataGridSchema.safeParse(targetFarm.plantData);

		if (!plantDataParsed.success) {
			await DiscordJSUtils.replyAndDelete(message, {
				content: `Houve um erro inesperado ao validar a fazenda de **${user.tag}**. Reporte isso ao desenvolvedor.`
			});

			return;
		}

		const robbedPlants: PlantData[] = [];
		let remainingPlants = FARM_ROBBERY_AMOUNT;

		const newPlantData = plantDataParsed.data.map((row) =>
			row.map((plant) => {
				if (plant !== null && remainingPlants > 0) {
					remainingPlants--;
					robbedPlants.push(plant);

					return null;
				}

				return plant;
			})
		);

		if (FARM_ROBBERY_AMOUNT - remainingPlants === 0) {
			await DiscordJSUtils.replyAndDelete(message, {
				content: `**${user.username}** não tem plantas para roubar!`
			});

			return;
		}

		await this.container.database.farm.update({
			where: { id: targetFarm.id },
			data: { plantData: newPlantData }
		});

		await this.container.database.userGuildData.update({
			where: {
				id: userGuildData.id
			},
			data: {
				energy: { decrement: ENERGY_COST },
				farm: { update: { plantData: newPlantData } }
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

		const stolenPlantCount: { [plantId: string]: number } = {};

		for (const plant of robbedPlants) {
			if (stolenPlantCount[plant.itemId]) stolenPlantCount[plant.itemId]++;
			else stolenPlantCount[plant.itemId] = 1;
		}

		// eslint-disable-next-line guard-for-in
		for (const plantId in stolenPlantCount) {
			const amountOfPlant = await this.container.database.inventoryItem.findUnique({
				where: {
					itemId_inventoryId: {
						itemId: plantId,
						inventoryId: inventory.id
					}
				},
				select: {
					amount: true
				}
			});

			if (amountOfPlant) {
				await this.container.database.inventoryItem.update({
					where: {
						itemId_inventoryId: {
							itemId: plantId,
							inventoryId: inventory.id
						}
					},
					data: {
						amount: amountOfPlant.amount + stolenPlantCount[plantId]
					}
				});
			} else {
				await this.container.database.inventoryItem.create({
					data: {
						itemId: plantId,
						inventoryId: inventory.id,
						amount: stolenPlantCount[plantId]
					}
				});
			}
		}

		await this.container.database.userGuildData.update({
			where: { id: userGuildData.id },
			data: { committedCrimeAt: new Date() }
		});

		await DiscordJSUtils.replyAndDelete(message, {
			content: `Você roubou **${
				FARM_ROBBERY_AMOUNT - remainingPlants
			}** plantas da fazenda de **${user.username}**!`
		});
	}
}
