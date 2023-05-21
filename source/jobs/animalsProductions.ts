import { PrismaClient } from '@prisma/client';
import { parentPort } from 'worker_threads';

import { container } from '@sapphire/pieces';
import { ItemSlug, getItemId } from '../utils/items';

export async function main() {
	const prismaClient = new PrismaClient();
	await prismaClient.$connect();

	container.database = prismaClient;

	await updateAnimalsProductions(prismaClient);

	if (parentPort) {
		parentPort.postMessage('done');
	} else {
		process.exit(0);
	}
}

async function updateAnimalsProductions(prismaClient: PrismaClient) {
	const farmAnimals = await prismaClient.farmAnimal.findMany({
		where: {
			animal: {
				isPet: false
			}
		},
		select: {
			id: true,
			animal: {
				select: {
					produceItemRange: true,
					itemId: true
				}
			},
			farm: {
				select: {
					userGuildDataId: true
				}
			}
		}
	});

	for (const farmAnimal of farmAnimals) {
		if (!farmAnimal.animal.itemId) continue;

		const [minProduction, maxProduction] = farmAnimal.animal.produceItemRange;

		const production =
			Math.floor(Math.random() * (maxProduction - minProduction + 1)) + minProduction;

		await prismaClient.farmAnimal.update({
			where: {
				id: farmAnimal.id
			},
			data: {
				lastProducedAt: new Date()
			}
		});

		const user = await prismaClient.userGuildData.findUnique({
			where: {
				id: farmAnimal.farm.userGuildDataId
			},
			select: {
				inventory: {
					select: {
						id: true
					}
				}
			}
		});

		if (!user?.inventory?.id) continue;

		const rationItem = await prismaClient.inventoryItem.findFirst({
			where: {
				inventoryId: user?.inventory?.id,
				itemId: await getItemId(ItemSlug.Ration),
				amount: {
					gte: 1
				}
			}
		});

		if (!rationItem) {
			console.warn(`User ${farmAnimal.farm.userGuildDataId} does not have a ration.`);
			continue;
		}

		const inventoryItem = await prismaClient.inventoryItem.findFirst({
			where: {
				inventoryId: user?.inventory?.id,
				itemId: farmAnimal.animal.itemId
			}
		});

		if (inventoryItem) {
			await prismaClient.inventoryItem.update({
				where: { id: inventoryItem.id },
				data: {
					amount: {
						increment: production
					}
				}
			});
		} else {
			if (!user?.inventory?.id) {
				console.warn(`User ${farmAnimal.farm.userGuildDataId} does not have an inventory.`);
				continue;
			}

			await prismaClient.inventoryItem.create({
				data: {
					inventoryId: user?.inventory?.id,
					itemId: farmAnimal.animal.itemId,
					amount: production
				}
			});
		}

		// Subtract the ration
		await prismaClient.inventoryItem.update({
			where: {
				id: rationItem.id
			},
			data: {
				amount: {
					decrement: 1
				}
			}
		});
	}
}

void main();
