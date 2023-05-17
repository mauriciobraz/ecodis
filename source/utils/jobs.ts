import { JobType } from '@prisma/client';
import { container } from '@sapphire/pieces';

export async function createJobsIfNotExists() {
	await container.database.job.upsert({
		where: {
			type: JobType.Doctor
		},
		create: {
			type: JobType.Doctor,
			salary: 4000,
			cooldown: new Date(1000 * 60 * 60 * 3)
		},
		update: {}
	});

	await container.database.job.upsert({
		where: {
			type: JobType.Vet
		},
		create: {
			type: JobType.Vet,
			salary: 3000,
			cooldown: new Date(1000 * 60 * 60 * 3)
		},
		update: {}
	});

	await container.database.job.upsert({
		where: {
			type: JobType.Cop
		},
		create: {
			type: JobType.Cop,
			salary: 3500,
			cooldown: new Date(1000 * 60 * 60 * 3)
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
