/** A verified supplier in the platform directory (the "find" side of the sheet). */
export interface PlatformSupplier {
  id: string;
  name: string;
  website: string | null;
  industry_sector: string | null;
  country: string | null;
  description: string | null;
  is_verified: boolean;
  contact_email: string | null;
  created_at: string | null;
}
