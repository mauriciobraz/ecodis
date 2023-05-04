import '@sapphire/pieces';
import type { PrismaClient } from '@prisma/client';

declare module '@sapphire/pieces' {
	interface Container {
		database: PrismaClient;
	}
}
