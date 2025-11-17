export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Placeholder Database type - will be replaced with generated types
// when Supabase CLI authentication is configured
export type Database = any
