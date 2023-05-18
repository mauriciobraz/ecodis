import { JobType } from '@prisma/client';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';

import { UserQueries } from '../../../utils/queries/user';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'remover-trabalho',
	description: 'Remove o trabalho de um usuário.',

	aliases: ['rem-job', 'remover-trabalho', 'remover-trabalhador'],
	generateDashLessAliases: true,
	generateUnderscoreLessAliases: true,

	preconditions: ['GuildOnly', 'EditorOnly']
})
export class RemoveJobCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const userResult = await args.pickResult('user');

		if (userResult.isErr()) {
			await message.reply({
				content: 'Você precisa mencionar um usuário para remover o trabalho.'
			});

			return;
		}

		const user = userResult.unwrap();

		const userDb = await UserQueries.getOrCreate(user.id);

		const guildDb = await this.container.database.guild.upsert({
			where: { discordId: message.guildId },
			create: { discordId: message.guildId },
			update: {},
			select: { id: true }
		});

		const userGuildData = await this.container.database.userGuildData.upsert({
			where: {
				userId_guildId: {
					guildId: guildDb.id,
					userId: userDb.id
				}
			},
			create: {
				userId: userDb.id,
				guildId: guildDb.id
			},
			update: {},
			select: {
				id: true,
				job: true
			}
		});

		if (!userGuildData.job) {
			await message.reply({
				content:
					'O usuário que você mencionou não possui um trabalho. Caso queira adicionar, use o comando `add-job`.'
			});

			return;
		}

		const confirmationButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId('confirm')
				.setLabel('Sim')
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder().setCustomId('cancel').setLabel('Não').setStyle(ButtonStyle.Danger)
		);

		const msg = await message.reply({
			content: `Você está prestes a remover a profissão de ${
				{
					[JobType.Cop]: 'policial',
					[JobType.Vet]: 'veterinário',
					[JobType.Doctor]: 'médico'
				}[userGuildData.job.type]
			} do usuário. Confirma?`,
			components: [confirmationButtons]
		});

		const collector = this.createCollector(message);

		collector.on('collect', async (interaction) => {
			if (interaction.customId === 'confirm') {
				await this.container.database.userGuildData.update({
					where: {
						id: userGuildData.id
					},
					data: {
						job: {
							disconnect: true
						}
					}
				});

				await msg.edit({
					content: `A profissão de ${
						{
							[JobType.Cop]: 'policial',
							[JobType.Vet]: 'veterinário',
							[JobType.Doctor]: 'médico'
						}[userGuildData.job!.type]
					} foi removida do usuário.`,
					components: []
				});
			} else if (interaction.customId === 'cancel') {
				await msg.edit({
					content: 'Ação cancelada.',
					components: []
				});
			}
		});
		collector.on('end', async (collected) => {
			if (collected.size === 0) {
				await message.reply({
					content: 'Tempo esgotado.',
					components: []
				});
			}
		});
	}

	private createCollector(message: Message<true>) {
		return message.channel.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: (i) => i.user.id === message.author.id,
			time: 15000
		});
	}
}
