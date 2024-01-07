export type socialMatchesCache = {
	entries: socialMatchesEntry[];
};

export type socialMatchesEntry = {
	uuid: string;
	date: Date;
	league: string;
	score: string;
	team: string[];
	winner: number;
	mastodon?: "new" | "queued" | "published";
};
