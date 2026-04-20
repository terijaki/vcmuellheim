import { describe, expect, it } from "vite-plus/test";
import dayjs from "dayjs";
import "dayjs/locale/de";
import { formatShiftDateRange } from "./volunteer";

dayjs.locale("de");

describe("formatShiftDateRange", () => {
	it("returns only start when no end date is given", () => {
		const result = formatShiftDateRange("2025-04-19T12:00:00");
		expect(result).toBe("Samstag, 19. April 2025 um 12:00 Uhr");
	});

	it("returns only start when end date is null", () => {
		const result = formatShiftDateRange("2025-04-19T12:00:00", null);
		expect(result).toBe("Samstag, 19. April 2025 um 12:00 Uhr");
	});

	it("formats same-day range with 'bis' and only end time", () => {
		const result = formatShiftDateRange("2025-04-19T12:00:00", "2025-04-19T16:00:00");
		expect(result).toBe("Samstag, 19. April 2025, 12:00 Uhr bis 16:00 Uhr");
	});

	it("formats multi-day range with em-dash and full end date", () => {
		const result = formatShiftDateRange("2025-04-19T12:00:00", "2025-04-20T16:00:00");
		expect(result).toBe("Samstag, 19. April 2025 um 12:00 Uhr – Sonntag, 20. April um 16:00 Uhr");
	});
});
