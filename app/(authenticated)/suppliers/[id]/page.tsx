"use client";

/**
 * One supplier, in the studio grammar: a statement header with the ESG
 * score standing right, the old badge zoo collapsed to a typographic
 * state-chip row, and the three internal tabs (overview, products, ESG)
 * re-cut as mono-eyebrow sections down one paper. Data hook, the
 * contact_email spine and the SendEsgSurveyDialog contract are unchanged.
 */

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useRosaPageContext } from "@/lib/rosa/RosaContextProvider";
import Link from "next/link";
import { PageLoader } from "@/components/ui/page-loader";
import { Statement } from "@/components/studio/statement";
import { Eyebrow } from "@/components/studio/eyebrow";
import { BigNumber } from "@/components/studio/big-number";
import { StateChip } from "@/components/studio/state-chip";
import { FactRow } from "@/components/studio/fact-row";
import { PillButton } from "@/components/studio/pill-button";
import type { WorkingTone } from "@/components/studio/theme";
import { getProfileCompleteness } from "@/lib/suppliers/profile-completeness";
import { useOrganizationSupplierDetail } from "@/hooks/data/useOrganizationSupplierDetail";
import { ESG_SECTIONS, getQuestionsBySection, type EsgResponse } from "@/lib/supplier-esg/questions";
import { getRatingLabel } from "@/lib/supplier-esg/scoring";
import { SendEsgSurveyDialog } from "@/components/suppliers/SendEsgSurveyDialog";

/** Quiet mono back-link to the list page. */
function BackLink() {
  return (
    <Link
      href="/suppliers"
      className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
    >
      &larr; The suppliers
    </Link>
  );
}

/** A quiet section: mono eyebrow over a hairline rule, then the work. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <div className="border-b border-studio-hairline pb-2">
        <Eyebrow>{label}</Eyebrow>
      </div>
      {children}
    </section>
  );
}

/** A quiet hairline bar with a room-accent fill. Opacity carries nothing here; the width is the score. */
function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm text-foreground">{label}</span>
        <span className="font-mono text-xs tabular-nums text-studio-dim">{value}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-studio-hairline">
        <div className="h-full rounded-full bg-room" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const ratingTone = (rating: string | null): "good" | "attention" | "stale" | "ink" => {
  switch (rating) {
    case "leader":
      return "good";
    case "progressing":
      return "attention";
    case "needs_improvement":
      return "stale";
    default:
      return "ink";
  }
};

const ANSWER_TONE: Record<string, WorkingTone> = {
  yes: "good",
  partial: "attention",
  no: "stale",
  na: "quiet",
};
const ANSWER_LABEL: Record<string, string> = {
  yes: "Yes",
  partial: "Partial",
  no: "No",
  na: "N/A",
};

