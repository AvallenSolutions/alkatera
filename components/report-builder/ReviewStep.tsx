'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  FileText,
  Calendar,
  Users,
  Award,
  Palette,
  Upload,
  X,
  Save,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import type { ReportConfig } from '@/types/report-builder';
import { SECTION_LABELS, STANDARDS_LABELS, AUDIENCE_LABELS } from '@/types/report-builder';

interface ReviewStepProps {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
  onSaveDefaults: () => Promise<void>;
  defaultsSaved: boolean;
}

export function ReviewStep({ config, onChange, onSaveDefaults, defaultsSaved }: ReviewStepProps) {
  const [uploading, setUploading] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(config.branding.logo);
  const supabase = getSupabaseBrowserClient();

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { data, error } = await supabase.storage
        .from('report-assets')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('report-assets')
        .getPublicUrl(data.path);

      onChange({ branding: { ...config.branding, logo: urlData.publicUrl } });
      setLogoPreview(urlData.publicUrl);
    } catch (error) {
      console.error('Logo upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    onChange({ branding: { ...config.branding, logo: null } });
    setLogoPreview(null);
  };

  const handleColorChange = (field: 'primaryColor' | 'secondaryColor', value: string) => {
    onChange({ branding: { ...config.branding, [field]: value } });
  };

  const handleSaveDefaults = async () => {
    setSavingDefaults(true);
    try {
      await onSaveDefaults();
    } finally {
      setSavingDefaults(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Config Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Report Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">{config.reportName}</h2>
            <p className="text-sm text-muted-foreground">
              {format(new Date(config.reportingPeriodStart), 'MMM d, yyyy')} &ndash;{' '}
              {format(new Date(config.reportingPeriodEnd), 'MMM d, yyyy')}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-2 p-2 rounded bg-accent/50">
              <Calendar className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Year</p>
                <p className="text-sm font-semibold">{config.reportYear}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-accent/50">
              <Users className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Audience</p>
                <p className="text-sm font-semibold">{AUDIENCE_LABELS[config.audience] || config.audience}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-accent/50">
              <FileText className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Sections</p>
                <p className="text-sm font-semibold">{config.sections.length} selected</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-accent/50">
              <Award className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Standards</p>
                <p className="text-sm font-semibold">{config.standards.length > 0 ? config.standards.map(s => STANDARDS_LABELS[s] || s).join(', ') : 'None'}</p>
              </div>
            </div>
          </div>

          {/* Sections list */}
          <div>
            <p className="text-sm font-medium mb-2">Report Sections</p>
            <div className="flex flex-wrap gap-1.5">
              {config.sections.map((sectionId) => (
                <Badge key={sectionId} variant="secondary" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                  {SECTION_LABELS[sectionId] || sectionId}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Branding
            </CardTitle>
            <Button
              variant={defaultsSaved ? 'ghost' : 'outline'}
              size="sm"
              onClick={handleSaveDefaults}
              disabled={savingDefaults || defaultsSaved}
            >
              {savingDefaults ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : defaultsSaved ? (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-green-600" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              {defaultsSaved ? 'Defaults Saved' : 'Save as Defaults'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo */}
          <div className="space-y-2">
            <Label>Company Logo</Label>
            {logoPreview ? (
              <div className="relative inline-block">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                  <img src={logoPreview} alt="Logo" className="max-h-20 max-w-full object-contain" />
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
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  id="logo-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                />
                <label htmlFor="logo-upload" className="cursor-pointer flex flex-col items-center gap-1">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm">Click to upload</p>
                    </>
                  )}
                </label>
              </div>
            )}
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={config.branding.primaryColor}
                  onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                  className="w-14 h-10 cursor-pointer p-1"
                />
                <Input
                  type="text"
                  value={config.branding.primaryColor}
                  onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={config.branding.secondaryColor}
                  onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                  className="w-14 h-10 cursor-pointer p-1"
                />
                <Input
                  type="text"
                  value={config.branding.secondaryColor}
                  onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {/* Brand Preview */}
          <div
            className="rounded-lg p-4 border"
            style={{
              background: `linear-gradient(135deg, ${config.branding.primaryColor}15 0%, ${config.branding.secondaryColor}15 100%)`,
            }}
          >
            <div className="flex items-center gap-3">
              {logoPreview && <img src={logoPreview} alt="Logo" className="h-10 object-contain" />}
              <div>
                <div className="text-lg font-bold" style={{ color: config.branding.primaryColor }}>
                  {config.reportName}
                </div>
                <div className="text-sm" style={{ color: config.branding.secondaryColor }}>
                  {config.reportYear} Sustainability Report
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generation Info */}
      <Alert>
        <AlertDescription className="text-sm">
          <strong>Estimated generation time:</strong> 1-2 minutes for {config.sections.length} section
          {config.sections.length !== 1 ? 's' : ''}. You&apos;ll see real-time progress and can download when complete.
        </AlertDescription>
      </Alert>
    </div>
  );
}
