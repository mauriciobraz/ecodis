import { parentPort } from 'worker_threads';

import { PrismaClient } from '@prisma/client';
import { differenceInMilliseconds } from 'date-fns';

import {
	PlantDataGridSchema as FarmPlantDataGridSchema,
	PurchasedAreaSchema as FarmPurchasedAreaSchema
} from '../utils/farm';
import {
	PlantDataGridSchema as GreenhousePlantDataGridSchema,
	PurchasedAreaSchema as GreenhousePurchasedAreaSchema
} from '../utils/greenhouse';
import { ZodParsers } from '../utils/items';

async function main(): Promise<void> {
	const prismaClient = new PrismaClient();
	await prismaClient.$connect();

	const updatedFarmItemGrowth = await updateFarmItemGrowth(prismaClient);
	const updatedGreenhouseItemGrowth = await updateGreenhouseItemGrowth(prismaClient);

	if (parentPort) {
		parentPort.postMessage(
			`Updated ${updatedFarmItemGrowth} farm item growth and ${updatedGreenhouseItemGrowth} greenhouse item growth`
		);
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

	let updatedItemCount = 0;

	for (const farm of parsedFarms) {
		for (const row of farm.plantData) {
			for (const cell of row) {
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
						updatedItemCount++;
					}
				}
			}
		}

		await prismaClient.farm.update({
			where: { id: farm.id },
			data: {
				plantData: farm.plantData,
				updatedAt: new Date()
			}
		});
	}

	return updatedItemCount;
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

	let updatedItemCount = 0;

	for (const greenhouse of parsedGreenhouses) {
		for (const row of greenhouse.plantData) {
			for (const cell of row) {
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
						updatedItemCount++;
					}
				}
			}
		}

		await prismaClient.greenhouse.update({
			where: { id: greenhouse.id },
			data: {
				plantData: greenhouse.plantData,
				updatedAt: new Date()
			}
		});
	}

	return updatedItemCount;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

void main();
