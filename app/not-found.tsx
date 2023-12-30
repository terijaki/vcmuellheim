import Link from "next/link";

export default function NotFound() {
	return (
		<div className="col-center-content bg-emerald-700">
			<p>Die angefragte Seite kann nicht gefunden werden.</p>
			<Link href="/">zur Startsteite</Link>
		</div>
	);
}
