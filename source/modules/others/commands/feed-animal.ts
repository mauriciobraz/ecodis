import { ApplyOptions } from '@sapphire/decorators';
import { Command, Result } from '@sapphire/framework';
import { ActionRowBuilder, ComponentType, StringSelectMenuBuilder, type Message } from 'discord.js';

import { ANIMALS_REGEN } from '../../../utils/animals';
import { DiscordJSUtils } from '../../../utils/discordjs';
import { UserQueries } from '../../../utils/queries/user';

@ApplyOptions<Command.Options>({
	name: 'feed',
	description: 'Feed your farm animals to increase their energy!',

	aliases: ['alimentar', 'alimentar-animal', 'feed-animal'],
	preconditions: ['GuildOnly']
})
export class FeedAnimalCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const user = await UserQueries.getOrCreate(message.author.id);

		const guild = await this.container.database.guild.upsert({
			where: { discordId: message.guildId },
			create: { discordId: message.guildId },
			update: {},
			select: {
				id: true
			}
		});

		const farmAnimals = await this.container.database.farmAnimal.findMany({
			where: {
				farm: {
					userGuildData: {
						userId: user.id,
						guildId: guild.id
					}
				}
			},
			include: {
				animal: true
			}
		});

		if (farmAnimals.length === 0) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'Você não tem nenhum animal para alimentar.'
			);

			return;
		}

		const animalsSelectMenu = new StringSelectMenuBuilder()
			.setCustomId(`CHOOSE_ANIMAL-${message.id}`)
			.setPlaceholder('Selecione um animal para alimentar.')
			.addOptions(
				farmAnimals.map((farmAnimal) => ({
					label: `${farmAnimal.animal.name}`,
					description: `Atualmente com ${farmAnimal.energy} energia.`,
					value: farmAnimal.id
				}))
			);

		const animalsActionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			animalsSelectMenu
		);

		const msg = await message.reply({
			components: [animalsActionRow]
		});

		const selectedAnimalResult = await Result.fromAsync(
			message.awaitMessageComponent({
				componentType: ComponentType.StringSelect,
				filter: (i) =>
					i.user.id === message.author.id && i.customId === `CHOOSE_ANIMAL-${message.id}`,
				time: 60e3
			})
		);

		if (selectedAnimalResult.isErr()) {
			await DiscordJSUtils.editAndDelete(message, {
				content: 'Você não selecionou um animal a tempo.',
				components: []
			});

			return;
		}

		const selectedAnimal = selectedAnimalResult.unwrap();
		const farmAnimal = farmAnimals.find((fa) => fa.id === selectedAnimal.values[0]);

		if (!farmAnimal) {
			await DiscordJSUtils.editAndDelete(message, {
				content: 'Você não selecionou um animal a tempo.',
				components: []
			});

			return;
		}

		// Feed the animal
		const energyToAdd = ANIMALS_REGEN[farmAnimal.animal.type];

		if (farmAnimal.energy + energyToAdd > 1000) {
			await DiscordJSUtils.editAndDelete(message, {
				content: `Seu animal já está com energia máxima. Você não pode alimentá-lo.`,
				components: []
			});

			return;
		}

		await this.container.database.farmAnimal.update({
			where: {
				id: farmAnimal.id
			},
			data: {
				energy: {
					increment: energyToAdd
				}
			}
		});

		await DiscordJSUtils.editAndDelete(msg, {
			content: `Você alimentou seu ${farmAnimal.animal.name} e ele ganhou ${energyToAdd} de energia.`,
			components: []
		});
	}
}
