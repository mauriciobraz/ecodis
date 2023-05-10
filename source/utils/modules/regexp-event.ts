/** A type that extracts the values of a record that are arrays. */
type ValuesOf<T> = {
	[K in keyof T]: T[K] extends any[] ? T[K] : never;
};

/**
 * A class that can be used to create event IDs and RegExp that can be used to
 * handle API events that require arguments, e.g. identify a specific user.
 */
export default class RegExpEvent<T extends object, U extends ValuesOf<T> = ValuesOf<T>> {
	public constructor(private readonly uid: string) {}

	/** Creates a RegExp that can be used to check if an event ID contains the event. */
	public createRegExp(event: keyof T) {
		return new RegExp(`^${this.uid}::${event.toString()}::`);
	}

	/** Creates an event ID that can be used to identify the event and its arguments. */
	public createEventId<K extends keyof T>(event: K, ...args: U[K]) {
		return `${this.uid}::${event.toString()}::${args.join('::')}`;
	}

	/** Parses an event ID and returns the event and its arguments. */
	public parseEventId<ExpectedEvent extends keyof T>(eventId: string) {
		return eventId.split('::').slice(2) as T[ExpectedEvent];
	}
}
