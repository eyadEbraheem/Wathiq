import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "dark";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-teal-grad text-white shadow-glow",
  secondary:
    "bg-icy text-primary-ink border border-primary/30 hover:bg-primary hover:text-white hover:border-transparent",
  ghost: "text-muted hover:bg-icy hover:text-ink",
  dark: "bg-navy-grad text-white",
};

const SIZES: Record<Size, string> = {
  sm: "organic-sm h-9 px-4 text-xs gap-1.5",
  md: "h-11 px-6 text-sm gap-2",
};

/** The reference's "organic" button: asymmetric corners, spring hover, teal gradient. */
export function buttonClasses(variant: Variant = "primary", size: Size = "md") {
  return `organic inline-flex items-center justify-center font-black disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={`${buttonClasses(variant, size)} ${className}`} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${buttonClasses(variant, size)} ${className}`}>
      {children}
    </Link>
  );
}
