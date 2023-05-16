import { JobType } from '@prisma/client';
import { ApplyOptions } from '@sapphire/decorators';
import type { Args } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { UserQueries } from '../../../utils/queries/user';

@ApplyOptions<Command.Options>({
	name: 'remover-trabalho',
	aliases: ['remove-job', 'rem-job', 'remover-job'],
	description: 'Remove um trabalho de um usuário.',
	preconditions: ['GuildOnly'],
	requiredUserPermissions: ['Administrator']
})
export class RemoveJobCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const userResult = await args.pickResult('user');

		if (userResult.isErr()) {
			await message.reply({
				content: 'Por favor, mencione um usuário válido.'
			});

			return;
		}

		const user = userResult.unwrap();

		const userDb = await UserQueries.getOrCreate(user.id);

		const guildDb = await this.container.database.guild.upsert({
			where: {
				discordId: message.guildId
			},
			create: {
				discordId: message.guildId
			},
			update: {},
			select: {
				id: true
			}
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
				content: 'O usuário não possui uma profissão para remover.'
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
				// Remove the job from the user in the database
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
					content: 'Você não respondeu. Ação cancelada.',
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
