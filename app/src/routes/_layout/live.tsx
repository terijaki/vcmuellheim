import { Center, Stack, Text } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import CenteredLoader from "@webapp/components/CenteredLoader";
import HomeLiveTicker from "@webapp/components/homepage/HomeLiveTicker";
import PageWithHeading from "@webapp/components/layout/PageWithHeading";
import { useHomeLiveTickerData } from "@webapp/hooks/useHomeLiveTicker";

export const Route = createFileRoute("/_layout/live")({
  component: LivePage,
});

function LivePage() {
  const { ourMatches, hasMatchesToday, hasOpenMatches, isPending } = useHomeLiveTickerData();

  const subtitle = isPending
    ? "Lade aktuelle Spiele…"
    : hasOpenMatches
      ? "Unsere Mannschaften spielen gerade!"
      : hasMatchesToday
        ? "Unsere Mannschaften haben heute gespielt!"
        : undefined;

  return (
    <PageWithHeading
      title="Live"
      description="Live-Ergebnisse der Mannschaften vom Volleyballclub Müllheim"
      subtitle={subtitle}
    >
      {isPending ? (
        <CenteredLoader text="Lade Live-Ergebnisse…" />
      ) : !hasMatchesToday ? (
        <Center py="xl">
          <Stack gap="xs" align="center">
            <Text ta="center" fw={500}>
              Aktuell keine Live-Spiele
            </Text>
            <Text ta="center" c="dimmed" size="sm">
              Hier erscheinen Ergebnisse, sobald unsere Mannschaften heute spielen.
            </Text>
          </Stack>
        </Center>
      ) : (
        <HomeLiveTicker matches={ourMatches} embedded />
      )}
    </PageWithHeading>
  );
}
