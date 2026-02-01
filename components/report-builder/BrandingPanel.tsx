'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import type { ReportConfig } from '@/types/report-builder';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

interface BrandingPanelProps {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
}

export function BrandingPanel({ config, onChange }: BrandingPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(config.branding.logo);
  const supabase = getSupabaseBrowserClient();

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('report-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        // If bucket doesn't exist, create it (dev environment)
        if (error.message.includes('not found')) {
          console.error('report-assets bucket not found. Please create it in Supabase dashboard.');
          alert('Storage bucket not configured. Please contact support.');
          return;
        }
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('report-assets')
        .getPublicUrl(data.path);

      const publicUrl = urlData.publicUrl;

      // Update config
      onChange({
        branding: {
          ...config.branding,
          logo: publicUrl,
        },
      });

      setLogoPreview(publicUrl);
    } catch (error) {
      console.error('Logo upload error:', error);
      alert('Failed to upload logo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    onChange({
      branding: {
        ...config.branding,
        logo: null,
      },
    });
    setLogoPreview(null);
  };

  const handleColorChange = (field: 'primaryColor' | 'secondaryColor', value: string) => {
    onChange({
      branding: {
        ...config.branding,
        [field]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Alert>
        <ImageIcon className="h-4 w-4" />
        <AlertDescription>
          Customize the look and feel of your report with your organization&apos;s branding.
          This will apply to the generated document.
        </AlertDescription>
      </Alert>

      {/* Logo Upload */}
      <div className="space-y-3">
        <Label>Company Logo</Label>
        <p className="text-sm text-muted-foreground">
          Upload your organization&apos;s logo (PNG, JPG, or SVG, max 5MB)
        </p>

        {logoPreview ? (
          <div className="relative inline-block">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
              <img
                src={logoPreview}
                alt="Company logo preview"
                className="max-h-32 max-w-full object-contain"
              />
            </div>
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={handleRemoveLogo}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
            <input
              type="file"
              id="logo-upload"
              className="hidden"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={uploading}
            />
            <label htmlFor="logo-upload" className="cursor-pointer">
              <div className="flex flex-col items-center gap-2">
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Click to upload logo</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, or SVG (max 5MB)</p>
                  </>
                )}
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Color Scheme */}
      <div className="space-y-4">
        <Label>Color Scheme</Label>
        <p className="text-sm text-muted-foreground mb-4">
          Choose colors that match your brand identity
        </p>

        <div className="grid grid-cols-2 gap-6">
          {/* Primary Color */}
          <div className="space-y-2">
            <Label htmlFor="primary-color" className="text-sm">
              Primary Color
            </Label>
            <div className="flex gap-2">
              <Input
                id="primary-color"
                type="color"
                value={config.branding.primaryColor}
                onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                className="w-20 h-10 cursor-pointer"
              />
              <Input
                type="text"
                value={config.branding.primaryColor}
                onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                placeholder="#2563eb"
                className="flex-1"
              />
            </div>
            <div
              className="h-12 rounded-md border"
              style={{ backgroundColor: config.branding.primaryColor }}
            />
          </div>

          {/* Secondary Color */}
          <div className="space-y-2">
            <Label htmlFor="secondary-color" className="text-sm">
              Secondary Color
            </Label>
            <div className="flex gap-2">
              <Input
                id="secondary-color"
                type="color"
                value={config.branding.secondaryColor}
                onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                className="w-20 h-10 cursor-pointer"
              />
              <Input
                type="text"
                value={config.branding.secondaryColor}
                onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                placeholder="#10b981"
                className="flex-1"
              />
            </div>
            <div
              className="h-12 rounded-md border"
              style={{ backgroundColor: config.branding.secondaryColor }}
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <Label>Brand Preview</Label>
        <div
          className="border rounded-lg p-6"
          style={{
            background: `linear-gradient(135deg, ${config.branding.primaryColor}15 0%, ${config.branding.secondaryColor}15 100%)`,
          }}
        >
          <div className="flex items-center gap-4">
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Logo"
                className="h-12 object-contain"
              />
            )}
            <div>
              <div
                className="text-xl font-bold mb-1"
                style={{ color: config.branding.primaryColor }}
              >
                Sustainability Report {config.reportYear}
              </div>
              <div
                className="text-sm"
                style={{ color: config.branding.secondaryColor }}
              >
                {config.reportName}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
