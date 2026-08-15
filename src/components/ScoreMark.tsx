import clsx from "clsx";
import type { ReactNode } from "react";
import type { ScoreMarkKind } from "@/lib/scoring/scoreMark";

function Ring({ shape, dim, children }: { shape: "circle" | "square"; dim: string; children: ReactNode }) {
  return (
    <span className={clsx(
      "inline-flex items-center justify-center border border-ink/70 leading-none px-0.5",
      shape === "circle" ? "rounded-full" : "rounded-[3px]",
      dim,
    )}>
      {children}
    </span>
  );
}

/**
 * PGA-style scorecard marks — single/double circle for birdie/eagle, single/
 * double square for bogey/double-or-worse, nothing for par. Gross only (see
 * scoreMarkKind). Renders children unwrapped when there's no mark, so it's
 * safe to use unconditionally around any gross-score cell.
 *
 * Rings use a fixed height + matching min-width (not padding alone) so a
 * single-digit score reads as a true circle/square rather than an oval —
 * line-height on large display text otherwise makes the box taller than
 * wide. Width still grows for rare two-digit scores.
 */
export function ScoreMark({
  kind, size = "sm", children,
}: { kind: ScoreMarkKind | null; size?: "sm" | "lg"; children: ReactNode }) {
  if (!kind) return <>{children}</>;
  const shape: "circle" | "square" = kind === "eagle" || kind === "birdie" ? "circle" : "square";
  const doubled = kind === "eagle" || kind === "double";
  const innerDim = size === "lg" ? "h-11 min-w-[2.75rem]" : "h-6 min-w-[1.5rem]";
  const outerDim = size === "lg" ? "h-[3.25rem] min-w-[3.25rem]" : "h-7 min-w-[1.75rem]";
  const inner = <Ring shape={shape} dim={innerDim}>{children}</Ring>;
  return doubled ? <Ring shape={shape} dim={outerDim}>{inner}</Ring> : inner;
}
