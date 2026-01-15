#!/bin/bash

# Script to update all API routes to use the new getSupabaseAPIClient

FILES=(
  "app/api/people-culture/benefits/route.ts"
  "app/api/people-culture/dei-actions/route.ts"
  "app/api/people-culture/demographics/route.ts"
  "app/api/people-culture/surveys/route.ts"
  "app/api/people-culture/training/route.ts"
  "app/api/people-culture/score/route.ts"
  "app/api/governance/board/route.ts"
  "app/api/governance/score/route.ts"
  "app/api/governance/ethics/route.ts"
  "app/api/governance/mission/route.ts"
  "app/api/governance/lobbying/route.ts"
  "app/api/governance/policies/route.ts"
  "app/api/governance/stakeholders/route.ts"
  "app/api/community-impact/score/route.ts"
  "app/api/community-impact/stories/route.ts"
  "app/api/community-impact/donations/route.ts"
  "app/api/community-impact/volunteering/route.ts"
  "app/api/community-impact/local-impact/route.ts"
  "app/api/certifications/score/route.ts"
  "app/api/certifications/evidence/route.ts"
  "app/api/certifications/frameworks/route.ts"
  "app/api/certifications/gap-analysis/route.ts"
  "app/api/certifications/audit-packages/route.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Updating $file"
    # Update import statement
    sed -i "s/import { getSupabaseServerClient } from '@\/lib\/supabase\/server-client';/import { getSupabaseAPIClient } from '@\/lib\/supabase\/api-client';/g" "$file"

    # Update GET function
    sed -i "s/const supabase = getSupabaseServerClient();/const { client: supabase, user, error: authError } = await getSupabaseAPIClient();/g" "$file"

    # Update auth check
    sed -i "s/const { data: { user }, error: authError } = await supabase.auth.getUser();/\/\/ User already fetched by getSupabaseAPIClient/g" "$file"
  fi
done

echo "Update complete!"
