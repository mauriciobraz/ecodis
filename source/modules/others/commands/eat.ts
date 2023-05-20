import { ItemType } from '@prisma/client';
import { ApplyOptions } from '@sapphire/decorators';
import { Command, Result } from '@sapphire/framework';
import { StringSelectMenuBuilder, type Message, ActionRowBuilder, ComponentType } from 'discord.js';
import { UserQueries } from '../../../utils/queries/user';
import { DiscordJSUtils } from '../../../utils/discordjs';
import { ZodParsers } from '../../../utils/items';

@ApplyOptions<Command.Options>({
	name: 'comer',
	description: 'Está com energia baixa? Coma algo!',

	aliases: ['comida', 'comer', 'comer'],
	preconditions: ['GuildOnly']
})
export class EatCommand extends Command {
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

		const consumables = await this.container.database.inventoryItem.findMany({
			where: {
				item: {
					type: ItemType.Food
				},
				inventory: {
					user: {
						userId: user.id,
						guildId: guild.id
					}
				}
			},
			include: {
				item: true
			}
		});

		if (consumables.length === 0) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'Você não tem nenhum item consumível no seu inventário. Compre algum na loja!'
			);

			return;
		}

		console.log({ consumables });

		// Ask for which consumable to use

		const consumablesSelectMenu = new StringSelectMenuBuilder()
			.setCustomId(`CHOOSE_CONSUMABLE-${message.id}`)
			.setPlaceholder('Escolha uma comida para comer')
			.addOptions(
				consumables.map((consumable) => ({
					label: `${consumable.item.name} x${consumable.amount}`,
					emoji: consumable.item.emoji,
					value: consumable.id
				}))
			);

		const consumableActionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			consumablesSelectMenu
		);

		const msg = await message.reply({
			components: [consumableActionRow]
		});

		const selectedConsumableResult = await Result.fromAsync(
			message.awaitMessageComponent({
				componentType: ComponentType.StringSelect,
				filter: (i) =>
					i.user.id === message.author.id &&
					i.customId === `CHOOSE_CONSUMABLE-${message.id}`,
				time: 60e3
			})
		);

		if (selectedConsumableResult.isErr()) {
			await DiscordJSUtils.editAndDelete(message, {
				content: 'Você não escolheu um item consumível a tempo.',
				components: []
			});

			return;
		}

		const selectedConsumable = selectedConsumableResult.unwrap();
		const consumable = consumables.find((c) => c.id === selectedConsumable.values[0]);

		if (!consumable) {
			await DiscordJSUtils.editAndDelete(message, {
				content: 'Você não escolheu um item consumível a tempo.',
				components: []
			});

			return;
		}

		// Use the consumable
		ZodParsers.Consumable;

		const consumableParsed = ZodParsers.Consumable.safeParse(consumable.item.data);

		if (!consumableParsed.success) {
			await DiscordJSUtils.editAndDelete(message, {
				content: 'Ocorreu um erro ao consumir o item. Reporte isso para um administrador.',
				components: []
			});

			return;
		}

		const consumableData = consumableParsed.data;

		await this.container.database.userGuildData.update({
			where: {
				userId_guildId: {
					guildId: guild.id,
					userId: user.id
				}
			},
			data: {
				energy: {
					increment: consumableData.energy
				}
			}
		});

		await this.container.database.inventoryItem.delete({
			where: {
				id: consumable.id
			}
		});

		await DiscordJSUtils.editAndDelete(msg, {
			content: `Você comeu ${consumable.item.emoji} ${consumable.item.name} e recuperou ${consumableData.energy} de energia.`,
			components: []
		});
	}
}
