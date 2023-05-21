import { parentPort } from 'worker_threads';
import { PrismaClient } from '@prisma/client';
import { addMilliseconds } from 'date-fns';

import { ARREST_DURATION } from '../utils/constants';
import { Time } from '@sapphire/time-utilities';

async function main(): Promise<void> {
	const prismaClient = new PrismaClient();
	await prismaClient.$connect();

	const regeneratedArrests = await regenerateArrests(prismaClient);

	if (parentPort) {
		parentPort.postMessage(`Regenerated ${regeneratedArrests} arrests.`);
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

	await prismaClient.userGuildData.updateMany({
		where: {
			robFarmRemainingCount: {
				lte: 1
			},
			robbedFarmAt: {
				lte: addMilliseconds(now, -Time.Hour)
			}
		},
		data: {
			robFarmRemainingCount: 3,
			robbedFarmAt: null
		}
	});

	return affected.count;
}

void main();
