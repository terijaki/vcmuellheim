import { createServerFn } from "@tanstack/react-start";

const HOME_INTRO_BACKGROUND_IMAGES = ["/assets/backgrounds/intro1.jpg", "/assets/backgrounds/intro2.jpg", "/assets/backgrounds/intro3.jpg", "/assets/backgrounds/intro4.jpg"] as const;

const pickRandomHomeIntroBackgroundImage = () => {
	const randomIndex = Math.floor(Math.random() * HOME_INTRO_BACKGROUND_IMAGES.length);
	return HOME_INTRO_BACKGROUND_IMAGES[randomIndex];
};

// Chosen once per runtime instance (for example, one warm Lambda container).
const stableHomeIntroBackgroundImage = pickRandomHomeIntroBackgroundImage();

export const getHomeIntroBackgroundImageFn = createServerFn().handler(async () => {
	return stableHomeIntroBackgroundImage;
});
