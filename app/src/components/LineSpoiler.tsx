import { Anchor } from "@mantine/core";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type LineSpoilerProps = {
  children: ReactNode;
  lines: number;
  showLabel: string;
  hideLabel?: string;
  className?: string;
};

function resolveLineHeightPx(el: HTMLElement): number {
  const computed = getComputedStyle(el).lineHeight;
  const parsed = Number.parseFloat(computed);
  if (Number.isFinite(parsed)) return parsed;
  const fontSize = Number.parseFloat(getComputedStyle(el).fontSize);
  return Number.isFinite(fontSize) ? fontSize * 1.5 : 24;
}

/**
 * A spoiler component that collapses content to a fixed number of lines using
 * the CSS `lh` unit, ensuring clean line-boundary cuts at all breakpoints and
 * font sizes — unlike pixel-based max-height.
 *
 * The expand control and fade are omitted when the content already fits within
 * the collapsed line budget.
 */
export function LineSpoiler({
  children,
  lines,
  showLabel,
  hideLabel,
  className,
}: LineSpoilerProps) {
  const [expanded, setExpanded] = useState(false);
  const [needsSpoiler, setNeedsSpoiler] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      if (!expanded) {
        setNeedsSpoiler(el.scrollHeight > el.clientHeight + 1);
        return;
      }
      const maxCollapsedHeight = resolveLineHeightPx(el) * lines;
      setNeedsSpoiler(el.scrollHeight > maxCollapsedHeight + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children, expanded, lines]);

  return (
    <div className={className}>
      <div
        ref={contentRef}
        style={{
          position: "relative",
          overflow: "hidden",
          maxHeight: expanded ? "none" : `${lines}lh`,
        }}
      >
        {children}
        {!expanded && needsSpoiler && (
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
      {needsSpoiler && (!expanded || hideLabel) && (
        <Anchor component="button" size="sm" mt="xs" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? hideLabel : showLabel}
        </Anchor>
      )}
    </div>
  );
}
