"use client"; // must be a client component for the locale to work

import { DatesProvider } from "@mantine/dates";
import "@mantine/dates/styles.css";
import "dayjs/locale/de";

export default function DatesDEProvider({ children }: { children: React.ReactNode }) {
	return <DatesProvider settings={{ locale: "de", firstDayOfWeek: 1, consistentWeeks: true }}>{children}</DatesProvider>;
}
