import type { AnchorProps } from "@mantine/core";
import { Anchor, Group, Text } from "@mantine/core";
import { useSyncExternalStore } from "react";
import { FaLocationDot as IconLocation } from "react-icons/fa6";
import { buildMapsSearchUrl } from "@/utils/build-maps-search-url";

interface MapsLinkProps extends Omit<AnchorProps, "href" | "component" | "target"> {
  street?: string | null;
  postal?: string | null;
  city?: string | null;
  name?: string | null;
}

function subscribe() {
  return () => {};
}

function hasUserAgentData(n: Navigator): n is Navigator & { userAgentData: { platform: string } } {
  return (
    "userAgentData" in n &&
    typeof (n as { userAgentData?: { platform?: string } }).userAgentData?.platform === "string"
  );
}

function getIsAppleDevice(): boolean {
  if (hasUserAgentData(navigator)) {
    return /iPhone|iPad|iPod|Mac/.test(navigator.userAgentData.platform);
  }
  if (navigator.userAgent) {
    return /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
  }
  return false;
}

export default function MapsLink({ street, postal, city, name, ...anchorProps }: MapsLinkProps) {
  const isAppleDevice = useSyncExternalStore(subscribe, getIsAppleDevice, () => false);
  const mapsUrl = buildMapsSearchUrl(
    { name, street, postal, city },
    isAppleDevice ? "apple" : "google",
  );

  const displayName = name || city;

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
