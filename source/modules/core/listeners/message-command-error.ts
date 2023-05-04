import { ApplyOptions } from '@sapphire/decorators';
import {
	Events,
	Listener,
	type MessageCommandErrorPayload,
	type UserError
} from '@sapphire/framework';

@ApplyOptions<Listener.Options>({
	event: Events.MessageCommandError
})
export class MessageCommandErrorListener extends Listener {
	public override async run(error: UserError, payload: MessageCommandErrorPayload) {
		await payload.message.reply({
			content: error.message
		});
	}
}
