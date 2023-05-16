import { JobType } from '@prisma/client';
import { container } from '@sapphire/pieces';

export async function createJobsIfNotExists() {
	await container.database.job.upsert({
		where: {
			type: JobType.Doctor
		},
		create: {
			type: JobType.Doctor,
			salary: 1000
		},
		update: {}
	});

	await container.database.job.upsert({
		where: {
			type: JobType.Vet
		},
		create: {
			type: JobType.Vet,
			salary: 1000
		},
		update: {}
	});

	await container.database.job.upsert({
		where: {
			type: JobType.Cop
		},
		create: {
			type: JobType.Cop,
			salary: 1000
		},
		update: {}
	});
}

/** Gets an item's ID from its slug. */
export async function getJobId(type: JobType | keyof typeof JobType) {
	return (await container.database.job.findUnique({
		where: { type },
		select: { id: true }
	}))!.id;
}
