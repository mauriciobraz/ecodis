import { z } from 'zod';

import { ItemType } from '@prisma/client';
import { container } from '@sapphire/pieces';

export enum ItemSlug {
	Pickaxe = 'Pickaxe',

	Sapphire = 'Sapphire',
	Amethyst = 'Amethyst',
	Diamond = 'Diamond',
	Emerald = 'Emerald',
	Ruby = 'Ruby',

	Banana = 'Banana',
	Chocolate = 'Chocolate',
	Cafe = 'Café',
	RedBull = 'RedBull',

	FirearmsLicense = 'FirearmsLicense',
	HK416 = 'HK416',
	AK47 = 'AK47',
	M4A1 = 'M4A1'
}

/** Creates all the items if they don't exist in the database. */
export async function createItemsIfNotExists() {
	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Pickaxe
		},
		create: {
			slug: ItemSlug.Pickaxe,
			type: ItemType.Tool,

			emoji: '⛏️',
			price: 100,

			name: 'Picareta',
			description: 'Uma picareta para minerar minérios.'
		},
		update: {}
	});

	// Ores
	// Ores
	// Ores

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Sapphire
		},
		create: {
			slug: ItemSlug.Sapphire,
			type: ItemType.Ore,

			emoji: '💎',
			price: 1,
			priceInDiamonds: true,

			name: 'Diamante',
			description: 'Um diamante brilhante.'
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Emerald
		},
		create: {
			slug: ItemSlug.Emerald,
			type: ItemType.Ore,

			emoji: '💚',
			price: 500,
			priceInDiamonds: false,

			name: 'Esmeralda',
			description: 'Uma pedra preciosa verde.'
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Sapphire
		},
		create: {
			slug: ItemSlug.Sapphire,
			type: ItemType.Ore,

			emoji: '💙',
			price: 300,
			priceInDiamonds: false,

			name: 'Safira',
			description: 'Uma pedra preciosa azul.'
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Ruby
		},
		create: {
			slug: ItemSlug.Ruby,
			type: ItemType.Ore,

			emoji: '❤️',
			price: 300,
			priceInDiamonds: false,

			name: 'Rubi',
			description: 'Uma pedra preciosa vermelha.'
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Amethyst
		},
		create: {
			slug: ItemSlug.Amethyst,
			type: ItemType.Ore,

			emoji: '💜',
			price: 100,
			priceInDiamonds: false,

			name: 'Ametista',
			description: 'Uma pedra preciosa roxa.'
		},
		update: {}
	});

	// Foods
	// Foods
	// Foods

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Banana
		},
		create: {
			slug: ItemSlug.Banana,
			type: ItemType.Food,

			emoji: '🍌',
			price: 500,

			name: 'Banana',
			description: 'Uma fruta amarela e saborosa.'
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Chocolate
		},
		create: {
			slug: ItemSlug.Chocolate,
			type: ItemType.Food,

			emoji: '🍫',
			price: 800,

			name: 'Chocolate',
			description: 'Um doce feito de cacau.'
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Cafe
		},
		create: {
			slug: ItemSlug.Cafe,
			type: ItemType.Food,

			emoji: '☕',
			price: 1200,

			name: 'Café',
			description: 'Uma bebida quente e revigorante.'
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.RedBull
		},
		create: {
			slug: ItemSlug.RedBull,
			type: ItemType.Food,

			emoji: '🐂',
			price: 2000,

			name: 'RedBull',
			description: 'Uma bebida energética.'
		},
		update: {}
	});

	// Weapons
	// Weapons
	// Weapons

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.FirearmsLicense
		},
		create: {
			slug: ItemSlug.FirearmsLicense,
			type: ItemType.Weapon,

			emoji: '🔫',
			price: 5,
			priceInDiamonds: true,

			name: 'Porte de Arma',
			description: 'Libera o acesso para usar armas legalmente.',
			data: {}
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.HK416
		},
		create: {
			slug: ItemSlug.HK416,
			type: ItemType.Weapon,

			emoji: '🔫',
			price: 80,
			priceInDiamonds: true,

			name: 'HK416',
			description: 'Um fuzil de assalto de alta qualidade.',
			data: {
				robberyChance: 0.95,
				bankHeistChance: 0.75
			}
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.AK47
		},
		create: {
			slug: ItemSlug.AK47,
			type: ItemType.Weapon,

			emoji: '🔫',
			price: 20,
			priceInDiamonds: true,

			name: 'AK47',
			description: 'Um fuzil de assalto de baixa qualidade.',
			data: {
				robberyChance: 0.75,
				bankHeistChance: 0.5
			}
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.M4A1
		},
		create: {
			slug: ItemSlug.M4A1,
			type: ItemType.Weapon,

			emoji: '🔫',
			price: 40,
			priceInDiamonds: true,

			name: 'M4A1',
			description: 'Um fuzil de assalto padrão.',
			data: {
				robberyChance: 0.85,
				bankHeistChance: 0.6
			}
		},
		update: {}
	});
}

/** Gets an item's ID from its slug. */
export async function getItemId(slug: ItemSlug | keyof typeof ItemSlug) {
	return (await container.database.item.findUnique({
		where: { slug },
		select: { id: true }
	}))!.id;
}

/** Parsers for items that have `data`. */
export const ZodParsers = {
	[ItemSlug.Pickaxe]: z.object({
		durability: z.number().positive().min(0).max(100)
	}),
	WeaponData: z.object({
		robberyChance: z.number().positive().min(0).max(1),
		bankHeistChance: z.number().positive().min(0).max(1)
	})
};
