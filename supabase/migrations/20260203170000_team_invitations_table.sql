-- Team invitations table for pending member invites
-- Users are NOT created until they accept and complete signup
CREATE TABLE IF NOT EXISTS "public"."team_invitations" (
    "id" UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "organization_id" UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    "email" TEXT NOT NULL,
    "role_id" UUID NOT NULL REFERENCES roles(id),
    "invitation_token" UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
    "status" TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    "invited_by" UUID NOT NULL REFERENCES auth.users(id),
    "invited_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    "expires_at" TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days') NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(organization_id, email, status) -- Allow re-inviting if previous was cancelled/expired
);

-- Add RLS policies
ALTER TABLE "public"."team_invitations" ENABLE ROW LEVEL SECURITY;

-- Org owners/admins can view invitations for their org
CREATE POLICY "Org admins can view team invitations" ON "public"."team_invitations"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            JOIN roles r ON r.id = om.role_id
            WHERE om.organization_id = team_invitations.organization_id
            AND om.user_id = auth.uid()
            AND r.name IN ('owner', 'admin')
        )
    );

-- Org owners/admins can insert invitations
CREATE POLICY "Org admins can create team invitations" ON "public"."team_invitations"
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM organization_members om
            JOIN roles r ON r.id = om.role_id
            WHERE om.organization_id = team_invitations.organization_id
            AND om.user_id = auth.uid()
            AND r.name IN ('owner', 'admin')
        )
    );

-- Org owners/admins can update invitations (cancel)
CREATE POLICY "Org admins can update team invitations" ON "public"."team_invitations"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            JOIN roles r ON r.id = om.role_id
            WHERE om.organization_id = team_invitations.organization_id
            AND om.user_id = auth.uid()
            AND r.name IN ('owner', 'admin')
        )
    );

-- Public can read invitations by token (for acceptance page)
CREATE POLICY "Anyone can view invitation by token" ON "public"."team_invitations"
    FOR SELECT
    USING (true);

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email, status);
