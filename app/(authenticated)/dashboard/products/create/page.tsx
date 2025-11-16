"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useOrganization } from "@/lib/organizationContext";
import { insertProduct } from "@/lib/products";
import type { UnitSizeUnit, Certification, Award } from "@/lib/types/products";

export default function CreateProductPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id;

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unitSizeValue, setUnitSizeValue] = useState("");
  const [unitSizeUnit, setUnitSizeUnit] = useState<UnitSizeUnit | "">("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddCertification = () => {
    setCertifications([...certifications, { name: "", evidence_url: "" }]);
  };

  const handleUpdateCertification = (index: number, field: keyof Certification, value: string) => {
    const updated = [...certifications];
    updated[index][field] = value;
    setCertifications(updated);
  };

  const handleRemoveCertification = (index: number) => {
    setCertifications(certifications.filter((_, i) => i !== index));
  };

  const handleAddAward = () => {
    setAwards([...awards, { name: "" }]);
  };

  const handleUpdateAward = (index: number, value: string) => {
    const updated = [...awards];
    updated[index].name = value;
    setAwards(updated);
  };

  const handleRemoveAward = (index: number) => {
    setAwards(awards.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationId) {
      setError("No organisation selected");
      return;
    }

    if (!name.trim()) {
      setError("Product name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const validCertifications = certifications.filter((cert) => cert.name.trim());
      const validAwards = awards.filter((award) => award.name.trim());

      await insertProduct(organizationId, {
        name: name.trim(),
        sku: sku.trim() || undefined,
        unit_size_value: unitSizeValue ? parseFloat(unitSizeValue) : undefined,
        unit_size_unit: unitSizeUnit || undefined,
        product_description: description.trim() || undefined,
        product_image_url: imageUrl.trim() || undefined,
        certifications: validCertifications.length > 0 ? validCertifications : undefined,
        awards: validAwards.length > 0 ? validAwards : undefined,
      });

      toast.success("Product created successfully!");
      router.push("/dashboard/products");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create product";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (!organizationId) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Please select an organisation to create a product.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create New Product</h1>
        <p className="text-muted-foreground mt-2">
          Add a new product to your catalogue
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
            <CardDescription>
              Enter the basic information about your product
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Product Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Premium Coffee Blend"
                  required
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="e.g., PCB-250-001"
                  disabled={isSaving}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit-size-value">Unit Size Value</Label>
                  <Input
                    id="unit-size-value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitSizeValue}
                    onChange={(e) => setUnitSizeValue(e.target.value)}
                    placeholder="250"
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit-size-unit">Unit</Label>
                  <Select
                    value={unitSizeUnit}
                    onValueChange={(value) => setUnitSizeUnit(value as UnitSizeUnit)}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="unit-size-unit">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="image-url">Image URL</Label>
                <Input
                  id="image-url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the full URL to the product image
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Product Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the product..."
                  rows={4}
                  disabled={isSaving}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-centre justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Certifications</h3>
                  <p className="text-sm text-muted-foreground">
                    Add product certifications and evidence
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCertification}
                  disabled={isSaving}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Certification
                </Button>
              </div>

              {certifications.length === 0 ? (
                <div className="text-centre py-6 border-2 border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    No certifications added yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {certifications.map((cert, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          value={cert.name}
                          onChange={(e) =>
                            handleUpdateCertification(index, "name", e.target.value)
                          }
                          placeholder="Certification name"
                          disabled={isSaving}
                        />
                        <Input
                          value={cert.evidence_url}
                          onChange={(e) =>
                            handleUpdateCertification(index, "evidence_url", e.target.value)
                          }
                          placeholder="Evidence URL"
                          disabled={isSaving}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCertification(index)}
                        disabled={isSaving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-centre justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Awards</h3>
                  <p className="text-sm text-muted-foreground">
                    Add product awards and recognition
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddAward}
                  disabled={isSaving}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Award
                </Button>
              </div>

              {awards.length === 0 ? (
                <div className="text-centre py-6 border-2 border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    No awards added yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {awards.map((award, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        className="flex-1"
                        value={award.name}
                        onChange={(e) => handleUpdateAward(index, e.target.value)}
                        placeholder="Award name"
                        disabled={isSaving}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAward(index)}
                        disabled={isSaving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/products")}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Creating..." : "Create Product"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
