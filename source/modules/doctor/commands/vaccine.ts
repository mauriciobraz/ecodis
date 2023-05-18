import { ApplyOptions } from '@sapphire/decorators';
import type { Args } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { DiscordJSUtils } from '../../../utils/discordjs';
import { UserQueries } from '../../../utils/queries/user';
import { VACCINES, VaccinationDataSchema } from './info-vac';

import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'vacinar',
	description: 'Aplica uma vacina em um usuário.',

	aliases: ['vaccine', 'vacina', 'aplicar-vacina', 'aplicar-vacinas'],
	generateDashLessAliases: true,
	generateUnderscoreLessAliases: true,

	preconditions: ['GuildOnly', 'DoctorOnly']
})
export class VacinarCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const targetUserResult = await args.pickResult('user');
		const vaccineTypeResult = await args.pickResult('string');

		if (vaccineTypeResult.isErr()) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'Vacina inválida. Por favor, especifique uma vacina válida.',
				5000
			);
			return;
		}

		if (targetUserResult.isErr()) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'Usuário inválido. Por favor, mencione um usuário válido.',
				5000
			);
			return;
		}

		const vaccineType = vaccineTypeResult.unwrap();
		const targetUser = targetUserResult.unwrap();

		if (!VACCINES.includes(vaccineType)) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'Vacina inválida. Por favor, especifique uma vacina válida.',
				5000
			);
			return;
		}

		const user = await UserQueries.getOrCreate(targetUser.id);

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

		const { __doctor } = VaccinationDataSchema.parse(userGuildData?.vaccinationData || {});

		if (!__doctor || __doctor.vaccines.length === 0) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'O usuário não possui vacinas disponíveis para serem aplicadas.',
				5000
			);
			return;
		}

		const selectedVaccine = __doctor.vaccines.find((vaccine) => vaccine.type === vaccineType);

		if (!selectedVaccine) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'Que estranho, parece que você não tem essa vacina.',
				5000
			);
			return;
		}

		const { type, amount } = selectedVaccine;

		if (amount === 1) {
			__doctor.vaccines = __doctor.vaccines.filter((vaccine) => vaccine.type !== type);
		} else {
			selectedVaccine.amount -= 1;
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
					__doctor
				}
			}
		});

		await DiscordJSUtils.replyAndDelete(
			message,
			`O usuário ${targetUser.tag} foi vacinado com sucesso com a vacina ${type}.`,
			5000
		);
	}
}
