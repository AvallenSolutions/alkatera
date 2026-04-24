import { EvidenceDetailPanel } from '@/components/evidence-library/EvidenceDetailPanel'

export default function EvidenceDocumentPage({ params }: { params: { id: string } }) {
  return <EvidenceDetailPanel docId={params.id} />
}
