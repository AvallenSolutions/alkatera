# Tier-Based Navigation Implementation

## Overview

The navigation system has been reorganised to provide progressive feature disclosure based on subscription tiers. Features are completely hidden if not available to the user's tier, creating a clean, uncluttered interface at each level.

## Key Changes

### 1. Scope 3 Now Available to All Tiers

**ALL** tiers (Seed, Blossom, and Canopy) now have full access to Scope 1, 2, and 3 emissions tracking through the "Company Emissions" menu item under the Company section.

### 2. Tier-Based Navigation Structure

#### Seed Tier (Level 1) - Entry Level
**Visible Navigation Items (7-8 items):**
- Dashboard
- Company
  - Overview
  - Facilities
  - Company Emissions (Scope 1, 2, and 3)
- Products
- Suppliers
- Knowledge Bank
- Reports
  - Sustainability Reports
- Settings

**Hidden Features:**
- Company Vitality
- Fleet management
- Production Allocation
- Social Impact (entire section)
- Greenwash Guardian
- Gaia AI Assistant
- Certifications
- LCA's & EPD's reports

#### Blossom Tier (Level 2) - Growth Stage
**Additional Features Unlocked:**
- Company Vitality
- Company > Fleet (with `vehicle_registry` feature)
- Company > Production Allocation
- Social Impact (new parent menu)
  - People & Culture
    - Overview
    - Fair Work
    - Diversity & Inclusion
    - Wellbeing
    - Training
- Greenwash Guardian
- Gaia AI Assistant
- Reports > LCA's & EPD's

**Still Hidden:**
- Governance
- Community Impact
- Certifications

#### Canopy Tier (Level 3) - Full Feature Access
**Additional Features Unlocked:**
- Certifications
- Social Impact menu expands to include:
  - Governance
    - Overview
    - Policies
    - Stakeholders
    - Board
    - Transparency
  - Community Impact
    - Overview
    - Charitable Giving
    - Local Impact
    - Volunteering
    - Impact Stories

## Technical Implementation

### Navigation Configuration

Each navigation item now includes:
```typescript
interface NavItem {
  name: string
  href: string
  icon: any
  children?: NavItem[]
  badge?: number
  minTier?: number // 1=Seed, 2=Blossom, 3=Canopy
  featureCode?: string // Optional feature code requirement
}
```

### Dynamic Social Impact Menu

The Social Impact parent menu is built dynamically based on tier:
- **Not visible** to Seed tier (level 1)
- **Visible with People & Culture only** to Blossom tier (level 2)
- **Fully expanded** with Governance and Community Impact at Canopy tier (level 3)

### Three-Level Navigation Support

The sidebar now supports three levels of nesting:
1. Top-level items (e.g., Social Impact)
2. Middle-level categories (e.g., People & Culture, Governance)
3. Individual pages (e.g., Fair Work, Diversity & Inclusion)

### Filtering Logic

Navigation items are filtered based on:
1. **Tier Level**: Items with `minTier` > current tier are hidden
2. **Feature Access**: Items with `featureCode` check against enabled features
3. **Children Filtering**: Parent items are hidden if all children are filtered out

## User Experience

### Progressive Disclosure
- Features appear as users upgrade tiers
- No "locked" or "upgrade" badges - features are simply absent
- Clean, focused interface at each tier level
- Navigation rebuilds dynamically when tier changes

### Consistency
- All tiers have access to core emissions tracking (Scopes 1, 2, and 3)
- Settings and basic functionality always visible
- Development section remains in development mode only

## Testing Recommendations

1. **Test with Seed tier**: Verify Social Impact section is completely hidden
2. **Test with Blossom tier**: Verify Social Impact appears with only People & Culture
3. **Test with Canopy tier**: Verify full Social Impact menu with all subsections
4. **Test Fleet feature**: Verify it only appears with `vehicle_registry` feature enabled
5. **Test navigation state**: Verify expanded menus persist correctly
6. **Test active states**: Verify current page highlighting works through all levels

## Benefits

1. **Cleaner UI**: Users only see features relevant to their tier
2. **Clear Upgrade Path**: Users naturally discover new features as they upgrade
3. **Better Performance**: Fewer menu items to render and manage
4. **Reduced Confusion**: No locked or disabled features cluttering the interface
5. **Scope 3 for Everyone**: Critical emissions tracking now available to all customers

## Migration Notes

- Existing users will see navigation automatically adjust to their tier
- No database changes required
- Social Impact grouping creates logical organisation without ESG terminology
- All tier checks use existing `useSubscription` hook
