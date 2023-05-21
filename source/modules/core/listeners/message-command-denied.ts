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
	public override run(error: UserError, payload: MessageCommandDeniedPayload) {
		if (Reflect.get(Object(error.context), 'silent') || process.env.NODE_ENV !== 'development')
			return;

		this.container.logger.error(
			`[COMMAND] ${payload.message.author.tag} (${payload.message.author.id}) ran command ${payload.command.name} (${payload.command.location.full})`
		);
	}
}
