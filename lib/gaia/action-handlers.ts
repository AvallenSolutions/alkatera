// Gaia Action Handlers
// Handles platform navigation, UI highlighting, and guided workflows
//
// IMPORTANT: Never refer to Gaia as "AI" or "AI agent" in any user-facing text.
// Use "digital assistant", "sustainability guide", or simply "Gaia".

import type {
  GaiaAction,
  GaiaUserContext,
  GaiaNavigatePayload,
  GaiaHighlightPayload,
} from '@/lib/types/gaia';

/**
 * Navigation map - maps natural language terms to actual routes
 */
const NAVIGATION_MAP: Record<string, string> = {
  // Main sections
  'dashboard': '/dashboard',
  'products': '/products',
  'company': '/company',
  'facilities': '/company/facilities',
  'fleet': '/company/fleet',
  'production allocation': '/company/production-allocation',
  'company emissions': '/company/emissions',
  'emissions': '/company/emissions',
  'vitality': '/company/vitality',
  'company vitality': '/company/vitality',
  'suppliers': '/suppliers',
  'people & culture': '/people-culture',
  'people and culture': '/people-culture',
  'governance': '/governance',
  'community impact': '/community-impact',
  'resources': '/resources',
  'certifications': '/certifications',
  'settings': '/settings',
  'gaia': '/gaia',

  // Common actions - products
  'add product': '/products/new',
  'add new product': '/products/new',
  'new product': '/products/new',
  'create product': '/products/new',

  // Common actions - facilities
  'add facility': '/company/facilities/new',
  'add new facility': '/company/facilities/new',
  'new facility': '/company/facilities/new',
  'create facility': '/company/facilities/new',

  // Common actions - suppliers
  'add supplier': '/suppliers/new',
  'new supplier': '/suppliers/new',

  // Common actions - fleet
  'add vehicle': '/company/fleet/new',
  'new vehicle': '/company/fleet/new',

  // Import/export
  'bulk import': '/import',
  'import': '/import',
  'upload data': '/import',
  'export': '/reports',
  'reports': '/reports',
};

/**
 * Page name map - maps routes to human-readable page names
 */
const PAGE_NAME_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/products': 'Products',
  '/products/new': 'Add New Product',
  '/company': 'Company Overview',
  '/company/facilities': 'Facilities',
  '/company/facilities/new': 'Add New Facility',
  '/company/fleet': 'Fleet',
  '/company/fleet/new': 'Add New Vehicle',
  '/company/production-allocation': 'Production Allocation',
  '/company/emissions': 'Company Emissions',
  '/company/vitality': 'Company Vitality',
  '/suppliers': 'Suppliers',
  '/suppliers/new': 'Add New Supplier',
  '/people-culture': 'People & Culture',
  '/governance': 'Governance',
  '/community-impact': 'Community Impact',
  '/resources': 'Resources',
  '/certifications': 'Certifications',
  '/settings': 'Settings',
  '/gaia': 'Gaia',
  '/reports': 'Reports',
  '/import': 'Bulk Import',
};

/**
 * Get human-readable page name from route
 */
export function getPageName(route: string): string {
  // Check exact match first
  if (PAGE_NAME_MAP[route]) {
    return PAGE_NAME_MAP[route];
  }

  // Check for dynamic routes (e.g., /products/[id])
  const basePath = route.replace(/\/[a-f0-9-]{36}(?:\/.*)?$/i, '');
  if (PAGE_NAME_MAP[basePath]) {
    return `${PAGE_NAME_MAP[basePath]} Details`;
  }

  // Fall back to capitalizing the last segment
  const segments = route.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] || 'Page';
  return lastSegment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Resolve a navigation path from natural language
 */
export function resolveNavigationPath(
  section: string,
  subsection?: string
): string | null {
  const key = subsection
    ? `${section.toLowerCase()} ${subsection.toLowerCase()}`.trim()
    : section.toLowerCase().trim();

  return NAVIGATION_MAP[key] || null;
}

/**
 * Parse navigation instructions from Gaia's response text
 */
export function parseActionsFromResponse(
  response: string,
  _context: GaiaUserContext
): GaiaAction[] {
  const actions: GaiaAction[] = [];
  const addedPaths = new Set<string>();

  // Navigation patterns to detect
  const navPatterns = [
    // "Go to Products > Add New Product"
    /Go to ([\w\s&]+)\s*(?:>|›)\s*([\w\s]+)/gi,
    // "Navigate to Products"
    /Navigate to ([\w\s&]+)/gi,
    // "Click the 'Products' link"
    /Click (?:on )?(?:the )?"?([\w\s&]+)"? (?:link|button|menu|tab)/gi,
    // "Open the Products page"
    /Open (?:the )?([\w\s&]+) page/gi,
    // "Go to Products in the sidebar"
    /Go to ([\w\s&]+) in (?:the )?sidebar/gi,
    // "Visit the Products page"
    /Visit (?:the )?([\w\s&]+)(?: page)?/gi,
  ];

  for (const pattern of navPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(response)) !== null) {
      const section = match[1]?.trim();
      const subsection = match[2]?.trim();

      if (section) {
        const destination = resolveNavigationPath(section, subsection);
        if (destination && !addedPaths.has(destination)) {
          addedPaths.add(destination);

          const label = subsection
            ? `Go to ${section} > ${subsection}`
            : `Go to ${section}`;

          actions.push({
            type: 'navigate',
            payload: {
              path: destination,
              label,
            } as GaiaNavigatePayload,
          });
        }
      }
    }
  }

  // Detect guided workflow mode
  const guidedPatterns = [
    /let me walk you through/i,
    /step by step/i,
    /I'll guide you/i,
    /follow these steps/i,
    /here's what to do/i,
  ];

  for (const pattern of guidedPatterns) {
    if (pattern.test(response)) {
      actions.push({
        type: 'message',
        payload: {
          mode: 'guided',
          persistent: true,
        },
      });
      break;
    }
  }

  return actions;
}

