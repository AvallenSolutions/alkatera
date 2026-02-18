'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { Package, CheckCircle2, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface ProductStats {
  total: number;
  completed: number;
  draft: number;
  inProgress: number;
}

export function ProductLCAStatusWidget() {
  const { currentOrganization } = useOrganization();
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProductStats() {
      if (!currentOrganization?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, name, is_draft, has_active_lca, latest_lca_id, image_url, updated_at')
          .eq('organization_id', currentOrganization.id)
          .order('updated_at', { ascending: false })
          .limit(5);

        if (productsError) throw productsError;

        const { data: lcas, error: lcasError } = await supabase
          .from('product_carbon_footprints')
          .select('id, product_id, status')
          .eq('organization_id', currentOrganization.id);

        if (lcasError) throw lcasError;

        const productsWithCompletedLCA = products?.filter(p => {
          const productLca = lcas?.find(l => l.id === p.latest_lca_id);
          return productLca?.status === 'completed';
        }).length || 0;

        const productsWithInProgressLCA = products?.filter(p => {
          const productLca = lcas?.find(l => l.id === p.latest_lca_id);
          return productLca?.status === 'in_progress' || (p.has_active_lca && !productLca);
        }).length || 0;

        const productsWithDraftLCA = products?.filter(p => {
          const productLca = lcas?.find(l => l.id === p.latest_lca_id);
          return productLca?.status === 'draft' || (!productLca && !p.has_active_lca);
        }).length || 0;

        setStats({
          total: products?.length || 0,
          completed: productsWithCompletedLCA,
          inProgress: productsWithInProgressLCA,
          draft: productsWithDraftLCA,
        });

        const productsWithStatus = (products || []).map((p) => {
          const productLca = lcas?.find((l) => l.id === p.latest_lca_id);
          let status = 'draft';
          if (productLca?.status === 'completed') {
            status = 'completed';
          } else if (productLca?.status === 'in_progress' || p.has_active_lca) {
            status = 'in progress';
          } else if (p.is_draft) {
            status = 'draft';
          }
          return { ...p, status };
        });

        setRecentProducts(productsWithStatus);
      } catch (err: any) {
        console.error('Error fetching product stats:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProductStats();
  }, [currentOrganization?.id]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            LCA Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            LCA Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const completionRate =
    stats && stats.total > 0 ? Math.min(Math.round((stats.completed / stats.total) * 100), 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-5 w-5" />
          LCA Status
        </CardTitle>
        <CardDescription>
          {stats?.total || 0} products in your portfolio
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && stats.total > 0 ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">LCA Completion</span>
                <span className="font-medium">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mb-1" />
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {stats.completed}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400">Complete</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 mb-1" />
                <span className="text-lg font-bold text-amber-700 dark:text-amber-300">
                  {stats.inProgress}
                </span>
                <span className="text-xs text-amber-600 dark:text-amber-400">In Progress</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <AlertCircle className="h-5 w-5 text-slate-500 mb-1" />
                <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
                  {stats.draft}
                </span>
                <span className="text-xs text-slate-500">No LCA</span>
              </div>
            </div>

            {recentProducts.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground">Recent Products</p>
                {recentProducts.slice(0, 3).map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="text-sm font-medium truncate">{product.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {product.status || 'draft'}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/products">
                View All Products
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </>
        ) : (
          <div className="text-center py-4">
            <Package className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              No products yet. Start building your portfolio.
            </p>
            <Button size="sm" asChild>
              <Link href="/products/new">
                Add Product
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
