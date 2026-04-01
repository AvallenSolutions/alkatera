import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import type { SupplierEsgAssessment } from '@/lib/types/supplier-esg'
import type { EsgResponse } from '@/lib/supplier-esg/questions'
import { calculateScores, getSectionCompletion } from '@/lib/supplier-esg/scoring'

export function useSupplierEsgAssessment(supplierId: string | undefined) {
  const [assessment, setAssessment] = useState<SupplierEsgAssessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchAssessment = useCallback(async () => {
    if (!supplierId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('supplier_esg_assessments')
        .select('*')
        .eq('supplier_id', supplierId)
        .maybeSingle()

      if (fetchError) throw fetchError

      setAssessment(data)
    } catch (err: any) {
      console.error('Error fetching ESG assessment:', err)
      setError(err.message || 'Failed to load ESG assessment')
    } finally {
      setLoading(false)
    }
  }, [supplierId])

  useEffect(() => {
    fetchAssessment()
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [fetchAssessment])

  /** Create the assessment record if it doesn't exist yet. */
  const ensureAssessment = async (): Promise<SupplierEsgAssessment | null> => {
    if (assessment) return assessment
    if (!supplierId) return null

    try {
      const { data, error } = await supabase
        .from('supplier_esg_assessments')
        .insert({ supplier_id: supplierId })
        .select()
        .single()

      if (error) throw error
      setAssessment(data)
      return data
    } catch (err: any) {
      console.error('Error creating ESG assessment:', err)
      toast.error('Failed to create ESG assessment')
      return null
    }
  }

  /** Save answers with debounce (called on every radio button change). */
  const saveAnswers = (answers: Record<string, EsgResponse>) => {
    if (!supplierId) return

    // Optimistic update: recalculate scores locally
    const scores = calculateScores(answers)
    const completion = getSectionCompletion(answers)

    setAssessment((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        answers,
        labour_human_rights_completed: completion.labour_human_rights,
        environment_completed: completion.environment,
        ethics_completed: completion.ethics,
        health_safety_completed: completion.health_safety,
        management_systems_completed: completion.management_systems,
        score_labour: scores.sections.labour_human_rights,
        score_environment: scores.sections.environment,
        score_ethics: scores.sections.ethics,
        score_health_safety: scores.sections.health_safety,
        score_management: scores.sections.management_systems,
        score_total: scores.total,
        score_rating: scores.rating,
      }
    })

    // Debounced save to API
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      try {
        setSaving(true)
        const res = await fetch('/api/supplier-esg/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        })
        if (!res.ok) {
          const body = await res.json()
          throw new Error(body.error || 'Failed to save')
        }
      } catch (err: any) {
        console.error('Error saving ESG answers:', err)
        toast.error('Failed to save answers')
      } finally {
        setSaving(false)
      }
    }, 1000)
  }

  /** Submit the assessment for verification. */
  const submitAssessment = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/supplier-esg/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Failed to submit')
      }
      toast.success('ESG assessment submitted for verification')
      await fetchAssessment()
    } catch (err: any) {
      console.error('Error submitting ESG assessment:', err)
      toast.error(err.message || 'Failed to submit assessment')
    } finally {
      setSaving(false)
    }
  }

  return {
    assessment,
    loading,
    error,
    saving,
    refetch: fetchAssessment,
    ensureAssessment,
    saveAnswers,
    submitAssessment,
  }
}
