import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockDismiss = vi.fn()
const mockRefetch = vi.fn()

let mockProgressReturn = {
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
  dismiss: mockDismiss,
  refetch: mockRefetch,
}

vi.mock('@/hooks/data/useSetupProgress', () => ({
  useSetupProgress: () => mockProgressReturn,
}))

// Import AFTER mocks
import { GettingStartedWidget } from '../GettingStartedWidget'

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GettingStartedWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default
    mockProgressReturn = {
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
      dismiss: mockDismiss,
      refetch: mockRefetch,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render the Getting Started title', () => {
    render(<GettingStartedWidget />)

    expect(screen.getByText('Getting Started')).toBeTruthy()
  })

  it('should show completion count badge', () => {
    mockProgressReturn.completedCount = 2
    mockProgressReturn.totalCount = 4

    render(<GettingStartedWidget />)

    expect(screen.getByText('2/4 complete')).toBeTruthy()
  })

  it('should render all 4 milestone items', () => {
    render(<GettingStartedWidget />)

    expect(screen.getByText('Add a facility')).toBeTruthy()
    expect(screen.getByText('Create a product')).toBeTruthy()
    expect(screen.getByText('Add a supplier')).toBeTruthy()
    expect(screen.getByText('Invite a team member')).toBeTruthy()
  })

  it('should show "Go" CTA buttons for incomplete milestones', () => {
    render(<GettingStartedWidget />)

    const goLinks = screen.getAllByText('Go')
    expect(goLinks.length).toBe(4) // All 4 are incomplete
  })

  it('should show "Done" badges for completed milestones', () => {
    mockProgressReturn.milestones = [
      { key: 'facilities', label: 'Add a facility', done: true, href: '/company/facilities' },
      { key: 'products', label: 'Create a product', done: true, href: '/products/new' },
      { key: 'suppliers', label: 'Add a supplier', done: false, href: '/suppliers' },
      { key: 'team', label: 'Invite a team member', done: false, href: '/settings' },
    ]
    mockProgressReturn.completedCount = 2

    render(<GettingStartedWidget />)

    const doneBadges = screen.getAllByText('Done')
    expect(doneBadges.length).toBe(2)

    const goLinks = screen.getAllByText('Go')
    expect(goLinks.length).toBe(2)
  })

  it('should render the celebration state when all milestones are complete', () => {
    mockProgressReturn.isComplete = true
    mockProgressReturn.completedCount = 4
    mockProgressReturn.percentage = 100

    render(<GettingStartedWidget />)

    expect(screen.getByText("You're all set!")).toBeTruthy()
    expect(
      screen.getByText(
        'Your sustainability dashboard is fully configured. Time to start uncovering insights.'
      )
    ).toBeTruthy()
  })

  it('should return null when dismissed', () => {
    mockProgressReturn.isDismissed = true

    const { container } = render(<GettingStartedWidget />)

    expect(container.innerHTML).toBe('')
  })

  it('should render loading skeleton when loading', () => {
    mockProgressReturn.isLoading = true

    render(<GettingStartedWidget />)

    expect(screen.getByText('Getting Started')).toBeTruthy()
    // Skeleton elements should be present (no milestone text visible)
    expect(screen.queryByText('Add a facility')).toBeNull()
  })

  it('should call dismiss when "Dismiss checklist" is clicked', () => {
    render(<GettingStartedWidget />)

    const dismissButton = screen.getByText('Dismiss checklist')
    fireEvent.click(dismissButton)

    expect(mockDismiss).toHaveBeenCalledOnce()
  })

  it('should render correct links for incomplete milestones', () => {
    render(<GettingStartedWidget />)

    const links = screen.getAllByRole('link')
    const hrefs = links.map((link) => link.getAttribute('href'))

    expect(hrefs).toContain('/company/facilities')
    expect(hrefs).toContain('/products/new')
    expect(hrefs).toContain('/suppliers')
    expect(hrefs).toContain('/settings')
  })

  it('should render a progress bar', () => {
    mockProgressReturn.percentage = 50

    const { container } = render(<GettingStartedWidget />)

    const progressBar = container.querySelector('[style*="width: 50%"]')
    expect(progressBar).toBeTruthy()
  })
})
