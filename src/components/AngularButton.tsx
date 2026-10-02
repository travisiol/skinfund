import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "outline";
type Size = "sm" | "md" | "lg";

function classes(variant: Variant, size: Size, extra?: string) {
  return ["btn frame", variant === "primary" ? "btn-primary" : "btn-outline", size === "lg" ? "btn-lg" : size === "sm" ? "btn-sm" : "", extra]
    .filter(Boolean)
    .join(" ");
}

interface Shared {
  variant?: Variant;
  size?: Size;
}

/** The clipped-corner button. Teal when it is the one thing to do, gold outline otherwise. */
export function AngularButton({ variant = "primary", size = "md", className, type = "button", ...rest }: Shared & ComponentProps<"button">) {
  return <button type={type} className={classes(variant, size, className)} {...rest} />;
}

export function AngularLink({ variant = "primary", size = "md", className, ...rest }: Shared & ComponentProps<typeof Link>) {
  return <Link className={classes(variant, size, className)} {...rest} />;
}
