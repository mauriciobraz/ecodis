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
	public override run(error: UserError, payload: MessageCommandErrorPayload) {
		if (Reflect.get(Object(error.context), 'silent') || process.env.NODE_ENV !== 'development')
			return;

		this.container.logger.error(
			`[COMMAND] ${payload.message.author.tag} (${payload.message.author.id}) ran command ${payload.command.name} (${payload.command.location.full})`
		);
	}
}
