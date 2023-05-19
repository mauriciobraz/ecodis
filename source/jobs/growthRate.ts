/* eslint-disable @typescript-eslint/prefer-for-of */

import { parentPort } from 'worker_threads';

import { PrismaClient } from '@prisma/client';
import { differenceInMilliseconds } from 'date-fns';

import { EmployeeType, EmploymentDataSchema } from '../modules/others/commands/office';
import {
	PlantDataGridSchema as FarmPlantDataGridSchema,
	PurchasedAreaSchema as FarmPurchasedAreaSchema,
	type PlantDataGrid as FarmPlantDataGrid
} from '../utils/farm';
import {
	PlantDataGridSchema as GreenhousePlantDataGridSchema,
	PurchasedAreaSchema as GreenhousePurchasedAreaSchema,
	type PlantDataGrid as GreenhousePlantDataGrid
} from '../utils/greenhouse';
import { DEFAULT_ITEM_DATA, ZodParsers } from '../utils/items';

async function main(): Promise<void> {
	const prismaClient = new PrismaClient();
	await prismaClient.$connect();

	await updateFarmItemGrowth(prismaClient);
	await updateGreenhouseItemGrowth(prismaClient);

	if (parentPort) {
		parentPort.postMessage('done');
	} else {
		process.exit(0);
	}
}

async function updateFarmItemGrowth(prismaClient: PrismaClient) {
	const farms = await prismaClient.farm.findMany({
		where: {
			plantData: {
				not: undefined
			},
			purchasedArea: {
				not: undefined
			}
		}
	});

	const parsedFarms = farms
		.map((farm) => {
			const safelyParsedPlantData = FarmPlantDataGridSchema.safeParse(farm?.plantData);
			const safelyParsedPurchasedArea = FarmPurchasedAreaSchema.safeParse(
				farm?.purchasedArea
			);

			if (!safelyParsedPlantData.success) {
				return false;
			}

			if (!safelyParsedPurchasedArea.success) {
				return false;
			}

			return {
				...farm,
				plantData: safelyParsedPlantData.data,
				purchasedArea: safelyParsedPurchasedArea.data
			};
		})
		.filter(Boolean);

	for (const farm of parsedFarms) {
		let isFarmUpdated = false;

		for (let y = 0; y < farm.plantData.length; y++) {
			for (let x = 0; x < farm.plantData[y].length; x++) {
				const cell = farm.plantData[y][x];

				if (cell !== null) {
					const item = await prismaClient.item.findUnique({ where: { id: cell.itemId } });

					if (!item) {
						console.warn(`Item with ID ${cell.itemId} not found`);
						continue;
					}

					const currentTime = new Date();
					const elapsedTime = differenceInMilliseconds(
						currentTime,
						new Date(cell.createdAt)
					);

					const safelyParsedItemData = ZodParsers.Seed.safeParse(item.data);

					if (!safelyParsedItemData.success) {
						console.warn(`Item with ID ${cell.itemId} has invalid data`);
						continue;
					}

					const elapsedTimeInMinutes = elapsedTime / 60000;

					const growthRate = clamp(
						(elapsedTimeInMinutes / safelyParsedItemData.data.growthTime) * 100,
						0,
						100
					);

					if (growthRate !== cell.growthRate) {
						cell.growthRate = growthRate;
					}

					// if the cell has been fully grown
					if (cell.growthRate === 100) {
						const user = await prismaClient.userGuildData.findUnique({
							where: { id: farm.userGuildDataId },
							select: { inventory: { select: { id: true } } }
						});

						if (user?.inventory) {
							const inventoryItem = await prismaClient.inventoryItem.findFirst({
								where: {
									inventoryId: user.inventory?.id,
									itemId: cell.itemId
								}
							});

							if (inventoryItem) {
								// If the user already has this item in the inventory, update the quantity.
								await prismaClient.inventoryItem.update({
									where: { id: inventoryItem.id },
									data: {
										amount: {
											// @ts-ignore - this is a valid item slug
											increment: DEFAULT_ITEM_DATA[cell.itemSlug]?.yield ?? 1
										}
									}
								});
							} else {
								// If the user does not have this item, create a new one.
								await prismaClient.inventoryItem.create({
									data: {
										inventoryId: user.inventory.id,
										itemId: cell.itemId,
										amount: 1
									}
								});
							}
						}
					}

					isFarmUpdated = true;
					farm.plantData[y][x] = cell.growthRate === 100 ? null : cell;
				}
			}
		}

		// if the farm has been updated, update it in the database
		if (isFarmUpdated) {
			await prismaClient.farm.update({
				where: { id: farm.id },
				data: {
					plantData: farm.plantData,
					updatedAt: new Date()
				}
			});
		}
	}
}

