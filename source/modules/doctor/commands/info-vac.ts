import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { EmbedBuilder, type Message } from 'discord.js';
import { z } from 'zod';

import { UserQueries } from '../../../utils/queries/user';
import { millisecondsToHours } from 'date-fns';

export enum Disease {
	Asthma = 'Asthma',
	Flu = 'Flu'
}

export const VACCINES = ['Asthma', 'Flu'] as const;

export const VaccinationSchema = z.object({
	/**
	 * The time of immunization that the vaccine will be effective (in milliseconds).
	 * @example 1_620_000_000 (18 days)
	 */
	immunizationTime: z.number().positive(),

	/**
	 * If the user is infected with the disease.
	 * @default false
	 */
	infected: z.boolean().default(false)
});

export const VaccinationDoctorSchema = z.object({
	/**
	 * The vaccines that the user has.
	 * @example [{ type: 'Asthma', amount: 1 }, { type: 'Flu', amount: 2 }]
	 */
	vaccines: z.array(
		z.object({
			type: z.enum(VACCINES),
			amount: z.number().positive()
		})
	),

	/**
	 * The last time the user researched about vaccines.
	 * @note This is used to calculate the cooldown.
	 */
	lastResearch: z.string().datetime().optional()
});

export const VaccinationDataSchema = z.object({
	/**
	 * Data to be saved if the user is a doctor.
	 * @default undefined
	 */
	__doctor: VaccinationDoctorSchema.optional(),

	Asthma: VaccinationSchema,
	Flu: VaccinationSchema
});

export type Vaccination = z.infer<typeof VaccinationSchema>;
export type VaccinationData = z.infer<typeof VaccinationDataSchema>;

export const DEFAULT_VACCINATION_DATA: VaccinationData = {
	Asthma: { immunizationTime: 1_620_000_000, infected: false },
	Flu: { immunizationTime: 1_620_000_000, infected: false }
};

@ApplyOptions<Command.Options>({
	name: 'info-vac',
	description: 'Exibe informações sobre vacinação.',

	aliases: ['info-vacina', 'info-vacinas', 'info-vacinação', 'info-vacinações'],
	generateDashLessAliases: true,
	generateUnderscoreLessAliases: true,

	preconditions: ['GuildOnly']
})
export class InfoVacCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const user = await UserQueries.getOrCreate(message.author.id);

		const guild = await this.container.database.guild.upsert({
			where: { discordId: message.guildId },
			create: { discordId: message.guildId },
			update: {},
			select: { id: true }
		});

		const userData = await this.container.database.userGuildData.upsert({
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
			select: {
				vaccinationData: true
			}
		});

		let vaccinationData = userData?.vaccinationData;

		if (!vaccinationData) {
			const { vaccinationData: newVaccinationData } =
				await this.container.database.userGuildData.update({
					where: {
						userId_guildId: {
							userId: user.id,
							guildId: guild.id
						}
					},
					data: {
						vaccinationData: DEFAULT_VACCINATION_DATA
					},
					select: {
						vaccinationData: true
					}
				});

			vaccinationData = newVaccinationData;
		}

		const { Asthma, Flu } = VaccinationDataSchema.parse(vaccinationData);

		const embed = new EmbedBuilder()
			.setTitle(`Carteirinha de vacinação de ${message.author.tag}`)
			.addFields([
				{
					name: 'Gripe',
					value: `🕰 **Tempo de imunização**: ${millisecondsToHours(
						Flu.immunizationTime
					)}h\n 🦠 **Está 	infectado(a)?**: ${Asthma.infected ? 'Sim' : 'Não'}\n\u200b`
				},
				{
					name: 'Asma',
					value: `🕰 **Tempo de imunização**: ${millisecondsToHours(
						Asthma.immunizationTime
					)}h\n 🦠 **Está infectado(a)?**: ${Asthma.infected ? 'Sim' : 'Não'}`
				}
			])
			.setTimestamp()
			.setColor(0x2b2d31);

		await message.channel.send({
			embeds: [embed]
		});
	}
}
