"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Info, TrendingUp, TrendingDown, Minus, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface DataQualityConfidenceCardProps {
  facilityId: string;
  organizationId: string;
}

interface ConfidenceMetrics {
  total_entries: number;
  primary_verified_count: number;
  primary_measured_count: number;
  secondary_modelled_count: number;
  secondary_allocated_count: number;
  average_confidence_score: number;
  primary_data_percentage: number;
  confidence_rating: string;
}

const CONFIDENCE_COLORS = {
  high: { bg: "bg-green-500", text: "text-green-700", badge: "bg-green-100 text-green-800" },
  medium: { bg: "bg-amber-500", text: "text-amber-700", badge: "bg-amber-100 text-amber-800" },
  low: { bg: "bg-orange-500", text: "text-orange-700", badge: "bg-orange-100 text-orange-800" },
  very_low: { bg: "bg-red-500", text: "text-red-700", badge: "bg-red-100 text-red-800" },
};

export function DataQualityConfidenceCard({ facilityId, organizationId }: DataQualityConfidenceCardProps) {
  const [metrics, setMetrics] = useState<ConfidenceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const { data, error } = await supabase
          .from("facility_confidence_summary")
          .select("*")
          .eq("facility_id", facilityId)
          .maybeSingle();

        if (error) throw error;
        setMetrics(data);
      } catch (error) {
        console.error("Error loading confidence metrics:", error);
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, [facilityId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.total_entries === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            Data Quality Confidence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <p>No activity data recorded yet</p>
            <p className="text-sm mt-1">Add water, waste, or utility entries to see your data quality score</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const rating = metrics.confidence_rating as keyof typeof CONFIDENCE_COLORS;
  const colors = CONFIDENCE_COLORS[rating] || CONFIDENCE_COLORS.very_low;
  const confidenceScore = metrics.average_confidence_score || 0;
  const primaryPercentage = metrics.primary_data_percentage || 0;

  const getRatingLabel = (rating: string) => {
    switch (rating) {
      case "high": return "High Confidence";
      case "medium": return "Medium Confidence";
      case "low": return "Low Confidence";
      case "very_low": return "Very Low Confidence";
      default: return "Unknown";
    }
  };

  const getRecommendation = () => {
    if (primaryPercentage >= 80) {
      return {
        icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
        text: "Excellent! Most of your data comes from verified sources.",
        action: null,
      };
    } else if (primaryPercentage >= 50) {
      return {
        icon: <TrendingUp className="h-4 w-4 text-amber-600" />,
        text: "Good progress. Engage more suppliers to improve data quality.",
        action: "Request Supplier Data",
      };
    } else {
      return {
        icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
        text: "Most data is modelled. Contact suppliers for primary data.",
        action: "Engage Suppliers Now",
      };
    }
  };

  const recommendation = getRecommendation();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              Data Quality Confidence
            </CardTitle>
            <CardDescription>
              Glass Box transparency score for this facility
            </CardDescription>
          </div>
          <Badge className={colors.badge}>
            {getRatingLabel(rating)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall Confidence</span>
            <span className={`font-bold ${colors.text}`}>{confidenceScore.toFixed(0)}%</span>
          </div>
          <Progress value={confidenceScore} className="h-3" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {primaryPercentage.toFixed(0)}%
            </div>
            <div className="text-xs text-green-600 dark:text-green-500">Primary Data</div>
            <div className="text-xs text-muted-foreground mt-1">
              {(metrics.primary_verified_count || 0) + (metrics.primary_measured_count || 0)} of {metrics.total_entries} entries
            </div>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {(100 - primaryPercentage).toFixed(0)}%
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-500">Secondary/Modelled</div>
            <div className="text-xs text-muted-foreground mt-1">
              {(metrics.secondary_modelled_count || 0) + (metrics.secondary_allocated_count || 0)} of {metrics.total_entries} entries
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium">Data Source Breakdown</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Supplier Verified</span>
              </div>
              <span className="font-medium">{metrics.primary_verified_count || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span>Measured On-site</span>
              </div>
              <span className="font-medium">{metrics.primary_measured_count || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>Allocated from Facility</span>
              </div>
              <span className="font-medium">{metrics.secondary_allocated_count || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <span>Industry Average (Fallback)</span>
              </div>
              <span className="font-medium">{metrics.secondary_modelled_count || 0}</span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-start gap-2">
            {recommendation.icon}
            <div className="flex-1">
              <p className="text-sm">{recommendation.text}</p>
              {recommendation.action && (
                <Button variant="link" className="px-0 h-auto text-sm mt-1">
                  <Users className="h-3 w-3 mr-1" />
                  {recommendation.action}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
