"use client";
import { Pagination } from "@mantine/core";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

export default function Paginator(props: ComponentProps<typeof Pagination>) {
	const router = useRouter();
	return <Pagination {...props} onChange={(value) => router.push(`?page=${value}`)} />;
}
