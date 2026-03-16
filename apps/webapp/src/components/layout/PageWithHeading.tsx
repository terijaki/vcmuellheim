import { Container, Group, Stack } from "@mantine/core";
import CenteredLoader from "../CenteredLoader";
import type { PageHeadProps } from "../PageHead";
import PageHead from "../PageHead";
import PageHeading from "./PageHeading";

interface PageWithHeadingProps extends PageHeadProps {
	// PageHeading props (override title from PageHeadProps)
	subtitle?: string;
	date?: Date;
	// PageWithHeading specific
	isLoading?: boolean;
	children: React.ReactNode;
}

export default function PageWithHeading({ children, isLoading, title, description, image, type, publishedAt, updatedAt, author, subtitle, date }: PageWithHeadingProps) {
	return (
		<>
			<PageHead title={title} description={description} image={image} type={type} publishedAt={publishedAt} updatedAt={updatedAt} author={author} />
			<Stack pb="md" bg="aquahaze" align="stretch">
				<PageHeading title={title ?? ""} subtitle={subtitle} date={date} />

				<Group grow>
					<Container size="xl" px={{ base: "lg", md: "xl" }}>
						{isLoading ? <CenteredLoader text="Lade Buchungen..." /> : children}
					</Container>
				</Group>
			</Stack>
		</>
	);
}
