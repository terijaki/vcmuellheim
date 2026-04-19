import { Anchor } from "@mantine/core";
import { useState, type ReactNode } from "react";

type LineSpoilerProps = {
	children: ReactNode;
	lines: number;
	showLabel: string;
	hideLabel?: string;
	className?: string;
};

/**
 * A spoiler component that collapses content to a fixed number of lines using
 * the CSS `lh` unit, ensuring clean line-boundary cuts at all breakpoints and
 * font sizes — unlike pixel-based max-height.
 */
export function LineSpoiler({ children, lines, showLabel, hideLabel, className }: LineSpoilerProps) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className={className}>
			<div
				style={{
					position: "relative",
					overflow: "hidden",
					maxHeight: expanded ? "none" : `${lines}lh`,
				}}
			>
				{children}
				{!expanded && (
					<div
						style={{
							position: "absolute",
							bottom: 0,
							left: 0,
							right: 0,
							height: "3lh",
							background: "linear-gradient(to bottom, transparent, var(--mantine-color-body))",
							pointerEvents: "none",
						}}
					/>
				)}
			</div>
			{(!expanded || hideLabel) && (
				<Anchor component="button" size="sm" mt="xs" onClick={() => setExpanded((prev) => !prev)}>
					{expanded ? hideLabel : showLabel}
				</Anchor>
			)}
		</div>
	);
}
