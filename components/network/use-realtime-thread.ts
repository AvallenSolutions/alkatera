import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

interface UseRealtimeThreadOptions {
  /** The realtime channel name, e.g. `advisor-conv-${id}` or `ticket-${id}`. */
  channelName: string;
  /** The postgres table to watch for inserts, e.g. `advisor_messages`. */
  table: string;
  /** The column the filter keys on, e.g. `conversation_id` or `ticket_id`. */
  filterColumn: string;
  /** The value that column must equal. */
  filterValue: string;
  /** Fired on every INSERT; typically reloads the thread's messages. */
  onInsert: () => void;
}

/**
 * The network's shared realtime subscription: watch one table for public
 * INSERTs matching a single filter, and reload on each. Both the advisor
 * messages thread and the support ticket thread subscribe through here; only
 * the channel name, table and filter differ.
 *
 * The callback lives in a ref so a new closure each render never re-subscribes;
 * the channel is torn down only when the identifying values change.
 */
export function useRealtimeThread({
  channelName,
  table,
  filterColumn,
  filterValue,
  onInsert,
}: UseRealtimeThreadOptions) {
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;

  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table,
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        () => {
          onInsertRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, table, filterColumn, filterValue]);
}
