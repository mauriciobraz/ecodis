import 'dotenv/config';

import '@sapphire/plugin-hmr/register';
import '@sapphire/plugin-logger/register';
import '@sapphire/plugin-subcommands/register';

import { GatewayIntentBits } from 'discord.js';

import { CustomSapphireClient } from './sapphire';
import { CONFIG } from './utils/constants/config';

const client = new CustomSapphireClient({
	baseUserDirectory: __dirname,
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages
	],
	hmr: {
		enabled: process.env.NODE_ENV === 'development'
	},
	logger: {
		level: CONFIG.LOG_LEVEL
	}
});

async function main(): Promise<void> {
	await client.login(CONFIG.DISCORD_TOKEN);
}

// Ensure that the main function is only called when this file is run directly
// (eg. "ts-node source/index.ts"), and not when it is imported by another file.

if (require.main === module) {
	void main();
}