async function updateGreenhouseItemGrowth(prismaClient: PrismaClient) {
	const greenhouses = await prismaClient.greenhouse.findMany({
		where: {
			plantData: {
				not: undefined
			},
			purchasedArea: {
				not: undefined
			}
		}
	});

	const parsedGreenhouses = greenhouses
		.map((greenhouse) => {
			const safelyParsedPlantData = GreenhousePlantDataGridSchema.safeParse(
				greenhouse?.plantData
			);
			const safelyParsedPurchasedArea = GreenhousePurchasedAreaSchema.safeParse(
				greenhouse?.purchasedArea
			);

			if (!safelyParsedPlantData.success) {
				return false;
			}

			if (!safelyParsedPurchasedArea.success) {
				return false;
			}

			return {
				...greenhouse,
				plantData: safelyParsedPlantData.data,
				purchasedArea: safelyParsedPurchasedArea.data
			};
		})
		.filter(Boolean);

	for (const greenhouse of parsedGreenhouses) {
		let isGreenhouseUpdated = false;

		for (let y = 0; y < greenhouse.plantData.length; y++) {
			for (let x = 0; x < greenhouse.plantData[y].length; x++) {
				const cell = greenhouse.plantData[y][x];

				if (cell !== null) {
					const item = await prismaClient.item.findUnique({ where: { id: cell.itemId } });

					if (!item) {
						console.warn(`Item with ID ${cell.itemId} not found`);
						continue;
					}

					const currentTime = new Date();
					const elapsedTime = differenceInMilliseconds(
						currentTime,
						new Date(cell.createdAt)
					);

					const safelyParsedItemData = ZodParsers.Seed.safeParse(item.data);

					if (!safelyParsedItemData.success) {
						console.warn(`Item with ID ${cell.itemId} has invalid data`);
						continue;
					}

					const elapsedTimeInMinutes = elapsedTime / 60000;

					const growthRate = clamp(
						(elapsedTimeInMinutes / safelyParsedItemData.data.growthTime) * 100,
						0,
						100
					);

					if (growthRate !== cell.growthRate) {
						cell.growthRate = growthRate;
					}

					// if the cell has been fully grown
					if (cell.growthRate === 100) {
						const user = await prismaClient.userGuildData.findUnique({
							where: { id: greenhouse.userGuildDataId },
							select: { inventory: { select: { id: true } } }
						});

						if (user?.inventory) {
							const inventoryItem = await prismaClient.inventoryItem.findFirst({
								where: {
									inventoryId: user.inventory?.id,
									itemId: cell.itemId
								}
							});

							if (inventoryItem) {
								// If the user already has this item in the inventory, update the quantity.
								await prismaClient.inventoryItem.update({
									where: { id: inventoryItem.id },
									data: {
										amount: {
											// @ts-ignore - this is a valid item slug
											increment: DEFAULT_ITEM_DATA[cell.itemSlug]?.yield ?? 1
										}
									}
								});
							} else {
								// If the user does not have this item, create a new one.
								await prismaClient.inventoryItem.create({
									data: {
										inventoryId: user.inventory.id,
										itemId: cell.itemId,
										amount: 1
									}
								});
							}
						}
					}

					isGreenhouseUpdated = true;
					greenhouse.plantData[y][x] = cell.growthRate === 100 ? null : cell;
				}
			}
		}

		// if the greenhouse has been updated, update it in the database
		if (isGreenhouseUpdated) {
			await prismaClient.greenhouse.update({
				where: { id: greenhouse.id },
				data: {
					plantData: greenhouse.plantData,
					updatedAt: new Date()
				}
			});
		}
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

void main();
