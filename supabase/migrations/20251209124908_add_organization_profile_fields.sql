/*
  # Add Organization Profile Fields

  1. Changes
    - Add `logo_url` (text) - URL to company logo image
    - Add `address` (text) - Street address
    - Add `city` (text) - City name
    - Add `country` (text) - Country name
    - Add `industry_sector` (text) - Industry classification
    - Add `founding_year` (integer) - Year company was founded
    - Add `company_size` (text) - Company size category (e.g., "1-10", "11-50", etc.)
    - Add `description` (text) - Company description
  
  2. Security
    - No RLS changes needed (inherits existing policies)
*/

-- Add new profile fields to organizations table
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS industry_sector text,
  ADD COLUMN IF NOT EXISTS founding_year integer,
  ADD COLUMN IF NOT EXISTS company_size text,
  ADD COLUMN IF NOT EXISTS description text;

-- Add check constraint for founding_year
ALTER TABLE organizations 
  ADD CONSTRAINT founding_year_check 
  CHECK (founding_year IS NULL OR (founding_year >= 1800 AND founding_year <= EXTRACT(YEAR FROM CURRENT_DATE)));
