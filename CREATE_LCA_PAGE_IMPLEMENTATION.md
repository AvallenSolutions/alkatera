# Create LCA Page Implementation Summary

## Overview

A complete, production-ready Product LCA creation page has been implemented at `/lcas/create` that integrates the LcaMaterialClassifier component with a full form workflow for creating Product LCAs with materials tracking.

## Components Delivered

### 1. Database Migration

**File**: `supabase/migrations/20251115105117_create_product_lca_materials_table.sql`

Created `product_lca_materials` table with polymorphic relationship pattern:

```sql
CREATE TABLE product_lca_materials (
  id UUID PRIMARY KEY,
  product_lca_id UUID NOT NULL,      -- Links to product_lcas
  material_id UUID NOT NULL,          -- UUID of ingredient or packaging
  material_type TEXT NOT NULL,        -- 'ingredient' or 'packaging'
  quantity NUMERIC(10, 2) NOT NULL,   -- Amount used
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  CHECK (material_type IN ('ingredient', 'packaging')),
  CHECK (quantity > 0)
);
```

**Security Features**:
- RLS enabled with organisation-scoped access
- Cascading delete when parent LCA is deleted
- Validates material_type and positive quantity
- Comprehensive CRUD policies via product_lcas relationship

### 2. TypeScript Type Definitions

**File**: `lib/types/lca.ts`

Added comprehensive type definitions:

```typescript
export interface ProductLca {
  id: string;
  organization_id: string;
  product_name: string;
  functional_unit: string;
  system_boundary: string;
  status: 'draft' | 'pending' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface ProductLcaMaterial {
  id: string;
  product_lca_id: string;
  material_id: string;
  material_type: MaterialType;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface MaterialWithDetails extends MaterialSelectionOutput {
  name?: string;
  displayName?: string;
}
```

### 3. Data Fetching Hooks

**Files Created**:
- `hooks/data/useIngredients.ts`
- `hooks/data/usePackagingTypes.ts`

Features:
- Organisation-scoped data fetching
- LEFT JOIN to lca_sub_stages for ingredient classification
- Loading and error state management
- Automatic refetch capability

### 4. Material Selection Components

**Files Created**:
- `components/lca/MaterialCombobox.tsx` - Reusable searchable dropdown
- `components/lca/LcaMaterialClassifier.tsx` - Main classifier with tab interface

### 5. Create LCA Page

**File**: `app/(authenticated)/lcas/create/page.tsx`

## Page Features

### Form Fields

1. **Product Name** (required)
   - Text input
   - Validates non-empty before save

2. **Product Description** (optional)
   - Textarea for detailed description
   - Maps to `system_boundary` field if provided

3. **Functional Unit** (required)
   - Text input
   - Defines the reference unit for LCA (e.g., "1 kg", "1 litre")

### Material Selection Workflow

1. **LcaMaterialClassifier Integration**
   - Embedded directly in the page
   - Provides callback `onMaterialSelect`
   - Supports both ingredients and packaging selection

2. **Add Material Flow**
   ```
   User selects material → Enters quantity → Clicks "Add Material to List"
   ```

3. **Material Enrichment**
   - Looks up material name from ingredients or packaging_types
   - Creates MaterialWithDetails object with display information
   - Adds to local state array

### Materials Display

**Table View** showing:
- Material Name
- Type (Badge: ingredient/packaging)
- Quantity
- Remove button (Trash icon)

**Empty State** when no materials added:
- Helpful message prompting user to add materials

### Save Draft Functionality

**Validation Checks**:
- Organisation must be selected
- Product name required
- Functional unit required
- At least one material must be added

**Database Transaction Flow**:
```typescript
1. Insert into product_lcas table
   - Returns new LCA record with ID

2. Iterate materials array
   - Insert each material into product_lca_materials
   - Link via product_lca_id foreign key

3. On success
   - Show success message
   - Redirect to /products after 2 seconds

4. On error
   - Display error alert
   - Allow user to retry
```

**Error Handling**:
- Catches and displays Supabase errors
- Maintains form state on failure
- Console logs for debugging

## User Experience Features

### Loading States
- Save button shows "Saving..." during operation
- Form fields disabled during save
- Material classifier disabled during save

### Validation Feedback
- Save button disabled until all required fields filled
- Save button disabled until at least one material added
- Real-time validation on quantity input (no negatives)

### Success Flow
- Green alert on successful save
- Automatic redirect to products page
- 2-second delay allows user to see confirmation

### Navigation
- Cancel button returns to /products
- Preserves unsaved work (with browser prompt)

## Code Architecture

### State Management

