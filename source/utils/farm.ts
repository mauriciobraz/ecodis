import { z } from 'zod';
import { ItemSlug } from './items';

export const SEEDS_SLUGS = [
	ItemSlug.Wheat,
	ItemSlug.Beans,
	ItemSlug.Pumpkin,
	ItemSlug.Cannabis
] as const;

export type SeedSlug = (typeof SEEDS_SLUGS)[number];

/**
 * DEFAULT_FARM_DIMENSION represents the default size (width and height) of the farm grid.
 * It is used to set the dimensions of the purchasedArea, plantData, and related schemas.
 */
const FARM_DIMENSION = 3;

/**
 * Validation schema for `Farm.purchasedArea`.
 * A 2D array of booleans with a minimum and maximum size equal to FARM_SIZE.
 */
export const PurchasedAreaSchema = z
	.array(z.array(z.boolean()).min(FARM_DIMENSION).max(FARM_DIMENSION))
	.min(FARM_DIMENSION)
	.max(FARM_DIMENSION);

/**
 * Validation schema for the data of a single plant in `Farm.plantData`.
 * Contains an `itemId` (string) and a `growthRate` (number from 0 to 100).
 */
export const PlantDataSchema = z.object({
	itemId: z.string(),
	itemSlug: z.enum(SEEDS_SLUGS),
	createdAt: z.string().datetime(),
	growthRate: z.number().min(0).max(100)
});

/**
 * Validation schema for `Farm.plantData` as a whole.
 * A 2D array of plant data or nulls, with a minimum and maximum size equal to FARM_SIZE.
 */
export const PlantDataGridSchema = z
	.array(z.array(PlantDataSchema.or(z.null())).min(FARM_DIMENSION).max(FARM_DIMENSION))
	.min(FARM_DIMENSION)
	.max(FARM_DIMENSION);

export type PurchasedArea = z.infer<typeof PurchasedAreaSchema>;
export type PlantDataGrid = z.infer<typeof PlantDataGridSchema>;

export type PlantData = NonNullable<PlantDataGrid[number][number]>;
