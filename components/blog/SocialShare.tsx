"use client";

import { useState } from 'react';
import { Linkedin, Link as LinkIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SocialShareProps {
  url: string;
  title: string;
  description?: string;
}

export function SocialShare({ url, title, description }: SocialShareProps) {
  const [copied, setCopied] = useState(false);

  const shareOnLinkedIn = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    window.open(linkedInUrl, '_blank', 'noopener,noreferrer,width=600,height=600');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-[#6F6F68] font-mono text-[10px] font-bold uppercase tracking-[0.22em]">
        Share
      </span>

      {/* LinkedIn Share */}
      <Button
        variant="ghost"
        size="sm"
        onClick={shareOnLinkedIn}
        className={cn(
          'h-9 px-4 gap-2 rounded-full border border-[#D9D6CB] text-[#1A1B1D] hover:border-[#205E40] hover:text-[#205E40] hover:bg-transparent transition-colors'
        )}
      >
        <Linkedin className="w-4 h-4" />
        <span className="font-mono text-xs uppercase tracking-[0.22em]">LinkedIn</span>
      </Button>

      {/* Copy Link */}
      <Button
        variant="ghost"
        size="sm"
        onClick={copyLink}
        className={cn(
          'h-9 px-4 gap-2 rounded-full border transition-colors hover:bg-transparent',
          copied
            ? 'border-[#047857] text-[#047857] hover:text-[#047857]'
            : 'border-[#D9D6CB] text-[#1A1B1D] hover:border-[#205E40] hover:text-[#205E40]'
        )}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            <span className="font-mono text-xs uppercase tracking-[0.22em]">Copied.</span>
          </>
        ) : (
          <>
            <LinkIcon className="w-4 h-4" />
            <span className="font-mono text-xs uppercase tracking-[0.22em]">Copy Link</span>
          </>
        )}
      </Button>
    </div>
  );
}
