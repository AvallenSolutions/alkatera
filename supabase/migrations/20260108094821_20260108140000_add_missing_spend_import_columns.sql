/*
  # Fix Spend Import System Schema Mismatch

  1. Changes
    - Add missing `raw_vendor` and `raw_category` columns to spend_import_items
    - Add `ai_processed_at` timestamp for tracking
    - Rename `ai_confidence` to `ai_confidence_score` for consistency with edge function
    - Add missing timestamp columns to spend_import_batches
  
  2. Purpose
    - Fixes schema mismatch causing silent failures during item insertion
    - Ensures frontend and backend use the same column names
*/

-- Add missing columns to spend_import_items
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spend_import_items' AND column_name = 'raw_vendor'
  ) THEN
    ALTER TABLE spend_import_items ADD COLUMN raw_vendor text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spend_import_items' AND column_name = 'raw_category'
  ) THEN
    ALTER TABLE spend_import_items ADD COLUMN raw_category text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spend_import_items' AND column_name = 'ai_processed_at'
  ) THEN
    ALTER TABLE spend_import_items ADD COLUMN ai_processed_at timestamptz;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spend_import_items' AND column_name = 'ai_confidence'
  ) THEN
    ALTER TABLE spend_import_items RENAME COLUMN ai_confidence TO ai_confidence_score;
  END IF;
END $$;

-- Add missing timestamp columns to spend_import_batches
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spend_import_batches' AND column_name = 'ai_processing_started_at'
  ) THEN
    ALTER TABLE spend_import_batches ADD COLUMN ai_processing_started_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spend_import_batches' AND column_name = 'ai_processing_completed_at'
  ) THEN
    ALTER TABLE spend_import_batches ADD COLUMN ai_processing_completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spend_import_batches' AND column_name = 'rejected_rows'
  ) THEN
    ALTER TABLE spend_import_batches ADD COLUMN rejected_rows integer NOT NULL DEFAULT 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spend_import_batches' AND column_name = 'imported_rows'
  ) THEN
    ALTER TABLE spend_import_batches RENAME COLUMN imported_rows TO imported_at;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spend_import_batches' AND column_name = 'imported_at'
  ) THEN
    ALTER TABLE spend_import_batches ADD COLUMN imported_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spend_import_batches' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE spend_import_batches ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'spend_import_batches' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE spend_import_batches ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create index on ai_processed_at for faster queries
CREATE INDEX IF NOT EXISTS idx_spend_import_items_ai_processed 
  ON spend_import_items(batch_id, ai_processed_at);
