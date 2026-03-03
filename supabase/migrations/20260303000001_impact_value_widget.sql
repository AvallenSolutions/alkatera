-- Add Impact Value widget to dashboard_widgets
INSERT INTO "public"."dashboard_widgets" (
  "id", "name", "description", "category", "default_size",
  "min_col_span", "max_col_span", "icon", "is_active",
  "requires_data", "sort_order", "created_at"
) VALUES (
  'impact-value',
  'Impact Value',
  'Total monetised value of your sustainability impact',
  'metrics',
  'standard',
  1,
  2,
  'TrendingUp',
  true,
  '{}',
  99,
  now()
) ON CONFLICT (id) DO NOTHING;
