import { ItemType } from '@prisma/client';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import {
	ActionRowBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	type Message
} from 'discord.js';

export const ItemTypeEmoji = {
	[ItemType.Armor]: '🛡️',
	[ItemType.Farm]: '🌾',
	[ItemType.Food]: '🍎',
	[ItemType.Ore]: '💎',
	[ItemType.Tool]: '🛠',
	[ItemType.Weapon]: '🔫',
	[ItemType.Greenhouse]: '🏡'
};

export const ItemTypeNames = {
	[ItemType.Greenhouse]: 'Estufa',
	[ItemType.Farm]: 'Fazenda',
	[ItemType.Food]: 'Comida',
	[ItemType.Ore]: 'Minério',
	[ItemType.Armor]: 'Armadura',
	[ItemType.Tool]: 'Ferramenta',
	[ItemType.Weapon]: 'Armamento'
};

@ApplyOptions<Command.Options>({
	name: 'shop',
	aliases: ['loja'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class ShopCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const itemsTypes = await this.container.database.item.findMany({
			distinct: ['type'],
			orderBy: {
				type: 'asc'
			},
			select: {
				type: true
			}
		});

		const categoriesSelectMenu = new StringSelectMenuBuilder()
			.setCustomId('shop:category')
			.addOptions([
				new StringSelectMenuOptionBuilder()
					.setValue('IGNORE')
					.setEmoji('🛍')
					.setLabel('Escolha uma categoria para ver os itens')
					.setDescription('↓ Está afim de comprar algo?')
					.setDefault(true),

				...itemsTypes.map((itemType) =>
					new StringSelectMenuOptionBuilder()
						.setValue(itemType.type)
						.setLabel(ItemTypeNames[itemType.type])
						.setEmoji(ItemTypeEmoji[itemType.type])
						.setDescription('→ Clique para ver os itens disponíveis')
				)
			]);

		const categorySelectMenuActionRow =
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categoriesSelectMenu);

		await message.reply({
			components: [categorySelectMenuActionRow]
		});
	}
}
