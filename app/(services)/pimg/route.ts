// Proxy Image service to deal with instagram CORS issue //

function isValidInstagramUrl(url: string): boolean {
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname.toLowerCase();
		
		// Check if hostname ends with allowed Instagram domains
		return hostname.endsWith(".cdninstagram.com") || hostname.endsWith(".fbcdn.net");
	} catch {
		return false;
	}
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const imageUrl = searchParams.get("url");

	if (!imageUrl) {
		return new Response("Missing URL parameter", { status: 400 });
	}

	if (!isValidInstagramUrl(imageUrl)) {
		return new Response("Invalid URL: Only Instagram images are allowed", { status: 403 });
	}

	try {
		const response = await fetch(imageUrl, {
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; InstagramProxy/1.0)",
			},
		});

		if (!response.ok) {
			return new Response("Failed to fetch image", { status: response.status });
		}

		const imageBuffer = await response.arrayBuffer();

		return new Response(imageBuffer, {
			status: 200,
			headers: {
				"Content-Type": response.headers.get("Content-Type") || "image/jpeg",
				"Cache-Control": "public, max-age=31536000, immutable",
				"Access-Control-Allow-Origin": "*",
			},
		});
	} catch (error) {
		console.error("Error proxying image:", error);
		return new Response("Internal Server Error", { status: 500 });
	}
}
