import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SetupProgressBanner } from '../SetupProgressBanner'
import type { SetupProgress } from '@/hooks/data/useSetupProgress'

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockProgress(overrides: Partial<SetupProgress> = {}): SetupProgress {
  const defaults: SetupProgress = {
    hasFacilities: false,
    hasProducts: false,
    hasSuppliers: false,
    hasTeamMembers: false,
    facilitiesCount: 0,
    productsCount: 0,
    suppliersCount: 0,
    membersCount: 1,
    milestones: [
      { key: 'facilities', label: 'Add a facility', done: false, href: '/company/facilities' },
      { key: 'products', label: 'Create a product', done: false, href: '/products/new' },
      { key: 'suppliers', label: 'Add a supplier', done: false, href: '/suppliers' },
      { key: 'team', label: 'Invite a team member', done: false, href: '/settings' },
    ],
    completedCount: 0,
    totalCount: 4,
    percentage: 0,
    isComplete: false,
    isLoading: false,
    isDismissed: false,
    dismiss: vi.fn(),
    refetch: vi.fn(),
  }

  return { ...defaults, ...overrides }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SetupProgressBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render the percentage and milestone count', () => {
    const progress = createMockProgress({
      percentage: 50,
      completedCount: 2,
      totalCount: 4,
    })

    render(<SetupProgressBanner progress={progress} />)

    expect(screen.getByText("You're 50% set up")).toBeTruthy()
    expect(screen.getByText('2 of 4 complete')).toBeTruthy()
  })

  it('should render all milestone labels', () => {
    const progress = createMockProgress()

    render(<SetupProgressBanner progress={progress} />)

    expect(screen.getByText('Add a facility')).toBeTruthy()
    expect(screen.getByText('Create a product')).toBeTruthy()
    expect(screen.getByText('Add a supplier')).toBeTruthy()
    expect(screen.getByText('Invite a team member')).toBeTruthy()
  })

  it('should show contextual message when nothing is set up', () => {
    const progress = createMockProgress({ completedCount: 0 })

    render(<SetupProgressBanner progress={progress} />)

    expect(
      screen.getByText(
        "Let's get your account set up — it only takes a few minutes."
      )
    ).toBeTruthy()
  })

  it('should show contextual next-step message based on first incomplete milestone', () => {
    const progress = createMockProgress({
      completedCount: 1,
      milestones: [
        { key: 'facilities', label: 'Add a facility', done: true, href: '/company/facilities' },
        { key: 'products', label: 'Create a product', done: false, href: '/products/new' },
        { key: 'suppliers', label: 'Add a supplier', done: false, href: '/suppliers' },
        { key: 'team', label: 'Invite a team member', done: false, href: '/settings' },
      ],
    })

    render(<SetupProgressBanner progress={progress} />)

    expect(
      screen.getByText('Nice progress! Next up: create your first product.')
    ).toBeTruthy()
  })

  it('should show celebration state when isComplete is true', () => {
    const progress = createMockProgress({
      isComplete: true,
      completedCount: 4,
      totalCount: 4,
      percentage: 100,
    })

    render(<SetupProgressBanner progress={progress} />)

    expect(screen.getByText("You're all set!")).toBeTruthy()
    expect(
      screen.getByText('Your sustainability dashboard is ready to go. Great work!')
    ).toBeTruthy()
  })

  it('should call dismiss when X button is clicked', () => {
    const dismiss = vi.fn()
    const progress = createMockProgress({ dismiss })

    render(<SetupProgressBanner progress={progress} />)

    // Find the button with X icon (it's the last button in the banner)
    const buttons = screen.getAllByRole('button')
    const dismissButton = buttons[buttons.length - 1]
    fireEvent.click(dismissButton)

    expect(dismiss).toHaveBeenCalledOnce()
  })

  it('should call dismiss on celebration state X button', () => {
    const dismiss = vi.fn()
    const progress = createMockProgress({ isComplete: true, dismiss })

    render(<SetupProgressBanner progress={progress} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(dismiss).toHaveBeenCalledOnce()
  })

  it('should render milestone links with correct hrefs', () => {
    const progress = createMockProgress()

    render(<SetupProgressBanner progress={progress} />)

    const links = screen.getAllByRole('link')
    const hrefs = links.map((link) => link.getAttribute('href'))

    expect(hrefs).toContain('/company/facilities')
    expect(hrefs).toContain('/products/new')
    expect(hrefs).toContain('/suppliers')
    expect(hrefs).toContain('/settings')
  })

  it('should render a progress bar with correct width', () => {
    const progress = createMockProgress({ percentage: 75 })

    const { container } = render(<SetupProgressBanner progress={progress} />)

    // Find the progress bar inner div by its style
    const progressBar = container.querySelector('[style*="width: 75%"]')
    expect(progressBar).toBeTruthy()
  })
})
