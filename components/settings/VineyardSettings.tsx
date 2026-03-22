'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Leaf, Plus, Loader2 } from 'lucide-react';
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-[#ccff00]" />
                Vineyard Management
              </CardTitle>
              <CardDescription className="mt-1">
                Manage your vineyards and growing operations. Each vineyard can be linked
                to products to calculate the environmental impact of your grape growing.
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                setEditVineyard(null);
                setDialogOpen(true);
              }}
              className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Vineyard
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : vineyards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
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
        </CardContent>
      </Card>

      <AddVineyardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={loadVineyards}
        editVineyard={editVineyard}
      />
    </>
  );
}
