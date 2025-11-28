import { Center, Container, SimpleGrid, Stack } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import NewsCard from "../components/NewsCard";
import Paginator from "../components/Paginator";
import { useNews } from "../lib/hooks";

const PSEUDO_PAGESIZE = 24;

export const Route = createFileRoute("/news/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { data } = useNews({ limit: 30, startKey: undefined });
	const news = data?.items || [];

	return (
		<Container size="xl">
			<Stack>
				<SimpleGrid cols={{ base: 1, sm: 2 }}>
					{news?.map((post) => {
						return <NewsCard key={post.id} {...post} />;
					})}
				</SimpleGrid>
				{PSEUDO_PAGESIZE && (
					<Center py="xl">
						<Paginator total={PSEUDO_PAGESIZE} value={news} />
					</Center>
				)}
			</Stack>
		</Container>
	);
}
