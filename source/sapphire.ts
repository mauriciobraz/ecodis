import { resolve } from 'path';

import { PrismaClient } from '@prisma/client';
import { SapphireClient, container } from '@sapphire/framework';
import { createPrismaRedisCache } from 'prisma-redis-middleware';

import { readdirRecursiveSync } from './utils/fs-utils';

import type { ClientOptions } from 'discord.js';
import { createItemsIfNotExists } from './utils/items';

export class CustomSapphireClient extends SapphireClient {
	public constructor(options: ClientOptions) {
		super(options);

		for (const folder of readdirRecursiveSync(resolve(__dirname, 'modules'))) {
			const folderName = folder.split('/').pop();

			if (folderName === 'interactions') {
				this.stores.get('interaction-handlers').registerPath(folder);
			} else {
				this.stores.registerPath(folder);
			}
		}
	}

	public override async login(token?: string) {
		container.database = new PrismaClient();
		await container.database.$connect();

		container.database.$use(
			createPrismaRedisCache({
				storage: {
					type: 'memory',
					options: {
						size: 1024,
						log: container.logger
					}
				},
				models: [
					{
						model: 'Item',
						cacheTime: 720
					}
				]
			})
		);

		await createItemsIfNotExists();

		return super.login(token);
	}

	public override async destroy() {
		await container.database.$disconnect();
		return super.destroy();
	}
}
