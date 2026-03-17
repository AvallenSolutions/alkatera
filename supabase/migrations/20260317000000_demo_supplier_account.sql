-- =============================================================================
-- Demo Supplier Account
-- =============================================================================
-- Creates a demo supplier with:
--   - Auth login: demo-supplier@alkatera.com / DemoSupplier2026!
--   - Organisation: "Demo Supplier Co" (supplier org)
--   - Platform supplier: "Demo Supplier Co" (verified)
--   - 8 supplier products across packaging and ingredients
-- =============================================================================

-- Fixed UUIDs for referential integrity
-- Demo supplier user
DO $$
DECLARE
  v_user_id UUID := 'e1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c';
  v_org_id UUID := 'f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5d';
  v_platform_supplier_id UUID := 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  v_owner_role_id UUID := '8b90b4ff-366c-4bdd-a349-b65f737fe5ef';
BEGIN

-- 1. Create auth user (password: DemoSupplier2026!)
INSERT INTO "auth"."users" (
  "instance_id", "id", "aud", "role", "email", "encrypted_password",
  "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at",
  "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change",
  "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data",
  "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at",
  "phone_change", "phone_change_token", "phone_change_sent_at",
  "email_change_token_current", "email_change_confirm_status", "banned_until",
  "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous"
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  v_user_id,
  'authenticated',
  'authenticated',
  'demo-supplier@alkatera.com',
  -- bcrypt hash of 'DemoSupplier2026!'
  '$2b$10$TrpWqlx3Ho3ryzeppvsa1ePcaUjiheHnfVBXUVWIYKe.sD9rlABIa',
  NOW(),
  NULL, '', NULL, '', NULL, '', '', NULL, NULL,
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object(
    'sub', v_user_id,
    'role', 'SUPPLIER',
    'email', 'demo-supplier@alkatera.com',
    'last_name', 'Supplier',
    'first_name', 'Demo',
    'company_name', 'Demo Supplier Co',
    'email_verified', true,
    'phone_verified', false
  ),
  NULL,
  NOW(), NOW(),
  NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false
) ON CONFLICT (id) DO NOTHING;

-- 2. Create auth identity
INSERT INTO "auth"."identities" (
  "provider_id", "user_id", "identity_data", "provider",
  "last_sign_in_at", "created_at", "updated_at", "id"
) VALUES (
  v_user_id::text,
  v_user_id,
  jsonb_build_object(
    'sub', v_user_id,
    'role', 'SUPPLIER',
    'email', 'demo-supplier@alkatera.com',
    'last_name', 'Supplier',
    'first_name', 'Demo',
    'company_name', 'Demo Supplier Co',
    'email_verified', false,
    'phone_verified', false
  ),
  'email',
  NOW(), NOW(), NOW(),
  gen_random_uuid()
) ON CONFLICT DO NOTHING;

-- 3. Create profile
INSERT INTO "public"."profiles" ("id", "email", "full_name", "avatar_url", "phone", "created_at", "updated_at", "is_alkatera_admin")
VALUES (v_user_id, 'demo-supplier@alkatera.com', 'Demo Supplier', NULL, NULL, NOW(), NOW(), false)
ON CONFLICT (id) DO NOTHING;

-- 4. Create organisation for the supplier
INSERT INTO "public"."organizations" (
  "id", "name", "slug", "description", "logo_url", "website",
  "created_at", "updated_at", "address", "city", "country",
  "industry_sector", "founding_year", "company_size",
  "subscription_tier", "subscription_status", "subscription_started_at",
  "subscription_expires_at", "methodology_access", "feature_flags",
  "billing_email", "current_product_count", "current_report_count_monthly",
  "report_count_reset_at", "current_lca_count", "address_lat", "address_lng",
  "is_platform_admin", "stripe_customer_id", "stripe_subscription_id"
) VALUES (
  v_org_id,
  'Demo Supplier Co',
  'demo-supplier-co',
  'Demo supplier organisation for testing supplier portal features',
  NULL, 'https://demo-supplier.example.com',
  NOW(), NOW(),
  '123 Packaging Lane', 'Manchester', 'United Kingdom',
  'Packaging & Ingredients', NULL, NULL,
  'seed', 'active', NOW(), NULL,
  '["recipe_2016"]', '{}',
  'demo-supplier@alkatera.com', 0, 0,
  NOW(), 0, 53.4808, -2.2426,
  false, NULL, NULL
) ON CONFLICT (id) DO NOTHING;

