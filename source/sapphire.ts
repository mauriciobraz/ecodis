import { resolve } from 'path';

import { SapphireClient, container } from '@sapphire/framework';
import type { ClientOptions } from 'discord.js';

import { readdirRecursiveSync } from './utils/fs-utils';
import { PrismaClient } from '@prisma/client';

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

		return super.login(token);
	}

	public override async destroy() {
		await container.database.$disconnect();
		return super.destroy();
	}
}
