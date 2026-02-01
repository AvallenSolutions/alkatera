'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap, FileText, Loader2 } from 'lucide-react';

interface QuickGenerateDialogProps {
  onGenerate: () => void;
  generating: boolean;
}

export function QuickGenerateDialog({ onGenerate, generating }: QuickGenerateDialogProps) {
  const [open, setOpen] = useState(false);

  const handleGenerate = () => {
    setOpen(false);
    onGenerate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={generating}>
          <Zap className="mr-2 h-4 w-4" />
          Quick Generate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Generate Report</DialogTitle>
          <DialogDescription>
            Generate a sustainability report with default settings. This will use the current
            year, all available data, and standard formatting.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-accent/50">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">Default Report Configuration</p>
              <ul className="text-sm text-muted-foreground mt-1 space-y-0.5">
                <li>Current year reporting period</li>
                <li>All available sections included</li>
                <li>Investor audience focus</li>
                <li>PowerPoint format</li>
              </ul>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Generate Now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
