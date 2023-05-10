export const MINIMUM_BET_AMOUNT = 1;

export const MINIMUM_BET_PRIZE = 100;
export const MAXIMUM_BET_PRIZE = 500;

/** Calculate a random prize between the minimum and maximum bet prize. */
export function calculatePrize() {
	return Math.floor(Math.random() * MAXIMUM_BET_PRIZE) + MINIMUM_BET_PRIZE;
}
