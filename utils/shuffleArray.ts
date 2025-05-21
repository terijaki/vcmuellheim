// Fisher–Yates Shuffle
// https://bost.ocks.org/mike/shuffle/

export function shuffleArray<T>(array: T[], cap?: number): T[] {
	let m = array.length;
	let t: T;
	let i: number;

	// While there remain elements to shuffle…
	while (m) {
		// Pick a remaining element…
		i = Math.floor(Math.random() * m--);

		// And swap it with the current element.
		t = array[m];
		array[m] = array[i];
		array[i] = t;
	}
	if (cap) {
		return array.slice(0, cap);
	}
	return array;
}
