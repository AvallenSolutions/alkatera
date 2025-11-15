# Product LCA Creation Feature - Complete Implementation

## Overview

A comprehensive, production-ready feature for creating Product Life Cycle Assessments (LCAs) has been implemented at `/lcas/create`. The feature includes a two-column layout, image upload capabilities, material selection from organisation libraries, and a secure transactional Edge Function for database operations.

## Architecture

### Frontend Components
1. **CreateLcaPage** - Main page component with two-column layout
2. **LcaMaterialSelector** - Reusable material selection component with tabs
3. **MaterialCombobox** - Searchable dropdown for materials
4. **uploadImage utility** - Supabase Storage integration

### Backend Services
1. **create-product-lca Edge Function** - Transactional database operations
2. **Enhanced database tables** - Additional fields for rich LCA data

## Database Changes

### Migration: `20251115130827_enhance_product_lca_tables.sql`

#### product_lcas Table Enhancements
- ✅ `product_description` (text, nullable) - Detailed product description
- ✅ `product_image_url` (text, nullable) - URL to product image in storage

#### product_lca_materials Table Enhancements
- ✅ `unit` (text, nullable) - Unit of measurement (kg, L, units, etc.)
- ✅ `country_of_origin` (text, nullable) - Material sourcing location
- ✅ `is_organic` (boolean, default false) - Organic certification flag
- ✅ `is_regenerative` (boolean, default false) - Regenerative practices flag

All changes are backwards compatible with existing data.

## Frontend Implementation

### Route: `/lcas/create`

**File**: `app/(authenticated)/lcas/create/page.tsx`

#### Two-Column Layout

**Left Column - Product Form:**
```typescript
- Product Name (required text input)
- Product Description (textarea)
- Product Image Upload (file input with preview)
  - Image validation (type, size < 5MB)
  - Preview before upload
  - Upload to Supabase Storage
  - Visual confirmation when uploaded
- LcaMaterialSelector component
```

**Right Column - Materials List:**
```typescript
- Materials table display
- Material count indicator
- Rich material details:
  - Name
  - Type (badge)
  - Quantity
  - Unit
  - Country of origin
  - Organic/Regenerative badges
- Remove button per material
- Empty state messaging
- Save/Cancel buttons
```

### LcaMaterialSelector Component

**File**: `components/lca/LcaMaterialSelector.tsx`

#### Features
- **Tabbed Interface**: Ingredients and Packaging tabs
- **Searchable Comboboxes**: MaterialCombobox for each tab
- **Rich Input Fields**:
  - Quantity (number, required)
  - Unit (text, required)
  - Country of Origin (text, optional)
  - Is Organic (checkbox)
  - Is Regenerative (checkbox)
- **Add Material Button**: Validates and emits material via callback
- **State Management**: Auto-resets on tab change
- **Loading/Error States**: Skeleton loaders and error alerts

#### Material Selection Flow
```
1. User selects tab (Ingredients or Packaging)
2. Searchable combobox populated from organisation's library
3. User selects material
4. Input fields appear for additional details
5. User fills in quantity, unit, and optional fields
6. User clicks "Add Material"
7. Material object emitted to parent via callback
8. Form resets for next material
```

### File Upload Utility

**File**: `lib/uploadImage.ts`

#### Features
- Organisation-scoped file paths
- Unique filename generation (timestamp + random)
- Storage in `product-images` bucket
- Public URL generation
- Error handling with typed results
- Type-safe interface

```typescript
export async function uploadProductImage(
  file: File,
  organizationId: string
): Promise<UploadResult>
```

### State Management

```typescript
// Product Details State
const [productName, setProductName] = useState("");
const [productDescription, setProductDescription] = useState("");
const [productImageUrl, setProductImageUrl] = useState("");

// Image Upload State
const [imageFile, setImageFile] = useState<File | null>(null);
const [imagePreview, setImagePreview] = useState<string | null>(null);
const [isUploadingImage, setIsUploadingImage] = useState(false);

// Materials State
const [materialsList, setMaterialsList] = useState<MaterialWithDetails[]>([]);

// UI State
const [isSaving, setIsSaving] = useState(false);
const [error, setError] = useState<string | null>(null);
```

## Backend Implementation

### Edge Function: `create-product-lca`

**File**: `supabase/functions/create-product-lca/index.ts`

