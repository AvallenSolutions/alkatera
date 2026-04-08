'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
  MessageSquare,
  ImageIcon,
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

const STORYTELLING_AUDIENCES = ['investors', 'customers', 'supply-chain', 'internal'];

export function ReviewStep({ config, onChange, onSaveDefaults, defaultsSaved }: ReviewStepProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(config.branding.logo);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingLeadershipPhoto, setUploadingLeadershipPhoto] = useState(false);
  const supabase = getSupabaseBrowserClient();

  const isStorytelling = STORYTELLING_AUDIENCES.includes(config.audience);

  async function uploadToStorage(file: File, folder: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from('report-assets')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('report-assets').getPublicUrl(data.path);
    return urlData.publicUrl;
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;

    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadToStorage(file, 'logos');
      onChange({ branding: { ...config.branding, logo: url } });
      setLogoPreview(url);
    } catch {
      setUploadError('Failed to upload logo. Please try again.');
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

  const handleLeadershipChange = (field: keyof NonNullable<ReportConfig['branding']['leadership']>, value: string) => {
    onChange({
      branding: {
        ...config.branding,
        leadership: { ...config.branding.leadership, [field]: value },
      },
    });
  };

  const handleLeadershipPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploadingLeadershipPhoto(true);
    try {
      const url = await uploadToStorage(file, 'leadership');
      handleLeadershipChange('photo', url);
    } catch {
      setUploadError('Failed to upload photo. Please try again.');
    } finally {
      setUploadingLeadershipPhoto(false);
    }
  };

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingHero(true);
    try {
      const urls = await Promise.all(files.slice(0, 3).map(f => uploadToStorage(f, 'hero')));
      const existing = config.branding.heroImages ?? [];
      const combined = [...existing, ...urls].slice(0, 3);
      onChange({ branding: { ...config.branding, heroImages: combined } });
    } catch {
      setUploadError('Failed to upload image. Please try again.');
    } finally {
      setUploadingHero(false);
    }
  };

  const removeHeroImage = (index: number) => {
    const updated = (config.branding.heroImages ?? []).filter((_, i) => i !== index);
    onChange({ branding: { ...config.branding, heroImages: updated } });
  };

  const handleSaveDefaults = async () => {
    setSavingDefaults(true);
    try {
      await onSaveDefaults();
    } finally {
      setSavingDefaults(false);
    }
  };

  const leadershipMessage = config.branding.leadership?.message ?? '';

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
            {uploadError && (
              <p className="text-sm text-destructive mt-2">{uploadError}</p>
            )}
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Primary Colour</Label>
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
              <Label className="text-sm">Secondary Colour</Label>
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

      {/* Storytelling & Media — only shown for narrative audiences */}
      {isStorytelling && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Storytelling &amp; Media
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Add a leadership message and photography to make your report come alive. These appear as dedicated pages in investor, customer, and partner-facing reports.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Leadership message */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Leadership Message</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    value={config.branding.leadership?.name ?? ''}
                    onChange={(e) => handleLeadershipChange('name', e.target.value)}
                    placeholder="e.g. Jane Smith"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Title</Label>
                  <Input
                    value={config.branding.leadership?.title ?? ''}
                    onChange={(e) => handleLeadershipChange('title', e.target.value)}
                    placeholder="e.g. CEO &amp; Co-Founder"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Message</Label>
                <Textarea
                  value={leadershipMessage}
                  onChange={(e) => handleLeadershipChange('message', e.target.value)}
                  placeholder="A personal message about your sustainability journey, values, and commitments..."
                  className="h-28 resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {leadershipMessage.length}/500 characters
                </p>
              </div>

              {/* Leadership photo */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Leadership Photo (optional)</Label>
                {config.branding.leadership?.photo ? (
                  <div className="relative inline-block">
                    <img
                      src={config.branding.leadership.photo}
                      alt="Leadership"
                      className="h-24 w-20 object-cover rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                      onClick={() => handleLeadershipChange('photo', '')}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-gray-300 transition-colors max-w-xs">
                    <input
                      type="file"
                      id="leadership-photo-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={handleLeadershipPhotoUpload}
                      disabled={uploadingLeadershipPhoto}
                    />
                    <label htmlFor="leadership-photo-upload" className="cursor-pointer flex flex-col items-center gap-1">
                      {uploadingLeadershipPhoto ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Upload portrait photo</p>
                        </>
                      )}
                    </label>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Hero photography */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Report Photography</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload up to 3 photos. The first is used as the cover hero, the second as a section divider background.
                </p>
              </div>

              {/* Existing hero images */}
              {(config.branding.heroImages ?? []).length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {(config.branding.heroImages ?? []).map((url, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={url}
                        alt={`Photo ${i + 1}`}
                        className="h-20 w-32 object-cover rounded-lg border"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeHeroImage(i)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="absolute bottom-1 left-1.5 text-[10px] text-white font-medium drop-shadow">
                        {i === 0 ? 'Cover' : i === 1 ? 'Divider' : `Photo ${i + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {(config.branding.heroImages ?? []).length < 3 && (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-5 text-center hover:border-gray-300 transition-colors">
                  <input
                    type="file"
                    id="hero-upload"
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleHeroImageUpload}
                    disabled={uploadingHero}
                  />
                  <label htmlFor="hero-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
                    {uploadingHero ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        <p className="text-sm">Click to upload photos</p>
                        <p className="text-xs text-muted-foreground">JPG or PNG, up to 10 MB each</p>
                      </>
                    )}
                  </label>
                </div>
              )}
            </div>

          </CardContent>
        </Card>
      )}

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
