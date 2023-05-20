import { JobType } from '@prisma/client';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';

import { UserQueries } from '../../../utils/queries/user';

import type { Message, User } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'inspect',
	description: 'Revista o usuário e verifica se ele possui algum item ilegal.',

	aliases: ['revistar'],
	preconditions: ['GuildOnly']
})
export class InspectCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const user = await UserQueries.getOrCreate(message.author.id);

		const userItems = await this.container.database.inventoryItem.findMany({
			where: {
				inventory: {
					userId: user.id
				}
			},
			include: {
				item: true
			}
		});

		const illegalItems = userItems.filter((item) => {
			return (
				item.data &&
				typeof item.data === 'object' &&
				!Array.isArray(item.data) &&
				item.data.illegal === true
			);
		});

		const msg = await message.channel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle('Inspeção de Itens')
					.setColor(0x2b2d31)
					.setDescription(
						illegalItems.length > 0
							? `⚠️ **Itens ilegais encontrados!** ⚠️\n${illegalItems
									.map((item) => `**Item** ${item.item.name} **x${item.amount}**`)
									.join('\n')}`
							: '🔎 **Nenhum item ilegal foi encontrado.**'
					)
			]
		});

		// If the user has illegal items, add a reaction to the author arrest him.
		if (illegalItems.length > 0) {
			await msg.react('👮');

			const collector = msg.createReactionCollector({
				filter: (reaction, localUser) => {
					return reaction.emoji.name === '👮' && localUser.id !== message.author.id;
				},
				time: 30_000
			});

			collector.on('collect', (_reaction, user) => {
				return this.handleReactionCollect(msg, user);
			});
		}
	}

	private async handleReactionCollect(message: Message<true>, user: User) {
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

		await message.channel.send({
			content: `<@${user.id}> foi preso por um policial por ter itens ilegais!`
		});

		setTimeout(async () => {
			await message.delete();
		}, 30_000);
	}
}
