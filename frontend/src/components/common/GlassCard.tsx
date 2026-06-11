import { ReactNode, HTMLAttributes } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual variant of the glass surface */
  variant?: "default" | "subtle" | "strong";
  /** Extra rounded corners */
  rounded?: "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
  children: ReactNode;
}

const roundedMap: Record<NonNullable<GlassCardProps["rounded"]>, string> = {
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
  full: "rounded-full",
};

const variantMap: Record<NonNullable<GlassCardProps["variant"]>, string> = {
  default: "glass",
  subtle: "glass-subtle",
  strong:
    "bg-white/[0.07] backdrop-blur-2xl border border-white/10",
};

/**
 * GlassCard — Reusable glassmorphism surface component.
 * Uses the `.glass` / `.glass-subtle` utilities defined in globals.css.
 */
export default function GlassCard({
  variant = "default",
  rounded = "2xl",
  className = "",
  children,
  ...rest
}: GlassCardProps) {
  return (
    <div
      className={`${variantMap[variant]} ${roundedMap[rounded]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
