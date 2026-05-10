import { redirect } from 'next/navigation'

// Legacy stub from the brief Footprint Agent prototype. Rosa is now the
// single agent across the platform; her queue + inbox live under /rosa/.
export default function LegacyAgentRedirect() {
  redirect('/rosa/?tab=queue')
}
