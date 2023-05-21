import { JobType, type Job } from '@prisma/client';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	StringSelectMenuBuilder
} from 'discord.js';

import { UserQueries } from '../../../utils/queries/user';

import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'trabalhos',
	description: 'Permite que um usuário escolha um trabalho para si mesmo.',

	aliases: ['choose-job', 'selecionar-trabalho', 'jobs'],
	generateDashLessAliases: true,
	generateUnderscoreLessAliases: true,

	preconditions: ['GuildOnly']
})
export class ChooseJobCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const userDb = await UserQueries.getOrCreate(message.author.id);

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

		const jobMenu = this.createJobMenu(
			(await this.container.database.job.findMany({
				where: {
					type: {
						notIn: [JobType.Cop, JobType.Vet, JobType.Doctor]
					}
				},
				select: {
					type: true,
					salary: true
				}
			})) as Job[]
		);

		await message.reply({
			content: 'Selecione uma profissão para você.',
			components: [jobMenu]
		});

		const collector = this.createCollector(message);

		collector.on('collect', async (interaction) => {
			if (interaction.customId === 'jobMenu') {
				await interaction.deferUpdate();

				const selectedJob = interaction.values[0];

				const confirmationButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId('confirm')
						.setLabel('Sim')
						.setStyle(ButtonStyle.Success),

					new ButtonBuilder()
						.setCustomId('cancel')
						.setLabel('Não')
						.setStyle(ButtonStyle.Danger)
				);

				await interaction.editReply({
					content: `Você está prestes a escolher a profissão de ${selectedJob} para si mesmo. Confirma?${
						userGuildData.job
							? ` Você já possui a profissão de ${
									{
										[JobType.Cop]: 'policial',
										[JobType.Vet]: 'veterinário',
										[JobType.Doctor]: 'médico',
										[JobType.StreetSweeper]: 'gari'
									}[userGuildData.job.type]
							  }.`
							: ''
					}`,
					components: [confirmationButtons]
				});

				const confirmationCollector = interaction.channel?.createMessageComponentCollector({
					componentType: ComponentType.Button,
					filter: (i) => i.user.id === interaction.user.id,
					time: 60000
				});

				confirmationCollector?.on('collect', async (buttonInteraction) => {
					if (buttonInteraction.customId === 'confirm') {
						await buttonInteraction.deferUpdate();

						await this.container.database.userGuildData.update({
							where: {
								id: userGuildData.id
							},
							data: {
								job: {
									connect: {
										type: selectedJob as JobType
									}
								}
							}
						});

						await interaction.editReply({
							content: `Você escolheu a profissão de ${selectedJob} para si mesmo.`,
							components: []
						});
					} else if (buttonInteraction.customId === 'cancel') {
						await interaction.editReply({
							content: 'Ação cancelada.',
							components: []
						});
					}
				});

				confirmationCollector?.on('end', async (collected) => {
					if (collected.size === 0) {
						await interaction.editReply({
							content: 'Tempo esgotado.',
							components: []
						});
					}
				});
			}
		});
	}

	private createJobMenu(jobs: Job[]): ActionRowBuilder<StringSelectMenuBuilder> {
		const translations = {
			[JobType.Cop]: 'policial',
			[JobType.Vet]: 'veterinário',
			[JobType.Doctor]: 'médico',
			[JobType.StreetSweeper]: 'gari'
		};

		return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId('jobMenu')
				.setPlaceholder('Selecione uma profissão para você.')
				.addOptions(
					jobs.map((job) => ({
						label: translations[job.type].toUpperCase(),
						description: `Salário 🪙 ${job.salary.toLocaleString('pt-BR')}`,
						value: job.type,
						emoji: {
							[JobType.Cop]: '👮',
							[JobType.Vet]: '🐶',
							[JobType.Doctor]: '🩺',
							[JobType.StreetSweeper]: '🗑️'
						}[job.type]
					}))
				)
		);
	}

	private createCollector(message: Message<true>) {
		return message.channel.createMessageComponentCollector({
			componentType: ComponentType.StringSelect,
			filter: (i) => i.user.id === message.author.id,
			time: 60000
		});
	}
}
