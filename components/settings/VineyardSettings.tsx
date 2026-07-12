'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eyebrow, Panel } from '@/components/studio';
import { Button } from '@/components/ui/button';
import { Leaf, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { VineyardCard } from '@/components/vineyards/VineyardCard';
import { AddVineyardDialog } from '@/components/vineyards/AddVineyardDialog';
import type { Vineyard } from '@/lib/types/viticulture';

export function VineyardSettings() {
  const [vineyards, setVineyards] = useState<Vineyard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editVineyard, setEditVineyard] = useState<Vineyard | null>(null);

  const loadVineyards = useCallback(async () => {
    try {
      const res = await fetch('/api/vineyards');
      if (!res.ok) throw new Error('Failed to load vineyards');
      const { data } = await res.json();
      setVineyards(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVineyards();
  }, [loadVineyards]);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/vineyards/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete vineyard');
      toast.success('Vineyard removed');
      loadVineyards();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function handleEdit(vineyard: Vineyard) {
    setEditVineyard(vineyard);
    setDialogOpen(true);
  }

  return (
    <>
      <Panel className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Eyebrow tone="dim">Vineyard management</Eyebrow>
            <p className="text-sm text-studio-dim">
              Manage your vineyards and growing operations. Each vineyard can be linked
              to products to calculate the environmental impact of your grape growing.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditVineyard(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Vineyard
          </Button>
        </div>
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                Loading
              </span>
            </div>
          ) : vineyards.length === 0 ? (
            <div className="text-center py-8 text-studio-dim">
              <Leaf className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No vineyards added yet</p>
              <p className="text-xs mt-1">
                Add your first vineyard to start measuring the impact of your grape growing.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {vineyards.map((vineyard) => (
                <VineyardCard
                  key={vineyard.id}
                  vineyard={vineyard}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </Panel>

      <AddVineyardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={loadVineyards}
        editVineyard={editVineyard}
      />
    </>
  );
}
