import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, type Message } from 'discord.js';

import dedent from 'ts-dedent';
import { z } from 'zod';

import { UserQueries } from '../../../utils/queries/user';

export enum EmployeeType {
	Harvester = 'Harvester',
	Banker = 'Banker',
	Assistant = 'Assistant',
	Feeder = 'Feeder',
	Dealer = 'Dealer'
}

export const EmployeeTranslation = {
	[EmployeeType.Harvester]: 'Colhedor',
	[EmployeeType.Banker]: 'Banqueiro',
	[EmployeeType.Assistant]: 'Auxiliar',
	[EmployeeType.Feeder]: 'Alimentador',
	[EmployeeType.Dealer]: 'Traficante'
};

export const EmploymentDataSchema = z.array(
	z.object({ type: z.nativeEnum(EmployeeType) }).nullable()
);

export type EmploymentData = z.infer<typeof EmploymentDataSchema>;

export const DEFAULT_EMPLOYMENT_DATA: EmploymentData = [null, null, null];

@ApplyOptions<Command.Options>({
	name: 'escritório',
	description: 'Gerencie os funcionários do seu escritório.',

	aliases: ['escritorio', 'office', 'staff'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class OfficeCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const user = await UserQueries.getOrCreate(message.author.id);

		const guild = await this.container.database.guild.upsert({
			where: { discordId: message.guildId! },
			create: { discordId: message.guildId! },
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

		const selectionMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId('employee_selection')
				.setPlaceholder('Selecione um funcionário para contratar')
				.addOptions([
					{
						emoji: '🏢',
						label: 'Selecione um funcionário para contratar',
						description: '↓ Cada funcionário possui uma função distinta.',
						value: 'IGNORE',
						default: true
					},
					{
						emoji: '🧑',
						label: 'Colhedor',
						description: '↓ Colhe sua plantação automaticamente.',
						value: EmployeeType.Harvester
					},
					// {
					// 	emoji: '🧑',
					// 	label: 'Banqueiro',
					// 	description: '↓ Paga o banco automaticamente.',
					// 	value: EmployeeType.Banker
					// },
					{
						emoji: '🤖',
						label: 'Auxiliar',
						description: '↓ Trabalha para você automaticamente.',
						value: EmployeeType.Assistant
					},
					{
						emoji: '🧑',
						label: 'Alimentador',
						description: '↓ Alimenta seus animais automaticamente.',
						value: EmployeeType.Feeder
					},
					{
						emoji: '🥷',
						label: 'Traficante',
						description: '↓ Vende sua produção ilegal (cannabis).',
						value: EmployeeType.Dealer
					}
				])
		);

		const embed = new EmbedBuilder()
			.setTitle(`Escritório de ${message.author.username}`)
			.setDescription(
				dedent`
					➡ | Seu escritório, cada funcionário possui uma função distinta.

					**Colhedor**: Colhe e planta automaticamente.
					**Banqueiro**: Pagará o banco automaticamente.
					**Auxiliar**: Trabalhará para você automaticamente.
					**Alimentador**: Dará comida automaticamente aos animais.
					**Traficante**: Venderá a produção de sua estufa (cannabis).

					1️⃣ **| Funcionário 1:** ${
						employmentDataParsed[0]?.type
							? EmployeeTranslation[employmentDataParsed[0].type]
							: 'Vazio 👤'
					}
					2️⃣ **| Funcionário 2:** ${
						employmentDataParsed[1]?.type
							? EmployeeTranslation[employmentDataParsed[1].type]
							: 'Vazio 👤'
					}
					3️⃣ **| Funcionário 3:** ${
						employmentDataParsed[2]?.type
							? EmployeeTranslation[employmentDataParsed[2].type]
							: 'Vazio 👤'
					}
				`
			);

		await message.reply({
			components: [selectionMenu],
			embeds: [embed]
		});
	}
}
