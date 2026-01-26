"use client";

import { useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Bug,
  Lightbulb,
  TrendingUp,
  Upload,
  X,
  Loader2,
  CheckCircle,
  ImageIcon,
} from "lucide-react";
import { useOrganization } from "@/lib/organizationContext";
import { createTicket, getBrowserInfo } from "@/lib/feedback";
import { useToast } from "@/hooks/use-toast";
import type { FeedbackCategory } from "@/lib/types/feedback";
import { FEEDBACK_CATEGORIES } from "@/lib/types/feedback";

const categoryIcons: Record<FeedbackCategory, React.ElementType> = {
  bug: Bug,
  feature: Lightbulb,
  improvement: TrendingUp,
  other: MessageSquare,
};

interface FeedbackDialogProps {
  trigger?: React.ReactNode;
  defaultCategory?: FeedbackCategory;
}

export function FeedbackDialog({ trigger, defaultCategory }: FeedbackDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Form state
  const [category, setCategory] = useState<FeedbackCategory>(defaultCategory || "bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const resetForm = () => {
    setCategory(defaultCategory || "bug");
    setTitle("");
    setDescription("");
    setAttachments([]);
    setIsSuccess(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setTimeout(resetForm, 300);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      // Check file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 10MB limit`,
          variant: "destructive",
        });
        return false;
      }
      // Check file type
      const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported file type`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });
    setAttachments((prev) => [...prev, ...validFiles].slice(0, 5)); // Max 5 files
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentOrganization) {
      toast({
        title: "Error",
        description: "No organization selected",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim() || !description.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in both title and description",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await createTicket(currentOrganization.id, {
        title: title.trim(),
        description: description.trim(),
        category,
        priority: category === "bug" ? "high" : "medium",
        attachments,
        browser_info: category === "bug" ? getBrowserInfo() : undefined,
        page_url: pathname || undefined,
      });

      setIsSuccess(true);

      toast({
        title: "Feedback submitted",
        description: "Thank you! We'll review your feedback shortly.",
      });

      // Close dialog after short delay
      setTimeout(() => {
        handleOpenChange(false);
      }, 2000);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {isSuccess ? (
          <div className="py-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Thank you!</h3>
            <p className="text-muted-foreground">
              Your feedback has been submitted. We&apos;ll review it and get back to you if needed.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Send Feedback</DialogTitle>
              <DialogDescription>
                Help us improve by reporting bugs or suggesting new features.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {/* Category Selection */}
              <div className="space-y-2">
                <Label>What type of feedback is this?</Label>
                <RadioGroup
                  value={category}
                  onValueChange={(v) => setCategory(v as FeedbackCategory)}
                  className="grid grid-cols-2 gap-2"
                >
                  {(Object.entries(FEEDBACK_CATEGORIES) as [FeedbackCategory, typeof FEEDBACK_CATEGORIES.bug][]).map(
                    ([key, value]) => {
                      const Icon = categoryIcons[key];
                      const isSelected = category === key;
                      return (
                        <Label
                          key={key}
                          htmlFor={key}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <RadioGroupItem value={key} id={key} className="sr-only" />
                          <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={isSelected ? "font-medium" : ""}>{value.label}</span>
                        </Label>
                      );
                    }
                  )}
                </RadioGroup>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder={
                    category === "bug"
                      ? "Brief description of the issue"
                      : "Brief description of your suggestion"
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder={
                    category === "bug"
                      ? "What happened? What were you trying to do? What did you expect to happen?"
                      : "Tell us more about your idea..."
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <Label>Attachments (optional)</Label>
                <div className="space-y-2">
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((file, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="gap-1 py-1 px-2"
                        >
                          <ImageIcon className="h-3 w-3" />
                          <span className="max-w-[150px] truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={attachments.length >= 5}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Add Screenshot
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Max 5 files, 10MB each. Supports images and PDF.
                  </p>
                </div>
              </div>

              {/* Current Page Info (for bugs) */}
              {category === "bug" && pathname && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  Page: {pathname}
                </div>
              )}

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Feedback"
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
