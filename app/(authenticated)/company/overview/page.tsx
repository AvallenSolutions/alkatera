"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Globe,
  MapPin,
  Calendar,
  Users,
  Briefcase,
  Save,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { PRODUCT_TYPE_OPTIONS } from "@/lib/industry-benchmarks";
import Link from "next/link";

const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1001+", label: "1001+ employees" },
];

const INDUSTRY_SECTORS = [
  "Agriculture & Farming",
  "Beverages & Spirits",
  "Consumer Goods",
  "Energy & Utilities",
  "Food & Beverage",
  "Healthcare & Pharmaceuticals",
  "Hospitality & Tourism",
  "Manufacturing",
  "Retail & E-commerce",
  "Technology",
  "Transportation & Logistics",
  "Other",
];

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  industry_sector: string | null;
  founding_year: number | null;
  company_size: string | null;
  billing_email: string | null;
  tax_id: string | null;
  product_type: string | null;
}

export default function CompanyOverviewPage() {
  const router = useRouter();
  const { currentOrganization, refreshOrganizations } = useOrganization();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [orgData, setOrgData] = useState<OrganizationData | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [industrySector, setIndustrySector] = useState("");
  const [foundingYear, setFoundingYear] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [productType, setProductType] = useState("");

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchOrganizationData();
    }
  }, [currentOrganization?.id]);

  async function fetchOrganizationData() {
    if (!currentOrganization?.id) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", currentOrganization.id)
        .single();

      if (error) throw error;

      const orgInfo = data as any;
      setOrgData(orgInfo);
      setName(orgInfo.name || "");
      setDescription(orgInfo.description || "");
      setWebsite(orgInfo.website || "");
      setAddress(orgInfo.address || "");
      setCity(orgInfo.city || "");
      setCountry(orgInfo.country || "");
      setIndustrySector(orgInfo.industry_sector || "");
      setFoundingYear(orgInfo.founding_year?.toString() || "");
      setCompanySize(orgInfo.company_size || "");
      setBillingEmail(orgInfo.billing_email || "");
      setTaxId(orgInfo.tax_id || "");
      setProductType(orgInfo.product_type || "");
    } catch (error) {
      console.error("Error fetching organization data:", error);
      toast.error("Failed to load organization details");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!currentOrganization?.id) {
      toast.error("No organization selected");
      return;
    }

    if (!name.trim()) {
      toast.error("Organisation name is required");
      return;
    }

    setIsSaving(true);

    try {
      // Build update payload - tax_id requires migration 20260121100000 to be applied
      const updatePayload: Record<string, any> = {
        name: name.trim(),
        description: description.trim() || null,
        website: website.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
        industry_sector: industrySector || null,
        founding_year: foundingYear ? parseInt(foundingYear) : null,
        company_size: companySize || null,
        billing_email: billingEmail.trim() || null,
        product_type: productType || null,
        updated_at: new Date().toISOString(),
      };

      // Try to save with tax_id first, fall back without it if column doesn't exist
      let result = await (supabase
        .from("organizations") as any)
        .update({ ...updatePayload, tax_id: taxId.trim() || null })
        .eq("id", currentOrganization.id);

      // If tax_id column doesn't exist, retry without it
      if (result.error?.code === 'PGRST204' && result.error?.message?.includes('tax_id')) {
        result = await (supabase
          .from("organizations") as any)
          .update(updatePayload)
          .eq("id", currentOrganization.id);
      }

      const { error } = result;

      if (error) throw error;

      toast.success("Organisation details updated successfully");

      // Refresh the organization context
      if (refreshOrganizations) {
        await refreshOrganizations();
      }
    } catch (error) {
      console.error("Error updating organization:", error);
      toast.error("Failed to update organisation details");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organisation Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and update your organisation details
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>
              Your organisation&apos;s core details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Organisation Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your company name"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of your organisation"
                rows={3}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.example.com"
                  className="pl-10"
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry">Industry Sector</Label>
                <Select value={industrySector} onValueChange={setIndustrySector} disabled={isSaving}>
                  <SelectTrigger id="industry">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_SECTORS.map((sector) => (
                      <SelectItem key={sector} value={sector}>
                        {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-size">Company Size</Label>
                <Select value={companySize} onValueChange={setCompanySize} disabled={isSaving}>
                  <SelectTrigger id="company-size">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-type">Primary Product Type</Label>
              <Select value={productType} onValueChange={setProductType} disabled={isSaving}>
                <SelectTrigger id="product-type">
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Determines the industry benchmarks used for your sustainability score
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="founding-year">Year Founded</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="founding-year"
                  type="number"
                  min="1800"
                  max={new Date().getFullYear()}
                  value={foundingYear}
                  onChange={(e) => setFoundingYear(e.target.value)}
                  placeholder="e.g., 2020"
                  className="pl-10"
                  disabled={isSaving}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location & Billing */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location
              </CardTitle>
              <CardDescription>
                Your organisation&apos;s address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main Street"
                  disabled={isSaving}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="London"
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="United Kingdom"
                    disabled={isSaving}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Billing Information
              </CardTitle>
              <CardDescription>
                Details used for invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="billing-email">Billing Email</Label>
                <Input
                  id="billing-email"
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder="billing@example.com"
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax-id">Tax/VAT ID</Label>
                <Input
                  id="tax-id"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="GB123456789"
                  disabled={isSaving}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild disabled={isSaving}>
          <Link href="/settings">Cancel</Link>
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