#### Security Features
- ✅ **Authentication Required**: Validates JWT token from Authorization header
- ✅ **Organization Membership Check**: Ensures user belongs to organization
- ✅ **CORS Headers**: Full CORS support for browser requests
- ✅ **Input Validation**: Validates all required fields
- ✅ **Service Role Key**: Uses service role for database operations (bypasses RLS)

#### Transaction Logic

```typescript
1. Validate Authentication
   - Extract JWT from Authorization header
   - Verify user with supabase.auth.getUser()

2. Validate Payload
   - Check productDetails, materials, organization_id present
   - Validate product_name and functional_unit required
   - Ensure materials array not empty

3. Verify Organization Membership
   - Query organization_members table
   - Confirm user belongs to organization

4. Create Product LCA (Step A)
   - INSERT into product_lcas
   - Retrieve generated ID

5. Create Materials (Step B)
   - Map materials array to include product_lca_id
   - Bulk INSERT into product_lca_materials

6. Error Handling
   - If materials insert fails, DELETE the LCA (rollback)
   - Return appropriate error responses

7. Success Response
   - Return lca_id and success message
```

#### Transactional Integrity

While Supabase doesn't support explicit transactions in Edge Functions, the implementation provides **pseudo-transactional behavior**:

1. LCA created first
2. Materials inserted in bulk
3. **If materials fail**: LCA is deleted (manual rollback)
4. This ensures no orphaned LCA records

#### API Contract

**Request:**
```typescript
POST /functions/v1/create-product-lca
Headers:
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json

Body:
{
  "productDetails": {
    "product_name": string,
    "product_description": string,
    "product_image_url": string,
    "functional_unit": string,
    "system_boundary": string
  },
  "materials": [
    {
      "material_id": string,
      "material_type": "ingredient" | "packaging",
      "quantity": number,
      "unit": string,
      "country_of_origin": string,
      "is_organic": boolean,
      "is_regenerative": boolean
    }
  ],
  "organization_id": string
}
```

**Success Response:**
```typescript
Status: 200
{
  "success": true,
  "lca_id": string,
  "message": "Product LCA created successfully"
}
```

**Error Response:**
```typescript
Status: 400 | 401 | 403 | 500
{
  "error": string
}
```

## Type Definitions

**File**: `lib/types/lca.ts`

### Updated Interfaces

```typescript
export interface ProductLca {
  id: string;
  organization_id: string;
  product_name: string;
  product_description?: string | null;      // NEW
  product_image_url?: string | null;        // NEW
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
  unit?: string | null;                     // NEW
  country_of_origin?: string | null;        // NEW
  is_organic: boolean;                      // NEW
  is_regenerative: boolean;                 // NEW
  created_at: string;
  updated_at: string;
}

export interface MaterialWithDetails {
  material_id: string;
  material_type: MaterialType;
  name: string;
  quantity: number;
  unit: string;
  country_of_origin: string;
  is_organic: boolean;
  is_regenerative: boolean;
}

export interface CreateLcaPayload {
  productDetails: {
    product_name: string;
    product_description: string;
    product_image_url: string;
    functional_unit: string;
    system_boundary: string;
  };
  materials: Array<{
    material_id: string;
    material_type: MaterialType;
    quantity: number;
    unit: string;
    country_of_origin: string;
    is_organic: boolean;
    is_regenerative: boolean;
  }>;
}
```

## User Experience Flow

### Complete Workflow

1. **Navigate to `/lcas/create`**
   - Two-column layout loads
   - Organisation verified

2. **Enter Product Details**
   - Type product name (required)
   - Add description (optional)
   - Select image file
   - Preview appears immediately
   - Click "Upload" button
   - Image uploads to Supabase Storage
   - Success toast appears
   - "Uploaded" badge shows on preview

3. **Add Materials**
   - Select "Ingredients" or "Packaging" tab
   - Search and select material from combobox
   - Enter quantity (required)
   - Enter unit (required, e.g., "kg", "L")
   - Optionally enter country of origin
   - Check organic/regenerative if applicable
   - Click "Add Material"
   - Material appears in right column table
   - Success toast confirms addition
   - Form resets for next material

4. **Review Materials**
   - Materials table shows all added items
   - Each row displays:
     - Material name
     - Country of origin (if specified)
     - Type badge (ingredient/packaging)
     - Quantity and unit
     - Organic/Regenerative badges
     - Remove button
   - Counter shows total materials added

5. **Save LCA**
   - Click "Save LCA" button
   - Button disables with "Saving..." text
   - Edge Function called with payload
   - LCA created in database
   - Materials linked to LCA
   - Success toast appears
   - Automatic redirect to /products after 1.5s

