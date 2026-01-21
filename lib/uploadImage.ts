import { supabase } from './supabaseClient';

export interface UploadResult {
  url: string | null;
  error: Error | null;
}

export async function uploadProductImage(
  file: File,
  organizationId: string
): Promise<UploadResult> {
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `${organizationId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      error: null,
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    return {
      url: null,
      error: error instanceof Error ? error : new Error('Failed to upload image'),
    };
  }
}
