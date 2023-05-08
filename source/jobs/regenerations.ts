import { parentPort } from 'worker_threads';

import { PrismaClient } from '@prisma/client';
import { Time } from '@sapphire/time-utilities';
import { addMilliseconds, millisecondsToMinutes, sub } from 'date-fns';

import { ARREST_DURATION } from '../utils/constants';

async function main(): Promise<void> {
	const prismaClient = new PrismaClient();
	await prismaClient.$connect();

	const regeneratedArrests = await regenerateArrests(prismaClient);
	const regeneratedEnergies = await regenerateEnergies(prismaClient);

	if (parentPort)
		parentPort.postMessage(
			`Regenerated ${regeneratedArrests} arrests and ${regeneratedEnergies} energies.`
		);
	else process.exit(0);
}

// FIXME: PRISMA IS NOT CHECKING CORRECTLY THE CREATED AT DATE
// FIXME: PRISMA IS NOT CHECKING CORRECTLY THE CREATED AT DATE
// FIXME: PRISMA IS NOT CHECKING CORRECTLY THE CREATED AT DATE

/** Regenerates the arrests for every user that has been arrested for more than 24 hours. */
async function regenerateArrests(prismaClient: PrismaClient) {
	const now = new Date();

	const affected = await prismaClient.userPrison.updateMany({
		where: {
			releasedAt: null,
			createdAt: {
				lte: addMilliseconds(now, -ARREST_DURATION)
			}
		},
		data: {
			releasedAt: now
		}
	});

	return affected.count;
}

/** Maximum energy a user can have (it's used to regenerate energy). */
const MAX_ENERGY = 1000;

/** Regenerates the energy for every user that has energy lower than 1000. */
async function regenerateEnergies(prismaClient: PrismaClient) {
	const affected = await prismaClient.user.updateMany({
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
