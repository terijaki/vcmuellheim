export type matchType = {
	id: string;
	uuid: string;
	number?: string;
	name: string;
	club?: { name?: string };
	date: string;
	time?: string;
	host?: { id?: string; uuid?: string; name?: string; club?: string };
	team: [{ number?: string; id: string; uuid?: string; name: string; club?: { name?: string } }, { number: string; id: string; uuid?: string; name: string; club?: { name?: string } }];
	matchSeries: {
		id: string;
		uuid: string;
		name?: string;
		type?: string;
		updated?: string;
		resultsUpdated?: string;
		season?: { id: string; uuid?: string; name?: string };
		hierarchy?: { id: string; uuid?: string; name?: string; hierarchyLevel?: string };
	};
	location?: { id?: string; name?: string; street: string; postalCode: string; city: string };
	results?: { winner: string; setPoints: string; ballPoints?: string; sets?: { set?: [{ number?: string; points?: string; winner?: string }] } };
	dateObject: Date; // custom property, generated before caching
	dateIso: string; // custom property, generated before caching
};

export type matchesType = {
	matches: { match: Array<matchType> };
};