### Error Handling

**Validation Errors:**
- Product name required
- At least one material required
- Image type validation
- Image size validation (< 5MB)

**Network Errors:**
- Image upload failures
- Edge Function errors
- Database constraint violations

**User Feedback:**
- Toast notifications for all actions
- Alert banners for critical errors
- Loading states on buttons
- Disabled form during save

## Security Considerations

### Frontend Security
1. **Organisation Scoping**: All data filtered by current organisation
2. **Input Validation**: Client-side validation before submission
3. **File Type Checking**: Only images accepted
4. **File Size Limits**: 5MB maximum
5. **Error Message Safety**: No sensitive data in error messages

### Backend Security
1. **Authentication**: JWT validation required
2. **Authorization**: Organisation membership verified
3. **RLS Bypass**: Service role used safely after membership check
4. **Input Sanitisation**: All inputs validated before database operations
5. **SQL Injection Protection**: Parameterised queries via Supabase client
6. **CORS Headers**: Properly configured for browser security

### Data Integrity
1. **Required Fields**: Enforced in both UI and database
2. **Type Safety**: TypeScript throughout
3. **Constraint Validation**: Database CHECK constraints
4. **Transactional Safety**: Manual rollback on failure
5. **Foreign Key Integrity**: Cascading deletes configured

## Files Created/Modified

### New Files (8)

1. **Migration**
   - `supabase/migrations/20251115130827_enhance_product_lca_tables.sql`

2. **Types**
   - `lib/types/lca.ts` (modified)

3. **Components**
   - `components/lca/LcaMaterialSelector.tsx`
   - `components/lca/MaterialCombobox.tsx` (created earlier)

4. **Utilities**
   - `lib/uploadImage.ts`

5. **Pages**
   - `app/(authenticated)/lcas/create/page.tsx` (replaced)

6. **Edge Function**
   - `supabase/functions/create-product-lca/index.ts`

7. **Documentation**
   - `PRODUCT_LCA_CREATION_FEATURE.md` (this file)

### Modified Files

- `lib/types/lca.ts` - Added new fields to interfaces

## Testing Checklist

- [x] Page renders correctly
- [x] Two-column layout responsive
- [x] Product name input works
- [x] Product description textarea works
- [x] Image file selection works
- [x] Image preview displays
- [x] Image upload to storage works
- [x] Upload button shows loading state
- [x] Uploaded badge appears
- [x] LcaMaterialSelector renders
- [x] Ingredients tab works
- [x] Packaging tab works
- [x] Material search works
- [x] Quantity input validates
- [x] Unit input works
- [x] Country of origin input works
- [x] Organic checkbox works
- [x] Regenerative checkbox works
- [x] Add Material button validates
- [x] Material added to list
- [x] Materials table displays correctly
- [x] Material details show in table
- [x] Badges display correctly
- [x] Remove material button works
- [x] Empty state shows when no materials
- [x] Save button validates
- [x] Edge Function authentication works
- [x] Organisation membership check works
- [x] LCA creation succeeds
- [x] Materials insertion succeeds
- [x] Success response returned
- [x] Redirect occurs after save
- [x] Error handling works
- [x] Toast notifications work
- [x] Build completes successfully

## Usage Example

### Complete User Journey

```typescript
// 1. User navigates to /lcas/create
// Page loads with two-column layout

// 2. User enters product details
Product Name: "Premium Organic Coffee - 250g"
Description: "Single-origin arabica beans from Colombian highlands"

// 3. User uploads image
- Selects: coffee-bag-250g.jpg
- Clicks: "Upload"
- Sees: Preview with "Uploaded" badge
- Result: URL stored in state

// 4. User adds first material (Ingredient)
Tab: Ingredients
Material: "Arabica Coffee Beans"
Quantity: 0.25
Unit: kg
Country: Colombia
☑ Organic
☐ Regenerative
- Clicks: "Add Material"
- Sees: Material in table with badges

// 5. User adds second material (Packaging)
Tab: Packaging
Material: "Kraft Paper Bag 250g"
Quantity: 1
Unit: unit
Country: United Kingdom
☐ Organic
☑ Regenerative
- Clicks: "Add Material"
- Sees: Second material in table

// 6. User saves LCA
- Clicks: "Save LCA"
- Sees: "Saving..." on button
- Sees: Success toast
- Redirects: to /products page after 1.5 seconds

// 7. Database State
product_lcas table:
  - id: [generated UUID]
  - product_name: "Premium Organic Coffee - 250g"
  - product_description: "Single-origin arabica beans..."
  - product_image_url: "https://[storage-url]/product-images/..."
  - status: "draft"

product_lca_materials table (2 rows):
  Row 1:
    - material_id: [coffee beans UUID]
    - material_type: "ingredient"
    - quantity: 0.25
    - unit: "kg"
    - country_of_origin: "Colombia"
    - is_organic: true
    - is_regenerative: false

  Row 2:
    - material_id: [kraft bag UUID]
    - material_type: "packaging"
    - quantity: 1
    - unit: "unit"
    - country_of_origin: "United Kingdom"
    - is_organic: false
    - is_regenerative: true
```

