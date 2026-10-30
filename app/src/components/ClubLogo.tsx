import { Flex, Image } from "@mantine/core";
import { FaVolleyball as Ball } from "react-icons/fa6";
import { clubLogoProxyUrl, teamLogoProxyUrl } from "@webapp/utils/club-logo";

type ClubLogoProps = (
  | { clubUuid: string; logoUrl?: never; teamUuid?: never }
  | { teamUuid: string; logoUrl?: never; clubUuid?: never }
  | { logoUrl: string | null | undefined; clubUuid?: never; teamUuid?: never }
) & {
  label?: string;
  light?: boolean;
  size?: number;
};

export default function ClubLogo({
  clubUuid,
  teamUuid,
  logoUrl: proppedLogoUrl,
  label,
  light,
  size = 24,
}: ClubLogoProps) {
  const logoUrl = clubUuid
    ? clubLogoProxyUrl(clubUuid)
    : teamUuid
      ? teamLogoProxyUrl(teamUuid)
      : proppedLogoUrl;

  if (!logoUrl) {
    return <ClubLogoFallback size={size} />;
  }

  return (
    <Flex justify="center" align="center" w={size} h={size} style={{ flexShrink: 0 }}>
      <Image
        src={logoUrl}
        alt={`Logo: ${label || "Vereinlogo"}`}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          borderRadius: "50%",
          filter: light ? "saturate(0) brightness(0) invert(1)" : undefined,
          mixBlendMode: light ? undefined : "multiply",
        }}
      />
    </Flex>
  );
}

export function ClubLogoFallback({ size = 24 }: { size?: number }) {
  return (
    <Flex pos="relative" justify="center" align="center" w={size} h={size} c="lion">
      <Ball />
    </Flex>
  );
}
