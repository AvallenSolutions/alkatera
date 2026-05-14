'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

const ACCEPT = '.csv,.xlsx,.pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf';
const ALLOWED_EXT = ['csv', 'xlsx', 'pdf'];

export function UploadDropzone({ onFileSelected, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File | null | undefined) {
    if (!file) return;
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      setError(`Unsupported file type ".${ext}". Please upload a CSV, XLSX, or PDF.`);
      return;
    }
    setError(null);
    onFileSelected(file);
  }

  return (
    <div>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`border-2 border-dashed rounded-lg px-6 py-12 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-sky-400 bg-sky-400/5'
            : 'border-border hover:border-sky-400/50 hover:bg-accent/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <div className="text-sm font-medium mb-1">Drop your product list here</div>
        <div className="text-xs text-muted-foreground mb-4">
          CSV, Excel (.xlsx), or PDF, up to 25&nbsp;MB
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={disabled}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && <div className="text-xs text-destructive mt-2">{error}</div>}
    </div>
  );
}
