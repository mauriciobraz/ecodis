import type { MineButtonInteractionHandlerParsedData } from '../../../modules/games/interactions/mine-button-interaction';

export interface MineGridItem {
	type: MineGrid;
	value: number;
}

export enum MineGrid {
	Sapphire = 'Sapphire',
	Amethyst = 'Amethyst',
	Diamond = 'Diamond',
	Emerald = 'Emerald',
	Stone = 'Stone',
	Ruby = 'Ruby'
}

export const MINE_DIAMOND_VALUE = -2;
export const MINE_STONE_VALUE = -1;

export const MINE_GRID_VALUES = {
	// Special Gems
	[MineGrid.Stone]: MINE_STONE_VALUE,
	[MineGrid.Diamond]: MINE_DIAMOND_VALUE,

	// Common Gems
	[MineGrid.Emerald]: 500,
	[MineGrid.Ruby]: 300,
	[MineGrid.Sapphire]: 300,
	[MineGrid.Amethyst]: 100
};

const CUSTOM_ID_IDENTIFIER = 'MBIH';
const CUSTOM_ID_SEPARATOR = '&';

/**
 * Generates a custom id for a button interaction based on the type of the grid item.
 * @returns A string that uniquely identifies the button interaction.
 */
export function generateCustomId(type: MineGrid, messageId: string, index: number) {
	return `${CUSTOM_ID_IDENTIFIER}${CUSTOM_ID_SEPARATOR}${type}${CUSTOM_ID_SEPARATOR}${messageId}${CUSTOM_ID_SEPARATOR}${index}`;
}

/**
 * Parses a custom id from a button interaction and returns the type of the grid item.
 * @returns The type of the grid item or null if the custom id is invalid.
 */
export function parseCustomId(customId: string): MineButtonInteractionHandlerParsedData | null {
	const [identifier, type, messageId, index] = customId.split(CUSTOM_ID_SEPARATOR);
	const isMineGrid = Object.values(MineGrid).includes(type);

	if (identifier !== CUSTOM_ID_IDENTIFIER || !isMineGrid) {
		return null;
	}

	return {
		messageId,
		index: Number(index),
		type: type as MineGrid
	};
}