export default function SupplierDetailPage() {
  const params = useParams();
  const orgSupplierId = params.id as string;

  const {
    supplierProfile,
    brandRelationship,
    resolvedSupplierId,
    products,
    esgAssessment,
    esgInvitationStatus,
    esgInvitationEmailStatus,
    esgInvitationEmailError,
    loading,
    error,
  } = useOrganizationSupplierDetail(orgSupplierId);

  // A bounced or rejected invitation must not read as "awaiting completion".
  // The supplier never got it, and the brand needs to chase another way.
  const esgEmailUndelivered =
    esgInvitationEmailStatus === "bounced" ||
    esgInvitationEmailStatus === "failed" ||
    esgInvitationEmailStatus === "suppressed";

  const [esgSurveyOpen, setEsgSurveyOpen] = useState(false);

  // Tell Rosa about this supplier so questions like "should we follow up?",
  // "what data are we still waiting on?", or "how does this supplier
  // compare?" can be answered with the supplier in context. The tabs are
  // now stacked sections on one paper, so we feed a lightweight
  // active_section instead of the old active_tab.
  const rosaSlice = useMemo(() => {
    if (!supplierProfile) return null;
    return {
      id: "supplier-detail",
      label: `Supplier: ${(supplierProfile as any).name || "unknown"}`,
      priority: 9,
      data: {
        supplier_id: resolvedSupplierId ?? orgSupplierId,
        name: (supplierProfile as any).name ?? null,
        country: (supplierProfile as any).country ?? null,
        industry_sector: (supplierProfile as any).industry_sector ?? null,
        engagement_status: (brandRelationship as any)?.engagement_status ?? null,
        annual_spend: (brandRelationship as any)?.annual_spend ?? null,
        product_count: Array.isArray(products) ? products.length : 0,
        has_esg_assessment: !!esgAssessment,
        active_section: "overview",
      },
    };
  }, [supplierProfile, brandRelationship, products, esgAssessment, orgSupplierId, resolvedSupplierId]);
  useRosaPageContext(rosaSlice);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (!amount) return "Not specified";
    const currencySymbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : "€";
    return `${currencySymbol}${amount.toLocaleString()}`;
  };

  const getEngagementChip = (status: string | null): { tone: WorkingTone; label: string } => {
    switch (status) {
      case "data_provided":
        return { tone: "good", label: "Data provided" };
      case "active":
        return { tone: "good", label: "Active" };
      case "invited":
        return { tone: "attention", label: "Invited" };
      case "inactive":
        return { tone: "quiet", label: "Inactive" };
      default:
        return { tone: "quiet", label: "No engagement" };
    }
  };

  const formatImpact = (value: number | null | undefined) => {
    if (value == null) return null;
    if (value === 0) return "0";
    if (value < 0.001) return value.toExponential(2);
    if (value < 0.01) return value.toFixed(4);
    if (value < 1) return value.toFixed(3);
    return value.toFixed(2);
  };

  if (loading) {
    return <PageLoader message="Loading supplier details..." />;
  }

  if (error || !supplierProfile) {
    return (
      <div className="space-y-6">
        <BackLink />
        <p className="text-sm text-muted-foreground">
          {error || "This supplier could not be found in your organisation."}
        </p>
      </div>
    );
  }

  const name: string = (supplierProfile as any).name || "Supplier";
  const headline = name.endsWith(".") ? name : `${name}.`;

  const location = [supplierProfile.city, supplierProfile.country]
    .filter(Boolean)
    .join(", ") || supplierProfile.address || null;
  const factParts = [supplierProfile.industry_sector, location].filter(Boolean) as string[];

  const websiteHref = supplierProfile.website
    ? supplierProfile.website.startsWith("http")
      ? supplierProfile.website
      : `https://${supplierProfile.website}`
    : null;

  const hasScore = !!esgAssessment && esgAssessment.score_total != null;
  const engagement = getEngagementChip(brandRelationship?.engagement_status ?? null);

  return (
    <div className="space-y-10">
      <div className="min-w-0 space-y-4">
        <BackLink />

        <Statement eyebrow="THE NETWORK · SUPPLIER" headline={headline}>
          {hasScore && (
            <BigNumber
              size="display"
              value={esgAssessment!.score_total}
              label={getRatingLabel(esgAssessment!.score_rating! as any)}
              tone={ratingTone(esgAssessment!.score_rating ?? null)}
            />
          )}
        </Statement>

        {/* State-chip meta row: the old badge zoo, said typographically. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {supplierProfile.is_verified && <StateChip tone="good">Verified</StateChip>}
          {esgAssessment && esgAssessment.submitted && !esgAssessment.is_verified && (
            <StateChip tone="attention">ESG pending</StateChip>
          )}
          {!resolvedSupplierId && <StateChip tone="attention">Not yet joined</StateChip>}
          {factParts.length > 0 && (
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-studio-dim">
              {factParts.join(" · ")}
            </span>
          )}
          {websiteHref && (
            <a
              href={websiteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] uppercase tracking-[0.15em] text-room-accent transition-opacity hover:opacity-70"
            >
              {supplierProfile.website!.replace(/^https?:\/\//, "")} ↗
            </a>
          )}
        </div>

        {!resolvedSupplierId && (
          <p className="max-w-xl text-sm text-studio-attention">
            This supplier has not yet joined the platform. Product and ESG data appear here once they
            accept the invitation and add their information.
          </p>
        )}
      </div>

      {/* ── THE COMPANY ── */}
      <Section label="THE COMPANY">
        {supplierProfile.description && (
          <p className="max-w-2xl whitespace-pre-wrap text-sm text-muted-foreground">
            {supplierProfile.description}
          </p>
        )}

        <div>
          {supplierProfile.catalogue_url && (
            <FactRow
              subject={
                <a
                  href={
                    supplierProfile.catalogue_url.startsWith("http")
                      ? supplierProfile.catalogue_url
                      : `https://${supplierProfile.catalogue_url}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-room-accent transition-opacity hover:opacity-70"
                >
                  View catalogue ↗
                </a>
              }
              meta="Catalogue"
            />
          )}
          <FactRow
            subject={
              supplierProfile.contact_email ? (
                <a
                  href={`mailto:${supplierProfile.contact_email}`}
                  className="text-room-accent transition-opacity hover:opacity-70"
                >
                  {supplierProfile.contact_email}
                </a>
              ) : (
                <span className="text-studio-dim">Not provided</span>
              )
            }
            meta="Email"
          />
          <FactRow subject={supplierProfile.contact_name || <span className="text-studio-dim">Not provided</span>} meta="Contact" />
          {supplierProfile.phone && (
            <FactRow
              subject={
                <a
                  href={`tel:${supplierProfile.phone}`}
                  className="text-room-accent transition-opacity hover:opacity-70"
                >
                  {supplierProfile.phone}
                </a>
              }
              meta="Phone"
            />
          )}
          <FactRow
            subject={<StateChip tone={engagement.tone}>{engagement.label}</StateChip>}
            meta="Status"
          />
          {brandRelationship?.relationship_type && (
            <FactRow
              subject={<span className="capitalize">{brandRelationship.relationship_type.replace(/_/g, " ")}</span>}
              meta="Type"
            />
          )}
          <FactRow
            subject={
              <span className="tabular-nums">
                {formatCurrency(brandRelationship?.annual_spend ?? null, brandRelationship?.spend_currency ?? null)}
              </span>
            }
            meta="Annual spend"
          />
          <FactRow subject={<span className="tabular-nums">{products.length}</span>} meta="Products available" />
          <FactRow subject={<span className="tabular-nums">{formatDate(brandRelationship?.added_at ?? null)}</span>} meta="Added" />
          <FactRow
            subject={<span className="tabular-nums">{getProfileCompleteness(supplierProfile as any).percent}% complete</span>}
            meta="Profile"
          />
        </div>

        {brandRelationship?.notes && (
          <div className="space-y-1.5">
            <Eyebrow tone="dim">Notes</Eyebrow>
            <p className="max-w-2xl whitespace-pre-wrap text-sm text-muted-foreground">
              {brandRelationship.notes}
            </p>
          </div>
        )}
      </Section>

      {/* ── THE PRODUCTS ── */}
      <Section label="THE PRODUCTS">
        {!resolvedSupplierId ? (
          <p className="text-sm text-studio-dim">This supplier has not joined yet.</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-studio-dim">No products added by this supplier yet.</p>
        ) : (
          <div>
            {products.map((product) => {
              const metaParts = [
                product.product_type,
                product.origin_country_code,
                product.product_code,
                product.category,
              ].filter(Boolean);

              const impacts = [
                { label: "CLIMATE", value: product.impact_climate, unit: `kg CO₂e/${product.unit}` },
                { label: "WATER", value: product.impact_water, unit: `L/${product.unit}` },
                { label: "LAND", value: product.impact_land, unit: `m²/${product.unit}` },
                { label: "WASTE", value: product.impact_waste, unit: `kg/${product.unit}` },
              ].filter((m) => m.value != null);

              const certs = ((product as any).certifications as string[] | undefined) || [];

              const packagingMeta =
                product.product_type === "packaging"
                  ? [
                      product.weight_g != null ? `${product.weight_g}g` : null,
                      product.primary_material ? product.primary_material.replace(/_/g, " ") : null,
                      product.recycled_content_pct != null ? `${product.recycled_content_pct}% recycled` : null,
                      product.packaging_category ?? null,
                    ].filter(Boolean)
                  : [];

              const quality =
                product.data_quality_score != null
                  ? `${product.data_quality_score <= 2 ? "High" : product.data_quality_score <= 3 ? "Medium" : "Low"}${
                      product.methodology_standard ? ` (${product.methodology_standard})` : ""
                    }`
                  : null;

              return (
                <div key={product.id} className="space-y-2 border-b border-studio-hairline py-4 last:border-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-display text-sm font-semibold text-foreground">{product.name}</span>
                    {metaParts.length > 0 && (
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
                        {metaParts.join(" · ")}
                      </span>
                    )}
                  </div>

                  {product.description && (
                    <p className="max-w-2xl truncate text-xs text-muted-foreground">{product.description}</p>
                  )}

                  {impacts.length > 0 && (
                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5">
                      {impacts.map((m) => (
                        <span key={m.label} className="inline-flex items-baseline gap-1.5">
                          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-studio-dim">
                            {m.label}
                          </span>
                          <span className="font-mono text-xs tabular-nums text-foreground">
                            {formatImpact(m.value)}
                          </span>
                          <span className="font-mono text-[10px] text-studio-dim">{m.unit}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {(certs.length > 0 || packagingMeta.length > 0 || quality) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.15em] text-studio-dim">
                      {certs.length > 0 && <span>Certified: {certs.join(" · ")}</span>}
                      {packagingMeta.length > 0 && <span>{packagingMeta.join(" · ")}</span>}
                      {quality && <span>Data quality: {quality}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── THE ESG ASSESSMENT ── */}
      <Section label="THE ESG ASSESSMENT">
        {!resolvedSupplierId ? (
          <div className="space-y-4">
            <p className="text-sm text-studio-dim">
              ESG data appears here once the supplier joins the platform and completes their assessment.
            </p>
            <PillButton variant="room" onClick={() => setEsgSurveyOpen(true)}>
              Send ESG survey
            </PillButton>
          </div>
        ) : esgAssessment && (esgAssessment.submitted || esgAssessment.is_verified) ? (
          <div className="space-y-8">
            {esgAssessment.is_verified && esgAssessment.verified_at && (
              <p className="text-sm text-studio-good">
                ESG verified on{" "}
                {new Date(esgAssessment.verified_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                .
              </p>
            )}

            {/* Per-section breakdown, quiet hairline bars. */}
            <div className="max-w-xl space-y-4">
              {ESG_SECTIONS.map((section) => {
                const scoreKey = {
                  labour_human_rights: "score_labour",
                  environment: "score_environment",
                  ethics: "score_ethics",
                  health_safety: "score_health_safety",
                  management_systems: "score_management",
                }[section.key] as keyof typeof esgAssessment;
                const score = (esgAssessment[scoreKey] as number) ?? 0;
                return <ScoreBar key={section.key} label={section.label} value={score} />;
              })}
            </div>

            {/* Section-by-section Q&A. */}
            <div className="space-y-8">
              {ESG_SECTIONS.map((section) => {
                const questions = getQuestionsBySection(section.key);
                const answers = (esgAssessment.answers || {}) as Record<string, EsgResponse>;
                return (
                  <div key={section.key} className="space-y-2">
                    <Eyebrow tone="dim">{section.label}</Eyebrow>
                    <div>
                      {questions.map((q) => {
                        const answer = answers[q.id];
                        return (
                          <div
                            key={q.id}
                            className="flex items-start justify-between gap-6 border-b border-studio-hairline py-2 last:border-0"
                          >
                            <span className="flex-1 text-sm text-muted-foreground">{q.text}</span>
                            {answer ? (
                              <StateChip tone={ANSWER_TONE[answer] ?? "quiet"}>
                                {ANSWER_LABEL[answer] ?? answer}
                              </StateChip>
                            ) : (
                              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                                Not answered
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : esgEmailUndelivered ? (
          <div className="space-y-4">
            <p className="max-w-xl text-sm text-studio-stale">
              Survey email didn&apos;t reach them. We sent the invitation but the
              supplier&apos;s mail server rejected it, so they never received it.
              Check the address is right, or ask them for a better contact.
            </p>
            {esgInvitationEmailError && (
              <p className="max-w-xl font-mono text-xs text-studio-dim">{esgInvitationEmailError}</p>
            )}
            <PillButton variant="outline" onClick={() => setEsgSurveyOpen(true)}>
              Try a different address
            </PillButton>
          </div>
        ) : esgInvitationStatus === "pending" || esgInvitationStatus === "accepted" ? (
          <div className="space-y-4">
            <p className="max-w-xl text-sm text-studio-attention">
              Survey sent, awaiting completion. Their scores appear here once they submit it.
            </p>
            <PillButton variant="outline" onClick={() => setEsgSurveyOpen(true)}>
              Resend survey
            </PillButton>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-studio-dim">This supplier has not yet completed an ESG assessment.</p>
            <PillButton variant="room" onClick={() => setEsgSurveyOpen(true)}>
              Send ESG survey
            </PillButton>
          </div>
        )}
      </Section>

      <SendEsgSurveyDialog
        open={esgSurveyOpen}
        onOpenChange={setEsgSurveyOpen}
        defaultEmail={(supplierProfile as any)?.contact_email || ""}
        defaultSupplierName={(supplierProfile as any)?.name || ""}
        defaultContactName={(supplierProfile as any)?.contact_name || ""}
      />
    </div>
  );
}
