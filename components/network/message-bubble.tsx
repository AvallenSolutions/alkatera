import type { ReactNode } from "react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface MessageBubbleProps {
  /** Keys the bubble's side and background: your messages sit right. */
  isOwnMessage: boolean;
  /** The name shown above the body (support overrides this to the desk). */
  senderName: string;
  senderAvatarUrl?: string;
  body: string;
  /** ISO timestamp; rendered as a mono margin note. */
  createdAt: string;
  /** An optional typographic state beside the name (e.g. a Staff chip). */
  badge?: ReactNode;
}

/**
 * The network's shared message bubble: cream on paper, one hairline, a mono
 * timestamp in the margin. Background keys on ownership, never on who is staff.
 */
export function MessageBubble({
  isOwnMessage,
  senderName,
  senderAvatarUrl,
  body,
  createdAt,
  badge,
}: MessageBubbleProps) {
  return (
    <div className={cn("flex", isOwnMessage ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "flex max-w-[80%] gap-3",
          isOwnMessage ? "flex-row-reverse" : "flex-row"
        )}
      >
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={senderAvatarUrl} />
          <AvatarFallback>{senderName?.charAt(0) || "?"}</AvatarFallback>
        </Avatar>
        <div>
          <div
            className={cn(
              "rounded-[6px] border border-studio-hairline px-4 py-2",
              isOwnMessage ? "bg-studio-cream" : "bg-studio-paper"
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="font-display text-sm font-semibold text-foreground">
                {senderName}
              </span>
              {badge}
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground">{body}</p>
          </div>
          <p className="mt-1 px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
            {format(new Date(createdAt), "MMM d 'at' h:mm a")}
          </p>
        </div>
      </div>
    </div>
  );
}
