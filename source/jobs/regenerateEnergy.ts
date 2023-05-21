import { PrismaClient } from '@prisma/client';
import { parentPort } from 'worker_threads';

import { Time } from '@sapphire/time-utilities';

async function main(): Promise<void> {
	const prismaClient = new PrismaClient();
	await prismaClient.$connect();

	const regeneratedEnergies = await regenerateEnergies(prismaClient);

	if (parentPort) {
		parentPort.postMessage(`Regenerated  ${regeneratedEnergies} energies.`);
	} else {
		process.exit(0);
	}
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
				lt: new Date(Date.now() - Time.Hour)
			}
		},
		data: {
			energy: MAX_ENERGY
		}
	});

	return affected.count;
}

void main();
