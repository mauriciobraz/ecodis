import { TokenRegex } from '@sapphire/discord-utilities';
import { LogLevel } from '@sapphire/framework';
import { z } from 'zod';

export const configSchema = z.object({
	NODE_ENV: z.enum(['development', 'production']),
	DISCORD_TOKEN: z.string().regex(TokenRegex),

	LOG_LEVEL: z
		.enum(['Trace', 'Debug', 'Info', 'Warn', 'Error', 'Fatal', 'None'])
		.transform((value) => LogLevel[value]),

	OWNERS: z.string().transform((value) => value.split(','))
});

export type ConfigType = z.infer<typeof configSchema>;

// process.env.NODE_ENV is set by tsup at build time but it
// also allows for the environment variable to be set manually.
export const CONFIG = configSchema.parse({
	...process.env,
	NODE_ENV: process.env.NODE_ENV
});
