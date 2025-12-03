import { Center, Loader, Stack, Text } from "@mantine/core";

export default function CenteredLoader({ text }: { text?: string }) {
	return (
		<Center p="xl">
			<Stack align="center" gap="xs">
				<Loader />
				{text && (
					<Text c="dimmed" size="sm">
						{text}
					</Text>
				)}
			</Stack>
		</Center>
	);
}
