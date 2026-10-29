"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";
import {
  LOCKUP_HEIGHT,
  LOCKUP_MARK_X,
  LOCKUP_MARK_Y,
  LOCKUP_VIEWBOX,
  LOCKUP_WIDTH,
  LOCKUP_WORD_X,
  LOCKUP_WORD_Y,
  MARK_HEIGHT,
  MARK_PATH,
  MARK_VIEWBOX,
  MARK_WIDTH,
  WORD_FLOW_PATH,
  WORD_HEIGHT,
  WORD_SALARY_PATH,
  WORD_WIDTH,
} from "./salaryflow-paths";

export type SalaryFlowLogoVariant = "auto" | "light" | "dark" | "icon";
export type SalaryFlowLogoSize = "sm" | "md" | "lg" | "xl";
export type SalaryFlowLogoLayout = "stacked" | "horizontal";

const SIZES: Record<
  SalaryFlowLogoSize,
  { stacked: number; horizontal: number; icon: number }
> = {
  sm: { stacked: 108, horizontal: 132, icon: 22 },
  md: { stacked: 148, horizontal: 168, icon: 30 },
  lg: { stacked: 196, horizontal: 220, icon: 40 },
  xl: { stacked: 264, horizontal: 280, icon: 54 },
};

const FLOW_ON_LIGHT = "#0891B2";
const FLOW_ON_DARK = "#22D3EE";
const WORD_DARK = "#102A43";
// `auto` follows the theme: darker cyan on light backgrounds, brighter cyan on
// dark backgrounds (matching the light/dark asset pair).
const FLOW_AUTO_CLASS = "fill-[#0891B2] dark:fill-[#22D3EE]";

// Horizontal lockup is derived from the stacked artwork: the mark keeps its
// aspect ratio and the wordmark sits to its right at 42% of the mark height.
const H_MARK_HEIGHT = 100;
const H_MARK_WIDTH = (MARK_WIDTH * H_MARK_HEIGHT) / MARK_HEIGHT;
const H_WORD_HEIGHT = 42;
const H_WORD_WIDTH = (WORD_WIDTH * H_WORD_HEIGHT) / WORD_HEIGHT;
const H_GAP = 18;
const H_WIDTH = H_MARK_WIDTH + H_GAP + H_WORD_WIDTH;
const H_WORD_Y = (H_MARK_HEIGHT - H_WORD_HEIGHT) / 2;

export interface SalaryFlowLogoProps {
  /**
   * `auto` inherits the current text colour for the "Salary" wordmark, so the
   * same logo works in light and dark themes. `dark` and `light` force the
   * wordmark for a known background. `icon` renders the symbol only.
   */
  variant?: SalaryFlowLogoVariant;
  size?: SalaryFlowLogoSize;
  /** `stacked` matches the reference artwork; `horizontal` suits headers. */
  layout?: SalaryFlowLogoLayout;
  /** Plays the one-time entrance animation. Use on startup/auth, not navigation. */
  animated?: boolean;
  /** Override the wordmark visibility. Defaults to false only for `icon`. */
  showWordmark?: boolean;
  className?: string;
  /** Accessible name. Pass `null` for decorative usage inside a labelled link. */
  label?: string | null;
}

export function SalaryFlowLogo({
  variant = "auto",
  size = "md",
  layout = "stacked",
  animated = false,
  showWordmark,
  className,
  label = "SalaryFlow",
}: SalaryFlowLogoProps) {
  const gradientId = `sf-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const sheenId = `${gradientId}-sheen`;
  const clipId = `${gradientId}-clip`;
  const withWordmark = showWordmark ?? variant !== "icon";
  const salaryColor =
    variant === "light"
      ? "#FFFFFF"
      : variant === "dark"
        ? WORD_DARK
        : "currentColor";
  const flowColor =
    variant === "light"
      ? FLOW_ON_DARK
      : variant === "dark"
        ? FLOW_ON_LIGHT
        : undefined;

  const classes = cn(
    "block shrink-0",
    animated && "sf-logo-animated",
    className,
  );
  const a11y =
    label === null
      ? { "aria-hidden": true as const }
      : { role: "img" as const, "aria-label": label };

  const gradient = (
    <defs>
      <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#0D9488" />
        <stop offset="0.5" stopColor="#22D3EE" />
        <stop offset="1" stopColor="#2563EB" />
      </linearGradient>
      <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="0.5" stopColor="#E0F7FF" stopOpacity="0.8" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
      <clipPath id={clipId}>
        <path d={MARK_PATH} clipRule="evenodd" />
      </clipPath>
    </defs>
  );

  const mark = (
    <>
      <path d={MARK_PATH} fill={`url(#${gradientId})`} fillRule="evenodd" />
      <rect
        className="sf-logo-sheen"
        x="0"
        y="0"
        width="150"
        height={MARK_HEIGHT}
        fill={`url(#${sheenId})`}
        clipPath={`url(#${clipId})`}
      />
    </>
  );

  const word = (
    <>
      <path d={WORD_SALARY_PATH} fill={salaryColor} fillRule="evenodd" />
      <path
        d={WORD_FLOW_PATH}
        fill={flowColor}
        fillRule="evenodd"
        className={variant === "auto" ? FLOW_AUTO_CLASS : undefined}
      />
    </>
  );

  if (!withWordmark) {
    const width = SIZES[size].icon;
    return (
      <svg
        viewBox={MARK_VIEWBOX}
        width={width}
        height={Math.round((width * MARK_HEIGHT) / MARK_WIDTH)}
        className={classes}
        {...a11y}
      >
        {gradient}
        <g className="sf-logo-mark">{mark}</g>
      </svg>
    );
  }

  if (layout === "horizontal") {
    const width = SIZES[size].horizontal;
    const height = Math.round((width * H_MARK_HEIGHT) / H_WIDTH);
    return (
      <svg
        viewBox={`0 0 ${H_WIDTH} ${H_MARK_HEIGHT}`}
        width={width}
        height={height}
        className={classes}
        {...a11y}
      >
        {gradient}
        <g transform={`scale(${H_MARK_HEIGHT / MARK_HEIGHT})`}>
          <g className="sf-logo-mark">{mark}</g>
        </g>
        <g
          transform={`translate(${H_MARK_WIDTH + H_GAP} ${H_WORD_Y}) scale(${H_WORD_HEIGHT / WORD_HEIGHT})`}
        >
          <g className="sf-logo-wordmark">{word}</g>
        </g>
      </svg>
    );
  }

  const width = SIZES[size].stacked;
  const height = Math.round((width * LOCKUP_HEIGHT) / LOCKUP_WIDTH);

  return (
    <svg
      viewBox={LOCKUP_VIEWBOX}
      width={width}
      height={height}
      className={classes}
      {...a11y}
    >
      {gradient}
      <g transform={`translate(${LOCKUP_MARK_X} ${LOCKUP_MARK_Y})`}>
        <g className="sf-logo-mark">{mark}</g>
      </g>
      <g transform={`translate(${LOCKUP_WORD_X} ${LOCKUP_WORD_Y})`}>
        <g className="sf-logo-wordmark">{word}</g>
      </g>
    </svg>
  );
}
