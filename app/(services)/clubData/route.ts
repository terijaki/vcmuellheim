import { NextResponse } from "next/server";
import { getSamsClubByName } from "@/data/samsClubs";
import { SAMS } from "@/project.config";

export async function GET() {
	try {
		const clubData = await getSamsClubByName(SAMS.name);
		return NextResponse.json(clubData);
	} catch (error) {
		console.warn("Error fetching club data: ", error);
		return NextResponse.json({ error: `Failed to fetch club data.` }, { status: 500 });
	}
}
