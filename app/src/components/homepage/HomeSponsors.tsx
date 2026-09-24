import type { Sponsor } from "@lib/db/types";
import {
  Anchor,
  BackgroundImage,
  Box,
  Button,
  Center,
  Container,
  Flex,
  Group,
  Image,
  Loader,
  Marquee,
  Overlay,
  Stack,
  Text,
} from "@mantine/core";
import { Club } from "@project.config";
import { useSponsors } from "../../hooks/dataQueries";
import SectionHeading from "../layout/SectionHeading";
import ScrollAnchor from "./ScrollAnchor";

export default function HomeSponsors({
  showFallback,
  initialSponsors,
}: {
  showFallback?: boolean;
  initialSponsors?: Awaited<ReturnType<typeof useSponsors>>["data"];
}) {
  const { data, isPending } = useSponsors(
    initialSponsors ? { initialData: initialSponsors } : undefined,
  );
  const sponsors = data?.items || [];
  const isLoading = isPending && !data;
  if (!isLoading && sponsors.length === 0 && !showFallback) return null;

  return (
    <Box bg="blumine">
      <ScrollAnchor name="sponsors" />
      <BackgroundImage
        src="/images/backgrounds/sponsors.jpg"
        py="md"
        style={{ zIndex: 0 }}
        pos="relative"
      >
        <Container size="xl" py="md" c="white">
          <Stack gap="xs">
            <SectionHeading text={sponsors.length === 1 ? "Sponsor" : "Sponsoren"} color="white" />
            {isLoading ? (
              <Center>
                <Loader type="dots" color="white" />
              </Center>
            ) : (
              <Sponsors sponsors={sponsors} showFallback={showFallback} />
            )}
          </Stack>
        </Container>
        <Overlay
          backgroundOpacity={0.9}
          color="var(--mantine-color-blumine-filled)"
          blur={2}
          zIndex={-1}
        />
      </BackgroundImage>
    </Box>
  );
}

function Sponsors({ sponsors, showFallback }: { sponsors: Sponsor[]; showFallback?: boolean }) {
  if (showFallback && (!sponsors || sponsors.length === 0))
    return (
      <Container size="sm">
        <Stack justify="center" align="center">
          <Text style={{ textWrap: "balance" }}>
            Um möglichst viele gemeinnützige Aktivitäten für alle Altersbereiche durchführen zu
            können, suchen wir Sponsoring Partnerschaften. Informieren Sie sich über unsere
            Werbemöglichkeiten.
          </Text>
          <Box>
            <Button
              component="a"
              href={`mailto:philipp@vcmuellheim.de?subject=Sponsoring ${Club.shortName}`}
              variant="white"
            >
              Förderverein kontaktieren
            </Button>
          </Box>
        </Stack>
      </Container>
    );

  return (
    <Stack align="center">
      <Text>
        Wir bedanken uns herzlich bei{" "}
        {sponsors.length === 1 ? "unserem Sponsor" : "unseren Sponsoren"}!
      </Text>
      {sponsors.length > 2 ? (
        <Marquee gap="xl" fadeEdgeColor="var(--mantine-color-blumine-filled)">
          {sponsors.map((sponsor) => (
            <SponsorCard sponsor={sponsor} key={sponsor.id} />
          ))}
        </Marquee>
      ) : (
        <Group gap="xl" align="flex-start" justify="center">
          {sponsors.map((sponsor) => (
            <SponsorCard sponsor={sponsor} key={sponsor.id} />
          ))}
        </Group>
      )}
    </Stack>
  );
}

function SponsorCard({ sponsor }: { sponsor: Sponsor & { logoUrl?: string } }) {
  const { name, description, websiteUrl, logoUrl } = sponsor;

  if (!name) return null;

  const visual = (
    <Flex w={180} h={80} maw={"50vw"} align="center" justify="center">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`${name}`}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <Text size="xl" c="white" fw="bolder" ta="center">
          {name}
        </Text>
      )}
    </Flex>
  );

  const content = (
    <Stack w={220} maw={"50vw"} gap={6} align="center" justify="flex-start">
      {visual}
      {description ? (
        <Text
          size="sm"
          c="white"
          maw={220}
          ta="center"
          style={{ textWrap: "balance" }}
          lineClamp={2}
        >
          {description}
        </Text>
      ) : null}
    </Stack>
  );

  if (websiteUrl) {
    return (
      <Anchor
        href={websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        c="inherit"
        underline="never"
        display="block"
      >
        {content}
      </Anchor>
    );
  }

  return content;
}
