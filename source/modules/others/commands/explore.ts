import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';

import type { Message } from 'discord.js';
import { UserQueries } from '../../../utils/queries/user';
import { ShopQueries } from '../../../utils/queries/shop';
import { DiscordJSUtils } from '../../../utils/discordjs';
import { pickRandom } from '@sapphire/utilities';
import { ItemSlug } from '../../../utils/items';
import { AnimalDisease } from '@prisma/client';

const ALLOWED_ITEMS = [
	ItemSlug.Sapphire,
	ItemSlug.Amethyst,
	ItemSlug.Emerald,
	ItemSlug.Ruby,
	ItemSlug.Banana,
	ItemSlug.Chocolate,
	ItemSlug.Cafe,
	ItemSlug.RedBull,
	ItemSlug.Egg,

	ItemSlug.Wheat,
	ItemSlug.Beans,
	ItemSlug.Pumpkin,
	ItemSlug.Cannabis
];

@ApplyOptions<Command.Options>({
	name: 'explorar',
	description: 'Explore o mundo e descubra itens aleatórios!',

	aliases: ['explore'],
	preconditions: ['GuildOnly', 'NotArrested']
})
export class ExploreCommand extends Command {
	public override async messageRun(message: Message<true>) {
		const user = await UserQueries.getOrCreate(message.author.id);
		await ShopQueries.getInventory(message.author.id, message.guildId);

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
			},
			select: {
				id: true
			}
		});

		// Check if the user has a pet
		const pet = await this.container.database.farmAnimal.findFirst({
			where: {
				farm: { userGuildDataId: userGuildData?.id },
				animal: { isPet: true }
			}
		});

		if (!pet) {
			await DiscordJSUtils.replyAndDelete(
				message,
				'Você não tem nenhum animal de estimação para explorar. Compre um na loja!',
				60
			);

			return;
		}

		if (pet.disease !== AnimalDisease.None) {
			await DiscordJSUtils.replyAndDelete(
				message,
				`Seu animal de estimação está doente e não pode explorar. Vá ao veterinário para curá-lo!`,
				60
			);

			return;
		}

		const loot = pickRandom(ALLOWED_ITEMS);
		const gotDisease = Math.random() < 0.2;

		const inventoryToGetId = await this.container.database.inventory.findUnique({
			where: { userId: userGuildData?.id },
			select: { id: true }
		});

		if (!inventoryToGetId) {
			throw new Error('Inventory not found');
		}

		const inventoryId = inventoryToGetId.id;

		const existingItem = await this.container.database.inventoryItem.findFirst({
			where: {
				item: { slug: loot },
				inventoryId
			}
		});

		if (existingItem) {
			await this.container.database.inventoryItem.update({
				where: {
					id: existingItem.id
				},
				data: {
					amount: {
						increment: 1
					}
				}
			});
		} else {
			await this.container.database.inventoryItem.create({
				data: {
					amount: 1,
					item: { connect: { slug: loot } },
					inventory: { connect: { id: inventoryId } }
				}
			});
		}

		if (gotDisease) {
			const disease = pickRandom(
				Object.values(AnimalDisease).filter((disease) => disease !== AnimalDisease.None)
			);

			await this.container.database.farmAnimal.update({
				where: {
					id: pet.id
				},
				data: {
					disease
				}
			});
		}

		await DiscordJSUtils.replyAndDelete(
			message,
			`Você explorou o mundo e encontrou um **${loot}**${
				gotDisease ? ` e seu animal de estimação ficou doente!` : ''
			}`,
			60
		);
	}
}
