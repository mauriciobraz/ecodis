import { z } from 'zod';

import { ItemType } from '@prisma/client';
import { container } from '@sapphire/pieces';

export enum ItemSlug {
	Pickaxe = 'Pickaxe'
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
	})
};
