"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader } from "@/components/ui/page-loader";
import {
  ArrowLeft,
  Building2,
  Mail,
  MapPin,
  Package,
  FileText,
  Globe,
  TrendingUp,
  ExternalLink,
  ShieldCheck,
  Shield,
  Clock,
  Info,
  User,
  Leaf,
  Droplets,
  Trash2,
  Mountain,
  CheckCircle2,
  Phone,
  Link2,
} from "lucide-react";
import { useOrganizationSupplierDetail } from "@/hooks/data/useOrganizationSupplierDetail";
import { Progress } from "@/components/ui/progress";
import { ESG_SECTIONS, getQuestionsBySection, type EsgResponse } from "@/lib/supplier-esg/questions";
import { getRatingLabel } from "@/lib/supplier-esg/scoring";

export default function SupplierDetailPage() {
  const params = useParams();
  const orgSupplierId = params.id as string;

  const {
    supplierProfile,
    brandRelationship,
    resolvedSupplierId,
    products,
    esgAssessment,
    loading,
    error,
  } = useOrganizationSupplierDetail(orgSupplierId);

  const [activeTab, setActiveTab] = useState("overview");

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

  const getEngagementBadge = (status: string | null) => {
    switch (status) {
      case "data_provided":
        return <Badge className="bg-green-600">Data Provided</Badge>;
      case "active":
        return <Badge className="bg-blue-600">Active</Badge>;
      case "invited":
        return <Badge className="bg-amber-600 text-white">Invited</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      default:
        return <Badge variant="outline">No Engagement</Badge>;
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
        <Link href="/suppliers">
          <Button variant="ghost" size="sm" className="gap-2 mb-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Suppliers
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Supplier Not Found</h3>
              <p className="text-muted-foreground">
                {error || "This supplier could not be found in your organisation."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Link href="/suppliers">
          <Button variant="ghost" size="sm" className="gap-2 mb-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Suppliers
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          {/* Logo or fallback icon */}
          <div className="relative h-16 w-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
            {supplierProfile.logo_url ? (
              <Image
                src={supplierProfile.logo_url}
                alt={`${supplierProfile.name} logo`}
                fill
                className="object-contain p-1"
              />
            ) : (
              <Building2 className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold truncate">{supplierProfile.name}</h1>
              {supplierProfile.is_verified && (
                <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30 flex-shrink-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Verified Supplier
                </Badge>
              )}
              {esgAssessment?.is_verified && (
                <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex-shrink-0">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  ESG {esgAssessment.score_total ?? "N/A"} ({getRatingLabel(esgAssessment.score_rating! as any)})
                </Badge>
              )}
              {esgAssessment && esgAssessment.submitted && !esgAssessment.is_verified && (
                <Badge className="text-xs bg-slate-500/20 text-slate-400 border-slate-500/30 flex-shrink-0">
                  <Clock className="h-3 w-3 mr-1" />
                  ESG Assessment Pending
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
              {supplierProfile.industry_sector && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {supplierProfile.industry_sector}
                </span>
              )}
              {(supplierProfile.address || supplierProfile.city || supplierProfile.country) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[supplierProfile.city, supplierProfile.country].filter(Boolean).join(", ") || supplierProfile.address}
                </span>
              )}
              {supplierProfile.website && (
                <a
                  href={supplierProfile.website.startsWith("http") ? supplierProfile.website : `https://${supplierProfile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {supplierProfile.website.replace(/^https?:\/\//, "")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Not yet joined banner */}
      {!resolvedSupplierId && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              This supplier has not yet joined the platform
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              Product and ESG data will appear here once they accept the invitation and add their information.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">
            Products ({products.length})
          </TabsTrigger>
          <TabsTrigger value="esg">ESG</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Company Details */}
            <Card>
              <CardHeader>
                <CardTitle>Company Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {supplierProfile.description && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">About</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{supplierProfile.description}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Industry Sector</p>
                    <p className="text-sm text-muted-foreground">
                      {supplierProfile.industry_sector || "Not specified"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Location</p>
                    {supplierProfile.address || supplierProfile.city || supplierProfile.country ? (
                      <p className="text-sm text-muted-foreground">
                        {[
                          supplierProfile.address,
                          supplierProfile.city,
                          supplierProfile.country,
                        ].filter(Boolean).join(", ")}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not specified</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Website</p>
                    {supplierProfile.website ? (
                      <a
                        href={supplierProfile.website.startsWith("http") ? supplierProfile.website : `https://${supplierProfile.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                      >
                        {supplierProfile.website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not provided</p>
                    )}
                  </div>
                </div>

                {supplierProfile.catalogue_url && (
                  <div className="flex items-start gap-3">
                    <Link2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Product Catalogue</p>
                      <a
                        href={supplierProfile.catalogue_url.startsWith("http") ? supplierProfile.catalogue_url : `https://${supplierProfile.catalogue_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                      >
                        View catalogue
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Email</p>
                    {supplierProfile.contact_email ? (
                      <a
                        href={`mailto:${supplierProfile.contact_email}`}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {supplierProfile.contact_email}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not provided</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Contact Person</p>
                    <p className="text-sm text-muted-foreground">
                      {supplierProfile.contact_name || "Not provided"}
                    </p>
                  </div>
                </div>

                {supplierProfile.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Phone</p>
                      <a
                        href={`tel:${supplierProfile.phone}`}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {supplierProfile.phone}
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Your Relationship */}
            <Card>
              <CardHeader>
                <CardTitle>Your Relationship</CardTitle>
                <CardDescription>Your organisation's relationship with this supplier</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Status</p>
                  {getEngagementBadge(brandRelationship?.engagement_status ?? null)}
                </div>

                {brandRelationship?.relationship_type && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <span className="capitalize">{brandRelationship.relationship_type.replace(/_/g, " ")}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Annual Spend</span>
                  <span className="font-semibold">
                    {formatCurrency(brandRelationship?.annual_spend ?? null, brandRelationship?.spend_currency ?? null)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Added</span>
                  <span>{formatDate(brandRelationship?.added_at ?? null)}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Products Available</span>
                  <span className="font-semibold">{products.length}</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats (only if supplier has products) */}
            {products.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Product Summary</CardTitle>
                  <CardDescription>Overview of available product data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Ingredients</span>
                    <span className="font-semibold">
                      {products.filter(p => p.product_type === "ingredient").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Packaging</span>
                    <span className="font-semibold">
                      {products.filter(p => p.product_type === "packaging").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">With Climate Data</span>
                    <span className="font-semibold">
                      {products.filter(p => p.impact_climate != null).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">With Water Data</span>
                    <span className="font-semibold">
                      {products.filter(p => p.impact_water != null).length}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Notes */}
          {brandRelationship?.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {brandRelationship.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Product Portfolio</CardTitle>
                <CardDescription>
                  Products and materials provided by this supplier
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {!resolvedSupplierId ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    This supplier has not yet joined the platform. Products will appear here once they register and add their catalogue.
                  </p>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    No products added by this supplier yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-start gap-4 p-4 border rounded-lg"
                    >
                      <div className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {product.product_image_url ? (
                          <Image
                            src={product.product_image_url}
                            alt={product.name}
                            fill
                            className="object-contain"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Package className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-medium">{product.name}</h4>
                          {product.product_type && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {product.product_type}
                            </Badge>
                          )}
                          {product.product_code && (
                            <Badge variant="outline" className="text-xs">{product.product_code}</Badge>
                          )}
                          {product.origin_country_code && (
                            <Badge variant="secondary" className="text-xs">
                              <MapPin className="h-3 w-3 mr-0.5" />
                              {product.origin_country_code}
                            </Badge>
                          )}
                        </div>
                        {product.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {product.description}
                          </p>
                        )}

                        {/* Impact metrics row */}
                        <div className="flex items-center gap-3 text-xs flex-wrap mt-1">
                          {product.category && (
                            <span className="text-muted-foreground">{product.category}</span>
                          )}
                          {product.impact_climate != null && (
                            <span className="flex items-center gap-1 font-medium text-foreground bg-emerald-500/10 px-2 py-0.5 rounded">
                              <Leaf className="h-3 w-3 text-emerald-500" />
                              {formatImpact(product.impact_climate)} kg CO₂e/{product.unit}
                            </span>
                          )}
                          {product.impact_water != null && (
                            <span className="flex items-center gap-1 font-medium text-foreground bg-blue-500/10 px-2 py-0.5 rounded">
                              <Droplets className="h-3 w-3 text-blue-500" />
                              {formatImpact(product.impact_water)} L/{product.unit}
                            </span>
                          )}
                          {product.impact_land != null && (
                            <span className="flex items-center gap-1 font-medium text-foreground bg-amber-500/10 px-2 py-0.5 rounded">
                              <Mountain className="h-3 w-3 text-amber-500" />
                              {formatImpact(product.impact_land)} m²/{product.unit}
                            </span>
                          )}
                          {product.impact_waste != null && (
                            <span className="flex items-center gap-1 font-medium text-foreground bg-orange-500/10 px-2 py-0.5 rounded">
                              <Trash2 className="h-3 w-3 text-orange-500" />
                              {formatImpact(product.impact_waste)} kg/{product.unit}
                            </span>
                          )}
                        </div>

                        {/* Certifications */}
                        {(product as any).certifications && (product as any).certifications.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            {(product as any).certifications.map((cert: string) => (
                              <Badge key={cert} variant="secondary" className="text-xs">
                                <ShieldCheck className="h-3 w-3 mr-0.5" />
                                {cert}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Packaging-specific details */}
                        {product.product_type === "packaging" && (
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                            {product.weight_g != null && (
                              <span>Weight: {product.weight_g}g</span>
                            )}
                            {product.primary_material && (
                              <span>Material: {product.primary_material.replace(/_/g, " ")}</span>
                            )}
                            {product.recycled_content_pct != null && (
                              <span>Recycled: {product.recycled_content_pct}%</span>
                            )}
                            {product.packaging_category && (
                              <span className="capitalize">{product.packaging_category}</span>
                            )}
                          </div>
                        )}

                        {/* Data quality indicator */}
                        {product.data_quality_score != null && (
                          <div className="mt-2">
                            <span className="text-xs text-muted-foreground">
                              Data quality: {product.data_quality_score <= 2 ? "High" : product.data_quality_score <= 3 ? "Medium" : "Low"}
                              {product.methodology_standard && ` (${product.methodology_standard})`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ESG Assessment Tab */}
        <TabsContent value="esg" className="space-y-6">
          {!resolvedSupplierId ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Supplier Not Yet Joined</h3>
                  <p className="text-muted-foreground">
                    ESG data will appear here once the supplier joins the platform and completes their assessment.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : esgAssessment && (esgAssessment.submitted || esgAssessment.is_verified) ? (
            <>
              {/* Verification status */}
              {esgAssessment.is_verified && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-6 w-6 text-emerald-500" />
                      <div>
                        <p className="font-semibold text-emerald-500">ESG Verified</p>
                        <p className="text-sm text-muted-foreground">
                          Verified on{" "}
                          {new Date(esgAssessment.verified_at!).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-3xl font-bold">{esgAssessment.score_total ?? "N/A"}</p>
                        <EsgRatingBadge rating={esgAssessment.score_rating} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Score breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Score Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ESG_SECTIONS.map((section) => {
                    const scoreKey = {
                      labour_human_rights: "score_labour",
                      environment: "score_environment",
                      ethics: "score_ethics",
                      health_safety: "score_health_safety",
                      management_systems: "score_management",
                    }[section.key] as keyof typeof esgAssessment;
                    const score = (esgAssessment[scoreKey] as number) ?? 0;

                    return (
                      <div key={section.key} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{section.label}</span>
                          <span className="font-medium">{score}%</span>
                        </div>
                        <Progress value={score} className="h-2" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Section-by-section Q&A */}
              {ESG_SECTIONS.map((section) => {
                const questions = getQuestionsBySection(section.key);
                const answers = (esgAssessment.answers || {}) as Record<string, EsgResponse>;

                return (
                  <Card key={section.key}>
                    <CardHeader>
                      <CardTitle className="text-base">{section.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {questions.map((q) => {
                          const answer = answers[q.id];
                          const answerStyles: Record<string, string> = {
                            yes: "bg-emerald-500/20 text-emerald-400",
                            partial: "bg-amber-500/20 text-amber-400",
                            no: "bg-red-500/20 text-red-400",
                            na: "bg-slate-500/20 text-slate-400",
                          };
                          const answerLabels: Record<string, string> = {
                            yes: "Yes",
                            partial: "Partial",
                            no: "No",
                            na: "N/A",
                          };

                          return (
                            <div
                              key={q.id}
                              className="flex items-start justify-between gap-4 text-sm py-1.5 border-b border-border/50 last:border-0"
                            >
                              <span className="text-muted-foreground flex-1">{q.text}</span>
                              {answer ? (
                                <Badge className={`text-xs flex-shrink-0 ${answerStyles[answer] || ""}`}>
                                  {answerLabels[answer] || answer}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">&mdash;</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No ESG Assessment</h3>
                  <p className="text-muted-foreground">
                    This supplier has not yet completed an ESG assessment.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EsgRatingBadge({ rating }: { rating: string | null }) {
  if (!rating) return null;
  const styles: Record<string, string> = {
    leader: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    progressing: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    needs_improvement: "bg-red-500/20 text-red-400 border-red-500/30",
    not_assessed: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };
  return (
    <Badge className={`text-xs ${styles[rating] || ""}`}>
      {getRatingLabel(rating as any)}
    </Badge>
  );
}
