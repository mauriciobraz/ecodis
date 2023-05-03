import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';

@ApplyOptions<Listener.Options>({
	event: Events.ClientReady,
	once: true
})
export class ReadyListener extends Listener {
	public override run() {
		this.container.logger.debug(
			`Core/ReadyListener: Connected to Discord's API as ${this.container.client.user}`
		);
	}
}
