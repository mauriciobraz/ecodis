import { parentPort } from 'worker_threads';
import { PrismaClient } from '@prisma/client';
import { addMilliseconds } from 'date-fns';

import { ARREST_DURATION } from '../utils/constants';
import { Time } from '@sapphire/time-utilities';

async function main(): Promise<void> {
	const prismaClient = new PrismaClient();
	await prismaClient.$connect();

	const regeneratedArrests = await regenerateArrests(prismaClient);
	const regeneratedEnergies = await regenerateEnergies(prismaClient);

	if (parentPort) {
		parentPort.postMessage(
			`Regenerated ${regeneratedArrests} arrests and ${regeneratedEnergies} energies.`
		);
	} else {
		process.exit(0);
	}
}

/** Regenerates the arrests for every user that has been arrested for more than 24 hours. */
async function regenerateArrests(prismaClient: PrismaClient) {
	const now = new Date();

	const affected = await prismaClient.userPrison.deleteMany({
		where: {
			createdAt: {
				lte: addMilliseconds(now, -ARREST_DURATION)
			}
		}
	});

	return affected.count;
}

/** Maximum energy a user can have (it's used to regenerate energy). */
const MAX_ENERGY = 1000;

/** Regenerates the energy for every user that has energy lower than 1000. */
async function regenerateEnergies(prismaClient: PrismaClient) {
	const affected = await prismaClient.userGuildData.updateMany({
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

	return affected.count;
}

void main();
