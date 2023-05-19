import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { z } from 'zod';

import { DiscordJSUtils } from '../../../utils/discordjs';
import { UserQueries } from '../../../utils/queries/user';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

export const DISEASES = ['raiva'] as const;

export const DiseaseTreatmentSchema = z.object({
	/**
	 * The time of immunization that the treatment will be effective (in milliseconds).
	 * @example 1_620_000_000 (18 days)
	 */
	treatmentTime: z.number().positive(),

	/**
	 * If the animal is infected with the disease.
	 * @default false
	 */
	infected: z.boolean().default(false)
});

export const VeterinaryDoctorSchema = z.object({
	/**
	 * The treatments that the vet has.
	 * @example [{ type: 'Rabies', amount: 1 }, { type: 'Parvo', amount: 2 }]
	 */
	diseaseTreatments: z.array(
		z.object({
			type: z.enum(DISEASES),
			amount: z.number().positive()
		})
	),

	/**
	 * The last time the vet researched about treatments.
	 * @note This is used to calculate the cooldown.
	 */
	lastResearch: z.string().datetime().optional()
});

export const VeterinaryDataSchema = z.object({
	/**
	 * Data to be saved if the user is a vet.
	 * @default undefined
	 */
	__vet: VeterinaryDoctorSchema.optional(),

	Rabies: DiseaseTreatmentSchema,
	Parvo: DiseaseTreatmentSchema
});

export type DiseaseTreatment = z.infer<typeof DiseaseTreatmentSchema>;
export type VeterinaryData = z.infer<typeof VeterinaryDataSchema>;

export const DEFAULT_VETERINARY_DATA: VeterinaryData = {
	Rabies: { treatmentTime: 1_620_000_000, infected: false },
	Parvo: { treatmentTime: 1_620_000_000, infected: false }
};

const SEARCH_COOLDOWN = 24 * 3600000;

@ApplyOptions<Command.Options>({
	name: 'pesquisar-vet',
	description: 'Pesquisa uma vacina de uma doença para os animais da fazenda.',

	aliases: ['pesquisar-veterinario', 'pesquisar-veterinária', 'pesquisar-veterinaria'],
	generateDashLessAliases: true,
	generateUnderscoreLessAliases: true,

	preconditions: ['GuildOnly', 'VetOnly']
})
export class PesquisarCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const term = await args.pick('string');

		if (!DISEASES.includes(term)) {
			await message.reply('Invalid search term. Please specify a valid term.');

			return;
		}

		const user = await UserQueries.getOrCreate(message.author.id);

		const guild = await this.container.database.guild.upsert({
			where: { discordId: message.guildId },
			create: { discordId: message.guildId },
			update: {},
			select: { id: true }
		});

		const userGuildData = await this.container.database.userGuildData.findUnique({
			where: {
				userId_guildId: {
					userId: user.id,
					guildId: guild.id
				}
			},
			select: {
				veterinaryData: true
			}
		});

		const { __vet } = VeterinaryDataSchema.parse(userGuildData?.veterinaryData);

		if (__vet?.lastResearch) {
			const lastResearchTime = new Date(__vet.lastResearch).getTime();
			const cooldownExpired = Date.now() - lastResearchTime >= SEARCH_COOLDOWN;

			if (!cooldownExpired) {
				const remainingTime = SEARCH_COOLDOWN - (Date.now() - lastResearchTime);
				const remainingHours = Math.ceil(remainingTime / 3600000);

				await DiscordJSUtils.replyAndDelete(
					message,
					`Você só pode realizar uma pesquisa a cada ${
						SEARCH_COOLDOWN / 3600000
					} horas. Por favor, espere mais ${remainingHours} horas.`,
					5000
				);

				return;
			}
		}

		await this.container.database.userGuildData.update({
			where: {
				userId_guildId: {
					userId: user.id,
					guildId: guild.id
				}
			},
			data: {
				veterinaryData: {
					__vet: {
						lastResearch: new Date().toISOString(),
						diseaseTreatments: [
							...(__vet?.diseaseTreatments ?? []),
							{
								type: term,
								amount:
									(__vet?.diseaseTreatments?.find(
										(treatment) => treatment.type === term
									)?.amount ?? 0) + 1
							}
						]
					}
				}
			}
		});

		await message.channel.send(
			`Você pesquisou sobre a doença ${term} e descobriu uma vacina para ela!`
		);
	}
}
