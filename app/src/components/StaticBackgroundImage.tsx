import { BackgroundImage, Box, type BoxProps, type MantineRadius } from "@mantine/core";
import type { CSSProperties, ReactNode } from "react";
import {
  staticBundledBackgroundImageStyle,
  type StaticBundledImageId,
} from "../utils/static-bundled-images";

type StaticBackgroundImageProps = BoxProps & {
  imageId: StaticBundledImageId;
  radius?: MantineRadius;
  children?: ReactNode;
};

/**
 * Hero / section backgrounds from bundled assets: WebP via CSS `image-set`, JPEG fallback.
 */
export function StaticBackgroundImage({
  imageId,
  style,
  className,
  ...rest
}: StaticBackgroundImageProps) {
  const bgVars = staticBundledBackgroundImageStyle(imageId);

  return (
    <Box
      className={[BackgroundImage.classes.root, "static-bundled-bg", className]
        .filter(Boolean)
        .join(" ")}
      style={{ ...bgVars, ...style } as CSSProperties}
      {...rest}
    />
  );
}

type OptionalStaticBackgroundImageProps = BoxProps & {
  /** Remote or CMS URL — passed through unchanged */
  src?: string;
  /** Bundled asset id when `src` is not set */
  imageId?: StaticBundledImageId;
  radius?: MantineRadius;
  children?: ReactNode;
};

/**
 * Uses a bundled WebP+JPEG pair, or a single remote `src` for dynamic images.
 */
export function OptionalStaticBackgroundImage({
  src,
  imageId,
  style,
  className,
  ...rest
}: OptionalStaticBackgroundImageProps) {
  if (src) {
    return <BackgroundImage src={src} style={style} className={className} {...rest} />;
  }
  if (!imageId) {
    throw new Error("OptionalStaticBackgroundImage requires either src or imageId");
  }
  return <StaticBackgroundImage imageId={imageId} style={style} className={className} {...rest} />;
}
