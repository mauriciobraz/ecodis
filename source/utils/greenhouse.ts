import { z } from 'zod';
import { ItemSlug } from './items';

export const SEEDS_SLUGS = [ItemSlug.Strawberry, ItemSlug.RedBerries] as const;

/**
 * DEFAULT_GREENHOUSE_DIMENSION represents the default size (width and height) of the gREENHOUSE grid.
 * It is used to set the dimensions of the purchasedArea, plantData, and related schemas.
 */
const GREENHOUSE_DIMENSION = 3;

/**
 * Validation schema for `GREENHOUSE.purchasedArea`.
 * A 2D array of booleans with a minimum and maximum size equal to GREENHOUSE_SIZE.
 */
export const PurchasedAreaSchema = z
	.array(z.array(z.boolean()).min(GREENHOUSE_DIMENSION).max(GREENHOUSE_DIMENSION))
	.min(GREENHOUSE_DIMENSION)
	.max(GREENHOUSE_DIMENSION);

/**
 * Validation schema for the data of a single plant in `GREENHOUSE.plantData`.
 * Contains an `itemId` (string) and a `growthRate` (number from 0 to 100).
 */
export const PlantDataSchema = z.object({
	itemId: z.string(),
	itemSlug: z.enum(SEEDS_SLUGS),
	createdAt: z.string().datetime(),
	growthRate: z.number().min(0).max(100)
});

/**
 * Validation schema for `GREENHOUSE.plantData` as a whole.
 * A 2D array of plant data or nulls, with a minimum and maximum size equal to GREENHOUSE_SIZE.
 */
export const PlantDataGridSchema = z
	.array(
		z.array(PlantDataSchema.or(z.null())).min(GREENHOUSE_DIMENSION).max(GREENHOUSE_DIMENSION)
	)
	.min(GREENHOUSE_DIMENSION)
	.max(GREENHOUSE_DIMENSION);

export type PurchasedArea = z.infer<typeof PurchasedAreaSchema>;
export type PlantDataGrid = z.infer<typeof PlantDataGridSchema>;

export type PlantData = NonNullable<PlantDataGrid[number][number]>;
