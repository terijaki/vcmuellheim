import { getPictures } from "@/data/pictures";
import { BackgroundImage, Box, Button, Center, Container, Overlay, Stack, Text } from "@mantine/core";
import Link from "next/link";
import ScrollAnchor from "./ScrollAnchor";

export default async function HomeFotos() {
	const data = await getPictures(5);
	const pictures = data?.docs;

	return (
		<Box bg="blumine">
			<ScrollAnchor name="fotos" />
			<BackgroundImage
				src={pictures?.[0]?.url || "/images/backgrounds/pageheading.jpg"}
				py="md"
				style={{ zIndex: 0 }}
				pos="relative"
			>
				<Container size="xs" py="md" c="white">
					<Stack>
						<Text>
							Eindrücke aus unserem Vereinsleben, von Spieltagen, Turnieren und unseren Mitgliedern findest du in
							unserer:
						</Text>
						<Center>
							<Button component={Link} href="/fotos">
								Fotogalerie
							</Button>
						</Center>
					</Stack>
				</Container>

				<Overlay backgroundOpacity={0.95} color="var(--mantine-color-onyx-filled)" blur={2} zIndex={-1} />
			</BackgroundImage>
		</Box>
	);

	// return (
	// 	<section className="col-full-content grid-cols-main-grid bg-gradient-overlay overflow-hidden">
	// 		<ScrollAnchor name="fotos" />
	// 		<div className="col-center-content text-white text-center px-4">
	// 			<SectionHeading text="Fotos" color="white" />
	// 			<p className="text-balance">
	// 				Eindrücke aus unserem Vereinsleben, von Spieltagen, Turnieren und unseren Mitgliedern findest du in unserer:
	// 			</p>
	// 			<div className="my-6">
	// 				<Link href="/fotos" className="button border-white">
	// 					Fotogalerie
	// 				</Link>
	// 			</div>
	// 		</div>

	// 		<div className="absolute inset-0 grid grid-flow-col z-[-10]">
	// 			{pictures?.map((image, index) => {
	// 				if (!image.url) return null;
	// 				return (
	// 					<div
	// 						key={image.url}
	// 						className={`relative${index === 1 ? " hidden sm:block" : ""}${index === 2 ? " hidden lg:block" : ""}${index === 3 ? " hidden xl:block" : ""}${index > 3 ? " hidden 2xl:block" : ""}`}
	// 					>
	// 						<Image src={image.url} fill className="object-cover" alt="" loading="lazy" />
	// 					</div>
	// 				);
	// 			})}
	// 		</div>
	// 	</section>
	// );
}
