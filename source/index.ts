import 'dotenv/config';

import '@sapphire/plugin-hmr/register';
import '@sapphire/plugin-logger/register';
import '@sapphire/plugin-subcommands/register';

import Bree from 'bree';
import { GatewayIntentBits, Partials } from 'discord.js';

import { join } from 'path';
import { CustomSapphireClient } from './sapphire';
import { CONFIG } from './utils/constants/config';
import { resolveToAssetPath } from './utils/fs-utils';
import { container } from '@sapphire/pieces';
import { Image, createCanvas, loadImage } from 'canvas';

const client = new CustomSapphireClient({
	regexPrefix: /^!/,
	defaultPrefix: ['!'],
	baseUserDirectory: __dirname,
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessageReactions
	],
	partials: [Partials.Reaction],
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
	jobs: [
		{
			name: 'regenerations',
			interval: 'every 5 seconds'
		},
		{
			name: 'growthRate',
			interval: 'every 5 seconds'
		},
		{
			name: 'animalsEnergy',
			interval: 'every 60 seconds'
		},
		{
			name: 'animalsProductions',
			interval: 'every 1 hour'
		}
	]
});

const IMAGES = {
	BASE: resolveToAssetPath('farm', 'base.png'),
	BASE_LAYERS: [
		resolveToAssetPath('farm', 'base_layer_1.png'),
		resolveToAssetPath('farm', 'base_layer_2.png')
	],
	BASE_LIGHTS: resolveToAssetPath('farm', 'base_layer_light.png'),

	PLANTS: {
		Beans: [
			resolveToAssetPath('farm', 'beans', 'plant_beans_stage_1.png'),
			resolveToAssetPath('farm', 'beans', 'plant_beans_stage_2.png'),
			resolveToAssetPath('farm', 'beans', 'plant_beans_stage_3.png')
		],
		Cannabis: [
			resolveToAssetPath('farm', 'cannabis', 'plant_cannabis_stage_1.png'),
			resolveToAssetPath('farm', 'cannabis', 'plant_cannabis_stage_2.png'),
			resolveToAssetPath('farm', 'cannabis', 'plant_cannabis_stage_3.png')
		],
		Pumpkin: [
			resolveToAssetPath('farm', 'pumpkin', 'plant_pumpkin_stage_1.png'),
			resolveToAssetPath('farm', 'pumpkin', 'plant_pumpkin_stage_2.png'),
			resolveToAssetPath('farm', 'pumpkin', 'plant_pumpkin_stage_3.png')
		],
		Wheat: [
			resolveToAssetPath('farm', 'wheat', 'plant_wheat_stage_1.png'),
			resolveToAssetPath('farm', 'wheat', 'plant_wheat_stage_2.png'),
			resolveToAssetPath('farm', 'wheat', 'plant_wheat_stage_3.png')
		]
	}
};

const loadImageAndResizeCanvas = (imagePath: string, scale = 2) => {
	const image = new Image();

	image.src = imagePath;
	image.onload = () => {
		const canvas = createCanvas(image.width / scale, image.height / scale);
		const ctx = canvas.getContext('2d');
		ctx.drawImage(image, 0, 0, image.width / scale, image.height / scale);
	};

	return image;
};

async function main(): Promise<void> {
	await client.login(CONFIG.DISCORD_TOKEN);
	await bree.start();

	container.canvasImages = {
		base: loadImageAndResizeCanvas(IMAGES.BASE),
		baseLayers: await Promise.all(IMAGES.BASE_LAYERS.map(loadImageAndResizeCanvas)),
		baseLights: loadImageAndResizeCanvas(IMAGES.BASE_LIGHTS),
		plants: {
			Beans: await Promise.all(IMAGES.PLANTS.Beans.map(loadImageAndResizeCanvas)),
			Cannabis: await Promise.all(IMAGES.PLANTS.Cannabis.map(loadImageAndResizeCanvas)),
			Pumpkin: await Promise.all(IMAGES.PLANTS.Pumpkin.map(loadImageAndResizeCanvas)),
			Wheat: await Promise.all(IMAGES.PLANTS.Wheat.map(loadImageAndResizeCanvas))
		}
	};

	container.canvasGreenhouseImages = {
		base: loadImageAndResizeCanvas(resolveToAssetPath('greenhouse', 'base.png')),
		baseLights: [
			loadImageAndResizeCanvas(resolveToAssetPath('greenhouse', 'light-25.png')),
			loadImageAndResizeCanvas(resolveToAssetPath('greenhouse', 'light-50.png'))
		],
		pot: loadImageAndResizeCanvas(resolveToAssetPath('greenhouse', 'pot.png')),
		potStrawberryStage1: loadImageAndResizeCanvas(
			resolveToAssetPath('greenhouse', 'pot_strawberry_stage_1.png')
		),
		potStrawberryStage2: loadImageAndResizeCanvas(
			resolveToAssetPath('greenhouse', 'pot_strawberry_stage_2.png')
		),
		potTomatoStage1: loadImageAndResizeCanvas(
			resolveToAssetPath('greenhouse', 'pot_tomato_stage_1.png')
		),
		potTomatoStage2: loadImageAndResizeCanvas(
			resolveToAssetPath('greenhouse', 'pot_tomato_stage_2.png')
		)
	};
}

// Ensure that the main function is only called when this file is run directly
// (eg. "ts-node source/index.ts"), and not when it is imported by another file.

if (require.main === module) {
	void main();
}
