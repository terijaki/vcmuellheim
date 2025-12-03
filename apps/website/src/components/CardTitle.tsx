import { Title, type TitleProps } from "@mantine/core";

export default function CardTitle(props: TitleProps) {
	return (
		<Title order={3} c="blumine" {...props}>
			{props.children}
		</Title>
	);
}
