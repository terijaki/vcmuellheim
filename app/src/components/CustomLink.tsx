import { Button, type ButtonProps, Card, type CardProps } from "@mantine/core";
import { createLink, type LinkComponent } from "@tanstack/react-router";
import type { AnchorHTMLAttributes } from "react";
import * as React from "react";

// Mantine Button + TanStack Router Link

const MantineButtonLinkComponent = React.forwardRef<HTMLAnchorElement, ButtonProps>((props, ref) => {
	return <Button component="a" ref={ref} {...props} />;
});

const CreatedButtonLinkComponent = createLink(MantineButtonLinkComponent);

/**
 * A strongly-typed Mantine Button component for declarative navigation.
 * Handles path, search, hash and state updates with optional route preloading
 * and active-state styling.
 * Props:
 * - `to`: The destination path or route name.
 * - `params`: Route parameters for dynamic segments.
 * - `search`: Query parameters as an object.
 */
export const ButtonLink: LinkComponent<typeof MantineButtonLinkComponent> = (props) => {
	return <CreatedButtonLinkComponent preload="intent" {...props} />;
};

// Mantine Card + TanStack Router Link with enhanced typing for anchor events
type MantineCardLinkProps = CardProps & AnchorHTMLAttributes<HTMLAnchorElement>;
const MantineCardLinkComponent = React.forwardRef<HTMLAnchorElement, MantineCardLinkProps>((props, ref) => {
	return <Card component="a" ref={ref} {...props} />;
});

const CreatedCardLinkComponent = createLink(MantineCardLinkComponent);
/**
 * A strongly-typed clickable Mantine Card component for declarative navigation.
 * Handles path, search, hash and state updates with optional route preloading
 * and active-state styling.
 * Props:
 * - `to`: The destination path or route name.
 * - `params`: Route parameters for dynamic segments.
 * - `search`: Query parameters as an object.
 */
export const CardLink: LinkComponent<typeof MantineCardLinkComponent> = (props) => {
	return <CreatedCardLinkComponent preload="intent" {...props} />;
};
