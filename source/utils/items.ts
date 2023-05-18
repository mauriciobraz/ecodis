import { z } from 'zod';

import { ItemType } from '@prisma/client';
import { container } from '@sapphire/pieces';

export enum ItemSlug {
	IronPickaxe = 'IronPickaxe',
	DiamondPickaxe = 'DiamondPickaxe',

	Sapphire = 'Sapphire',
	Amethyst = 'Amethyst',
	Diamond = 'Diamond',
	Emerald = 'Emerald',
	Ruby = 'Ruby',

	Banana = 'Banana',
	Chocolate = 'Chocolate',
	Cafe = 'Café',
	RedBull = 'RedBull',

	Egg = 'Egg',

	Soy = 'Soy',
	Wheat = 'Wheat',
	Beans = 'Beans',
	Pumpkin = 'Pumpkin',
	Cannabis = 'Cannabis',

	Strawberry = 'Strawberry',
	RedBerries = 'RedBerries',
	Fertilizer = 'Fertilizer',

	FirearmsLicense = 'FirearmsLicense',
	HK416 = 'HK416',
	AK47 = 'AK47',
	M4A1 = 'M4A1'
}

const CommonSchema = z.object({
	/** If the user has this item and a cop searches him, it'll warn the cop about it. */
	illegal: z.union([z.boolean(), z.enum(['IF_NOT FirearmsLicense'])]).default(false)
});

/** Parsers for items that have `data`. */
export const ZodParsers = {
	UserPickaxe: CommonSchema.extend({
		/** The amount of durability the pickaxe has (it's used to mine blocks). */
		durability: z.number().positive().min(0),

		/** Whether an item pickaxe is unique or not. */
		unique: z.boolean().default(true)
	}),

	WeaponData: CommonSchema.extend({
		/** The chance of success for a robbery with this weapon. */
		robberyChance: z.number().positive().min(0).max(1),

		/** The chance of success for a bank heist with this weapon. */
		bankHeistChance: z.number().positive().min(0).max(1)
	}),

	Seed: CommonSchema.extend({
		/** The time it takes for a seed to grow into a fully grown plant. */
		growthTime: z.number().positive().min(0),

		/** The amount of produce or harvest obtained from a fully grown plant. */
		yield: z.number().positive().min(0),

		/** The list of diseases that can affect a plant. */
		diseases: z.array(z.string())
	}),

	Consumable: CommonSchema.extend({
		/** The amount of energy that a consumable restores. */
		energy: z.number().positive().min(0)
	})
};

export const DEFAULT_ITEM_DATA: Partial<Record<ItemSlug, object>> = {
	[ItemSlug.IronPickaxe]: {
		durability: 30,
		unique: true
	} as z.infer<typeof ZodParsers.UserPickaxe>,

	[ItemSlug.DiamondPickaxe]: {
		durability: 90,
		unique: true
	} as z.infer<typeof ZodParsers.UserPickaxe>,

	// Consumables

	[ItemSlug.Egg]: {
		energy: 10
	} as z.infer<typeof ZodParsers.Consumable>,

	// Seeds
	// Seeds
	// Seeds

	[ItemSlug.Soy]: {
		illegal: false,
		growthTime: 3,
		yield: 10,
		diseases: []
	} as z.infer<typeof ZodParsers.Seed>,

	[ItemSlug.Wheat]: {
		illegal: false,
		growthTime: 4,
		yield: 8,
		diseases: []
	} as z.infer<typeof ZodParsers.Seed>,

	[ItemSlug.Beans]: {
		illegal: false,
		growthTime: 5,
		yield: 6,
		diseases: []
	} as z.infer<typeof ZodParsers.Seed>,

	[ItemSlug.Pumpkin]: {
		illegal: false,
		growthTime: 6,
		yield: 4,
		diseases: []
	} as z.infer<typeof ZodParsers.Seed>,

	[ItemSlug.Cannabis]: {
		illegal: true,
		growthTime: 7,
		yield: 3,
		diseases: []
	} as z.infer<typeof ZodParsers.Seed>,

	// TODO: CHANGE GROWTH TIME

	[ItemSlug.Strawberry]: {
		illegal: true,
		growthTime: 3.5,
		yield: 3,
		diseases: []
	} as z.infer<typeof ZodParsers.Seed>,

	[ItemSlug.RedBerries]: {
		illegal: true,
		growthTime: 3.5,
		yield: 3,
		diseases: []
	} as z.infer<typeof ZodParsers.Seed>,

	// Weapons
	// Weapons
	// Weapons

	[ItemSlug.HK416]: {
		illegal: 'IF_NOT FirearmsLicense',
		robberyChance: 0.95,
		bankHeistChance: 0.75
	} as z.infer<typeof ZodParsers.WeaponData>,

	[ItemSlug.AK47]: {
		illegal: 'IF_NOT FirearmsLicense',
		robberyChance: 0.75,
		bankHeistChance: 0.5
	} as z.infer<typeof ZodParsers.WeaponData>,

	[ItemSlug.M4A1]: {
		illegal: 'IF_NOT FirearmsLicense',
		robberyChance: 0.85,
		bankHeistChance: 0.6
	} as z.infer<typeof ZodParsers.WeaponData>
};

