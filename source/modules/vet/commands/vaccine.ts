import { ApplyOptions } from '@sapphire/decorators';
import type { Args } from '@sapphire/framework';
import { Command } from '@sapphire/framework';

import { DiscordJSUtils } from '../../../utils/discordjs';
import { UserQueries } from '../../../utils/queries/user';
import { DISEASES, VeterinaryDataSchema } from './research';

import type { Message } from 'discord.js';

@ApplyOptions<Command.Options>({
	name: 'tratar',
	description: 'Aplica um tratamento em um animal de estimação.',

	aliases: ['treat', 'tratamento', 'aplicar-tratamento'],
	generateDashLessAliases: true,
	generateUnderscoreLessAliases: true,

	preconditions: ['GuildOnly', 'VetOnly']
})
export class TratarCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const targetUserResult = await args.pickResult('user');
		const treatmentTypeResult = await args.pickResult('string');

		if (targetUserResult.isErr()) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'Usuário inválido. Por favor, mencione um usuário válido.',
				5000
			);

			return;
		}

		if (treatmentTypeResult.isErr()) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'Tratamento inválido. Por favor, especifique um tratamento válido.',
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

		const treatmentType = treatmentTypeResult.unwrap();
		const targetUser = targetUserResult.unwrap();

		if (!DISEASES.includes(treatmentType)) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'Tratamento inválido. Por favor, especifique um tratamento válido.',
				5000
			);
			return;
		}

		const user = await UserQueries.getOrCreate(targetUser.id);

		// Fetch all animals of the user
		const userAnimals = await this.container.database.farmAnimal.findMany({
			where: {
				farm: {
					userGuildData: { user: { discordId: user.id } }
				}
			}
		});

		// Check if user has any animals with diseases
		const diseasedAnimals = userAnimals.filter((animal) => animal.disease === treatmentType);

		if (diseasedAnimals.length === 0) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'O usuário não possui animais com a doença para que o tratamento possa ser aplicado.',
				5000
			);

			return;
		}

		// Select the first diseased animal to apply the treatment
		const animalToTreat = diseasedAnimals[0];

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

		const { __vet } = VeterinaryDataSchema.parse(userGuildData?.veterinaryData || {});

		if (!__vet || __vet.diseaseTreatments.length === 0) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'O usuário não possui tratamentos disponíveis para serem aplicados.',
				5000
			);

			return;
		}

		const selectedTreatment = __vet.diseaseTreatments.find(
			(treatment) => treatment.type === treatmentType
		);

		if (!selectedTreatment) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'Que estranho, parece que você não tem esse tratamento.',
				5000
			);

			return;
		}

		const { type, amount } = selectedTreatment;

		if (amount === 1) {
			__vet.diseaseTreatments = __vet.diseaseTreatments.filter(
				(treatment) => treatment.type !== type
			);
		} else {
			selectedTreatment.amount -= 1;
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
					__vet
				}
			}
		});

		await this.container.database.farmAnimal.update({
			where: {
				id: animalToTreat.id
			},
			data: {
				disease: {
					set: undefined
				}
			}
		});

		await DiscordJSUtils.replyAndDelete(
			message,
			animalToTreat.nickname
				? `O animal ${animalToTreat.nickname} do usuário ${targetUser.tag} foi tratado com sucesso com o tratamento ${type}.`
				: `O animal do usuário ${targetUser.tag} foi tratado com sucesso com o tratamento ${type}.`,
			5000
		);
	}
}
