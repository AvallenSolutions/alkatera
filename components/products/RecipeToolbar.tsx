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
  // One primary action; every other pathway lives behind a single "More"
  // menu so an inexperienced user sees one obvious way forward. Actions that
  // can't do anything yet (save an empty template) don't render at all.
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onAdd} size="sm">
        <Plus className="h-3.5 w-3.5 mr-1" />
        {primaryAddLabel}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            More
            <MoreHorizontal className="h-3.5 w-3.5 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
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
