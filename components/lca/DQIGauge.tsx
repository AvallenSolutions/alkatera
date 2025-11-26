import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

interface DQIGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function DQIGauge({ score, size = 'md' }: DQIGaugeProps) {
  const getScoreConfig = (score: number) => {
    if (score >= 80) {
      return {
        level: 'High Confidence',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        fillColor: '#10b981',
        icon: CheckCircle2,
        badgeClass: 'bg-green-600',
        description: 'Primary data with full traceability',
      };
    } else if (score >= 50) {
      return {
        level: 'Medium Confidence',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        fillColor: '#f59e0b',
        icon: AlertTriangle,
        badgeClass: 'bg-amber-600',
        description: 'Mix of primary and secondary data',
      };
    } else {
      return {
        level: 'Modelled/Estimate',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        fillColor: '#ef4444',
        icon: AlertCircle,
        badgeClass: 'bg-red-600',
        description: 'Based on industry averages and estimates',
      };
    }
  };

  const config = getScoreConfig(score);
  const Icon = config.icon;

  const sizeConfig = {
    sm: {
      container: 'w-32 h-32',
      stroke: 8,
      text: 'text-2xl',
      subtext: 'text-xs',
      radius: 50,
    },
    md: {
      container: 'w-40 h-40',
      stroke: 10,
      text: 'text-3xl',
      subtext: 'text-sm',
      radius: 60,
    },
    lg: {
      container: 'w-48 h-48',
      stroke: 12,
      text: 'text-4xl',
      subtext: 'text-base',
      radius: 70,
    },
  };

  const { container, stroke, text, subtext, radius } = sizeConfig[size];
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card className={`${config.bgColor} border-2 ${config.borderColor}`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className={`h-5 w-5 ${config.color}`} />
          <h3 className="font-semibold text-sm">Data Quality Index</h3>
        </div>

        <div className="flex flex-col items-center gap-4">
          {/* Circular Gauge */}
          <div className={`relative ${container}`}>
            <svg className="transform -rotate-90" width="100%" height="100%" viewBox="0 0 160 160">
              {/* Background circle */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke="#e5e7eb"
                strokeWidth={stroke}
                fill="none"
              />
              {/* Progress circle */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke={config.fillColor}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Icon className={`h-8 w-8 ${config.color} mb-1`} />
              <span className={`${text} font-bold ${config.color}`}>{score}</span>
              <span className={`${subtext} text-muted-foreground`}>/ 100</span>
            </div>
          </div>

          {/* Status badge and description */}
          <div className="text-center space-y-2">
            <Badge variant="default" className={`${config.badgeClass} text-xs px-3 py-1`}>
              {config.level}
            </Badge>
            <p className="text-xs text-muted-foreground max-w-xs">
              {config.description}
            </p>
          </div>
        </div>

        {/* Trust signal explanation */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-muted-foreground">
            <strong>DQI Score:</strong> Reflects data provenance, completeness, and verification status.
            Scores above 80 indicate primary data suitable for CSRD and ISO 14044 compliance.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
