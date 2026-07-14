-- Real archive flag for products. is_draft was overloaded as "archived", but
-- nothing filtered or badged it, so archiving a product did nothing visible
-- (it reappeared in the list, the multipack picker, everywhere) and, because
-- most products are created as drafts, is_draft could not distinguish the two.
-- archived_at is the single source of truth for archived state.

alter table public.products
  add column if not exists archived_at timestamptz;

-- Partial index for the default "hide archived" list query.
create index if not exists idx_products_active
  on public.products (organization_id)
  where archived_at is null;

comment on column public.products.archived_at is
  'When the product was archived; NULL means active. Replaces the overloaded is_draft-as-archived flag.';
