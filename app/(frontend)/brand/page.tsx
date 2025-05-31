import CardTitle from "@/components/CardTitle";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { Anchor, AspectRatio, Box, Button, Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Brand Guide" };

export default function StyleGuidePage() {
	return (
		<PageWithHeading title="Vereinsfarben & Logo Dateien">
			<Stack>
				{/* colors */}
				<Card>
					<Stack>
						<Text>
							Unsere Vereinsfarben werden hier auf der Webseite verwendet und sollten wenn möglich auch in anderem
							Kontext verwendet werden.
						</Text>
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
							<Text>
								Vektorgrafiken skalieren dynamisch und eigenen sich daher perfekt für den Druck oder die Beflockung von
								Trikots.
							</Text>
							<Stack align="center">
								<Image src="/images/logo/logo.svg" width={505} height={288} alt="Logo" unoptimized />
								<Group>
									<Button component={Link} href="/images/logo/logo.svg" download>
										Download SVG
									</Button>
									<Button component={Link} href="/images/logo/logo.pdf" download>
										Download PDF
									</Button>
								</Group>
							</Stack>
						</Stack>
						<Stack>
							<CardTitle>Rastergrafik</CardTitle>
							<Text>
								Rastergrafiken haben eine feste Auflösung und das Dateiformat PNG hat eine hohe Kompatibilität. Diese
								Dateien eignen sich daher für die meisten digitalen Zwecke. Die Auflösung beträgt 5050x2880 Pixel.
							</Text>
							<SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
								<Stack>
									<Image src="/images/logo/logo-schwarz.png" width={505} height={288} alt="Logo Schwarz" unoptimized />
									<Button component={Link} href="/images/logo/logo-schwarz.png" download mx="lg">
										Download (Schwarz)
									</Button>
								</Stack>
								<Stack>
									<Box bg="gray">
										<Image src="/images/logo/logo-weiss.png" width={505} height={288} alt="Logo Weiß" unoptimized />
									</Box>
									<Button component={Link} href="/images/logo/logo-weiss.png" download mx="lg">
										Download (Weiß)
									</Button>
								</Stack>
								<Stack>
									<Image
										src="/images/logo/logo-363B40-01A29A.png"
										width={505}
										height={288}
										alt="Logo Türkis"
										unoptimized
									/>
									<Button component={Link} href="/images/logo/logo-363B40-01A29A.png" download mx="lg">
										Download (Türkis)
									</Button>
								</Stack>
								<Stack>
									<Image
										src="/images/logo/logo-363B40-366273.png"
										width={505}
										height={288}
										alt="Logo Blumine"
										unoptimized
									/>
									<Button component={Link} href="/images/logo/logo-363B40-366273.png" download mx="lg">
										Download (Blumine)
									</Button>
								</Stack>
							</SimpleGrid>
						</Stack>
						<Stack>
							<CardTitle>Rastergrafik mit Hintergrund</CardTitle>
							<Text>Fertige Bilddateien mit weißem Logo auf farbigem Hintergrund.</Text>
							<SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
								<Stack>
									<Image src="/images/logo/logo-366273.png" width={500} height={500} alt="Logo Blumine" unoptimized />
									<Button component={Link} href="/images/logo/logo-366273.png" download>
										Download (Blumine)
									</Button>
								</Stack>
								<Stack>
									<Image src="/images/logo/logo-363B40.png" width={500} height={500} alt="Logo Onyx" unoptimized />
									<Button component={Link} href="/images/logo/logo-363B40.png" download>
										Download (Onyx)
									</Button>
								</Stack>
								<Stack>
									<Image src="/images/logo/logo-01A29A.png" width={500} height={500} alt="Logo Türkis" unoptimized />
									<Button component={Link} href="/images/logo/logo-01A29A.png" download>
										Download (Türkis)
									</Button>
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
							Damit wir Mannschafts- und Jahrgangsübergreifend geschlossen als Verein auftreten können, sollten Trikots
							in einer Farbe bestellt werden, die der Vereinsfarbe{" "}
							<Text span bg="blumine" c="white">
								Blumine
							</Text>{" "}
							ähnelnt. Navy oder Royal Blau sind beispielsweise Farben die von Sportartikelherstellern oft angeboten
							werden.
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
									<Image
										width={600}
										height={400}
										src="/images/brand/jersey1.jpg"
										alt="Logo"
										style={{ objectFit: "cover" }}
									/>
								</AspectRatio>
								<AspectRatio ratio={6 / 4}>
									<Image
										width={600}
										height={400}
										src="/images/brand/jersey2.jpg"
										alt="Logo"
										style={{ objectFit: "cover" }}
									/>
								</AspectRatio>
							</SimpleGrid>
						</Stack>
						<Text>
							Trikots können bequem in unserem{" "}
							<Anchor
								component={Link}
								href="https://vcmuellheim.fan12.de/kategorien/vereinskollektion/"
								target="_blank"
								referrerPolicy="no-referrer"
								rel="noreferrer"
							>
								Vereinsshop
							</Anchor>{" "}
							bestellt werden. Das richtige Vereinslogo ist dort bereits hinterlegt und muss bei der Bestellung nicht
							bereitgestellt werden.
						</Text>
					</Stack>
				</Card>
			</Stack>
		</PageWithHeading>
	);
}
