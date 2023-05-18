declare module '@sapphire/framework' {
	interface Preconditions {
		OnlyOwners: never;
		DoctorOnly: never;
		EditorOnly: never;
		NotArrested: never;
		NotBlacklisted: never;
	}
}

export {};
