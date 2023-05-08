import 'dotenv/config';

import '@sapphire/plugin-hmr/register';
import '@sapphire/plugin-logger/register';
import '@sapphire/plugin-subcommands/register';

import Bree from 'bree';
import { container } from '@sapphire/pieces';
import { GatewayIntentBits } from 'discord.js';

import { CustomSapphireClient } from './sapphire';
import { CONFIG } from './utils/constants/config';
import { join } from 'path';

const client = new CustomSapphireClient({
	regexPrefix: /^!/,
	defaultPrefix: ['!'],
	baseUserDirectory: __dirname,
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	],
	hmr: {
		enabled: process.env.NODE_ENV === 'development'
	},
	logger: {
		level: CONFIG.LOG_LEVEL
	},
	loadMessageCommandListeners: true
});

const bree = new Bree({
	root: join(__dirname, 'jobs'),
	logger: container.logger,
	jobs: [
		{
			name: 'regenerations',
			interval: 'every 30 seconds'
		}
	]
});

async function main(): Promise<void> {
	await client.login(CONFIG.DISCORD_TOKEN);
	await bree.start();
}

// Ensure that the main function is only called when this file is run directly
// (eg. "ts-node source/index.ts"), and not when it is imported by another file.

if (require.main === module) {
	void main();
}
