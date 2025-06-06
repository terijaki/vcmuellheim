import { getSamsClubByName } from "@/data/samsClubs";
import { SAMS } from "@/project.config";
import { NextResponse } from "next/server";

export async function GET() {
	try {
		const clubData = await getSamsClubByName(SAMS.name);
		return NextResponse.json(clubData);
	} catch (error) {
		return NextResponse.json({ error: "Failed to fetch club data" }, { status: 500 });
	}
}
