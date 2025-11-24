"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Factory, Package, Truck, Building, Users, Plane, Briefcase } from "lucide-react";

interface ScopeBreakdown {
  scope1: number;
  scope2: number;
  scope3: {
    products: number;
    business_travel: number;
    purchased_services: number;
    employee_commuting: number;
    total: number;
  };
  total: number;
}

interface CCFSankeyDashboardProps {
  breakdown: ScopeBreakdown;
  year: number;
}

export function CCFSankeyDashboard({ breakdown, year }: CCFSankeyDashboardProps) {
  // Format emissions for display
  const formatEmissions = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)} tCO₂e`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} tCO₂e`;
    }
    return `${value.toFixed(2)} kgCO₂e`;
  };

  // Calculate percentages
  const calculatePercentage = (value: number) => {
    return ((value / breakdown.total) * 100).toFixed(1);
  };

  // Data for scope breakdown chart
  const scopeData = [
    {
      name: "Scope 1",
      value: breakdown.scope1,
      percentage: calculatePercentage(breakdown.scope1),
      fill: "#ef4444",
    },
    {
      name: "Scope 2",
      value: breakdown.scope2,
      percentage: calculatePercentage(breakdown.scope2),
      fill: "#f59e0b",
    },
    {
      name: "Scope 3",
      value: breakdown.scope3.total,
      percentage: calculatePercentage(breakdown.scope3.total),
      fill: "#3b82f6",
    },
  ];

  // Data for Scope 3 breakdown
  const scope3Data = [
    {
      name: "Products",
      value: breakdown.scope3.products,
      percentage: calculatePercentage(breakdown.scope3.products),
      icon: <Package className="h-4 w-4" />,
      fill: "#3b82f6",
    },
    {
      name: "Business Travel",
      value: breakdown.scope3.business_travel,
      percentage: calculatePercentage(breakdown.scope3.business_travel),
      icon: <Plane className="h-4 w-4" />,
      fill: "#8b5cf6",
    },
    {
      name: "Purchased Services",
      value: breakdown.scope3.purchased_services,
      percentage: calculatePercentage(breakdown.scope3.purchased_services),
      icon: <Briefcase className="h-4 w-4" />,
      fill: "#ec4899",
    },
    {
      name: "Employee Commuting",
      value: breakdown.scope3.employee_commuting,
      percentage: calculatePercentage(breakdown.scope3.employee_commuting),
      icon: <Users className="h-4 w-4" />,
      fill: "#10b981",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-slate-900">
          <CardHeader className="pb-3">
            <CardDescription>Total Emissions ({year})</CardDescription>
            <CardTitle className="text-3xl">{formatEmissions(breakdown.total)}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Factory className="h-3 w-3" />
              Scope 1
            </CardDescription>
            <CardTitle className="text-2xl">{formatEmissions(breakdown.scope1)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{calculatePercentage(breakdown.scope1)}%</Badge>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Building className="h-3 w-3" />
              Scope 2
            </CardDescription>
            <CardTitle className="text-2xl">{formatEmissions(breakdown.scope2)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{calculatePercentage(breakdown.scope2)}%</Badge>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3" />
              Scope 3
            </CardDescription>
            <CardTitle className="text-2xl">{formatEmissions(breakdown.scope3.total)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{calculatePercentage(breakdown.scope3.total)}%</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scope3">Scope 3 Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Emissions by Scope</CardTitle>
              <CardDescription>
                Distribution of greenhouse gas emissions across all three scopes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={scopeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis
                    label={{ value: "kgCO₂e", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip
                    formatter={(value: any) => formatEmissions(value)}
                    labelStyle={{ color: "#000" }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {scopeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scope3" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scope 3 Category Breakdown</CardTitle>
              <CardDescription>
                Detailed analysis of value chain emissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scope3Data.map((category, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${category.fill}20` }}
                    >
                      <div style={{ color: category.fill }}>{category.icon}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{category.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatEmissions(category.value)} ({category.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${category.percentage}%`,
                            backgroundColor: category.fill,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scope 3 Chart</CardTitle>
              <CardDescription>
                Visual comparison of Scope 3 emission sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={scope3Data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis
                    label={{ value: "kgCO₂e", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip
                    formatter={(value: any) => formatEmissions(value)}
                    labelStyle={{ color: "#000" }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {scope3Data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