```typescript
const [productName, setProductName] = useState("");
const [productDescription, setProductDescription] = useState("");
const [functionalUnit, setFunctionalUnit] = useState("");
const [materials, setMaterials] = useState<MaterialWithDetails[]>([]);
const [currentMaterial, setCurrentMaterial] = useState<MaterialSelectionOutput | null>(null);
const [isSaving, setIsSaving] = useState(false);
const [error, setError] = useState<string | null>(null);
const [success, setSuccess] = useState(false);
```

### Key Functions

**handleMaterialSelect**
- Receives MaterialSelectionOutput from classifier
- Stores in currentMaterial state
- Waits for user to click "Add Material to List"

**handleAddMaterial**
- Validates currentMaterial exists and quantity > 0
- Looks up material name from fetched data
- Enriches with display information
- Appends to materials array
- Clears currentMaterial

**handleRemoveMaterial**
- Removes material at specified index
- Updates materials array immutably

**handleSaveDraft**
- Validates all required fields
- Creates product_lcas record via Supabase
- Batch inserts all materials with foreign key
- Handles success/error states
- Redirects on success

## Security Considerations

1. **Organisation Scoping**
   - All queries filtered by current organization_id
   - RLS policies enforce data isolation

2. **Input Validation**
   - Required fields checked before save
   - Material type constrained to enum values
   - Quantity validated as positive number

3. **Error Handling**
   - Supabase errors caught and displayed safely
   - No sensitive data exposed in error messages
   - Console logging for debugging only

## Route Information

**URL**: `/lcas/create`

**Route Group**: `(authenticated)` - Requires authentication

**Access Pattern**:
```
/app/(authenticated)/lcas/create/page.tsx
```

## Dependencies

### UI Components
- Card, CardContent, CardHeader, CardTitle, CardDescription
- Input, Label, Textarea, Button
- Table, TableBody, TableCell, TableHead, TableHeader, TableRow
- Badge, Alert, AlertDescription

### Icons
- Trash2 (remove material)
- Save (save button)
- Package, Box (in classifier tabs)

### Data Hooks
- useOrganization (context)
- useIngredients (custom hook)
- usePackagingTypes (custom hook)

### Navigation
- useRouter (Next.js)

## Testing Checklist

- [x] Page renders correctly
- [x] Form fields update state properly
- [x] Material classifier integration works
- [x] Current material displays correctly
- [x] Add material button adds to list
- [x] Materials table displays correctly
- [x] Remove material button works
- [x] Save validation prevents empty submissions
- [x] Save creates product_lcas record
- [x] Save creates product_lca_materials records
- [x] Success message displays
- [x] Redirect occurs after success
- [x] Error messages display on failure
- [x] Loading states work correctly
- [x] Build completes successfully

## Usage Example

1. Navigate to `/lcas/create`
2. Enter product name: "Organic Coffee Blend 250g"
3. Enter description: "Premium single-origin coffee"
4. Enter functional unit: "1 kg"
5. Select "Ingredients" tab in classifier
6. Search and select "Coffee Beans"
7. Enter quantity: 0.95
8. Click "Add Material to List"
9. Select "Packaging" tab
10. Search and select "Aluminium Can 250g"
11. Enter quantity: 1
12. Click "Add Material to List"
13. Click "Save Draft"
14. View success message
15. Automatic redirect to products page

## Future Enhancements

1. **Duplicate Material Check**: Prevent adding same material twice
2. **Edit Material**: Allow inline editing of quantity
3. **Material Search**: Enhanced search with filters
4. **Import from Template**: Pre-fill from existing LCA
5. **Auto-save Draft**: Periodic save to prevent data loss
6. **Material Categories**: Group materials by classification
7. **Bulk Import**: CSV upload for materials
8. **Validation Rules**: Business logic for valid combinations
9. **Progress Indicator**: Show completion percentage
10. **Side Panel**: Show LCA classification breakdown

## Files Created/Modified

### New Files (10)
1. `supabase/migrations/20251115105117_create_product_lca_materials_table.sql`
2. `lib/types/lca.ts`
3. `hooks/data/useIngredients.ts`
4. `hooks/data/usePackagingTypes.ts`
5. `components/lca/MaterialCombobox.tsx`
6. `components/lca/LcaMaterialClassifier.tsx`
7. `app/(authenticated)/lcas/create/page.tsx`
8. `CREATE_LCA_PAGE_IMPLEMENTATION.md` (this file)

## Deployment Notes

1. Apply database migration first
2. No environment variables required
3. Requires existing organisations with material libraries
4. Users must be authenticated and have organisation membership
5. RLS policies automatically enforce security

## Conclusion

The Create LCA Page provides a complete, user-friendly workflow for creating Product LCAs with database-driven material selection. The integration of the LcaMaterialClassifier component ensures data integrity whilst the structured save process maintains referential integrity between product_lcas and product_lca_materials tables.

The implementation follows React best practices, maintains type safety throughout, and provides comprehensive error handling for a robust user experience.
