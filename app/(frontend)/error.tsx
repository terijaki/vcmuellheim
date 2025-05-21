"use client"; // Error components must be Client Components

import PageHeading from "@/components/layout/PageHeading";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<>
			<PageHeading title="Hoppala! 🫢" />
			<div className="col-full-content sm:col-center-content card mb-6 first-of-type:mt-6">
				<div>
					Etwas ist schief gelaufen. Der Server konnte dir diesen Bereich ({usePathname()}) nicht fehlerfrei darstellen.
				</div>
				<div>Bitte versuche es zu einem späteren Zeitpunkt noch einmal.</div>
			</div>
			<div className="col-full-content text-center pb-6">
				<div className="col-span-2 gap-3">
					<button
						className="button"
						type="button"
						onClick={
							// Attempt to recover by trying to re-render the segment
							() => reset()
						}
					>
						Seite neu laden
					</button>
					<Link className="button" href="/">
						Zurück zur Startseite
					</Link>
				</div>
			</div>
		</>
	);
}
