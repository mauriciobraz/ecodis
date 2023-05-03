import { ApplyOptions } from '@sapphire/decorators';
import type { UserError } from '@sapphire/framework';
import {
	Events,
	Listener,
	type ChatInputCommandDeniedPayload,
	type ContextMenuCommandDeniedPayload
} from '@sapphire/framework';

type CommandDeniedPayload = ChatInputCommandDeniedPayload | ContextMenuCommandDeniedPayload;

async function handleCommandDenied(error: UserError, { interaction }: CommandDeniedPayload) {
	if (Reflect.get(Object(error.context), 'silent')) {
		return;
	}

	if (interaction.deferred || interaction.replied) {
		return interaction.editReply({
			content: error.message
		});
	}

	return interaction.reply({
		content: error.message,
		ephemeral: true
	});
}

@ApplyOptions<Listener.Options>({
	event: Events.ChatInputCommandDenied,
	once: true
})
export class ChatInputCommandDeniedListener extends Listener {
	public override async run(error: UserError, payload: ChatInputCommandDeniedPayload) {
		await handleCommandDenied(error, payload);
	}
}

@ApplyOptions<Listener.Options>({
	event: Events.ContextMenuCommandDenied,
	once: true
})
export class ContextMenuCommandDeniedListener extends Listener {
	public override async run(error: UserError, payload: ContextMenuCommandDeniedPayload) {
		await handleCommandDenied(error, payload);
	}
}