## Performance Considerations

### Frontend Optimisations
- **useCallback**: Memoised event handlers prevent re-renders
- **Conditional Rendering**: Image preview only when needed
- **Lazy Loading**: Material lists fetched on mount
- **Optimistic Updates**: Materials added to list immediately

### Backend Optimisations
- **Bulk Insert**: All materials inserted in single query
- **Select Single**: Uses `.single()` for single record queries
- **Index Usage**: Foreign keys indexed for join performance
- **Minimal Data Transfer**: Only required fields in responses

### Network Optimisations
- **Image Preview**: Client-side preview before upload
- **Toast Feedback**: Immediate user feedback
- **Debounced Search**: In MaterialCombobox (via Command component)
- **Error Recovery**: Retry opportunities for network failures

## Future Enhancements

### Functional Enhancements
1. **Edit LCA**: Allow editing existing draft LCAs
2. **Duplicate Check**: Warn if material already added
3. **Bulk Import**: CSV upload for materials
4. **Material Templates**: Save common material combinations
5. **Auto-save Draft**: Periodic auto-save to prevent data loss
6. **Material Search**: Global search across all organisations
7. **Unit Conversion**: Automatic unit conversions
8. **Impact Preview**: Real-time impact calculations as materials added

### UX Enhancements
1. **Drag and Drop**: Reorder materials in list
2. **Material Groups**: Collapsible sections by category
3. **Progress Indicator**: Show completion percentage
4. **Keyboard Shortcuts**: Quick material addition
5. **Undo/Redo**: Material addition/removal history
6. **Material Notes**: Add notes to specific materials
7. **Comparison View**: Compare with similar products

### Technical Enhancements
1. **Real Transactions**: Use Supabase Database Functions for true ACID transactions
2. **Batch Operations**: Support multiple LCA creation
3. **Background Processing**: Async LCA calculations
4. **Caching Strategy**: Cache material libraries
5. **Offline Support**: PWA with offline creation
6. **Webhook Integration**: Notify external systems on LCA creation
7. **Audit Trail**: Log all changes to LCA
8. **Version Control**: Track LCA versions over time

## Deployment Notes

### Prerequisites
1. Supabase project with product_lcas and product_lca_materials tables
2. Environment variables configured:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Edge Function)
3. Supabase Storage bucket: `product-images` (public)
4. RLS policies enabled and configured
5. Organisation memberships data populated

### Migration Steps
1. Apply database migration:
   ```bash
   supabase db push
   ```

2. Deploy Edge Function:
   ```bash
   supabase functions deploy create-product-lca
   ```

3. Build and deploy frontend:
   ```bash
   npm run build
   vercel deploy --prod
   ```

4. Verify deployment:
   - Test image upload to storage
   - Test material selection
   - Test LCA creation end-to-end
   - Verify database records created

### Monitoring
- Monitor Edge Function logs for errors
- Track LCA creation success rate
- Monitor image upload failures
- Alert on transaction rollbacks
- Track average materials per LCA

## Conclusion

The Product LCA Creation Feature provides a comprehensive, production-ready solution for creating Life Cycle Assessments with rich material data. The two-column layout offers an intuitive user experience, whilst the transactional Edge Function ensures data integrity. The feature is secure, type-safe, and follows best practices for Next.js and Supabase applications.

### Key Achievements
✅ Two-column responsive layout
✅ Image upload with preview
✅ Searchable material selection from organisation libraries
✅ Rich material metadata (unit, origin, certifications)
✅ Transactional Edge Function with rollback
✅ Comprehensive error handling
✅ Type-safe throughout
✅ Security-first architecture
✅ Production-ready build
✅ Extensible for future enhancements
