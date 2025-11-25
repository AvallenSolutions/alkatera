"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

interface MarkdownDocProps {
  title: string;
  description: string;
  content: string;
  badge?: string;
}

export function MarkdownDoc({ title, description, content, badge }: MarkdownDocProps) {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {badge && <Badge variant="outline">{badge}</Badge>}
        </div>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed bg-slate-50 dark:bg-slate-900 p-6 rounded-lg overflow-x-auto">
              {content}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
