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
	description: 'Desafie o bot para uma partida de blackjack!',

	detailedDescription: dedent`
		No comando de blackjack, você pode apostar um certo número de moedas contra o bot em uma partida de blackjack (também conhecido como 21).

		O objetivo do jogo é ter uma mão de cartas cujo valor total seja o mais próximo possível de 21 sem ultrapassar. Se o total das suas cartas ultrapassar 21, você "estoura" e perde a aposta. Cada partida começa com cada jogador recebendo duas cartas.

		Aqui estão algumas opções que você pode escolher durante o jogo:
		- Se a soma das suas cartas for menor que 21, você pode escolher pedir outra carta (chamado de "hit") para tentar chegar mais perto de 21.
		- Se você achar que a soma das suas cartas é alta o suficiente, pode escolher não receber mais cartas (chamado de "stand").

		O jogo termina quando você escolhe parar de receber cartas ou sua soma ultrapassa 21, ou o bot tem um total de 17 ou mais. Se a soma das suas cartas for maior que a do bot (e menor ou igual a 21), você ganha a aposta. Se o bot tiver uma soma maior (e menor ou igual a 21), ou você ultrapassar 21, você perde a aposta. Em caso de empate (mesma soma), ninguém ganha.

			A quantidade de moedas que você ganha ou perde é igual à quantidade que você apostou no início do jogo. Divirta-se jogando blackjack!
	`,

	aliases: ['bj', '21'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class BlackjackCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const amountResult = await args.pickResult('number');

		if (amountResult.isErr()) {
			await message.reply({
				content: 'Você precisa escolher um valor para apostar (por exemplo, 100).'
			});

			return;
		}

		const amount = amountResult.unwrap();

		const user = await this.container.database.user.upsert({
			where: {
				discordId: message.author.id
			},
			create: {
				discordId: message.author.id,
				userGuildDatas: {
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
				userGuildDatas: {
					select: {
						id: true,
						balance: true
					}
				}
			}
		});

		const userGuildBalance = user.userGuildDatas[0];

		if (userGuildBalance.balance < amount) {
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
							userGuildDatas: {
								upsert: {
									where: {
										id: userGuildBalance.id
									},
									create: {
										balance: -amount,
										guild: {
											connectOrCreate: {
												where: { discordId: message.guildId },
												create: { discordId: message.guildId }
											}
										}
									},
									update: {
										balance: {
											decrement: amount
										}
									}
								}
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
					userGuildDatas: {
						upsert: {
							where: {
								id: userGuildBalance.id
							},
							create: {
								balance: amount,
								guild: {
									connectOrCreate: {
										where: { discordId: message.guildId },
										create: { discordId: message.guildId }
									}
								}
							},
							update: {
								balance: {
									increment: amount
								}
							}
						}
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
					userGuildDatas: {
						upsert: {
							where: {
								id: userGuildBalance.id
							},
							create: {
								balance: -amount,
								guild: {
									connectOrCreate: {
										where: { discordId: message.guildId },
										create: { discordId: message.guildId }
									}
								}
							},
							update: {
								balance: {
									decrement: amount
								}
							}
						}
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
