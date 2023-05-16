import { JobType } from '@prisma/client';
import { ApplyOptions } from '@sapphire/decorators';
import type { Args } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import {
	ActionRowBuilder,
	ComponentType,
	StringSelectMenuBuilder,
	type Message,
	ButtonBuilder,
	ButtonStyle
} from 'discord.js';
import { UserQueries } from '../../../utils/queries/user';

@ApplyOptions<Command.Options>({
	name: 'adicionar-trabalho',
	aliases: ['add-job', 'add-trabalho', 'adicionar-job'],
	description: 'Adiciona uma profissão a um usuário.',
	preconditions: ['GuildOnly'],
	requiredUserPermissions: ['Administrator']
})
export class AddJobCommand extends Command {
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

		const jobMenu = this.createJobMenu();

		await message.reply({
			content: 'Por favor, selecione uma profissão para o usuário.',
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
					content: `Você está prestes a adicionar a profissão de ${selectedJob} ao usuário. Confirma?${
						userGuildData.job
							? ` Ele já possui a profissão de ${
									{
										[JobType.Cop]: 'policial',
										[JobType.Vet]: 'veterinário',
										[JobType.Doctor]: 'médico'
									}[userGuildData.job.type]
							  }.`
							: ''
					}`,
					components: [confirmationButtons]
					// ephemeral: true
				});

				const confirmationCollector = interaction.channel?.createMessageComponentCollector({
					componentType: ComponentType.Button,
					filter: (i) => i.user.id === interaction.user.id,
					time: 60000
				});

				confirmationCollector?.on('collect', async (buttonInteraction) => {
					if (buttonInteraction.customId === 'confirm') {
						await buttonInteraction.deferUpdate();

						// Add the job to the user in the database
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
							content: `A profissão de ${selectedJob} foi adicionada ao usuário.`,
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
							content: 'Você não respondeu. Ação cancelada.',
							components: []
						});
					}
				});
			}
		});
	}

	private createJobMenu(): ActionRowBuilder<StringSelectMenuBuilder> {
		return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId('jobMenu')
				.setPlaceholder('Selecione uma profissão')
				.addOptions([
					{
						label: 'Cop',
						description: 'Adicionar profissão de policial',
						value: JobType.Cop,
						emoji: '👮'
					},
					{
						label: 'Vet',
						description: 'Adicionar profissão de veterinário',
						value: JobType.Vet,
						emoji: '🐶'
					},
					{
						label: 'Doctor',
						description: 'Adicionar profissão de médico',
						value: JobType.Doctor,
						emoji: '🩺'
					}
				])
		);
	}

	private createCollector(message: Message<true>) {
		return message.channel.createMessageComponentCollector({
			componentType: ComponentType.StringSelect,
			filter: (i) => i.user.id === message.author.id,
			time: 15000
		});
	}
}
