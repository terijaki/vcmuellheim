import { describe, expect, it } from "bun:test";
import { resolveClubLogoUrl } from "./sams";

describe("resolveClubLogoUrl", () => {
	const CF = "https://cdn.example.com";

	it("returns CloudFront URL when logoS3Key and cloudfrontUrl are set", () => {
		const result = resolveClubLogoUrl({ logoS3Key: "sams-logos/abc.png" }, CF);
		expect(result).toBe("https://cdn.example.com/sams-logos/abc.png");
	});

	it("falls back to logoImageLink when logoS3Key is absent", () => {
		const result = resolveClubLogoUrl({ logoImageLink: "https://sams.cdn/logo.png" }, CF);
		expect(result).toBe("https://sams.cdn/logo.png");
	});

	it("falls back to logoImageLink when cloudfrontUrl is empty", () => {
		const result = resolveClubLogoUrl({ logoS3Key: "sams-logos/abc.png", logoImageLink: "https://sams.cdn/logo.png" }, "");
		expect(result).toBe("https://sams.cdn/logo.png");
	});

	it("returns null when club has neither logo field", () => {
		const result = resolveClubLogoUrl({}, CF);
		expect(result).toBeNull();
	});

	it("returns null when club is null", () => {
		const result = resolveClubLogoUrl(null, CF);
		expect(result).toBeNull();
	});
});
