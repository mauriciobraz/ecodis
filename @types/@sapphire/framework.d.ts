declare module '@sapphire/framework' {
	interface Preconditions {
		OnlyOwners: never;
		EditorOnly: never;
		NotArrested: never;
	}
}

export {};
