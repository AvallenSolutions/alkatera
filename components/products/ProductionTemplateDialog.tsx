"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import type { ProductionChainTemplate } from "@/lib/types/products";

interface ProductionTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (template: ProductionChainTemplate) => void | Promise<void>;
}

export function ProductionTemplateDialog({
  open,
  onOpenChange,
  onApply,
}: ProductionTemplateDialogProps) {
  const [templates, setTemplates] = useState<ProductionChainTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("production_chain_templates")
      .select("*")
      .order("kind", { ascending: false })
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          toast.error("Failed to load production templates");
          setTemplates([]);
        } else {
          setTemplates((data || []) as ProductionChainTemplate[]);
        }
        setLoading(false);
      });
  }, [open]);

  const handleApply = async (t: ProductionChainTemplate) => {
    setApplyingId(t.id);
    try {
      await onApply(t);
      onOpenChange(false);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply production chain template</DialogTitle>
          <DialogDescription>
            Templates pre-configure the stages of a typical production process. Pick the one that
            matches your product, then refine the stage volumes to your actual figures.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading templates
          </div>
        )}

        {!loading && templates.length === 0 && (
          <div className="text-sm text-muted-foreground py-4">
            No templates available.
          </div>
        )}

        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  {t.name}
                  <Badge variant={t.kind === "built_in" ? "secondary" : "outline"}>
                    {t.kind === "built_in" ? (
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Built-in
                      </span>
                    ) : (
                      "Custom"
                    )}
                  </Badge>
                </CardTitle>
                {t.description && (
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                )}
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(t.stages || []).map((s) => (
                    <Badge key={s.ordinal} variant="outline" className="text-xs">
                      {s.ordinal + 1}. {s.name}
                    </Badge>
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleApply(t)}
                  disabled={applyingId === t.id}
                >
                  {applyingId === t.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : null}
                  Apply this chain
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
