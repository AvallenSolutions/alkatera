"use client";

import { cn } from "@/lib/utils";

export const AlkaTeraIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M50 10L90 80H10L50 10Z" stroke="currentColor" strokeWidth="2" className="opacity-30" />
    <path d="M50 10C50 10 30 40 30 60C30 71.0457 38.9543 80 50 80C61.0457 80 70 71.0457 70 60C70 40 50 10 50 10Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    <path d="M50 10V80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M50 40L70 25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M50 55L30 45" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const AlkaTeraWordmark = ({ className }: { className?: string }) => (
  <div className={cn("font-sans font-extralight tracking-[0.2em] lowercase leading-none", className)}>
    alka<span className="font-normal">tera</span>
  </div>
);

export const AlkaTeraLogoHorizontal = ({
  className,
  iconSize = "h-10 w-10",
  textSize = "text-3xl",
  iconClassName,
  wordmarkClassName
}: {
  className?: string;
  iconSize?: string;
  textSize?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
}) => (
  <div className={cn("flex items-center gap-4", className)}>
    <AlkaTeraIcon className={cn(iconSize, iconClassName)} />
    <AlkaTeraWordmark className={cn(textSize, wordmarkClassName)} />
  </div>
);

export const AlkaTeraLogoVertical = ({
  className,
  iconSize = "h-16 w-16",
  textSize = "text-3xl",
  iconClassName,
  wordmarkClassName
}: {
  className?: string;
  iconSize?: string;
  textSize?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
}) => (
  <div className={cn("flex flex-col items-center gap-4", className)}>
    <AlkaTeraIcon className={cn(iconSize, iconClassName)} />
    <AlkaTeraWordmark className={cn(textSize, wordmarkClassName)} />
  </div>
);
