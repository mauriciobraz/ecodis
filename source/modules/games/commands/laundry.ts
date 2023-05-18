import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import { UserQueries } from '../../../utils/queries/user';

import type { Args } from '@sapphire/framework';
import type { Message } from 'discord.js';

const CHANCE_OF_LOSS = 0.6;

@ApplyOptions<Command.Options>({
	name: 'lavar',
	description:
		'Lave seu dinheiro sujo. Este comando possui uma taxa de 10% sobre o dinheiro lavado.',

	generateDashLessAliases: true,
	generateUnderscoreLessAliases: true,

	aliases: [
		'lavar-dinheiro',
		'lavar-dinheiro-sujo',
		'lavagem-de-dinheiro',
		'lavagem-de-dinheiro-sujo',
		'laundry'
	],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class LaundryCommand extends Command {
	public override async messageRun(message: Message<true>, args: Args) {
		const amountToLaundryResult = await args.pickResult('number');

		if (amountToLaundryResult.isErr()) {
			await message.channel.send({
				content: 'Você precisa escolher um valor para lavar (por exemplo, 100).'
			});

			return;
		}

		const amountToLaundry = amountToLaundryResult.unwrap();

		const balances = await UserQueries.getUserBalances({
			userId: message.author.id,
			guildId: message.guildId
		});

		if (balances.dirtyBalance < amountToLaundry) {
			return message.channel.send(
				'Você não tem dinheiro sujo suficiente para lavar esta quantia.'
			);
		}

		const luck = Math.random();

		if (luck < CHANCE_OF_LOSS) {
			await UserQueries.updateBalance({
				userId: message.author.id,
				guildId: message.guildId,
				dirtyBalance: ['decrement', amountToLaundry]
			});
			return message.channel.send(
				`Infelizmente, você foi pego e perdeu ${amountToLaundry} de dinheiro sujo.`
			);
		}

		const launderedAmount = amountToLaundry * 0.9;

		await UserQueries.updateBalance({
			userId: message.author.id,
			guildId: message.guildId,
			dirtyBalance: ['decrement', amountToLaundry],
			balance: ['increment', launderedAmount]
		});

		return message.channel.send(
			`Você lavou ${amountToLaundry} de dinheiro sujo e recebeu ${launderedAmount} de dinheiro limpo após a taxa de 10%.`
		);
	}
}
