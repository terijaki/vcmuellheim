import { samsClubData } from "@/utils/sams/sams-server-actions";
import { NextResponse } from "next/server";

export async function GET() {
	try {
		const clubData = await samsClubData();
		return NextResponse.json(clubData);
	} catch (error) {
		return NextResponse.json(
			{ error: "Failed to fetch club data" },
			{ status: 500 }
		);
	}
}
