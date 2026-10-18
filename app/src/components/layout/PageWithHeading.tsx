import { Container, Group, Stack } from "@mantine/core";
import CenteredLoader from "../CenteredLoader";
import PageHeading from "./PageHeading";

interface PageWithHeadingProps {
  title?: string;
  subtitle?: string;
  date?: Date;
  isLoading?: boolean;
  children: React.ReactNode;
}

export default function PageWithHeading({
  children,
  isLoading,
  title,
  subtitle,
  date,
}: PageWithHeadingProps) {
  return (
    <Stack pb="md" bg="aquahaze" align="stretch">
      <PageHeading title={title ?? ""} subtitle={subtitle} date={date} />

      <Group grow>
        <Container size="xl" px={{ base: "lg", md: "xl" }}>
          {isLoading ? <CenteredLoader text="Lade Buchungen..." /> : children}
        </Container>
      </Group>
    </Stack>
  );
}
