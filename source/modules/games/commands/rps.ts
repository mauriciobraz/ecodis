import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { pickRandom } from '@sapphire/utilities';

import { MINIMUM_BET_AMOUNT, calculatePrize } from '../utilities';
import { UserQueries } from '../../../utils/queries/user';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

enum RPSChoice {
	Rock = 'Pedra',
	Paper = 'Papel',
	Scissors = 'Tesoura'
}

const RPS_CHOICES: Record<RPSChoice, RegExp> = {
	[RPSChoice.Rock]: /^pedra$/i,
	[RPSChoice.Paper]: /^papel$/i,
	[RPSChoice.Scissors]: /^tesouras?$/i
};

@ApplyOptions<Command.Options>({
	name: 'ppt',
	aliases: ['pedra-papel-tesoura', 'rps'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class RockPaperScissorsCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const choiceResult = await args.pickResult('string');
		const amountResult = await args.pickResult('number');

		if (choiceResult.isErr()) {
			await message.reply({
				content: 'Você precisa escolher entre **pedra**, **papel** ou **tesoura**.'
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

		if (amount < MINIMUM_BET_AMOUNT) {
			await message.reply({
				content: 'Não podes depositar menos de 1 moeda!'
			});

			return;
		}

		if (!this.isRpsChoice(choice)) {
			await message.reply({
				content:
					'Opção inválida! Precisas de escolher entre **pedra**, **papel** ou **tesoura**.'
			});

			return;
		}

		const balances = await UserQueries.getUserBalances({
			userId: message.author.id,
			guildId: message.guildId
		});

		if (balances.balance < amount) {
			return message.channel.send({
				content: `Você não tem dinheiro suficiente para apostar ${amount} moedas.`
			});
		}

		const { isTie, prize } = this.handleGame(choice);

		if (prize !== 0) {
			const { updatedBalance } = await UserQueries.updateBalance({
				userId: message.author.id,
				guildId: message.guildId,
				balance: ['increment', prize]
			});

			await message.reply({
				content: `Ganhaste ${prize} moedas! O teu saldo atual é de ${updatedBalance} moedas.`
			});
		}

		if (prize < 0) {
			await message.reply({
				content: `Perdeste ${Math.abs(prize)} moedas!`
			});

			return;
		}

		if (isTie) {
			await message.reply({
				content: 'Empate!'
			});

			return;
		}

		await message.reply({
			content: `Ganhaste ${prize} moedas!`
		});
	}

	/** Checks if the provided choice is a valid Rock Paper Scissors choice. */
	private isRpsChoice(choice: string): choice is RPSChoice {
		return Object.values(RPS_CHOICES).some((regex) => regex.test(choice));
	}

	/** Checks if the user won the game. */
	private didUserWin(userChoice: RPSChoice, machineChoice: RPSChoice) {
		return (
			(userChoice === RPSChoice.Rock && machineChoice === RPSChoice.Scissors) ||
			(userChoice === RPSChoice.Paper && machineChoice === RPSChoice.Rock) ||
			(userChoice === RPSChoice.Scissors && machineChoice === RPSChoice.Paper)
		);
	}

	/** Handles the logic of this game and calculate the amount of prize. */
	private handleGame(userChoice: RPSChoice) {
		const machineChoice = pickRandom(Object.keys(RPS_CHOICES)) as RPSChoice;

		if (userChoice === machineChoice) {
			return {
				prize: 0,
				isTie: true
			};
		}

		if (this.didUserWin(userChoice, machineChoice)) {
			return {
				prize: calculatePrize(),
				isTie: false
			};
		}

		return {
			prize: -calculatePrize(),
			isTie: false
		};
	}
}
