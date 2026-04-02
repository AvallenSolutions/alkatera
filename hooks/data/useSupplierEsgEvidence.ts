import { useState, useEffect, useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { toast } from 'sonner'
import type { SupplierEsgEvidence } from '@/lib/types/supplier-esg'

export function useSupplierEsgEvidence(assessmentId: string | undefined) {
  const [evidence, setEvidence] = useState<SupplierEsgEvidence[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEvidence = useCallback(async () => {
    if (!assessmentId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const supabase = getSupabaseBrowserClient()

      const { data, error } = await supabase
        .from('supplier_esg_evidence')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setEvidence(data || [])
    } catch (err: any) {
      console.error('Error fetching ESG evidence:', err)
    } finally {
      setLoading(false)
    }
  }, [assessmentId])

  useEffect(() => {
    fetchEvidence()
  }, [fetchEvidence])

  /** Group evidence items by question_id for easy lookup. */
  const evidenceByQuestion: Record<string, SupplierEsgEvidence[]> = {}
  for (const item of evidence) {
    if (!evidenceByQuestion[item.question_id]) {
      evidenceByQuestion[item.question_id] = []
    }
    evidenceByQuestion[item.question_id].push(item)
  }

  /** Upload a file as evidence for a specific question. */
  const uploadEvidence = async (
    questionId: string,
    file: File,
    name: string
  ): Promise<SupplierEsgEvidence | null> => {
    if (!assessmentId) {
      toast.error('No assessment found')
      return null
    }

    try {
      const supabase = getSupabaseBrowserClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Build storage path
      const timestamp = Date.now()
      const sanitisedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storagePath = `${assessmentId}/${questionId}/${timestamp}-${sanitisedFileName}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('esg-evidence')
        .upload(storagePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('esg-evidence').getPublicUrl(storagePath)

      // Insert record
      const { data, error: insertError } = await supabase
        .from('supplier_esg_evidence')
        .insert({
          assessment_id: assessmentId,
          question_id: questionId,
          document_name: name,
          document_url: publicUrl,
          storage_object_path: storagePath,
          file_size_bytes: file.size,
          mime_type: file.type,
          uploaded_by: user.id,
        })
        .select()
        .single()

      if (insertError) throw insertError

      toast.success('Evidence uploaded successfully')
      await fetchEvidence()
      return data
    } catch (err: any) {
      console.error('Error uploading ESG evidence:', err)
      toast.error(err.message || 'Failed to upload evidence')
      return null
    }
  }

  /** Delete an evidence item and its storage object. */
  const deleteEvidence = async (id: string): Promise<boolean> => {
    try {
      const supabase = getSupabaseBrowserClient()

      // Look up storage path first
      const item = evidence.find((e) => e.id === id)

      if (item?.storage_object_path) {
        const { error: storageError } = await supabase.storage
          .from('esg-evidence')
          .remove([item.storage_object_path])

        if (storageError) {
          console.warn('Failed to delete file from storage:', storageError)
        }
      }

      const { error: deleteError } = await supabase
        .from('supplier_esg_evidence')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      toast.success('Evidence deleted')
      await fetchEvidence()
      return true
    } catch (err: any) {
      console.error('Error deleting ESG evidence:', err)
      toast.error(err.message || 'Failed to delete evidence')
      return false
    }
  }

  return {
    evidenceByQuestion,
    uploadEvidence,
    deleteEvidence,
    loading,
  }
}
