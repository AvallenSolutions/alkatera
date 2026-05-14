'use client';

import { Loader2 } from 'lucide-react';

interface Props {
  message: string;
}

export function UploadProgress({ message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Loader2 className="h-8 w-8 text-sky-400 animate-spin mb-3" />
      <div className="text-sm font-medium">{message}</div>
    </div>
  );
}
