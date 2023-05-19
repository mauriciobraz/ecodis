declare module '@sapphire/framework' {
	interface Preconditions {
		VetOnly: never;
		OnlyOwners: never;
		DoctorOnly: never;
		EditorOnly: never;
		NotArrested: never;
		NotBlacklisted: never;
	}
}

export {};
