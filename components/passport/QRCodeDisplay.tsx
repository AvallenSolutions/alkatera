"use client";

import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Eyebrow } from '@/components/studio/eyebrow';
import { PillButton } from '@/components/studio/pill-button';
import { useState } from 'react';
import { toast } from 'sonner';

interface QRCodeDisplayProps {
  url: string;
  productName: string;
  size?: number;
}

export default function QRCodeDisplay({ url, productName, size = 200 }: QRCodeDisplayProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const handleDownloadSVG = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `${productName.replace(/\s+/g, '-').toLowerCase()}-passport-qr.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);

    toast.success('QR code downloaded');
  };

  const handleDownloadPNG = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();

    img.onload = () => {
      canvas.width = size * 2;
      canvas.height = size * 2;

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${productName.replace(/\s+/g, '-').toLowerCase()}-passport-qr.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);

        toast.success('QR code downloaded');
      });
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('URL copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy URL');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${productName} - Product Passport`,
          text: `View environmental impact data for ${productName}`,
          url: url,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          toast.error('Failed to share');
        }
      }
    } else {
      handleCopyUrl();
    }
  };

  return (
    <div>
      <Eyebrow className="mb-1">QR code</Eyebrow>
      <p className="mb-4 text-sm text-muted-foreground">
        Put this on packaging, marketing or displays. Anyone who scans it opens the passport.
      </p>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div ref={qrRef} className="flex justify-center rounded-[6px] border border-border bg-white p-5">
          <QRCodeSVG value={url} size={size} level="H" includeMargin={true} />
        </div>
        <div className="flex flex-wrap gap-2">
          <PillButton variant="outline" size="sm" onClick={handleDownloadPNG}>
            Download PNG
          </PillButton>
          <PillButton variant="outline" size="sm" onClick={handleDownloadSVG}>
            Download SVG
          </PillButton>
          <PillButton variant="ghost" size="sm" onClick={handleCopyUrl}>
            {copied ? 'Copied' : 'Copy link'}
          </PillButton>
          <PillButton variant="ghost" size="sm" onClick={handleShare}>
            Share
          </PillButton>
        </div>
      </div>
    </div>
  );
}
