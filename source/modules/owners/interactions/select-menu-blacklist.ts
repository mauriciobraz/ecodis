import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { StringSelectMenuInteraction } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.SelectMenu,
	name: 'SelectMenuBlacklistInteractionHandler'
})
export class SelectMenuBlacklistInteractionHandler extends InteractionHandler {
	public override async run(interaction: StringSelectMenuInteraction) {
		if (!interaction.customId.startsWith('blacklist:command:')) {
			return;
		}

		if (!interaction.inGuild()) {
			throw new Error('interaction.inGuild() returned false');
		}

		const [command, action] = interaction.values[0].split(':');
		const guildId = interaction.customId.split(':').pop();

		if (!guildId) {
			throw new Error('guildId not found');
		}

		if (!this.container.stores.get('commands').has(command)) {
			await interaction.reply({
				content:
					'Este comando não existe. Por favor, contate um administrador e reporte o erro.',
				ephemeral: true
			});

			return;
		}

		const guild = await this.container.database.guild.findFirst({
			where: {
				discordId: guildId
			},
			select: {
				blacklistedCommands: true
			}
		});

		const blacklistedCommands = guild?.blacklistedCommands || [];

		const updatedBlacklist =
			action === 'add'
				? [...blacklistedCommands, command]
				: blacklistedCommands.filter((cmd) => cmd !== command);

		console.log({
			updatedBlacklist,
			action
		});

		if (guild) {
			await this.container.database.guild.update({
				where: {
					discordId: guildId
				},
				data: {
					blacklistedCommands: updatedBlacklist
				}
			});
		} else {
			await this.container.database.guild.create({
				data: {
					discordId: guildId,
					blacklistedCommands: updatedBlacklist
				}
			});
		}

		const alreadyBlacklisted = updatedBlacklist.includes(command);

		await interaction.reply({
			content: alreadyBlacklisted
				? `O comando **${command}** foi removido da blacklist deste servidor.`
				: `O comando **${command}** foi adicionado à blacklist deste servidor.`,
			ephemeral: true
		});
	}
}
