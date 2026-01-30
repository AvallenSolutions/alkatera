#!/bin/bash
# =============================================================
# Supabase Migration Cleanup Script
# =============================================================
# This script replaces all broken/duplicate migration files
# with a single clean dump from your hosted Supabase database.
#
# PREREQUISITES:
#   1. Supabase CLI installed (npm install -g supabase)
#   2. Logged in to Supabase (supabase login)
#   3. Project linked (supabase link --project-ref dfcezkyaejrxmbwunhry)
#
# USAGE:
#   chmod +x scripts/cleanup-migrations.sh
#   ./scripts/cleanup-migrations.sh
# =============================================================

set -e

MIGRATIONS_DIR="supabase/migrations"
BACKUP_DIR="supabase/migrations_backup_$(date +%Y%m%d_%H%M%S)"

echo ""
echo "=========================================="
echo "  Supabase Migration Cleanup"
echo "=========================================="
echo ""

# Step 1: Check supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "ERROR: Supabase CLI is not installed."
    echo ""
    echo "Install it with:"
    echo "  npm install -g supabase"
    echo ""
    echo "Then log in:"
    echo "  supabase login"
    echo ""
    echo "Then link your project:"
    echo "  supabase link --project-ref dfcezkyaejrxmbwunhry"
    echo ""
    exit 1
fi

# Step 2: Backup existing migrations
echo "Step 1: Backing up existing migrations to $BACKUP_DIR ..."
mkdir -p "$BACKUP_DIR"
cp "$MIGRATIONS_DIR"/*.sql "$BACKUP_DIR/"
echo "  Done. $(ls "$BACKUP_DIR"/*.sql | wc -l) files backed up."
echo ""

# Step 3: Dump the remote schema
echo "Step 2: Dumping schema from hosted Supabase..."
DUMP_FILE="$MIGRATIONS_DIR/20251108000000_initial_schema.sql"
supabase db dump --linked > "$DUMP_FILE"
echo "  Done. Schema saved to $DUMP_FILE"
echo ""

# Step 4: Dump the seed data (roles data etc)
echo "Step 3: Dumping seed data from hosted Supabase..."
SEED_FILE="$MIGRATIONS_DIR/20251108000001_seed_data.sql"
supabase db dump --linked --data-only > "$SEED_FILE"
echo "  Done. Data saved to $SEED_FILE"
echo ""

# Step 5: Remove all old migration files (except the new ones)
echo "Step 4: Removing old migration files..."
for file in "$MIGRATIONS_DIR"/*.sql; do
    filename=$(basename "$file")
    if [ "$filename" != "20251108000000_initial_schema.sql" ] && [ "$filename" != "20251108000001_seed_data.sql" ]; then
        rm "$file"
    fi
done
echo "  Done. Old migrations removed."
echo ""

echo "=========================================="
echo "  Cleanup Complete!"
echo "=========================================="
echo ""
echo "You now have 2 clean migration files:"
echo "  1. 20251108000000_initial_schema.sql (full schema)"
echo "  2. 20251108000001_seed_data.sql (seed data)"
echo ""
echo "Your old migrations are backed up in:"
echo "  $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "  1. Run: supabase start"
echo "  2. Run: supabase db reset"
echo "  3. If it works, commit the changes!"
echo ""
