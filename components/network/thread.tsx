"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { PillButton } from "@/components/studio";
import { cn } from "@/lib/utils";
import { MessageBubble, type MessageBubbleProps } from "./message-bubble";

/** The bubble props a thread derives per message, minus its ownership side. */
type ThreadBubbleProps = Omit<MessageBubbleProps, "isOwnMessage">;

interface ThreadProps<T> {
  messages: T[];
  /** The signed-in user; kept for callers that key ownership on it. */
  currentUserId?: string | null;
  /** True when the message belongs to the signed-in user. */
  isOwn: (message: T) => boolean;
  /** Maps a message to the bubble's presentational props. */
  bubblePropsFor: (message: T) => ThreadBubbleProps;
  /** A stable key per message. */
  keyFor: (message: T) => string;
  /** Sends the composed text. May throw; the composer keeps the text if it does. */
  onSend: (text: string) => Promise<void> | void;
  isSending: boolean;
  /** When true the composer is hidden (the caller shows the resolved note). */
  resolved?: boolean;
  /** An optional slot rendered between the messages and the composer. */
  attachments?: ReactNode;
  /** Enables ⌘/Ctrl+Enter to send, with a mono helper line. */
  shortcutSend?: boolean;
  placeholder?: string;
}

/**
 * The network's shared thread shell: a studio message list with a cream
 * composer and a room-pill send. Both the advisor messages thread and the
 * support ticket thread render through here; each keeps its own data layer and
 * passes an isOwn predicate plus a bubble mapper.
 */
export function Thread<T>({
  messages,
  isOwn,
  bubblePropsFor,
  keyFor,
  onSend,
  isSending,
  resolved = false,
  attachments,
  shortcutSend = false,
  placeholder = "Type your message…",
}: ThreadProps<T>) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await onSend(trimmed);
      setText("");
    } catch {
      // The caller surfaces the error; keep the text so nothing is lost.
    }
  }

  return (
    <div className="space-y-6">
      {messages.length === 0 ? (
        <p className="py-8 text-center text-sm text-studio-dim">
          No messages yet. Start the conversation below.
        </p>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={keyFor(message)}
              isOwnMessage={isOwn(message)}
              {...bubblePropsFor(message)}
            />
          ))}
          <div ref={endRef} />
        </div>
      )}

      {attachments}

      {!resolved && (
        <form onSubmit={submit} className="space-y-3">
          <Textarea
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="rounded-[6px] border-studio-hairline bg-studio-cream focus-visible:ring-room-accent"
            onKeyDown={
              shortcutSend
                ? (e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      submit(e);
                    }
                  }
                : undefined
            }
          />
          <div className="flex items-center justify-between">
            {shortcutSend ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                Press ⌘+Enter to send
              </p>
            ) : (
              <span />
            )}
            <PillButton
              type="submit"
              variant="room"
              disabled={isSending || !text.trim()}
            >
              {isSending ? "Sending…" : "Send"}
            </PillButton>
          </div>
        </form>
      )}
    </div>
  );
}
