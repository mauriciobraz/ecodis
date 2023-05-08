import { parentPort } from 'worker_threads';

import { PrismaClient } from '@prisma/client';
import { Time } from '@sapphire/time-utilities';

async function main(): Promise<void> {
	const prismaClient = new PrismaClient();
	await prismaClient.$connect();

	await regenerateArrests(prismaClient);
	await regenerateEnergies(prismaClient);

	if (parentPort) parentPort.postMessage('done');
	else process.exit(0);
}

/** Regenerates the arrests for every user that has been arrested for more than 24 hours. */
async function regenerateArrests(prismaClient: PrismaClient) {
	await prismaClient.user.updateMany({
		where: {
			arrestedAt: {
				lt: new Date(Date.now() - Time.Day)
			}
		},
		data: {
			arrestedAt: null
		}
	});
}

/** Maximum energy a user can have (it's used to regenerate energy). */
const MAX_ENERGY = 1000;

/** Regenerates the energy for every user that has energy lower than 1000. */
async function regenerateEnergies(prismaClient: PrismaClient) {
	await prismaClient.user.updateMany({
		where: {
			energy: {
				lt: MAX_ENERGY
			},
			energyUpdatedAt: {
				lt: new Date(Date.now() - Time.Day)
			}
		},
		data: {
			energy: MAX_ENERGY
		}
	});
}

void main();
