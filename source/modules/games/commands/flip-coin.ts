import { Command } from '@sapphire/framework';
import { pickRandom } from '@sapphire/utilities';

import { MINIMUM_BET_PRIZE, calculatePrize } from '../utilities';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { ApplyOptions } from '@sapphire/decorators';

enum FlipCoinChoice {
	Heads = 'Cara',
	Tails = 'Coroa'
}

const FLIP_COIN_CHOICES: Record<FlipCoinChoice, RegExp> = {
	[FlipCoinChoice.Heads]: /^cara(s)?$/i,
	[FlipCoinChoice.Tails]: /^coroa(s)?$/i
};

@ApplyOptions<Command.Options>({
	name: 'cara-coroa',
	aliases: ['cara-coroa', 'flip-coin', 'fc'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class FlipCoinCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const choice = await args.pick('string');
		const amount = await args.pick('number');

		if (amount < MINIMUM_BET_PRIZE) {
			await message.reply({
				content: 'Não podes depositar menos de 1 moeda!'
			});

			return;
		}

		if (!this.isFlipCoinChoice(choice)) {
			await message.reply({
				content: 'Você precisa escolher entre cara ou coroa.'
			});

			return;
		}

		const { prize } = this.handleGame(choice);

		if (prize !== 0) {
			const user = await this.container.database.user.upsert({
				where: {
					discordId: message.author.id
				},
				create: {
					discordId: message.author.id,
					userGuildBalances: {
						create: {
							guild: {
								connectOrCreate: {
									where: { discordId: message.guildId },
									create: { discordId: message.guildId }
								}
							}
						}
					}
				},
				update: {},
				select: {
					userGuildBalances: {
						select: {
							id: true,
							balance: true
						}
					},
					energy: true
				}
			});

			const userGuildBalance = user.userGuildBalances[0];

			await this.container.database.userGuildBalance.update({
				where: {
					id: userGuildBalance.id
				},
				data: {
					balance: {
						increment: prize
					}
				}
			});
		}

		if (prize < 0) {
			await message.reply({
				content: `Perdeste ${Math.abs(prize)} moedas!`
			});

			return;
		}

		await message.reply({
			content: `Ganhaste ${prize} moedas!`
		});
	}

	/** Checks if the choice is a valid flip coin choice. */
	private isFlipCoinChoice(userChoice: string) {
		return Object.values(FLIP_COIN_CHOICES).some((choice) => choice.test(userChoice));
	}

	/** Handles the logic of flip coin game */
	private handleGame(userChoice: string) {
		const machineChoice = pickRandom(Object.keys(FLIP_COIN_CHOICES));

		if (userChoice.toLowerCase() === machineChoice.toLowerCase()) {
			return {
				prize: calculatePrize()
			};
		}

		return {
			prize: -calculatePrize()
		};
	}
}
