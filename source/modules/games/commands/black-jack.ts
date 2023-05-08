import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import dedent from 'ts-dedent';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

enum Suit {
	Hearts = '♥️',
	Diamonds = '♦️',
	Clubs = '♣️',
	Spades = '♠️'
}

@ApplyOptions<Command.Options>({
	name: 'blackjack',
	aliases: ['bj', '21'],
	description: 'Jogue uma partida de blackjack!',
	preconditions: ['GuildOnly']
})
export class BlackjackCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const amount = await args.pick('number');

		const user = await this.container.database.user.upsert({
			where: {
				discordId: message.author.id
			},
			create: {
				discordId: message.author.id
			},
			update: {},
			select: {
				balance: true
			}
		});

		if (user.balance < amount) {
			await message.reply('Você não tem moedas suficientes para fazer essa aposta.');
			return;
		}

		const deck = new Deck();

		const userHand = [deck.drawCard(), deck.drawCard()];
		const botHand = [deck.drawCard(), deck.drawCard()];

		let userSum = this.calculateHand(userHand);
		let botSum = this.calculateHand(botHand.slice(0, 1));

		const reply = await message.reply({
			content: dedent`
        Sua mão: ${this.formatHand(userHand)} (${userSum})
        Mão do Bot: ${this.formatHand(botHand.slice(0, 1))} (${botSum})
        Deseja pedir mais uma carta? (yes/no)
      `
		});

		let keepPlaying = true;

		while (keepPlaying && userSum < 21) {
			const collected = await message.channel.awaitMessages({
				filter: (m) =>
					m.author.id === message.author.id &&
					['yes', 'no'].includes(m.content.toLowerCase()),
				max: 1,
				time: 15000
			});

			if (!collected.size) {
				await message.reply('Tempo esgotado, desistindo da partida.');
				return;
			}

			const answer = collected.first()?.content.toLowerCase();

			if (answer === 'no') {
				keepPlaying = false;
			} else {
				userHand.push(deck.drawCard());
				userSum = this.calculateHand(userHand);

				if (userSum > 21) {
					await message.reply({
						content: dedent`
              Sua mão: ${this.formatHand(userHand)} (${userSum})
              Você ultrapassou 21, perdeu ${amount} moedas.
            `
					});

					await this.container.database.user.update({
						where: {
							discordId: message.author.id
						},
						data: {
							balance: {
								decrement: amount
							}
						}
					});

					return;
				}

				await reply.edit({
					content: dedent`
            Sua mão: ${this.formatHand(userHand)} (${userSum})
            Mão do Bot: ${this.formatHand(botHand.slice(0, 1))} (${botSum})
            Deseja pedir mais uma carta? (yes/no)
          `
				});
			}
		}

		while (botSum < 17) {
			botHand.push(deck.drawCard());
			botSum = this.calculateHand(botHand);

			await reply.edit({
				content: dedent`
          Sua mão: ${this.formatHand(userHand)} (${userSum})
          Mão do Bot: ${this.formatHand(botHand)} (${botSum})
        `
			});
		}

		if (botSum > 21 || userSum > botSum) {
			await message.reply({
				content: dedent`
          Sua mão: ${this.formatHand(userHand)} (${userSum})
          Mão do Bot: ${this.formatHand(botHand)} (${botSum})
          Você ganhou ${amount} moedas!
        `
			});

			await this.container.database.user.update({
				where: {
					discordId: message.author.id
				},
				data: {
					balance: {
						increment: amount
					}
				}
			});
		} else if (userSum < botSum) {
			await message.reply({
				content: dedent`
          Sua mão: ${this.formatHand(userHand)} (${userSum})
          Mão do Bot: ${this.formatHand(botHand)} (${botSum})
          Você perdeu ${amount} moedas.
        `
			});

			await this.container.database.user.update({
				where: {
					discordId: message.author.id
				},
				data: {
					balance: {
						decrement: amount
					}
				}
			});
		} else {
			await message.reply({
				content: dedent`
          Sua mão: ${this.formatHand(userHand)} (${userSum})
          Mão do Bot: ${this.formatHand(botHand)} (${botSum})
          Foi um empate!
        `
			});
		}
	}

	/** Calculates the value of a hand of cards. */
	private calculateHand(hand: Card[]): number {
		let sum = 0;
		let numAces = 0;

		for (const card of hand) {
			if (card.value === 1) {
				numAces++;
			} else if (card.value > 10) {
				sum += 10;
			} else {
				sum += card.value;
			}
		}

		for (let i = 0; i < numAces; i++) {
			if (sum + 11 <= 21) {
				sum += 11;
			} else {
				sum += 1;
			}
		}

		return sum;
	}

	/** Formats a hand of cards into a string. */
	private formatHand(hand: Card[]): string {
		return hand.map((card) => `${card.symbol}${card.suit}`).join(' ');
	}
}

class Card {
	public readonly symbol: string;

	public constructor(public readonly suit: Suit, public readonly value: number) {
		switch (value) {
			case 1:
				this.symbol = 'A';
				break;

			case 11:
				this.symbol = 'J';
				break;

			case 12:
				this.symbol = 'Q';
				break;

			case 13:
				this.symbol = 'K';
				break;

			default:
				this.symbol = value.toString();
		}
	}
}

class Deck {
	private cards: Card[];

	public constructor() {
		this.cards = [];

		for (const suit of Object.values(Suit)) {
			for (let value = 1; value <= 13; value++) {
				this.cards.push(new Card(suit, value));
			}
		}

		this.shuffle();
	}

	/** Draws a card from the deck. */
	public drawCard() {
		if (!this.cards.length) {
			throw new Error('Tried to draw a card from an empty deck. Did you forget to shuffle?');
		}

		return this.cards.pop()!;
	}

	/** Shuffles the deck. */
	public shuffle(): void {
		for (let i = this.cards.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));

			[this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
		}
	}
}
