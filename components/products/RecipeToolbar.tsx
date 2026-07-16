"use client";

import { PillButton } from "@/components/studio/pill-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Copy,
  Upload,
  BookmarkPlus,
  ListChecks,
  Plus,
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
  // The composer below (IngredientComposer / PackagingComposer) is the only
  // visible add path now — typing a name is faster than a blank full-record
  // row, and it auto-matches. A blank row is still one click away for the
  // rare case the composer can't handle, tucked in "More" rather than
  // competing with it for attention.
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <PillButton variant="outline" size="sm">
            More
          </PillButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={onAdd}>
            <Plus className="h-4 w-4 mr-2" />
            {primaryAddLabel} (blank row)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onApplyTemplate}>
            <Copy className="h-4 w-4 mr-2" />
            Apply a template
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onImportBom}>
            <Upload className="h-4 w-4 mr-2" />
            {importBomLabel}
          </DropdownMenuItem>
          {itemCount > 0 && (
            <DropdownMenuItem onClick={onSaveAsTemplate}>
              <BookmarkPlus className="h-4 w-4 mr-2" />
              Save as template
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onToggleChecklist}>
            <ListChecks className="h-4 w-4 mr-2" />
            {showChecklist ? "Hide" : "Show"} suggestions
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
