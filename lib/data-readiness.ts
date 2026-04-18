import type { OrganizationUsage } from "@/hooks/useSubscription";

export type MilestoneCode =
  | "has_product"
  | "has_facility"
  | "has_supplier"
  | "has_lca";

export interface MilestoneMeta {
  label: string;
  unlockHint: string;
  actionHref: string;
}

export const MILESTONE_META: Record<MilestoneCode, MilestoneMeta> = {
  has_product: {
    label: "Add a product",
    unlockHint: "Add your first product to unlock",
    actionHref: "/products/",
  },
  has_facility: {
    label: "Add a facility",
    unlockHint: "Add your first facility to unlock",
    actionHref: "/company/facilities/",
  },
  has_supplier: {
    label: "Add a supplier",
    unlockHint: "Add your first supplier to unlock",
    actionHref: "/suppliers/",
  },
  has_lca: {
    label: "Complete an LCA",
    unlockHint: "Complete your first LCA to unlock",
    actionHref: "/products/",
  },
};

export function getCompletedMilestones(
  usage: OrganizationUsage | null
): Set<MilestoneCode> {
  const done = new Set<MilestoneCode>();
  if (!usage) return done;
  const u = usage.usage;
  if ((u.products?.current ?? 0) > 0) done.add("has_product");
  if ((u.facilities?.current ?? 0) > 0) done.add("has_facility");
  if ((u.suppliers?.current ?? 0) > 0) done.add("has_supplier");
  if ((u.lcas?.current ?? 0) > 0) done.add("has_lca");
  return done;
}
