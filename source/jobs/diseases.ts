import { parentPort } from 'worker_threads';

import { AnimalDisease, PrismaClient } from '@prisma/client';
import { pickRandom } from '@sapphire/utilities';

const DISEASE_CHANCE = 0.05;

async function main() {
	const prismaClient = new PrismaClient();
	await prismaClient.$connect();

	await applyRandomDiseases(prismaClient);

	if (parentPort) {
		parentPort.postMessage('done');
	} else {
		process.exit(0);
	}
}

async function applyRandomDiseases(prisma: PrismaClient) {
	const farmAnimals = await prisma.farmAnimal.findMany({
		where: {
			animal: {
				isPet: false
			},
			disease: {
				equals: AnimalDisease.None
			}
		}
	});

	for (const farmAnimal of farmAnimals) {
		if (Math.random() < DISEASE_CHANCE) {
			const disease = pickRandom(
				Object.values(AnimalDisease).filter((disease) => disease !== AnimalDisease.None)
			);

			await prisma.farmAnimal.update({
				where: { id: farmAnimal.id },
				data: { disease }
			});
		}
	}
}

void main();
