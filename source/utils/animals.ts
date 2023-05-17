import { AnimalType } from '@prisma/client';
import { container } from '@sapphire/pieces';
import { ItemSlug } from './items';

/**
 * @note This function should be called AFTER `createItemsIfNotExists`
 */
export async function createAnimalsIfNotExists() {
	await container.database.animal.upsert({
		where: {
			type: AnimalType.Horse
		},
		create: {
			type: AnimalType.Horse,

			name: 'Cavalo',
			description: 'Um cavalo que produz adubo para a sua estufa.',

			emoji: '🐴',
			price: 1000,

			item: {
				connect: {
					slug: ItemSlug.Fertilizer
				}
			},

			produceItemRange: [1, 6]
		},
		update: {}
	});

	await container.database.animal.upsert({
		where: {
			type: AnimalType.Rabbit
		},
		create: {
			type: AnimalType.Rabbit,

			name: 'Coelho',
			description: 'Um coelho fofo, melhor amigo do homem.',

			emoji: '🐰',
			price: 2500,

			isPet: true
		},
		update: {}
	});

	await container.database.animal.upsert({
		where: {
			type: AnimalType.Chicken
		},
		create: {
			type: AnimalType.Chicken,

			name: 'Galinha',
			description: 'Produz ovos que regeneram suas energias.',

			emoji: '🐔',
			price: 1750,

			item: {
				connect: {
					slug: ItemSlug.Egg
				}
			},

			produceItemRange: [1, 3]
		},
		update: {}
	});
}
