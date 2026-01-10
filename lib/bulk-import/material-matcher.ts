export type ConfidenceLevelName = 'high' | 'medium' | 'low' | 'none';

export interface ConfidenceLevel {
  level: ConfidenceLevelName;
  label: string;
  color: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
}

export interface MatchResult {
  material_id: string | null;
  material_name: string | null;
  confidence: number;
  confidence_level: ConfidenceLevel;
}

export function getConfidenceLevel(confidence: number | null): ConfidenceLevel {
  if (confidence === null || confidence === undefined || confidence === 0) {
    return { level: 'none', label: 'No Match', color: 'text-gray-400', badgeVariant: 'outline' };
  }
  if (confidence >= 0.8) {
    return { level: 'high', label: 'High', color: 'text-green-600', badgeVariant: 'default' };
  }
  if (confidence >= 0.5) {
    return { level: 'medium', label: 'Medium', color: 'text-amber-600', badgeVariant: 'secondary' };
  }
  return { level: 'low', label: 'Low', color: 'text-orange-600', badgeVariant: 'destructive' };
}

export function getConfidenceColor(level: ConfidenceLevel | ConfidenceLevelName): string {
  const levelName = typeof level === 'string' ? level : level.level;
  switch (levelName) {
    case 'high': return 'text-green-600';
    case 'medium': return 'text-amber-600';
    case 'low': return 'text-orange-600';
    case 'none': return 'text-gray-400';
    default: return 'text-gray-400';
  }
}

export function getConfidenceBadgeVariant(level: ConfidenceLevel | ConfidenceLevelName): 'default' | 'secondary' | 'destructive' | 'outline' {
  const levelName = typeof level === 'string' ? level : level.level;
  switch (levelName) {
    case 'high': return 'default';
    case 'medium': return 'secondary';
    case 'low': return 'destructive';
    case 'none': return 'outline';
    default: return 'outline';
  }
}

export async function matchMaterial(
  _name: string,
  _type: 'ingredient' | 'packaging'
): Promise<MatchResult> {
  return {
    material_id: null,
    material_name: null,
    confidence: 0,
    confidence_level: getConfidenceLevel(0)
  };
}
