export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: 'HomeIcon' },
  {
    label: 'Corporate Footprint',
    icon: 'BuildingIcon',
    children: [
      { href: '/company/facilities', label: 'Facilities' },
      { href: '/data/scope-1-2', label: 'Scope 1 & 2 Data' },
      { href: '/data/water-footprint', label: 'Water Footprint' },
      { href: '/data/waste-and-circularity', label: 'Waste & Circularity' },
    ],
  },
  {
    label: 'Product LCA',
    icon: 'BoxIcon',
    children: [
      { href: '/lca-workbench', label: 'LCA Workbench' },
    ],
  },
  {
    label: 'Supply Chain',
    icon: 'TruckIcon',
    children: [
      { href: '/suppliers', label: 'Suppliers' },
      { href: '/supplier-portal/submit-data', label: 'Supplier Data Submissions' },
    ],
  },
  {
    label: 'Analytics & Reporting',
    icon: 'ChartBarIcon',
    children: [
      { href: '/kpis', label: 'KPI Dashboard' },
      { href: '/reports', label: 'Reports' },
      { href: '/reporting/calculations', label: 'Run Calculations' },
    ],
  },
  {
    label: 'Settings',
    icon: 'CogIcon',
    children: [
      { href: '/dashboard/settings/team', label: 'Team Management' },
      { href: '/settings', label: 'Company Settings' },
    ],
  },
];
