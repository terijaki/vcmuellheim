import Link from "next/link";
import { FaTriangleExclamation as IconError } from "react-icons/fa6";

export default function NotFound() {
	return (
		<div className="col-center-content flex flex-col gap-4 my-6 justify-center items-center">
			<p>
				<IconError className="text-5xl text-onyx" />
			</p>
			<p>Der angefragte Bereich kann nicht gefunden werden.</p>
			<p>
				<Link
					href="/"
					className="button"
				>
					zur Startsteite
				</Link>
			</p>
		</div>
	);
}
