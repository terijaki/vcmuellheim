import PageWithHeading from "@/components/layout/PageWithHeading";
import { Center, Loader } from "@mantine/core";

export default function Loading() {
	return (
		<PageWithHeading title="Lade..">
			<Center p="xl">
				<Loader />
			</Center>
		</PageWithHeading>
	);
}
