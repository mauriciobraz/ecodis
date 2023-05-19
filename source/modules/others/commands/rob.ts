import { ApplyOptions } from '@sapphire/decorators';
import { Command, type Args } from '@sapphire/framework';

import { JobType } from '@prisma/client';
import type {
	Collection,
	Message,
	MessageReaction,
	ReactionCollector,
	Snowflake,
	User
} from 'discord.js';
import { DiscordJSUtils } from '../../../utils/discordjs';
import { UserQueries } from '../../../utils/queries/user';

@ApplyOptions<Command.Options>({
	name: 'roubar',
	aliases: ['rob', 'roubar', 'roubo'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class RobCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const userResult = await args.pickResult('user');

		if (userResult.isErr()) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'Você precisa mencionar um usuário para roubar',
				30
			);

			return;
		}

		const user = userResult.unwrap();

		if (user.id === message.author.id) {
			await DiscordJSUtils.replyAndDelete(message, 'Você não pode roubar a si mesmo', 30);

			return;
		}

		const targetUserBalance = await UserQueries.getUserBalances({
			userId: user.id,
			guildId: message.guildId!
		});

		if (targetUserBalance.balance === 0) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'Este usuário não tem dinheiro para ser roubado',
				30
			);

			return;
		}

		const amountToSteal = Math.floor(Math.random() * targetUserBalance.balance);

		const msg = await message.reply({
			content: `Você roubou ${amountToSteal} ${amountToSteal === 1 ? 'moeda' : 'moedas'} de ${
				user.tag
			}. Clique na reação para prendê-lo se você for um policial!`
		});

		await msg.react('👮');

		const collector = msg.createReactionCollector({
			filter: (reaction) => {
				return (
					reaction.emoji.name === '👮'
					// localUser.id !== message.author.id &&
					// localUser.id !== user.id
				);
			},
			time: 30_000
		});

		collector.on('collect', (_reaction, user) => {
			return this.handleReactionCollect(msg, user, collector, amountToSteal);
		});

		collector.on('end', async (collected) => {
			return this.handleReactionEnd(collected, msg, user, amountToSteal);
		});
	}

	private async handleReactionCollect(
		message: Message<true>,
		user: User,
		collector: ReactionCollector,
		amountToSteal: number
	) {
		console.log(
			`[ROB] ${message.author.tag} (${message.author.id}) roubou ${amountToSteal} moedas de ${user.tag} (${user.id})`
		);

		const guildDb = await this.container.database.guild.upsert({
			where: { discordId: message.guildId },
			create: { discordId: message.guildId },
			update: {},
			select: { id: true }
		});

		const userDb = await this.container.database.user.upsert({
			where: { discordId: user.id },
			create: { discordId: user.id },
			update: {},
			select: { id: true }
		});

		const userGDDb = await this.container.database.userGuildData.findFirst({
			where: {
				guild: {
					discordId: message.guildId
				},
				user: {
					discordId: user.id
				}
			},
			select: {
				id: true,
				job: {
					select: {
						type: true
					}
				}
			}
		});

		if (userGDDb?.job?.type !== JobType.Cop) {
			return;
		}

		await this.container.database.userPrison.upsert({
			where: {
				userId_guildId: {
					userId: userDb.id,
					guildId: guildDb.id
				}
			},
			create: {
				userId: userDb.id,
				guildId: guildDb.id
			},
			update: {},
			select: {
				id: true
			}
		});

		await message.edit(`Você foi preso por um policial e perdeu todo o dinheiro que roubou!`);

		setTimeout(async () => {
			await message.delete();
		}, 30_000);

		collector.stop('User was arrested');
	}

	private async handleReactionEnd(
		collected: Collection<Snowflake, MessageReaction>,
		message: Message<true>,
		user: User,
		amountToSteal: number
	) {
		if (collected.size === 0) {
			await UserQueries.updateBalance({
				userId: user.id,
				guildId: message.guildId,
				balance: ['decrement', amountToSteal]
			});

			await UserQueries.updateBalance({
				userId: message.author.id,
				guildId: message.guildId,
				dirtyBalance: ['increment', amountToSteal]
			});

			await message.edit(`Nenhum policial prendeu você, seu roubo foi bem sucedido!`);

			setTimeout(async () => {
				await message.delete();
			}, 30_000);
		}
	}
}
