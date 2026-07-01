'use client';

/**
 * Downloads the B Corp "answer key" — a spreadsheet of every applicable
 * requirement with a paste-ready answer synthesised from the org's alkatera
 * data, to work down while filling B Lab's own questionnaire.
 */

import { useState } from 'react';
import { FileSpreadsheet, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export function AnswerKeyButton() {
  const [loading, setLoading] = useState(false);

  async function download(format: 'xlsx' | 'csv') {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/certifications/answer-key?format=${format}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to generate the answer key');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bcorp-answer-key.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to generate the answer key',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" loading={loading}>
          {!loading && <FileSpreadsheet className="mr-2 h-3.5 w-3.5" />}
          Answer key
          <ChevronDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => download('xlsx')}>
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => download('csv')}>
          CSV (.csv)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