/**
 * GaiaActionHandler class for executing actions on the frontend
 */
export class GaiaActionHandler {
  private router: { push: (path: string) => void } | null = null;

  /**
   * Set the router instance (call this in the React component)
   */
  setRouter(router: { push: (path: string) => void }): void {
    this.router = router;
  }

  /**
   * Parse actions from Gaia's response
   */
  parseActionsFromResponse(response: string, context: GaiaUserContext): GaiaAction[] {
    return parseActionsFromResponse(response, context);
  }

  /**
   * Execute an action
   */
  executeAction(action: GaiaAction): void {
    switch (action.type) {
      case 'navigate':
        this.handleNavigate(action.payload as GaiaNavigatePayload);
        break;

      case 'highlight':
        this.handleHighlight(action.payload as GaiaHighlightPayload);
        break;

      case 'open_modal':
        this.handleOpenModal(action.payload);
        break;

      case 'message':
        this.handleMessage(action.payload);
        break;

      case 'prefill':
        // Prefill is handled differently - needs form context
        this.handlePrefill(action.payload);
        break;
    }
  }

  /**
   * Handle navigation action
   */
  private handleNavigate(payload: GaiaNavigatePayload): void {
    if (this.router && payload.path) {
      this.router.push(payload.path);
    } else if (typeof window !== 'undefined' && payload.path) {
      // Fallback to window.location
      window.location.href = payload.path;
    }
  }

  /**
   * Handle highlight action - highlights a UI element
   */
  private handleHighlight(payload: GaiaHighlightPayload): void {
    if (typeof window === 'undefined') return;

    const element = document.querySelector(payload.selector);
    if (element) {
      // Scroll element into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Add highlight class
      element.classList.add('gaia-highlight');

      // Remove after duration (default 3 seconds)
      const duration = payload.duration || 3000;
      setTimeout(() => {
        element.classList.remove('gaia-highlight');
      }, duration);
    }
  }

  /**
   * Handle open modal action
   */
  private handleOpenModal(payload: unknown): void {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(
      new CustomEvent('gaia:open-modal', {
        detail: payload,
      })
    );
  }

  /**
   * Handle message action (for guided mode)
   */
  private handleMessage(payload: unknown): void {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(
      new CustomEvent('gaia:message', {
        detail: payload,
      })
    );
  }

  /**
   * Handle prefill action
   */
  private handlePrefill(payload: unknown): void {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(
      new CustomEvent('gaia:prefill', {
        detail: payload,
      })
    );
  }
}

/**
 * Create a singleton instance of the action handler
 */
let actionHandlerInstance: GaiaActionHandler | null = null;

export function getActionHandler(): GaiaActionHandler {
  if (!actionHandlerInstance) {
    actionHandlerInstance = new GaiaActionHandler();
  }
  return actionHandlerInstance;
}

/**
 * Generate navigation suggestions based on current context
 */
export function getNavigationSuggestions(context: GaiaUserContext): GaiaAction[] {
  const suggestions: GaiaAction[] = [];

  // Suggest based on missing data
  if (context.missingData) {
    if (context.missingData.includes('products')) {
      suggestions.push({
        type: 'navigate',
        payload: {
          path: '/products/new',
          label: 'Add your first product',
        },
      });
    }
    if (context.missingData.includes('facilities')) {
      suggestions.push({
        type: 'navigate',
        payload: {
          path: '/company/facilities/new',
          label: 'Add a facility',
        },
      });
    }
  }

  // Suggest based on current page context
  if (context.currentRoute) {
    const route = context.currentRoute.toLowerCase();

    if (route.includes('products') && !route.includes('new')) {
      suggestions.push({
        type: 'navigate',
        payload: {
          path: '/products/new',
          label: 'Add new product',
        },
      });
    }

    if (route.includes('facilities') && !route.includes('new')) {
      suggestions.push({
        type: 'navigate',
        payload: {
          path: '/company/facilities/new',
          label: 'Add new facility',
        },
      });
    }
  }

  return suggestions.slice(0, 3);
}

export default {
  GaiaActionHandler,
  getActionHandler,
  parseActionsFromResponse,
  resolveNavigationPath,
  getPageName,
  getNavigationSuggestions,
};
