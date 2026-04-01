import { Center, Divider, type MantineColor, Stack, Title } from "@mantine/core";

export default function SectionHeading({ text, color = "blumine" }: { text: string; color?: MantineColor }) {
	return (
		<Center c={color} pb="xs">
			<Stack gap={0}>
				<Title order={3}>{text}</Title>
				<Divider mx="xs" size="sm" color={color} opacity={0.3} />
			</Stack>
		</Center>
	);
}
