"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";
import type { ExtractedBOMItem, BOMParseResult } from "@/lib/bom/types";

interface BOMUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemsExtracted: (items: ExtractedBOMItem[], metadata: BOMParseResult['metadata']) => void;
}

type UploadState = 'idle' | 'uploading' | 'parsing' | 'success' | 'error';

export function BOMUploadDialog({
  open,
  onOpenChange,
  onItemsExtracted,
}: BOMUploadDialogProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [extractedCount, setExtractedCount] = useState(0);

  const resetState = useCallback(() => {
    setUploadState('idle');
    setProgress(0);
    setError(null);
    setSelectedFile(null);
    setExtractedCount(0);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const validateFile = (file: File): string | null => {
    const validTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'text/plain',
    ];

    const fileName = file.name.toLowerCase();
    const isValidExtension = fileName.endsWith('.pdf') || fileName.endsWith('.csv');

    if (!validTypes.includes(file.type) && !isValidExtension) {
      return 'Please upload a PDF or CSV file';
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }

    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSelectedFile(file);
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadState('uploading');
    setProgress(20);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      setProgress(40);
      setUploadState('parsing');

      const response = await fetch('/api/bom/parse', {
        method: 'POST',
        body: formData,
      });

      setProgress(80);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse file');
      }

      const result = await response.json();
      setProgress(100);

      if (!result.success || result.items.length === 0) {
        throw new Error(result.errors?.[0] || 'No items could be extracted from the file');
      }

      setExtractedCount(result.items.length);
      setUploadState('success');

      setTimeout(() => {
        onItemsExtracted(result.items, result.metadata);
        handleClose();
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Failed to process file');
      setUploadState('error');
    }
  };

  const getFileIcon = () => {
    if (!selectedFile) return null;

    const fileName = selectedFile.name.toLowerCase();
    if (fileName.endsWith('.pdf')) {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Bill of Materials</DialogTitle>
          <DialogDescription>
            Upload a PDF or CSV file containing your product&apos;s bill of materials.
            We&apos;ll extract ingredients and packaging automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {uploadState === 'idle' && (
            <>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
                  ${isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : selectedFile
                      ? 'border-green-500 bg-green-50 dark:bg-green-950'
                      : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                  }
                `}
              >
                <input
                  type="file"
                  accept=".pdf,.csv"
                  onChange={handleInputChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="flex justify-center">{getFileIcon()}</div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-10 w-10 mx-auto text-slate-400" />
                    <p className="font-medium">
                      Drop your file here or click to browse
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Supports PDF and CSV files up to 10MB
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={!selectedFile}>
                  <Upload className="h-4 w-4 mr-2" />
                  Extract Items
                </Button>
              </div>
            </>
          )}

          {(uploadState === 'uploading' || uploadState === 'parsing') && (
            <div className="space-y-4 py-4">
              <div className="flex justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground">
                {uploadState === 'uploading' ? 'Uploading file...' : 'Extracting items from BOM...'}
              </p>
            </div>
          )}

          {uploadState === 'success' && (
            <div className="space-y-4 py-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-medium text-lg">Extraction Complete</p>
                <p className="text-muted-foreground">
                  Found {extractedCount} item{extractedCount !== 1 ? 's' : ''} in your BOM
                </p>
              </div>
            </div>
          )}

          {uploadState === 'error' && (
            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={resetState}>
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
