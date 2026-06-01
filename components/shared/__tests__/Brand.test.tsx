import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Brand, RichText, applyBrandStyling } from '../Brand'

function renderToHtml(node: React.ReactNode): string {
  return render(<>{node}</>).container.innerHTML
}

describe('<Brand />', () => {
  it('renders alka + bold tera', () => {
    expect(renderToHtml(<Brand />)).toBe('alka<strong>tera</strong>')
  })

  it('forwards className to the strong tag', () => {
    expect(renderToHtml(<Brand className="text-lime-500" />)).toBe(
      'alka<strong class="text-lime-500">tera</strong>',
    )
  })
})

describe('<RichText>', () => {
  it('auto-bolds tera inside a plain sentence', () => {
    expect(renderToHtml(<RichText>{'Welcome to alkatera.'}</RichText>)).toBe(
      'Welcome to alka<strong>tera</strong>.',
    )
  })

  it('detects all case variants without rewriting input casing', () => {
    expect(renderToHtml(<RichText>{'Visit Alkatera now'}</RichText>)).toContain(
      'Alka<strong>tera</strong>',
    )
    expect(renderToHtml(<RichText>{'ALKATERA is here'}</RichText>)).toContain(
      'ALKA<strong>TERA</strong>',
    )
    expect(renderToHtml(<RichText>{'alkaTera is mixed'}</RichText>)).toContain(
      'alka<strong>Tera</strong>',
    )
  })

  it('parses **bold** markdown', () => {
    expect(renderToHtml(<RichText>{'this is **important** stuff'}</RichText>)).toBe(
      'this is <strong>important</strong> stuff',
    )
  })

  it('handles **alkatera** as bold containing the styled brand', () => {
    // Outer bold wraps the brand; inner styling still applies.
    const html = renderToHtml(<RichText>{'see **alkatera** here'}</RichText>)
    expect(html).toBe('see <strong>alka<strong>tera</strong></strong> here')
  })

  it('returns null for empty input', () => {
    expect(renderToHtml(<RichText>{''}</RichText>)).toBe('')
    expect(renderToHtml(<RichText>{null}</RichText>)).toBe('')
    expect(renderToHtml(<RichText>{undefined}</RichText>)).toBe('')
  })

  it('handles strings without any brand or markdown unchanged', () => {
    expect(renderToHtml(<RichText>{'plain text'}</RichText>)).toBe('plain text')
  })

  it('wraps with as= when requested', () => {
    expect(renderToHtml(<RichText as="p">{'hello alkatera'}</RichText>)).toBe(
      '<p>hello alka<strong>tera</strong></p>',
    )
  })

  it('handles multiple brand mentions in one string', () => {
    expect(
      renderToHtml(<RichText>{'alkatera does X and alkatera does Y'}</RichText>),
    ).toBe('alka<strong>tera</strong> does X and alka<strong>tera</strong> does Y')
  })
})

describe('applyBrandStyling utility', () => {
  it('returns the input string when no brand or markdown present', () => {
    expect(applyBrandStyling('hello world')).toBe('hello world')
  })

  it('returns the empty string for empty input', () => {
    expect(applyBrandStyling('')).toBe('')
  })

  it('returns an array of nodes when matches exist', () => {
    const result = applyBrandStyling('hello alkatera')
    expect(Array.isArray(result)).toBe(true)
  })
})
