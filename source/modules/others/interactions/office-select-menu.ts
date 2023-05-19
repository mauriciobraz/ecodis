import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes, Result } from '@sapphire/framework';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	StringSelectMenuBuilder,
	type StringSelectMenuInteraction
} from 'discord.js';

import { UserQueries } from '../../../utils/queries/user';
import {
	DEFAULT_EMPLOYMENT_DATA,
	EmploymentDataSchema,
	type EmployeeType,
	EmployeeTranslation
} from '../commands/office';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.SelectMenu,
	name: 'OfficeSelectMenuInteractionHandler'
})
export class OfficeSelectMenuInteractionHandler extends InteractionHandler {
	public override async run(interaction: StringSelectMenuInteraction) {
		if (interaction.customId !== 'employee_selection') {
			return;
		}

		if (interaction.values[0] === 'IGNORE') {
			await interaction.deferUpdate();
			return;
		}

		const employeeType = interaction.values[0] as EmployeeType;

		const user = await UserQueries.getOrCreate(interaction.user.id);

		const guild = await this.container.database.guild.upsert({
			where: { discordId: interaction.guildId! },
			create: { discordId: interaction.guildId! },
			update: {},
			select: { id: true }
		});

		const { employmentData: rawEmploymentData } =
			await this.container.database.userGuildData.upsert({
				where: {
					userId_guildId: {
						userId: user.id,
						guildId: guild.id
					}
				},
				create: {
					userId: user.id,
					guildId: guild.id
				},
				update: {},
				select: { employmentData: true }
			});

		const employmentDataParsed = EmploymentDataSchema.parse(
			rawEmploymentData ?? DEFAULT_EMPLOYMENT_DATA
		);

		const employeeData = employmentDataParsed.find(
			(employee) => employee?.type === employeeType
		);

		let employeeDataIndex = employmentDataParsed.findIndex((employee) => employee === null);

		await interaction.deferReply({
			ephemeral: true
		});

		const alreadyEmployed = employmentDataParsed.some(
			(employee) => employee?.type === employeeType
		);

		if (alreadyEmployed) {
			await interaction.editReply({
				content: 'Você já contratou um funcionário desse tipo.'
			});

			return;
		}

		if (
			employmentDataParsed.every((employee) => employee !== null) &&
			employeeData === undefined
		) {
			await interaction.editReply({
				content: 'Todas as vagas estão preenchidas. Deseja substituir algum funcionário?',
				components: [
					new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder()
							.setCustomId('employee_selection_override_yes')
							.setLabel('Sim')
							.setStyle(ButtonStyle.Success),

						new ButtonBuilder()
							.setCustomId('employee_selection_override_no')
							.setLabel('Não')
							.setStyle(ButtonStyle.Danger)
					)
				]
			});

			const collectedMessageResult = await Result.fromAsync(
				interaction.channel!.awaitMessageComponent({
					componentType: ComponentType.Button,
					filter: (i) =>
						i.user.id === interaction.user.id &&
						(i.customId === 'employee_selection_override_yes' ||
							i.customId === 'employee_selection_override_no'),
					time: 30000
				})
			);

			const collectedInteraction = collectedMessageResult.unwrap();

			if (
				collectedMessageResult.isErr() ||
				collectedInteraction.customId === 'employee_selection_override_no'
			) {
				await interaction.editReply({
					content: 'Operação cancelada.',
					components: []
				});

				return;
			}

			await collectedInteraction.deferUpdate();

			await interaction.editReply({
				content: 'Selecione um funcionário para substituir',
				components: [
					new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
						new StringSelectMenuBuilder()
							.setCustomId('employee_selection_index')
							.addOptions(
								{
									value: 'IGNORE',
									label: 'Selecione um funcionário',
									description: '↓ Selecione a vaga que deseja substituir',
									default: true,
									emoji: '👇'
								},
								...employmentDataParsed.map((_employee, index) => ({
									label: `Funcionário ${index + 1}`,
									description: `Atualmente: ${
										EmployeeTranslation[employmentDataParsed[index]!.type]
									}`,
									value: String(index),
									emoji: `${index + 1}\ufe0f\u20e3`
								}))
							)
					)
				]
			});

			const collectedIndexResult = await Result.fromAsync(
				interaction.channel!.awaitMessageComponent({
					componentType: ComponentType.StringSelect,
					filter: (i) =>
						i.user.id === interaction.user.id &&
						i.customId === 'employee_selection_index',
					time: 30000
				})
			);

			if (collectedIndexResult.isErr()) {
				await interaction.editReply({
					content: 'Operação cancelada.',
					components: []
				});

				return;
			}

			const collectedIndexInteraction = collectedIndexResult.unwrap();
			const selectedEmployeeIndex = Number(collectedIndexInteraction.values[0]);

			employeeDataIndex = selectedEmployeeIndex;
		}

		employmentDataParsed[employeeDataIndex] = {
			type: employeeType
		};

		await this.container.database.userGuildData.update({
			where: {
				userId_guildId: {
					userId: user.id,
					guildId: guild.id
				}
			},
			data: {
				employmentData: employmentDataParsed
			}
		});

		await interaction.editReply({
			content: 'Funcionário contratado com sucesso!',
			components: []
		});
	}
}
