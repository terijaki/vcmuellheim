import type { AnchorProps } from "@mantine/core";
import { Anchor, Group, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { FaLocationDot as IconLocation } from "react-icons/fa6";
import { buildMapsSearchUrl } from "@/utils/build-maps-search-url";

interface MapsLinkProps extends Omit<AnchorProps, "href" | "component" | "target"> {
  street?: string | null;
  postal?: string | null;
  city?: string | null;
  name?: string | null;
}

export default function MapsLink({ street, postal, city, name, ...anchorProps }: MapsLinkProps) {
  const [mapsUrl, setMapsUrl] = useState<string | null>(null);

  useEffect(() => {
    let isAppleDevice = false;
    function hasUserAgentData(
      n: Navigator,
    ): n is Navigator & { userAgentData: { platform: string } } {
      return (
        "userAgentData" in n &&
        typeof (n as { userAgentData?: { platform?: string } }).userAgentData?.platform === "string"
      );
    }
    if (hasUserAgentData(navigator)) {
      isAppleDevice = /iPhone|iPad|iPod|Mac/.test(navigator.userAgentData.platform);
    } else if (navigator.userAgent) {
      isAppleDevice = /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
    }

    setMapsUrl(
      buildMapsSearchUrl({ name, street, postal, city }, isAppleDevice ? "apple" : "google"),
    );
  }, [street, postal, city, name]);

  const displayName = name || city;

  // Before the effect runs, just show the name without a link
  if (!mapsUrl) return <>{displayName}</>;

  return (
    <Anchor
      component="a"
      href={mapsUrl}
      underline="never"
      target="_blank"
      rel="noopener noreferrer"
      {...anchorProps}
    >
      <Group gap={4} wrap="nowrap" align="baseline">
        <IconLocation />
        <Text lineClamp={2}>{displayName}</Text>
      </Group>
    </Anchor>
  );
}
