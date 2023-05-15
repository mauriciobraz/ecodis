import { parentPort } from 'worker_threads';

import { PrismaClient } from '@prisma/client';
import { differenceInMilliseconds } from 'date-fns';

import { ZodParsers } from '../utils/items';
import { PlantDataGridSchema, PurchasedAreaSchema } from '../utils/farm';

async function main(): Promise<void> {
	const prismaClient = new PrismaClient();
	await prismaClient.$connect();

	const updatedItemGrowth = await updateItemGrowth(prismaClient);

	if (parentPort) {
		parentPort.postMessage(`Updated growth for ${updatedItemGrowth} items.`);
	} else {
		process.exit(0);
	}
}

/** Updates the growthRate of items based on their growthTime and creation date. */
async function updateItemGrowth(prismaClient: PrismaClient) {
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
			const safelyParsedPlantData = PlantDataGridSchema.safeParse(farm?.plantData);
			const safelyParsedPurchasedArea = PurchasedAreaSchema.safeParse(farm?.purchasedArea);

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

					console.log({
						growthRate,
						elapsedTime,
						growthTime: safelyParsedItemData.data.growthTime
					});

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

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

void main();
