import CenteredLoader from "@/components/CenteredLoader";
import PageWithHeading from "@/components/layout/PageWithHeading";

export default function Loading() {
	return (
		<PageWithHeading title="">
			<CenteredLoader text="Lade Seite..." />
		</PageWithHeading>
	);
}
