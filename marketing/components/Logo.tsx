import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

// The cream lockup: this component sits on dark surfaces (the old blend hacks
// were forcing a light logo to show). The cream SVG needs no filters.
export const Logo = ({ className }: LogoProps) => (
  <div className={cn("flex items-center select-none", className)}>
    <img
      src="/logo-cream.svg"
      alt="alkatera"
      className="h-10 md:h-14 w-auto object-contain"
    />
  </div>
);
