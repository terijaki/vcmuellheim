import { AspectRatio, Card, Group, Image } from "@mantine/core";
import { useMemo, useState } from "react";

/** Deterministic shuffle so render stays pure (no Math.random). */
function shuffleDeterministic(images: string[]): string[] {
  const shuffled = [...images];
  let seed = 0;
  for (const url of images) {
    for (let i = 0; i < url.length; i++) {
      seed = (Math.imul(31, seed) + url.charCodeAt(i)) | 0;
    }
  }
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const j = Math.abs(seed) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function ImageGallery({ images }: { images?: string[] }) {
  const [isHovered, setIsHovered] = useState<string | null>(null);

  const shuffledGallery = useMemo(() => (images ? shuffleDeterministic(images) : []), [images]);

  if (!images || images.length === 0) return null;

  return (
    <Group gap="xs" justify="flex-start" preventGrowOverflow={false} mt="md">
      {shuffledGallery.map((imageUrl: string, index) => {
        return (
          <AspectRatio
            key={imageUrl}
            ratio={16 / 9}
            w={{ base: "100%", xs: 264 }}
            h={{ base: undefined, xs: (264 / 16) * 9 }}
          >
            <Card
              shadow="sm"
              component="a"
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={() => setIsHovered(imageUrl)}
              onMouseLeave={() => setIsHovered(null)}
            >
              <Card.Section>
                <Image
                  src={imageUrl}
                  alt={`Foto ${index}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: 8,
                    transition: "transform 0.5s ease",
                    transform: isHovered === imageUrl ? "scale(1.03)" : undefined,
                  }}
                />
              </Card.Section>
            </Card>
          </AspectRatio>
        );
      })}
    </Group>
  );
}
