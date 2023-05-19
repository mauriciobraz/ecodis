import { readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Reads all subfolders recursively from the given directory.
 * @param directory Directory to read all subfolders recursively.
 * @param protectedDirs Directories to ignore.
 * @returns All subfolders from the given directory.
 *
 * @example
 * ```ts
 * readFoldersRecursively(join(__dirname, 'commands'));
 * // => ['admin', 'misc', 'mod', ...]
 * ```
 */
export function readdirRecursiveSync(dir: string): string[] {
	const filesAndDirs = readdirSync(dir);

	const dirs = filesAndDirs.filter((fileOrDir) => {
		return statSync(join(dir, fileOrDir)).isDirectory();
	});

	return dirs.reduce<string[]>((result, dirName) => {
		const subDir = join(dir, dirName);
		return result.concat(subDir, readdirRecursiveSync(subDir));
	}, []);
}

type AssetPathHint =
	| ['emojis', '_invisible.png']
	| ['emojis', 'mine_amethyst_fake.webp']
	| ['emojis', 'mine_amethyst.webp']
	| ['emojis', 'mine_diamond.gif']
	| ['emojis', 'mine_emerald_fake.webp']
	| ['emojis', 'mine_emerald.webp']
	| ['emojis', 'mine_ruby_fake.webp']
	| ['emojis', 'mine_ruby.webp']
	| ['emojis', 'mine_sapphire_fake.webp']
	| ['emojis', 'mine_sapphire.webp']
	| ['farm', 'animals', 'chicken.png']
	| ['farm', 'animals', 'horse.png']
	| ['farm', 'animals', 'rabbit.png']
	| ['farm', 'base_layer_1.png']
	| ['farm', 'base_layer_2.png']
	| ['farm', 'base_layer_light.png']
	| ['farm', 'base.png']
	| ['farm', 'beans', 'plant_beans_stage_1.png']
	| ['farm', 'beans', 'plant_beans_stage_2.png']
	| ['farm', 'beans', 'plant_beans_stage_3.png']
	| ['farm', 'cannabis', 'plant_cannabis_stage_1.png']
	| ['farm', 'cannabis', 'plant_cannabis_stage_2.png']
	| ['farm', 'cannabis', 'plant_cannabis_stage_3.png']
	| ['farm', 'pumpkin', 'plant_pumpkin_stage_1.png']
	| ['farm', 'pumpkin', 'plant_pumpkin_stage_2.png']
	| ['farm', 'pumpkin', 'plant_pumpkin_stage_3.png']
	| ['farm', 'wheat', 'plant_wheat_stage_1.png']
	| ['farm', 'wheat', 'plant_wheat_stage_2.png']
	| ['farm', 'wheat', 'plant_wheat_stage_3.png']
	| ['greenhouse', 'base.png']
	| ['greenhouse', 'light-25.png']
	| ['greenhouse', 'light-50.png']
	| ['greenhouse', 'pot.png']
	| ['greenhouse', 'pot_strawberry_stage_1.png']
	| ['greenhouse', 'pot_strawberry_stage_2.png']
	| ['greenhouse', 'pot_tomato_stage_1.png']
	| ['greenhouse', 'pot_tomato_stage_2.png']
	| ['mine.png'];

/**
 * Resolves the given path segments to the assets folder.
 * @param pathSegments Path segments to resolve.
 * @returns The resolved path.
 *
 * @example
 * ```ts
 * resolveToAssetPath('images', 'avatar.png');
 * // => '/home/.../assets/images/avatar.png'
 * ```
 */
export function resolveToAssetPath(...pathSegments: AssetPathHint | string[]): string {
	return join(__dirname, '..', '..', 'assets', ...pathSegments);
}
