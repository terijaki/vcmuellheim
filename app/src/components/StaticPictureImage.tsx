import { Image, type ImageProps } from "@mantine/core";
import type { ComponentPropsWithoutRef } from "react";
import { getStaticBundledImage, type StaticBundledImageId } from "../utils/static-bundled-images";

type StaticPictureImageProps = Omit<ImageProps, "src"> & {
  imageId: StaticBundledImageId;
} & Pick<ComponentPropsWithoutRef<"img">, "alt">;

/** `<picture>` wrapper for bundled photos (WebP + JPEG fallback). */
export function StaticPictureImage({ imageId, alt, ...imageProps }: StaticPictureImageProps) {
  const { webp, fallback } = getStaticBundledImage(imageId);

  return (
    <picture style={{ display: "block", width: "100%", height: "100%" }}>
      <source type="image/webp" srcSet={webp} />
      <Image src={fallback} alt={alt} {...imageProps} />
    </picture>
  );
}
