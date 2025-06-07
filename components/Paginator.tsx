"use client";
import { Pagination, type PaginationProps } from "@mantine/core";
import Link from "next/link";
import type { ComponentProps } from "react";

export default function Paginator(props: ComponentProps<typeof Pagination>) {
	const defaultProps: PaginationProps = {
		hideWithOnePage: true,
		getItemProps: (value) => ({ component: Link, href: `?page=${value}` }),
		...props,
	};
	return <Pagination {...defaultProps} />;
}
