"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Copy,
  Upload,
  MoreHorizontal,
  BookmarkPlus,
  ListChecks,
} from "lucide-react";

interface RecipeToolbarProps {
  itemCount: number;
  onAdd: () => void;
  onApplyTemplate: () => void;
  onSaveAsTemplate: () => void;
  onImportBom: () => void;
  onToggleChecklist: () => void;
  showChecklist: boolean;
  primaryAddLabel?: string;
  importBomLabel?: string;
}

export function RecipeToolbar({
  itemCount,
  onAdd,
  onApplyTemplate,
  onSaveAsTemplate,
  onImportBom,
  onToggleChecklist,
  showChecklist,
  primaryAddLabel = "Add ingredient",
  importBomLabel = "Import BOM",
}: RecipeToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onAdd} size="sm">
        <Plus className="h-3.5 w-3.5 mr-1" />
        {primaryAddLabel}
      </Button>
      <Button variant="outline" size="sm" onClick={onApplyTemplate}>
        <Copy className="h-3.5 w-3.5 mr-1" />
        Apply template
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onSaveAsTemplate}
        disabled={itemCount === 0}
      >
        <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
        Save as template
      </Button>
      <Button variant="outline" size="sm" onClick={onImportBom}>
        <Upload className="h-3.5 w-3.5 mr-1" />
        {importBomLabel}
      </Button>

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onToggleChecklist}>
              <ListChecks className="h-4 w-4 mr-2" />
              {showChecklist ? "Hide" : "Show"} suggestions
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
