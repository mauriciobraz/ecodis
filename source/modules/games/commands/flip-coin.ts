import { Command } from '@sapphire/framework';
import { pickRandom } from '@sapphire/utilities';

import { MINIMUM_BET_PRIZE, calculatePrize } from '../utilities';
import { UserQueries } from '../../../utils/queries/user';

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
		const choiceResult = await args.pickResult('string');
		const amountResult = await args.pickResult('number');

		if (choiceResult.isErr()) {
			await message.reply({
				content: 'Você precisa escolher entre **cara** ou **coroa**.'
			});

			return;
		}

		if (amountResult.isErr()) {
			await message.reply({
				content: 'Você precisa escolher um valor para apostar (por exemplo, 100).'
			});

			return;
		}

		const choice = choiceResult.unwrap();
		const amount = amountResult.unwrap();

		if (amount < MINIMUM_BET_PRIZE) {
			await message.reply({
				content: 'Não podes depositar menos de 1 moeda!'
			});

			return;
		}

		const balances = await UserQueries.getUserBalances({
			userId: message.author.id,
			guildId: message.guildId
		});

		if (balances.balance < amount) {
			await message.channel.send({
				content: `Você não tem dinheiro suficiente para apostar ${amount} moedas.`
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
			const { updatedBalance } = await UserQueries.updateBalance({
				userId: message.author.id,
				guildId: message.guildId,
				balance: ['increment', prize]
			});

			await message.reply({
				content: `Ganhaste ${prize} moedas! O teu saldo atual é de ${updatedBalance} moedas.`
			});

			return;
		}

		if (prize < 0) {
			await message.reply({
				content: `Perdeste ${Math.abs(prize)} moedas!`
			});
		} else if (prize === 0) {
			await message.reply({
				content: 'Empate! Nenhuma moeda ganha ou perdida.'
			});
		}
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
