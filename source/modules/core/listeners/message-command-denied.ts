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
		if (Reflect.get(Object(error.context), 'silent')) return;

		await payload.message.reply({
			content: error.message
		});
	}
}
