import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

export const Logo = ({ className }: LogoProps) => (
  <div className={cn("flex items-center select-none", className)}>
    <img
      src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png"
      alt="AlkaTera"
      className="h-10 md:h-14 w-auto object-contain mix-blend-screen brightness-125 contrast-150"
      style={{ mixBlendMode: 'screen' }}
    />
  </div>
);