/** Creates all the items if they don't exist in the database. */
export async function createItemsIfNotExists() {
	await container.database.item.upsert({
		where: {
			slug: ItemSlug.IronPickaxe
		},
		create: {
			slug: ItemSlug.IronPickaxe,
			type: ItemType.Tool,

			emoji: '<:stone_pickaxe:1106218448041812079>',
			price: 100,

			name: 'Picareta de Ferro',
			description: 'Uma picareta normal de ferro.',

			data: DEFAULT_ITEM_DATA[ItemSlug.IronPickaxe]
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.DiamondPickaxe
		},
		create: {
			slug: ItemSlug.DiamondPickaxe,
			type: ItemType.Tool,

			emoji: '<:diamond_pickaxe:1106218468497445015>',
			price: 300,

			name: 'Picareta de Diamante',
			description: 'Uma picareta de diamante bem resistente',

			data: DEFAULT_ITEM_DATA[ItemSlug.DiamondPickaxe]
		},
		update: {}
	});

	// Ores
	// Ores
	// Ores

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Diamond
		},
		create: {
			slug: ItemSlug.Diamond,
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

	// Consumables
	// Consumables
	// Consumables

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Egg
		},
		create: {
			slug: ItemSlug.Egg,
			type: ItemType.Tool,

			emoji: '🥚',
			price: 300,

			name: 'Ovos de Galinha',
			description: 'Ovos de galinha para fazer restaurar sua energia.',

			data: DEFAULT_ITEM_DATA[ItemSlug.Egg]
		},
		update: {}
	});

	// Seeds
	// Seeds
	// Seeds

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Soy
		},
		create: {
			slug: ItemSlug.Soy,
			type: ItemType.Farm,

			emoji: '🌱',
			price: 10,

			name: 'Soja',
			description: 'Sementes de soja para plantar.',

			data: DEFAULT_ITEM_DATA[ItemSlug.Soy]
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Wheat
		},
		create: {
			slug: ItemSlug.Wheat,
			type: ItemType.Farm,

			emoji: '🌾',
			price: 15,

			name: 'Trigo',
			description: 'Sementes de trigo para plantar.',

			data: DEFAULT_ITEM_DATA[ItemSlug.Wheat]
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Beans
		},
		create: {
			slug: ItemSlug.Beans,
			type: ItemType.Farm,

			emoji: '🌱',
			price: 12,

			name: 'Feijão',
			description: 'Sementes de feijão para plantar.',

			data: DEFAULT_ITEM_DATA[ItemSlug.Beans]
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Pumpkin
		},
		create: {
			slug: ItemSlug.Pumpkin,
			type: ItemType.Farm,

			emoji: '🎃',
			price: 20,

			name: 'Abóbora',
			description: 'Sementes de abóbora para plantar.',

			data: DEFAULT_ITEM_DATA[ItemSlug.Pumpkin]
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Cannabis
		},
		create: {
			slug: ItemSlug.Cannabis,
			type: ItemType.Farm,

			emoji: '🌿',
			price: 25,

			name: 'Cannabis',
			description: 'Sementes de cannabis para plantar.',

			data: DEFAULT_ITEM_DATA[ItemSlug.Cannabis]
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Strawberry
		},
		create: {
			slug: ItemSlug.Strawberry,
			type: ItemType.Greenhouse,

			emoji: '🍓',
			price: 100,

			name: 'Morango',
			description: 'Semente para plantar morangos na estufa.',

			data: DEFAULT_ITEM_DATA[ItemSlug.Strawberry]
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.RedBerries
		},
		create: {
			slug: ItemSlug.RedBerries,
			type: ItemType.Greenhouse,

			emoji: '🍒',
			price: 100,

			name: 'Frutas Vermelhas',
			description: 'Semente para plantar frutas vermelhas na estufa.',

			data: DEFAULT_ITEM_DATA[ItemSlug.Strawberry]
		},
		update: {}
	});

	await container.database.item.upsert({
		where: {
			slug: ItemSlug.Fertilizer
		},
		create: {
			slug: ItemSlug.Fertilizer,
			type: ItemType.Greenhouse,

			emoji: '🌱',
			price: 150,

			name: 'Adubo',
			description: 'Adubo para poder plantar na estufa.',

			data: DEFAULT_ITEM_DATA[ItemSlug.Strawberry]
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
			description: 'Libera o acesso para usar armas legalmente.'
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

			data: DEFAULT_ITEM_DATA[ItemSlug.HK416]
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

			data: DEFAULT_ITEM_DATA[ItemSlug.AK47]
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

			data: DEFAULT_ITEM_DATA[ItemSlug.M4A1]
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

/** Checks whether a user has more than one of a specific item. */
export async function userHasMoreThanOneUniqueItem(
	slugs: (ItemSlug | keyof typeof ItemSlug)[],
	userId: string
) {
	const count = await container.database.inventoryItem.count({
		where: {
			inventory: {
				user: {
					user: {
						discordId: userId
					}
				}
			},
			item: {
				slug: {
					in: slugs
				}
			}
		}
	});

	return count >= 1;
}
