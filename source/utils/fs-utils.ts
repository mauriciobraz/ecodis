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
