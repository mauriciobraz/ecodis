import { PrismaClient } from '@prisma/client';
import { parentPort } from 'worker_threads';

import { BANK_FEE } from '../utils/constants';

async function main() {
	const prismaClient = new PrismaClient();
	await prismaClient.$connect();

	await chargeBankFee(prismaClient);

	if (parentPort) {
		parentPort.postMessage('done');
	} else {
		process.exit(0);
	}
}

async function chargeBankFee(prisma: PrismaClient) {
	const userGuildDatas = await prisma.userGuildData.findMany();

	for (const userGuildData of userGuildDatas) {
		const fee = userGuildData.bankBalance * BANK_FEE;
		userGuildData.bankBalance -= fee;

		await prisma.userGuildData.update({
			where: { id: userGuildData.id },
			data: { bankBalance: userGuildData.bankBalance }
		});
	}
}

void main();
