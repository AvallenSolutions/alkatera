"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface MaterialsDebuggerProps {
  lcaId: string;
}

export function MaterialsDebugger({ lcaId }: MaterialsDebuggerProps) {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMaterials() {
      try {
        console.log('[MaterialsDebugger] Fetching materials for LCA:', lcaId);
        const supabase = getSupabaseBrowserClient();

        const { data, error: fetchError } = await supabase
          .from('product_lca_materials')
          .select('*')
          .eq('product_lca_id', lcaId)
          .order('created_at');

        if (fetchError) {
          console.error('[MaterialsDebugger] Fetch error:', fetchError);
          setError(fetchError.message);
        } else {
          console.log('[MaterialsDebugger] Fetched materials:', data?.length || 0, data);
          setMaterials(data || []);
        }
      } catch (err) {
        console.error('[MaterialsDebugger] Unexpected error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchMaterials();
  }, [lcaId]);

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mb-4">
      <h3 className="font-semibold mb-2">🔍 Debug Info (Client-Side Fetch)</h3>
      {loading && <p>Loading materials from database...</p>}
      {error && <p className="text-red-600">Error: {error}</p>}
      {!loading && !error && (
        <div>
          <p className="font-medium">Materials found in database: {materials.length}</p>
          {materials.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {materials.map((m, idx) => (
                <li key={m.id}>
                  {idx + 1}. {m.name} - {m.quantity} {m.unit} (Sub-stage ID: {m.lca_sub_stage_id})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
