import type { ReactNode } from "react";

/** Estilo de superficie de tarjeta sin padding (para listas a sangre). */
export const cardSurfaceClasses = "rounded-2xl border border-border bg-surface";

export const cardClasses = `${cardSurfaceClasses} p-5 sm:p-6`;

export function Card({
  as = "div",
  className,
  children,
}: {
  as?: "div" | "article" | "section" | "li";
  className?: string;
  children: ReactNode;
}) {
  const Tag = as;
  return <Tag className={className ? `${cardClasses} ${className}` : cardClasses}>{children}</Tag>;
}
