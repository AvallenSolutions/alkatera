# Platform Admin Setup Guide

This guide will help you set up platform administrators for AlkaTera.

## Step 1: Run the Admin System Migration

In Supabase SQL Editor, run the migration file:
```
supabase/migrations/20260104000013_platform_admin_careful_order.sql
```

Or copy and paste the entire contents of that file into the SQL Editor and click **Run**.

**Important**: This migration creates a platform admin organization that sits above the normal subscription system. It carefully handles the constraint update by dropping the old constraint first, then allowing NULL values for the platform admin org while keeping your existing tier values (seed, blossom, canopy) intact.

## Step 2: Make Yourself a Platform Admin

### Quick Method (Recommended)

Just run this single SQL command with your email:

```sql
-- Replace 'your-email@example.com' with your actual email
SELECT * FROM add_platform_admin('your-email@example.com');
```

You should see:
```
success | message                                    | user_id | organization_id
--------|--------------------------------------------|---------|-----------------
true    | Successfully added your@email.com as...    | <uuid>  | <uuid>
```

### Manual Method (Alternative)

If the quick method doesn't work, run this:

```sql
-- Step 1: Find your user ID
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Step 2: Run this with your user ID
DO $$
DECLARE
  v_user_id uuid := 'YOUR_USER_ID_HERE';  -- Replace with ID from step 1
BEGIN
  -- Create profile
  INSERT INTO profiles (id, email, full_name)
  SELECT id, email, email FROM auth.users WHERE id = v_user_id
  ON CONFLICT (id) DO NOTHING;

  -- Add to platform admin org
  INSERT INTO organization_members (organization_id, user_id, role_id)
  VALUES (
    (SELECT id FROM organizations WHERE slug = 'alkatera'),
    v_user_id,
    (SELECT id FROM roles WHERE name = 'owner')
  )
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET role_id = (SELECT id FROM roles WHERE name = 'owner');
END $$;
```

## Step 3: Verify Admin Access

```sql
-- Check if you're an admin
SELECT is_alkatera_admin() as "Am I Admin?";
-- Should return: true

-- List all platform admins
SELECT * FROM list_platform_admins();
```

## Step 4: Log Out and Back In

1. Log out of your AlkaTera account
2. Log back in to refresh your session
3. Navigate to `www.alkatera.com/admin/blog`
4. You should now have access! 🎉

---

## Managing Other Admins

### Add Another Admin

```sql
SELECT * FROM add_platform_admin('colleague@example.com');
```

### Remove an Admin

```sql
SELECT * FROM remove_platform_admin('colleague@example.com');
```

### List All Admins

```sql
SELECT * FROM list_platform_admins();
```

---

## What This Admin System Does

✅ **Independent of Subscriptions** - Platform admins aren't subject to subscription tier limits
✅ **Separate Organization** - The "AlkaTera Platform" org is marked as `is_platform_admin = true`
✅ **Full Access** - Platform admins can:
  - Manage all blog posts
  - Access all admin routes (`/admin/*`)
  - View analytics across all organizations
  - Manage the entire platform

✅ **Easy Management** - Simple SQL functions to add/remove admins

---

## Troubleshooting

**"User not found"**
- Make sure you've created an account first (sign up at www.alkatera.com/signup)
- Or create a user manually in Supabase → Authentication → Users

**"Still can't access /admin/blog"**
- Verify `is_alkatera_admin()` returns `true`
- Log out and log back in
- Check browser console for errors

**"Need to create signup page"**
- Let me know and I can create a signup page for you

---

## Quick Reference

```sql
-- One-liner to make yourself admin
SELECT * FROM add_platform_admin('your@email.com');

-- Verify
SELECT is_alkatera_admin();

-- List all admins
SELECT * FROM list_platform_admins();
```
