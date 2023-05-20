import '@sapphire/pieces';
import type { PrismaClient } from '@prisma/client';
import type { Image } from 'canvas';

declare module '@sapphire/pieces' {
	interface Container {
		database: PrismaClient;
		canvasImages: {
			base: Image;
			baseLayers: Image[];
			baseLights: Image;
			plants: {
				Beans: Image[];
				Cannabis: Image[];
				Pumpkin: Image[];
				Wheat: Image[];
			};
		};
		canvasGreenhouseImages: {
			base: Image;
			baseLights: Image[];
			pot: Image;
			potStrawberryStage1: Image;
			potStrawberryStage2: Image;
			potTomatoStage1: Image;
			potTomatoStage2: Image;
		};
	}
}
