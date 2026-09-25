import { Container, Skeleton, Stack } from "@mantine/core";
import SectionHeading from "../layout/SectionHeading";

export default function HomeSectionFallback({ title }: { title: string }) {
  return (
    <Container size="xl" w="100%" py="md" px={{ base: "lg", md: "xl" }}>
      <Stack>
        <SectionHeading text={title} />
        <Skeleton height={160} />
        <Skeleton height={160} />
      </Stack>
    </Container>
  );
}
