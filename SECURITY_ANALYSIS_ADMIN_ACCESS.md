# Security Analysis: Admin Access to Organizations and Profiles

## Summary
✅ **SAFE**: The new RLS policies only expose minimal metadata needed for the feedback system. Private business data remains fully protected.

---

## What Alkatera Admins CAN Now See

### 1. Organizations Table (Basic Metadata Only)
```sql
- id
- name
- slug
- description
- logo_url
- website
- created_at
- updated_at
```

**Purpose**: Required for the feedback system to display which organization submitted a ticket.

### 2. Profiles Table (Basic User Info Only)
```sql
- id
- email
- full_name
- avatar_url
- phone
- created_at
- updated_at
- is_alkatera_admin (boolean flag)
```

**Purpose**: Required for the feedback system to display who submitted a ticket.

---

## What Alkatera Admins CANNOT See

### Protected by `user_has_organization_access()` Function

The following tables use the `user_has_organization_access(organization_id)` RLS helper function, which ONLY grants access if:
1. User is a member of the organization, OR
2. User is an active authorized advisor

This function **does NOT check for `is_alkatera_admin`**, meaning admins have no access to:

#### Business Data Tables
- `products` - Product catalog and LCA data
- `product_lca` - Life cycle assessment data
- `product_lca_production_sites` - Production site information
- `facility_activity_entries` - Activity tracking data
- `supplier_products` - Supplier information
- `bom_imports` - Bill of materials imports
- `contract_manufacturer_allocations` - Manufacturing allocations

#### Reporting & Analytics
- `sustainability_reports` - Sustainability reports
- `sustainability_report_sections` - Report content
- `report_templates` - Custom templates
- `platform_analytics_events` - Usage analytics
- `organization_usage_tracking` - Resource usage data

#### Financial & Subscription
- `subscription_history` - Billing history
- `organization_tier_overrides` - Custom pricing
- `methodology_access` - LCA methodology access

#### Governance & Compliance
- `governance_policies` - Internal policies
- `ethics_reports` - Ethics reporting data
- `certifications` - Certification documents
- `audit_trails` - Audit logs

#### Environmental Data
- `water_consumption_data` - Water usage data
- `waste_circularity_profiles` - Waste management
- `packaging_circularity_profiles` - Packaging data
- `facility_emissions_aggregated` - Emissions data

#### Strategic Data
- `greenwash_guardian_checks` - Greenwashing checks
- `gaia_assessments` - AI assessments
- `rosa_knowledge_documents` - Private documents
- `advisor_sessions` - Advisor engagement data

---

## Why This Is Secure

1. **Principle of Least Privilege**: Admins only get access to the minimum data required for support tasks (viewing feedback tickets).

2. **Separation of Concerns**:
   - Organization metadata (public-facing info) is separate from business data
   - User profile info (contact details) is separate from their activity data

3. **Defense in Depth**: Even if an admin can see organization IDs, they cannot query organization-specific tables without being explicitly granted access through:
   - Organization membership
   - Advisor authorization

4. **No Transitive Access**: Just because admins can SELECT from `organizations` table doesn't mean they can JOIN to protected tables - each table enforces its own RLS.

---

## Testing Recommendation

To verify this security model:

1. **Log in as an Alkatera admin**
2. **Try to query private data** (should fail):
   ```sql
   SELECT * FROM products WHERE organization_id = '<some-org-id>';
   SELECT * FROM sustainability_reports WHERE organization_id = '<some-org-id>';
   ```
3. **View feedback ticket** (should succeed):
   ```sql
   SELECT * FROM feedback_tickets_with_users WHERE id = '<ticket-id>';
   ```

The feedback view should work (showing org name and creator name), but direct queries to business data tables should return zero rows due to RLS.

---

## Conclusion

✅ **The new RLS policies are safe and appropriate**:
- Admins can provide user support for the feedback system
- Private business data remains fully protected
- No sensitive financial, operational, or strategic data is exposed
