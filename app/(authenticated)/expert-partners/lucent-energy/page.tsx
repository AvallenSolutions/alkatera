import { PartnerProfile } from '@/components/partners/PartnerProfile'
import { lucentEnergyProfile } from '@/lib/partners/profiles'

export default function LucentEnergyPartnerPage() {
  return <PartnerProfile config={lucentEnergyProfile} />
}
