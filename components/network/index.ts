/**
 * The network kit: shared pieces for the messages and support threads.
 * Both surfaces keep their own data layer; only the realtime hook, the
 * message bubble and the thread shell are shared.
 */
export { useRealtimeThread } from "./use-realtime-thread";
export { MessageBubble } from "./message-bubble";
export type { MessageBubbleProps } from "./message-bubble";
export { Thread } from "./thread";
