"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, ArrowLeft, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";
import Link from "next/link";
import { COUNTRIES } from "@/lib/countries";

interface SupplierFormData {
  name: string;
  contact_name: string;
  contact_email: string;
  website: string;
  industry_sector: string;
  country: string;
  annual_spend: string;
  spend_currency: string;
  notes: string;
}

const INDUSTRY_SECTORS = [
  "Food & Beverage",
  "Packaging & Materials",
  "Logistics & Transportation",
  "Manufacturing",
  "Agriculture",
  "Energy & Utilities",
  "Chemicals",
  "Textiles",
  "Construction",
  "Technology",
  "Services",
  "Other",
];

const CURRENCIES = [
  { value: "GBP", label: "£ British Pound (GBP)" },
  { value: "USD", label: "$ US Dollar (USD)" },
  { value: "EUR", label: "€ Euro (EUR)" },
];

export default function NewSupplierPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentOrganization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invitationToken = searchParams?.get("token");
  const invitedEmail = searchParams?.get("email");
  const invitedName = searchParams?.get("name");

  const [formData, setFormData] = useState<SupplierFormData>({
    name: invitedName || "",
    contact_name: "",
    contact_email: invitedEmail || "",
    website: "",
    industry_sector: "",
    country: "",
    annual_spend: "",
    spend_currency: "GBP",
    notes: "",
  });

  useEffect(() => {
    if (invitedEmail || invitedName) {
      setFormData(prev => ({
        ...prev,
        contact_email: invitedEmail || prev.contact_email,
        name: invitedName || prev.name,
      }));
    }
  }, [invitedEmail, invitedName]);

  const handleInputChange = (field: keyof SupplierFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      toast.error("Supplier name is required");
      return false;
    }

    if (formData.contact_email && !formData.contact_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast.error("Please enter a valid email address");
      return false;
    }

    if (formData.annual_spend) {
      const spend = parseFloat(formData.annual_spend);
      if (isNaN(spend) || spend < 0) {
        toast.error("Annual spend must be a positive number");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!currentOrganization?.id) {
      toast.error("No organisation selected");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      const supplierData: any = {
        organization_id: currentOrganization.id,
        name: formData.name,
        contact_name: formData.contact_name || null,
        contact_email: formData.contact_email || null,
        website: formData.website || null,
        industry_sector: formData.industry_sector || null,
        country: formData.country || null,
        annual_spend: formData.annual_spend ? parseFloat(formData.annual_spend) : null,
        spend_currency: formData.spend_currency,
        notes: formData.notes || null,
      };

      const { data, error } = await supabase
        .from("suppliers")
        .insert([supplierData])
        .select()
        .single();

      if (error) throw error;

      // Create initial engagement record
      const { error: engagementError } = await supabase
        .from("supplier_engagements")
        .insert([{
          supplier_id: data.id,
          status: "invited",
          created_by: user.id,
        }]);

      if (engagementError) {
        console.error("Error creating engagement:", engagementError);
      }

      if (invitationToken) {
        const { error: invitationUpdateError } = await supabase
          .from("supplier_invitations")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
            supplier_id: data.id,
          })
          .eq("invitation_token", invitationToken);

        if (invitationUpdateError) {
          console.error("Error updating invitation:", invitationUpdateError);
        }
      }

      toast.success("Supplier created successfully");
      router.push(`/suppliers/${data.id}`);
    } catch (error: any) {
      console.error("Error creating supplier:", error);
      toast.error(error.message || "Failed to create supplier");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentOrganization) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select an organisation to create a supplier.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/suppliers">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">
            {invitationToken ? "Complete Supplier Registration" : "Add New Supplier"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {invitationToken
              ? "Fill in your company details to complete your supplier profile"
              : "Add a supplier to your supply chain network"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Company details and contact information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Supplier Company Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Acme Glass Manufacturing Ltd"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry_sector">Industry Sector</Label>
              <Select
                value={formData.industry_sector}
                onValueChange={(value) => handleInputChange("industry_sector", value)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="industry_sector">
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
              <Label htmlFor="country">Country</Label>
              <Select
                value={formData.country}
                onValueChange={(value) => handleInputChange("country", value)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.value} value={country.label}>
                      {country.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Details</CardTitle>
          <CardDescription>
            Primary contact person for this supplier
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="contact_name">Contact Person Name</Label>
            <Input
              id="contact_name"
              placeholder="e.g., John Smith"
              value={formData.contact_name}
              onChange={(e) => handleInputChange("contact_name", e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">Contact Email</Label>
            <Input
              id="contact_email"
              type="email"
              placeholder="e.g., john.smith@supplier.com"
              value={formData.contact_email}
              onChange={(e) => handleInputChange("contact_email", e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="e.g., https://www.supplier.com"
              value={formData.website}
              onChange={(e) => handleInputChange("website", e.target.value)}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              The supplier&apos;s company website (include https:// or http://)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>
            Financial and commercial details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="annual_spend">Annual Spend</Label>
              <Input
                id="annual_spend"
                type="number"
                step="0.01"
                min="0"
                placeholder="50000"
                value={formData.annual_spend}
                onChange={(e) => handleInputChange("annual_spend", e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="spend_currency">Currency</Label>
              <Select
                value={formData.spend_currency}
                onValueChange={(value) => handleInputChange("spend_currency", value)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="spend_currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Estimated annual procurement spend with this supplier
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>
            Additional information about this supplier
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="notes">Supplier Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes or comments about this supplier..."
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              disabled={isSubmitting}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-6 border-t">
        <Link href="/suppliers">
          <Button variant="outline" disabled={isSubmitting}>
            Cancel
          </Button>
        </Link>
        <Button onClick={handleSubmit} size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              Create Supplier
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
