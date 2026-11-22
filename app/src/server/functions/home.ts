import {
  HOME_INTRO_BACKGROUND_IMAGE_IDS,
  type HomeIntroBackgroundImageId,
} from "@webapp/utils/static-bundled-images";
import { createServerFn } from "@tanstack/react-start";

const pickRandomHomeIntroBackgroundImage = (): HomeIntroBackgroundImageId => {
  const randomIndex = Math.floor(Math.random() * HOME_INTRO_BACKGROUND_IMAGE_IDS.length);
  return HOME_INTRO_BACKGROUND_IMAGE_IDS[randomIndex];
};

// Chosen once per runtime instance (for example, one warm Lambda container).
const stableHomeIntroBackgroundImage = pickRandomHomeIntroBackgroundImage();

export const getHomeIntroBackgroundImageFn = createServerFn().handler(async () => {
  return stableHomeIntroBackgroundImage;
});
