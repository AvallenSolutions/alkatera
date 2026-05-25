'use client';

import { useState } from 'react';
import { Sparkles, ListChecks, FileSpreadsheet } from 'lucide-react';
import { BrandSourcing } from '@/components/admin/directory/brand-sourcing';
import { IntakeListPanel } from '@/components/admin/directory/intake-list-panel';
import { AdminUploadWizard } from '@/components/admin/directory/admin-upload-wizard';
import { BRAND_FIELDS, PRODUCT_FIELDS } from '@/lib/admin/directory/field-specs';

type Tab = 'brief' | 'list' | 'csv';

export function IntakeTabs({ initialTab }: { initialTab?: Tab } = {}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'brief');
  const [csvKind, setCsvKind] = useState<'brands' | 'products'>('brands');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
        <TabButton
          active={tab === 'brief'}
          onClick={() => setTab('brief')}
          icon={Sparkles}
          label="Generation brief"
          hint="Web search"
        />
        <TabButton
          active={tab === 'list'}
          onClick={() => setTab('list')}
          icon={ListChecks}
          label="Paste a list"
          hint="Names or URLs"
        />
        <TabButton
          active={tab === 'csv'}
          onClick={() => setTab('csv')}
          icon={FileSpreadsheet}
          label="CSV upload"
          hint="Brands or products"
        />
      </div>

      {tab === 'brief' && <BrandSourcing />}
      {tab === 'list' && <IntakeListPanel />}
      {tab === 'csv' && (
        <div className="space-y-4">
          <div className="inline-flex rounded-lg border border-border/60 bg-card/40 p-0.5">
            <KindButton active={csvKind === 'brands'} onClick={() => setCsvKind('brands')}>
              Brands
            </KindButton>
            <KindButton active={csvKind === 'products'} onClick={() => setCsvKind('products')}>
              Products
            </KindButton>
          </div>
          {csvKind === 'brands' ? (
            <AdminUploadWizard
              kind="brands"
              title="Upload brands CSV"
              description={
                <>
                  One row per canonical brand. The matcher dedupes against existing entries by
                  normalised name; brands you've uploaded before will be linked rather than
                  duplicated. New rows land pending with{' '}
                  <code className="text-[12px] bg-muted/50 px-1.5 py-0.5 rounded">
                    discovered_via='manual'
                  </code>
                  .
                </>
              }
              fields={BRAND_FIELDS}
              backHref="/admin/directory/intake"
              templateName="brands.csv"
            />
          ) : (
            <AdminUploadWizard
              kind="products"
              title="Upload products CSV"
              description={
                <>
                  One row per product. GTIN is the primary dedup key; brand name is matched
                  against the canonical directory and unresolved brands are reported back.
                </>
              }
              fields={PRODUCT_FIELDS}
              backHref="/admin/directory/intake"
              templateName="products.csv"
            />
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
        active
          ? 'bg-neon-lime/15 border-neon-lime/40 text-neon-lime'
          : 'border-border/60 bg-card/30 text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="font-semibold">{label}</span>
      <span className="text-[10px] uppercase tracking-wider opacity-80">{hint}</span>
    </button>
  );
}

function KindButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-semibold rounded-md px-3 py-1.5 transition-colors ${
        active
          ? 'bg-neon-lime/15 text-neon-lime'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
