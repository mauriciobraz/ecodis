import { resolve } from 'path';

import { SapphireClient } from '@sapphire/framework';
import type { ClientOptions } from 'discord.js';

import { readdirRecursiveSync } from './utils/fs-utils';

/**
 * Extends {@link SapphireClient} to add custom functionalities.
 *
 * @features
 * - Registers all stores in the `modules` folder.
 * - Alias for `interaction-handlers` store as `interactions`.
 */
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
}
