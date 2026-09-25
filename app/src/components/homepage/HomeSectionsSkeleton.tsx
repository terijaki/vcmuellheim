import { Container, SimpleGrid, Skeleton, Stack } from "@mantine/core";

export default function HomeSectionsSkeleton() {
  return (
    <Stack gap="xl">
      <Container size="xl" py="md">
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Skeleton height={280} />
          <Skeleton height={280} />
        </SimpleGrid>
      </Container>
      <Container size="xl" py="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Skeleton height={140} />
          <Skeleton height={140} />
        </SimpleGrid>
      </Container>
      <Container size="xl" py="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Skeleton height={160} />
          <Skeleton height={160} />
        </SimpleGrid>
      </Container>
    </Stack>
  );
}
