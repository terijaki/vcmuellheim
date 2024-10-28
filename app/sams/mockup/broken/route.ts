import { SAMS } from "@/project.config";
import { type NextRequest } from "next/server";

export const revalidate = false;

export function GET(request: NextRequest) {
	const requsetUrl = request.nextUrl;
	const searchParams = request.nextUrl.searchParams;
	const query = searchParams.get("query");
	console.log(searchParams);
	// query is "hello" for /api/search?query=hello
	let context = requsetUrl.toString().replace(SAMS.url, "");

	const data = {
		requestUrl: request.nextUrl,
		context: context,
		info: "This is a fake response.",
	};

	return Response.json({ data });
}
