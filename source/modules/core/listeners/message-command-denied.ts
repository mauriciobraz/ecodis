import { ApplyOptions } from '@sapphire/decorators';
import {
	Events,
	Listener,
	type MessageCommandDeniedPayload,
	type UserError
} from '@sapphire/framework';

@ApplyOptions<Listener.Options>({
	event: Events.MessageCommandDenied
})
export class MessageCommandDeniedListener extends Listener {
	public override async run(error: UserError, payload: MessageCommandDeniedPayload) {
		await payload.message.reply({
			content: error.message
		});
	}
}
