import { MarkdownDoc } from '@/components/dev/MarkdownDoc'
import { readFileSync } from 'fs'
import { join } from 'path'

export default function TechnicalDebtPage() {
  let content = ''

  try {
    const filePath = join(process.cwd(), 'TECHNICAL_DEBT_AUDIT_REPORT.md')
    content = readFileSync(filePath, 'utf-8')
  } catch (error) {
    content = 'Error loading technical debt report. Please ensure TECHNICAL_DEBT_AUDIT_REPORT.md exists in the project root.'
  }

  return (
    <MarkdownDoc
      title="Technical Debt Audit Report"
      description="Comprehensive analysis of technical debt, errors, and recommended fixes"
      content={content}
      badge="v1.0"
    />
  )
}
