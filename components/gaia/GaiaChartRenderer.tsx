'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { GaiaChartData } from '@/lib/types/gaia';

interface GaiaChartRendererProps {
  chartData: GaiaChartData;
}

const CHART_COLORS = [
  '#10B981', // emerald-500
  '#14B8A6', // teal-500
  '#06B6D4', // cyan-500
  '#3B82F6', // blue-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
];

export function GaiaChartRenderer({ chartData }: GaiaChartRendererProps) {
  const { type, title, data, config } = chartData;

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  const renderTable = () => {
    const tableData = data as Record<string, unknown>[];
    if (!tableData || tableData.length === 0) return null;

    const headers = config?.headers || Object.keys(tableData[0] || {});

    return (
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header: string, i: number) => (
                <TableHead key={i} className="font-medium">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableData.map((row, rowIdx) => (
              <TableRow key={rowIdx}>
                {headers.map((header: string, cellIdx: number) => (
                  <TableCell key={cellIdx}>
                    {String(row[header] ?? row[Object.keys(row)[cellIdx]] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderBarChart = () => {
    const chartItems = data as Record<string, unknown>[];
    const xKey = config?.xKey || config?.labelKey || 'name';
    const yKey = config?.yKey || config?.valueKey || 'value';

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartItems} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey={xKey}
            className="text-xs fill-muted-foreground"
            tick={{ fontSize: 12 }}
          />
          <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          {config?.showLegend && <Legend />}
          <Bar
            dataKey={yKey}
            fill={CHART_COLORS[0]}
            radius={[4, 4, 0, 0]}
          >
            {chartItems.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={config?.colors?.[index % config.colors.length] || CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderPieChart = () => {
    const chartItems = data as Record<string, unknown>[];
    const labelKey = config?.labelKey || 'name';
    const valueKey = config?.valueKey || 'value';

    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartItems}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            outerRadius={100}
            innerRadius={type === 'donut' ? 60 : 0}
            dataKey={valueKey}
            nameKey={labelKey}
          >
            {chartItems.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={config?.colors?.[index % config.colors.length] || CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          {config?.showLegend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderLineChart = () => {
    const chartItems = data as Record<string, unknown>[];
    const xKey = config?.xKey || 'date';
    const yKey = config?.yKey || 'value';

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartItems} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey={xKey}
            className="text-xs fill-muted-foreground"
            tick={{ fontSize: 12 }}
          />
          <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          {config?.showLegend && <Legend />}
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={CHART_COLORS[0]}
            strokeWidth={2}
            dot={{ fill: CHART_COLORS[0], strokeWidth: 2 }}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderAreaChart = () => {
    const chartItems = data as Record<string, unknown>[];
    const xKey = config?.xKey || 'date';
    const yKey = config?.yKey || 'value';

    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartItems} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey={xKey}
            className="text-xs fill-muted-foreground"
            tick={{ fontSize: 12 }}
          />
          <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          {config?.showLegend && <Legend />}
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={CHART_COLORS[0]}
            fill={`${CHART_COLORS[0]}33`}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  const renderChart = () => {
    switch (type) {
      case 'table':
        return renderTable();
      case 'bar':
        return renderBarChart();
      case 'pie':
      case 'donut':
        return renderPieChart();
      case 'line':
        return renderLineChart();
      case 'area':
        return renderAreaChart();
      default:
        return renderTable();
    }
  };

  return (
    <Card className="bg-muted/30">
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={title ? 'pt-0' : 'pt-4'}>
        {renderChart()}
      </CardContent>
    </Card>
  );
}
