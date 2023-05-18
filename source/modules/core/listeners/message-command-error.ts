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
		if (Reflect.get(Object(error.context), 'silent') || process.env.NODE_ENV !== 'development')
			return;

		await payload.message.reply({
			content: error.message
		});
	}
}
