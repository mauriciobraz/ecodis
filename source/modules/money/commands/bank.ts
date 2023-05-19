import { ApplyOptions } from '@sapphire/decorators';
import type { CommandOptions } from '@sapphire/framework';
import { Command } from '@sapphire/framework';

import { EmbedBuilder, time, type Message } from 'discord.js';
import { BANK_FEE } from '../../../utils/constants';

@ApplyOptions<CommandOptions>({
	name: 'banco',
	description: 'Mostra o saldo atual do banco e a taxa a ser deduzida no próximo dia.',

	aliases: ['bank'],
	preconditions: ['GuildOnly']
})
export class BankFeeCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const user = await this.container.database.user.upsert({
			where: { discordId: message.author.id },
			create: { discordId: message.author.id },
			update: {}
		});

		const guild = await this.container.database.guild.upsert({
			where: { discordId: message.guild.id },
			create: { discordId: message.guild.id },
			update: {}
		});

		const userGuildData = await this.container.database.userGuildData.findUnique({
			where: {
				userId_guildId: {
					guildId: guild.id,
					userId: user.id
				}
			}
		});

		const currentBalance = userGuildData?.bankBalance ?? 0;
		const bankFeeAmount = currentBalance * BANK_FEE;

		const nextPayout = time(
			new Date((userGuildData?.lastBankFee ?? new Date()).getTime() + 86400000)
		);

		return message.channel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle('Banco Central')
					.setDescription(`Próximo pagamento será ${nextPayout}.\n\u200b`)
					.addFields([
						{
							name: '💳 Saldo Depositado',
							value: `$ ${currentBalance.toFixed(2)}`,
							inline: true
						},
						{
							name: '💸 Taxa do Banco',
							value: `$ ${bankFeeAmount.toFixed(2)}`,
							inline: true
						}
					])
					.setColor(0x2b2d31)
			]
		});
	}
}
