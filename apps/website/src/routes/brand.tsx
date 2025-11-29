import { Anchor, AspectRatio, Box, Button, Card, Group, Image, SimpleGrid, Stack, Text } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import brandJersey1 from "../assets/brand/jersey1.jpg";
import brandJersey2 from "../assets/brand/jersey2.jpg";
import CardTitle from "../components/CardTitle";
import PageWithHeading from "../components/layout/PageWithHeading";

export const Route = createFileRoute("/brand")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<PageWithHeading title="Vereinsfarben & Logo Dateien">
			<Stack>
				{/* colors */}
				<Card>
					<Stack>
						<Text>Unsere Vereinsfarben werden hier auf der Webseite verwendet und sollten wenn möglich auch in anderem Kontext verwendet werden.</Text>
						<SimpleGrid cols={3} c="white" spacing={{ base: 4, xs: "xs" }}>
							<Text p="xs" bg="blumine" fw="bold">
								Blumine
							</Text>
							<Text p="xs" bg="blumine">
								#366273
							</Text>
							<Text p="xs" bg="blumine">
								rgb(54,98,115)
							</Text>
							<Text p="xs" bg="onyx" fw="bold">
								Onyx
							</Text>
							<Text p="xs" bg="onyx">
								#363B40
							</Text>
							<Text p="xs" bg="onyx">
								rgb(54,59,64)
							</Text>
							<Text p="xs" bg="turquoise" fw="bold">
								Türkis
							</Text>
							<Text p="xs" bg="turquoise">
								#01A29A
							</Text>
							<Text p="xs" bg="turquoise">
								rgb(54,59,64)
							</Text>
						</SimpleGrid>
					</Stack>
				</Card>
				{/* logos */}
				<Card>
					<Stack gap="xl">
						<Stack>
							<CardTitle>Vektorgrafik</CardTitle>
							<Text>Vektorgrafiken skalieren dynamisch und eigenen sich daher perfekt für den Druck oder die Beflockung von Trikots.</Text>
							<Stack align="center">
								<Box pos="relative" w="100%" maw={505} style={{ aspectRatio: "505 / 288" }}>
									<Image src="/images/logo/logo.svg" alt="Logo" />
								</Box>
								<Group>
									<DownloadButton href="/images/logo/logo.svg">Download SVG</DownloadButton>
									<DownloadButton href="/images/logo/logo.pdf">Download PDF</DownloadButton>
								</Group>
							</Stack>
						</Stack>
						<Stack>
							<CardTitle>Rastergrafik</CardTitle>
							<Text>
								Rastergrafiken haben eine feste Auflösung und das Dateiformat PNG hat eine hohe Kompatibilität. Diese Dateien eignen sich daher für die meisten digitalen Zwecke. Die Auflösung beträgt
								5050x2880 Pixel.
							</Text>
							<SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
								<Stack>
									<Box pos="relative" w="100%" style={{ aspectRatio: "505 / 288" }}>
										<Image src="/images/logo/logo-schwarz.png" alt="Logo Schwarz" />
									</Box>
									<DownloadButton href="/images/logo/logo-schwarz.png">Download (Schwarz)</DownloadButton>
								</Stack>
								<Stack>
									<Box pos="relative" w="100%" bg="gray" style={{ aspectRatio: "505 / 288" }}>
										<Image src="/images/logo/logo-weiss.png" alt="Logo Weiß" />
									</Box>
									<DownloadButton href="/images/logo/logo-weiss.png">Download (Weiß)</DownloadButton>
								</Stack>
								<Stack>
									<Box pos="relative" w="100%" style={{ aspectRatio: "505 / 288" }}>
										<Image src="/images/logo/logo-363B40-01A29A.png" alt="Logo Türkis" />
									</Box>
									<DownloadButton href="/images/logo/logo-363B40-01A29A.png">Download (Türkis)</DownloadButton>
								</Stack>
								<Stack>
									<Box pos="relative" w="100%" style={{ aspectRatio: "505 / 288" }}>
										<Image src="/images/logo/logo-363B40-366273.png" alt="Logo Blumine" />
									</Box>
									<DownloadButton href="/images/logo/logo-363B40-366273.png">Download (Blumine)</DownloadButton>
								</Stack>
							</SimpleGrid>
						</Stack>
						<Stack>
							<CardTitle>Rastergrafik mit Hintergrund</CardTitle>
							<Text>Fertige Bilddateien mit weißem Logo auf farbigem Hintergrund.</Text>
							<SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
								<Stack>
									<Box pos="relative" w="100%" style={{ aspectRatio: "1 / 1" }}>
										<Image src="/images/logo/logo-366273.png" alt="Logo Blumine" />
									</Box>
									<DownloadButton href="/images/logo/logo-366273.png">Download (Blumine)</DownloadButton>
								</Stack>
								<Stack>
									<Box pos="relative" w="100%" style={{ aspectRatio: "1 / 1" }}>
										<Image src="/images/logo/logo-363B40.png" alt="Logo Onyx" />
									</Box>
									<DownloadButton href="/images/logo/logo-363B40.png">Download (Onyx)</DownloadButton>
								</Stack>
								<Stack>
									<Box pos="relative" w="100%" style={{ aspectRatio: "1 / 1" }}>
										<Image src="/images/logo/logo-01A29A.png" alt="Logo Türkis" />
									</Box>
									<DownloadButton href="/images/logo/logo-01A29A.png">Download (Türkis)</DownloadButton>
								</Stack>
							</SimpleGrid>
						</Stack>
					</Stack>
				</Card>
				{/* jerseys */}
				<Card>
					<Stack>
						<CardTitle>Trikots</CardTitle>
						<Text>
							<Text span fw="bold">
								Farbe:{" "}
							</Text>
							Damit wir Mannschafts- und Jahrgangsübergreifend geschlossen als Verein auftreten können, sollten Trikots in einer Farbe bestellt werden, die der Vereinsfarbe{" "}
							<Text span bg="blumine" c="white">
								Blumine
							</Text>{" "}
							ähnelnt. Navy oder Royal Blau sind beispielsweise Farben die von Sportartikelherstellern oft angeboten werden.
						</Text>
						<Text>
							<Text span fw="bold">
								Marke:{" "}
							</Text>{" "}
							ERIMA wird bevorzugt.
						</Text>
						<Stack gap="xs">
							<Text span fw="bold">
								Beispiele:
							</Text>

							<SimpleGrid spacing="xs" cols={{ base: 1, sm: 2 }}>
								<AspectRatio ratio={6 / 4}>
									<Image width={600} height={400} src={brandJersey1} alt="Logo" style={{ objectFit: "cover" }} />
								</AspectRatio>
								<AspectRatio ratio={6 / 4}>
									<Image width={600} height={400} src={brandJersey2} alt="Logo" style={{ objectFit: "cover" }} />
								</AspectRatio>
							</SimpleGrid>
						</Stack>
						<Text>
							Trikots können bequem in unserem{" "}
							<Anchor component="a" href="https://vcmuellheim.fan12.de/kategorien/vereinskollektion/" target="_blank" referrerPolicy="no-referrer" rel="noreferrer">
								Vereinsshop
							</Anchor>{" "}
							bestellt werden. Das richtige Vereinslogo ist dort bereits hinterlegt und muss bei der Bestellung nicht bereitgestellt werden.
						</Text>
					</Stack>
				</Card>
			</Stack>
		</PageWithHeading>
	);
}

function DownloadButton({ href, children }: { href: string; children: React.ReactNode }) {
	return (
		<Button component="a" href={href} download variant="light">
			{children}
		</Button>
	);
}
