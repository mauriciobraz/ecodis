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

import { UserQueries } from './source/utils/queries/user';
import {
	DEFAULT_EMPLOYMENT_DATA,
	EmploymentDataSchema,
	type EmployeeType
} from './source/modules/others/commands/office';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.SelectMenu,
	name: 'OfficeSelectMenuInteractionHandler'
})
export class OfficeSelectMenuInteractionHandler extends InteractionHandler {
	public override async run(interaction: StringSelectMenuInteraction) {
		if (interaction.customId !== 'employee_selection') {
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

		await interaction.deferReply({
			ephemeral: true
		});

		if (employeeData) {
			await interaction.editReply({
				content: 'Você já tem um funcionário desse tipo. Você gostaria de substituí-lo?',
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
					content: 'Operação cancelada.'
				});

				return;
			}

			const options = employmentDataParsed.map((_employee, index) => ({
				label: `Funcionário ${index + 1}`,
				description: `Funcionário ${index + 1}`,
				value: String(index)
			}));

			await interaction.editReply({
				content: 'Qual funcionário você gostaria de substituir?',
				components: [
					new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
						new StringSelectMenuBuilder()
							.setCustomId('employee_selection_override')
							.setPlaceholder('Selecione um funcionário para substituir')
							.addOptions(options)
					)
				]
			});

			const overrideResult = await Result.fromAsync(
				interaction.channel!.awaitMessageComponent({
					componentType: ComponentType.SelectMenu,
					filter: (i) =>
						i.user.id === interaction.user.id &&
						i.customId === 'employee_selection_override',
					time: 30000
				})
			);

			if (overrideResult.isErr()) {
				await interaction.editReply({
					content: 'Operação cancelada.'
				});

				return;
			}

			const overrideInteraction = overrideResult.unwrap();
			const overrideIndex = Number(overrideInteraction.values[0]);

			employmentDataParsed[overrideIndex] = {
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
				content: 'Funcionário substituído com sucesso!'
			});
		} else {
			employmentDataParsed.push({
				type: employeeType
			});

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
				content: 'Funcionário adicionado com sucesso!'
			});
		}
	}
}
