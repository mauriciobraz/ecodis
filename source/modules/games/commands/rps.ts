import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { pickRandom } from '@sapphire/utilities';

import { UserQueries } from '../../../utils/queries/user';
import { MINIMUM_BET_AMOUNT } from '../utilities';

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
	description: 'Inicie uma partida de pedra, papel e tesoura contra o bot.',

	generateDashLessAliases: true,
	generateUnderscoreLessAliases: true,

	aliases: [
		'pedra-papel-tesoura',
		'jogo-ppt',
		'jogar-ppt',
		'rps',
		'rock-paper-scissors',
		'play-rps'
	],
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
			await message.channel.send({
				content: `Você não tem dinheiro suficiente para apostar ${amount} moedas.`
			});

			return;
		}

		const { isTie, prize } = this.handleGame(choice, amount);

		console.log({
			prize
		});

		if (prize > 0) {
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
	private didUserWin(userChoice: string, machineChoice: string) {
		return (
			(userChoice.toLowerCase() === RPSChoice.Rock.toLowerCase() &&
				machineChoice.toLowerCase() === RPSChoice.Scissors.toLowerCase()) ||
			(userChoice.toLowerCase() === RPSChoice.Paper.toLowerCase() &&
				machineChoice.toLowerCase() === RPSChoice.Rock.toLowerCase()) ||
			(userChoice.toLowerCase() === RPSChoice.Scissors.toLowerCase() &&
				machineChoice.toLowerCase() === RPSChoice.Paper.toLowerCase())
		);
	}

	/** Handles the logic of this game and calculate the amount of prize. */
	private handleGame(userChoice: RPSChoice, bet: number) {
		const machineChoice = pickRandom(Object.values(RPSChoice)).toLowerCase();

		if (userChoice.toLowerCase() === machineChoice.toLowerCase()) {
			return {
				prize: 0,
				isTie: true
			};
		}

		console.log({
			machineChoice,
			userChoice
		});

		const didUserWin = this.didUserWin(userChoice.toLowerCase(), machineChoice.toLowerCase());

		if (didUserWin) {
			return {
				prize: bet + bet * 0.9,
				isTie: false
			};
		}

		return {
			prize: -bet,
			isTie: false
		};
	}
}
