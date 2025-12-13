import { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PassportMetricCardProps {
  title: string;
  value: number | string;
  unit: string;
  icon: LucideIcon;
  description?: string;
  comparison?: {
    label: string;
    value: string;
  };
  color?: 'green' | 'blue' | 'orange' | 'purple';
}

const colorStyles = {
  green: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    icon: 'text-green-600',
  },
  blue: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    icon: 'text-blue-600',
  },
  orange: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    icon: 'text-orange-600',
  },
  purple: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    icon: 'text-purple-600',
  },
};

export default function PassportMetricCard({
  title,
  value,
  unit,
  icon: Icon,
  description,
  comparison,
  color = 'green',
}: PassportMetricCardProps) {
  const styles = colorStyles[color];

  return (
    <Card className="overflow-hidden border-neutral-200 shadow-sm hover:shadow-md transition-shadow bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-neutral-700">
            {title}
          </CardTitle>
          <div className={`p-2 rounded-lg ${styles.bg}`}>
            <Icon className={`h-4 w-4 ${styles.icon}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold ${styles.text}`}>
            {typeof value === 'number' ? value.toFixed(2) : value}
          </span>
          <span className="text-sm text-neutral-600">{unit}</span>
        </div>

        {description && (
          <p className="text-xs text-neutral-600">{description}</p>
        )}

        {comparison && (
          <Badge variant="outline" className="text-xs text-neutral-700">
            {comparison.label}: {comparison.value}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
