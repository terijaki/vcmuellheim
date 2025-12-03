import { Pagination, type PaginationProps } from "@mantine/core";
import type { ComponentProps } from "react";

export default function Paginator(props: ComponentProps<typeof Pagination>) {
	const defaultProps: PaginationProps = {
		hideWithOnePage: true,
		getItemProps: (value) => ({ component: "a", href: `?page=${value}` }),
		...props,
	};
	return <Pagination {...defaultProps} />;
}
