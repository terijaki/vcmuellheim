import { BackgroundImage, Overlay, Stack, Text, Title } from "@mantine/core";

export default function PageHeading(props: {
	title: string;
	subtitle?: string;
	date?: Date;
}) {
	// #366273 is in rgb (54, 98, 115)
	// #363b40 is in rgb (54, 59, 64)

	return (
		<BackgroundImage
			src="/images/backgrounds/pageheading.jpg"
			h={96 + 8 + 8 + 8}
			w="100%"
			pos="relative"
			style={{ zIndex: 0 }}
		>
			<Stack justify="center" align="center" h="100%" gap={0} c="white">
				<Title ta="center" textWrap="balance" order={1} lineClamp={2}>
					{props.title}
				</Title>

				{props.subtitle && <Text ta="center">{props.subtitle}</Text>}
				{!props.subtitle && props.date && (
					<time dateTime={props.date.toISOString()}>
						<Text ta="center">
							{" "}
							{props.date.toLocaleString("de-DE", {
								day: "numeric",
								month: "short",
								year: "numeric",
							})}
						</Text>
					</time>
				)}
			</Stack>
			{/* <Overlay backgroundOpacity={0.95} color="var(--mantine-color-onyx-filled)" blur={2} zIndex={-1} /> */}

			<Overlay gradient="linear-gradient(0deg, rgba(54, 98, 115, 0.9) 0%, rgba(54, 59, 64,0.98) 100%)" zIndex={-1} />
		</BackgroundImage>
	);
}