-- 5. Add user as owner of the organisation
INSERT INTO "public"."organization_members" ("id", "organization_id", "user_id", "role_id", "invited_by", "joined_at")
VALUES (gen_random_uuid(), v_org_id, v_user_id, v_owner_role_id, NULL, NOW())
ON CONFLICT DO NOTHING;

-- 6. Create platform supplier
INSERT INTO "public"."platform_suppliers" (
  "id", "name", "website", "contact_email", "contact_name",
  "industry_sector", "country", "description", "logo_url",
  "is_verified", "verification_date", "created_at", "updated_at", "created_by"
) VALUES (
  v_platform_supplier_id,
  'Demo Supplier Co',
  'https://demo-supplier.example.com',
  'demo-supplier@alkatera.com',
  'Demo Supplier',
  'Packaging & Ingredients',
  'United Kingdom',
  'Multi-category supplier providing glass packaging, closures, labels, and key beverage ingredients. Demo account for testing supplier portal features.',
  NULL,
  true, NOW(), NOW(), NOW(), NULL
) ON CONFLICT (id) DO NOTHING;

-- 7. Link platform supplier to alkatera Demo org
INSERT INTO "public"."organization_suppliers" (
  "id", "organization_id", "platform_supplier_id",
  "annual_spend", "spend_currency", "relationship_type",
  "engagement_status", "notes", "added_at", "updated_at", "added_by"
) VALUES (
  gen_random_uuid(),
  '2d86de84-e24e-458b-84b9-fd4057998bda', -- alkatera Demo org
  v_platform_supplier_id,
  120000, 'GBP', 'direct', 'active',
  'Demo supplier for testing',
  NOW(), NOW(), NULL
) ON CONFLICT DO NOTHING;

-- 8. Create platform supplier products - PACKAGING
-- 8a. Glass bottle (750ml wine/spirits)
INSERT INTO "public"."platform_supplier_products" (
  "id", "platform_supplier_id", "name", "description", "category",
  "unit", "carbon_intensity", "product_code", "product_image_url",
  "is_active", "is_verified", "verified_by", "verified_at", "verification_notes",
  "origin_address", "origin_lat", "origin_lng", "origin_country_code",
  "metadata", "created_at", "updated_at",
  "unit_measurement", "unit_measurement_type"
) VALUES (
  gen_random_uuid(), v_platform_supplier_id,
  'Flint Glass Bottle 750ml (35% recycled)',
  'Standard 750ml flint glass wine/spirits bottle manufactured with 35% recycled cullet. Cradle-to-gate carbon footprint verified by EPD.',
  'packaging',
  'kg', 0.8520, 'PKG-GL-750F',
  NULL, true, false, NULL, NULL, NULL,
  'Doncaster, South Yorkshire, UK', 53.5228, -1.1285, 'GB',
  '{"material": "glass", "recycled_content_pct": 35, "bottle_weight_g": 450, "colour": "flint", "closure_type": "cork"}',
  NOW(), NOW(), 450.0000, 'weight'
),
-- 8b. Amber glass bottle (330ml beer)
(
  gen_random_uuid(), v_platform_supplier_id,
  'Amber Glass Bottle 330ml',
  '330ml amber glass beer bottle with 50% recycled content. Lightweight design reducing transport emissions.',
  'packaging',
  'kg', 0.6340, 'PKG-GL-330A',
  NULL, true, false, NULL, NULL, NULL,
  'Barnsley, South Yorkshire, UK', 53.5529, -1.4793, 'GB',
  '{"material": "glass", "recycled_content_pct": 50, "bottle_weight_g": 200, "colour": "amber", "closure_type": "crown_cap"}',
  NOW(), NOW(), 200.0000, 'weight'
),
-- 8c. Aluminium can (330ml)
(
  gen_random_uuid(), v_platform_supplier_id,
  'Aluminium Can 330ml',
  'Standard 330ml aluminium beverage can with pull-tab end. 70% recycled aluminium content.',
  'packaging',
  'kg', 0.4200, 'PKG-AL-330',
  NULL, true, false, NULL, NULL, NULL,
  'Wrexham, Wales, UK', 53.0468, -2.9925, 'GB',
  '{"material": "aluminium", "recycled_content_pct": 70, "can_weight_g": 15, "closure_type": "pull_tab"}',
  NOW(), NOW(), 15.0000, 'weight'
),
-- 8d. Cork closure (natural)
(
  gen_random_uuid(), v_platform_supplier_id,
  'Natural Cork Closure 44x24mm',
  'Premium natural cork stopper for wine and spirits. FSC-certified Portuguese cork oak. Carbon-negative material.',
  'packaging',
  'unit', 0.0083, 'PKG-CK-4424',
  NULL, true, false, NULL, NULL, NULL,
  'Alentejo, Portugal', 38.5667, -7.9000, 'PT',
  '{"material": "cork", "type": "natural", "diameter_mm": 24, "length_mm": 44, "weight_g": 6}',
  NOW(), NOW(), 6.0000, 'weight'
),
-- 8e. Paper label (self-adhesive)
(
  gen_random_uuid(), v_platform_supplier_id,
  'Self-Adhesive Paper Label 90x120mm',
  'FSC-certified paper label with water-based adhesive. Suitable for wine and spirits bottles.',
  'packaging',
  'unit', 0.0032, 'PKG-LB-9012',
  NULL, true, false, NULL, NULL, NULL,
  'Leicester, UK', 52.6369, -1.1398, 'GB',
  '{"material": "paper", "fsc_certified": true, "dimensions_mm": "90x120", "adhesive": "water_based", "weight_g": 3}',
  NOW(), NOW(), 3.0000, 'weight'
);

