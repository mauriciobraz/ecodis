import { PrismaClient } from '@prisma/client';
import { parentPort } from 'worker_threads';

import { EmployeeType, EmploymentDataSchema } from '../modules/others/commands/office';
import { ANIMALS_REGEN } from '../utils/animals';
import { ItemSlug, getItemId } from '../utils/items';
import { container } from '@sapphire/pieces';

export async function main() {
	const prismaClient = new PrismaClient();
	await prismaClient.$connect();

	container.database = prismaClient;

	await updateAnimalFeeds(prismaClient);

	if (parentPort) {
		parentPort.postMessage('done');
	} else {
		process.exit(0);
	}
}

async function updateAnimalFeeds(prismaClient: PrismaClient) {
	const usersGuildsData = await prismaClient.userGuildData.findMany({
		where: {
			employmentData: {
				not: null
			}
		},
		select: {
			id: true,
			employmentData: true
		}
	});

	for (const userGuildData of usersGuildsData) {
		const parsedEmploymentData = EmploymentDataSchema.safeParse(userGuildData.employmentData);

		if (!parsedEmploymentData.success) {
			console.warn(`User ${userGuildData.id} has invalid employment data.`);
			continue;
		}

		const hasFeeder = parsedEmploymentData.data.some(
			(employee) => employee?.type === EmployeeType.Feeder
		);

		if (!hasFeeder) continue;

		const rationItem = await prismaClient.inventoryItem.findFirst({
			where: {
				inventory: { userId: userGuildData.id },
				itemId: await getItemId(ItemSlug.Ration),
				amount: {
					gte: 1
				}
			}
		});

		if (!rationItem) {
			continue;
		}

		const farmAnimals = await prismaClient.farmAnimal.findMany({
			where: {
				farm: {
					userGuildDataId: userGuildData.id
				}
			},
			take: rationItem.amount,
			include: {
				animal: true
			}
		});

		for (const farmAnimal of farmAnimals) {
			const foodItem = await prismaClient.inventoryItem.findFirst({
				where: {
					inventory: { userId: userGuildData.id },
					itemId: await getItemId(ItemSlug.Ration),
					amount: {
						gte: 1
					}
				}
			});

			if (!foodItem) continue;

			await prismaClient.inventoryItem.update({
				where: {
					id: foodItem.id
				},
				data: {
					amount: {
						decrement: 1
					}
				}
			});

			await prismaClient.farmAnimal.update({
				where: {
					id: farmAnimal.id
				},
				data: {
					lastFedAt: new Date(),
					energy: Math.min(
						farmAnimal.energy + ANIMALS_REGEN[farmAnimal.animal.type],
						1000
					)
				}
			});
		}
	}
}

void main();
