import { Box } from "@mantine/core";

export default function ScrollAnchor({ name }: { name: string }) {
	return <Box pos="absolute" mt={-60} id={name} />;
}
