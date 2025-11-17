import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/db_types'

export const supabase = createClientComponentClient<Database>()
