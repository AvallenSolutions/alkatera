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
      <span className="text-gray-500 font-mono text-xs uppercase tracking-widest">
        Share:
      </span>

      {/* LinkedIn Share */}
      <Button
        variant="ghost"
        size="sm"
        onClick={shareOnLinkedIn}
        className={cn(
          'h-9 px-3 gap-2 border border-white/10 hover:border-[#0077b5] hover:bg-[#0077b5]/10 hover:text-[#0077b5] transition-all'
        )}
      >
        <Linkedin className="w-4 h-4" />
        <span className="font-mono text-xs uppercase tracking-widest">LinkedIn</span>
      </Button>

      {/* Copy Link */}
      <Button
        variant="ghost"
        size="sm"
        onClick={copyLink}
        className={cn(
          'h-9 px-3 gap-2 border border-white/10 transition-all',
          copied
            ? 'border-[#ccff00] bg-[#ccff00]/10 text-[#ccff00]'
            : 'hover:border-[#ccff00] hover:bg-[#ccff00]/10 hover:text-[#ccff00]'
        )}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            <span className="font-mono text-xs uppercase tracking-widest">Copied!</span>
          </>
        ) : (
          <>
            <LinkIcon className="w-4 h-4" />
            <span className="font-mono text-xs uppercase tracking-widest">Copy Link</span>
          </>
        )}
      </Button>
    </div>
  );
}
