import { SAMS } from "@/project.config";
import { type NextRequest } from "next/server";
import fs from "fs";
import { init } from "next/dist/compiled/webpack/webpack";

export const revalidate = false;

export async function GET(request: NextRequest) {
	const requsetUrl = request.nextUrl;
	const requsetUrlPath = request.nextUrl.pathname;
	const searchParams = request.nextUrl.searchParams;
	const query = searchParams.get("query");
	// query is "hello" for /api/search?query=hello
	console.log(requsetUrl);
	let context = requsetUrl.toString().replace(SAMS.url, "").replace("/xml", "");

	let responseBody: {} = {
		status: 400,
		context: requsetUrlPath,
		message: "This is not a valid request.",
	};

	if (requsetUrlPath.includes("sportsclub.xhtml")) {
		const exampleFile = Bun.file("./app/sams/mockup/_sportsclub.xml");
		const club = await exampleFile.text();
		return Response.json(club);
	}

	return Response.json(responseBody);
}

// sportsclubList.xhtml => all clubs
// sportsclub.xhtml?sportsclubId= => specific club
