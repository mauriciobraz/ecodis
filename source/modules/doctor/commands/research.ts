import { ApplyOptions } from '@sapphire/decorators';
import type { Args } from '@sapphire/framework';
import { Command } from '@sapphire/framework';

import { DiscordJSUtils } from '../../../utils/discordjs';
import { UserQueries } from '../../../utils/queries/user';
import { VaccinationDataSchema } from './info-vac';

import type { Message } from 'discord.js';

const SEARCH_COOLDOWN = 24 * 3600000;

@ApplyOptions<Command.Options>({
	name: 'pesquisar',
	description: 'Pesquisa informações sobre um determinado tópico.',

	aliases: ['search', 'pesquisar-vacina', 'pesquisar-vacinas'],
	generateDashLessAliases: true,
	generateUnderscoreLessAliases: true,

	preconditions: ['GuildOnly', 'DoctorOnly']
})
export class PesquisarCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const term = await args.pick('string');

		if (!['covid', 'asma', 'gripe'].includes(term)) {
			await message.reply(
				'Termo de pesquisa inválido. Por favor, especifique um termo válido.'
			);

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
				vaccinationData: true
			}
		});

		const { __doctor } = VaccinationDataSchema.parse(userGuildData?.vaccinationData);

		if (__doctor?.lastResearch) {
			const lastResearchTime = new Date(__doctor.lastResearch).getTime();
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
				vaccinationData: {
					__doctor: {
						lastResearch: new Date().toISOString(),
						vaccines: [
							...(__doctor?.vaccines ?? []),
							{
								type: term,
								amount: 1
							}
						]
					}
				}
			}
		});

		// Lógica de pesquisa para os termos "covid", "asma" e "gripe"
		await message.channel.send(`Pesquisando informações sobre ${term}...`);
	}
}