-- 9. Create platform supplier products - INGREDIENTS
-- 9a. Malted barley
INSERT INTO "public"."platform_supplier_products" (
  "id", "platform_supplier_id", "name", "description", "category",
  "unit", "carbon_intensity", "product_code", "product_image_url",
  "is_active", "is_verified", "verified_by", "verified_at", "verification_notes",
  "origin_address", "origin_lat", "origin_lng", "origin_country_code",
  "metadata", "created_at", "updated_at",
  "unit_measurement", "unit_measurement_type"
) VALUES (
  gen_random_uuid(), v_platform_supplier_id,
  'Pale Malt (Spring Barley)',
  'UK-grown spring barley malted using low-carbon kiln process. Suitable for brewing and distilling. Verified carbon footprint per tonne.',
  'ingredient',
  'kg', 0.5100, 'ING-MLT-PALE',
  NULL, true, false, NULL, NULL, NULL,
  'Berwick-upon-Tweed, Northumberland, UK', 55.7711, -2.0070, 'GB',
  '{"grain_type": "spring_barley", "origin": "UK", "organic": false, "moisture_pct": 4.5}',
  NOW(), NOW(), 1000.0000, 'weight'
),
-- 9b. Cane sugar
(
  gen_random_uuid(), v_platform_supplier_id,
  'Cane Sugar (Refined)',
  'Refined cane sugar from sustainable Fairtrade-certified sources. Used in fermentation and sweetening.',
  'ingredient',
  'kg', 0.5700, 'ING-SUG-CANE',
  NULL, true, false, NULL, NULL, NULL,
  'Mauritius', -20.3484, 57.5522, 'MU',
  '{"sugar_type": "refined_cane", "fairtrade": true, "organic": false, "purity_pct": 99.8}',
  NOW(), NOW(), 1000.0000, 'weight'
),
-- 9c. Sauvignon Blanc grape juice
(
  gen_random_uuid(), v_platform_supplier_id,
  'Sauvignon Blanc Grape Must',
  'Fresh Sauvignon Blanc grape must from Marlborough, New Zealand. Primary data from estate vineyard with verified water and carbon footprint.',
  'ingredient',
  'kg', 0.3800, 'ING-GRP-SAUV',
  NULL, true, false, NULL, NULL, NULL,
  'Marlborough, New Zealand', -41.5134, 173.9612, 'NZ',
  '{"grape_variety": "sauvignon_blanc", "region": "Marlborough", "vintage": 2025, "brix": 22.5}',
  NOW(), NOW(), 1000.0000, 'weight'
);

END $$;
