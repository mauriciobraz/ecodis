import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { pickRandom } from '@sapphire/utilities';
import { differenceInSeconds } from 'date-fns';

import { DiscordJSUtils } from '../../../utils/discordjs';
import { UserQueries } from '../../../utils/queries/user';
import { VACCINES, VaccinationDataSchema } from '../../doctor/commands/info-vac';

import type { UserGuildData } from '@prisma/client';
import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'trabalhar',
	aliases: ['work'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class TrabalharCommand extends Command {
	public override async messageRun(message: Message<boolean>) {
		const userId = message.author.id;

		const user = await UserQueries.getOrCreate(message.author.id);

		const guild = await this.container.database.guild.upsert({
			where: { discordId: message.guildId! },
			create: { discordId: message.guildId! },
			update: {},
			select: { id: true }
		});

		const userGuildData = await this.container.database.userGuildData.upsert({
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
			include: {
				job: true,
				inventory: true
			}
		});

		// Check if the user has a job
		if (!userGuildData.job) {
			await DiscordJSUtils.replyAndDelete(message, 'Você não tem um emprego.', 30);
			return;
		}

		const alreadyWorked =
			userGuildData.workedAt !== null &&
			userGuildData.job.cooldown >= differenceInSeconds(new Date(), userGuildData.workedAt);

		if (alreadyWorked) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'Você já trabalhou hoje, tente novamente mais tarde!',
				30
			);

			return;
		}

		// Update the last worked time
		await this.container.database.userGuildData.update({
			where: {
				id: userGuildData.id
			},
			data: {
				workedAt: new Date()
			}
		});

		const { updatedBalance } = await UserQueries.updateBalance({
			guildId: message.guildId!,
			userId,
			balance: ['increment', userGuildData.job.salary]
		});

		const disease = this.checkUserDisease(userGuildData);

		await DiscordJSUtils.replyAndDelete(
			message,
			`Você trabalhou e recebeu um salário de ${
				userGuildData.job.salary
			} moedas. Seu saldo atual é ${updatedBalance} moedas.${
				disease ? `Você também foi infectado com ${disease}!` : ''
			}`,
			30
		);
	}

	private checkUserDisease(userGuildData: UserGuildData) {
		const chance = 0.75;

		if (!userGuildData.vaccinationData) {
			return null;
		}

		if (Math.random() >= chance) {
			return null;
		}

		const vaccinationDataParsed = VaccinationDataSchema.safeParse(
			userGuildData.vaccinationData
		);

		if (!vaccinationDataParsed.success) {
			return null;
		}

		const vaccinationData = vaccinationDataParsed.data;

		const disease = pickRandom(VACCINES);

		if (vaccinationData[disease].infected) {
			return null;
		}

		const vaccinated = vaccinationData[disease].immunizationTime > 0;

		if (!vaccinated || this.shouldGetInfected(vaccinationData[disease])) {
			vaccinationData[disease].infected = true;
			userGuildData.vaccinationData = vaccinationData;

			return disease;
		}

		return null;
	}

	private shouldGetInfected(vaccineData: {
		immunizationTime: number;
		infected: boolean;
	}): boolean {
		if (vaccineData.immunizationTime === 0) {
			return true;
		}

		const currentTime = new Date().getTime();
		const elapsedTime = currentTime - vaccineData.immunizationTime;

		return elapsedTime >= vaccineData.immunizationTime;
	}
}
