import { container } from '@sapphire/pieces';
import type { Message, MessageEditOptions, MessagePayload, MessageReplyOptions } from 'discord.js';

export namespace DiscordJSUtils {
	/**
	 * Replies to a message and deletes the reply after a delay.
	 * @param message The message to reply to.
	 * @param content The content of the reply.
	 * @param delay The delay before the reply is deleted, in seconds.
	 */
	export async function replyAndDelete(
		message: Message,
		content: string | MessagePayload | MessageReplyOptions,
		delay = 60
	) {
		const reply = await message.reply(content);

		setTimeout(() => {
			reply.delete().catch((error) => container.logger.error(error));
		}, delay * 1000);
	}

	/**
	 * Edit to a message and deletes the reply after a delay.
	 * @param message The message to reply to.
	 * @param content The content of the reply.
	 * @param delay The delay before the reply is deleted, in seconds.
	 */
	export async function editAndDelete(
		message: Message,
		content: string | MessagePayload | MessageEditOptions,
		delay = 60
	) {
		const reply = await message.edit(content);

		setTimeout(() => {
			reply.delete().catch((error) => container.logger.error(error));
		}, delay * 1000);
	}
}
