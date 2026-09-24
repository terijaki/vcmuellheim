import { Button, Center, Container, SimpleGrid, Skeleton, Stack, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useHomeNews } from "../../hooks/dataQueries";
import SectionHeading from "../layout/SectionHeading";
import NewsCard from "../NewsCard";
import ScrollAnchor from "./ScrollAnchor";

export default function HomeNews({
  initialNews,
}: {
  initialNews?: Awaited<ReturnType<typeof useHomeNews>>["data"];
} = {}) {
  const { data, isLoading } = useHomeNews(initialNews ? { initialData: initialNews } : undefined);

  let news = data?.items || [];

  // if the 3 and 4th news are older than 3 months, exclude them
  if (news && news.length > 2) {
    const threeMonthsAgo = dayjs().subtract(3, "month");
    const thirdIsOld = dayjs(news[2].updatedAt).isBefore(threeMonthsAgo);
    if (thirdIsOld) news = news.slice(0, 2);
  }

  return (
    <Container size="xl" w="100%" py="md" px={{ base: "lg", md: "xl" }}>
      <ScrollAnchor name="news" />
      <Stack>
        <SectionHeading text="News" />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {isLoading && (
            <>
              <Skeleton height={140} maw={620} />
              <Skeleton height={140} maw={620} />
            </>
          )}

          {news?.map((post) => {
            return <NewsCard key={post.id} {...post} />;
          })}
        </SimpleGrid>
        <Center p="md">
          {news.length === 0 && !isLoading ? (
            <Text ta="center">News-Beiträge konnten nicht geladen werden.</Text>
          ) : (
            <Button component={Link} to="/news" style={{ opacity: isLoading ? 0.1 : 1 }}>
              News-Archiv
            </Button>
          )}
        </Center>
      </Stack>
    </Container>
  );
}
