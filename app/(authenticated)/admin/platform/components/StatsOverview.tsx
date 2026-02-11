"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Building2,
  Package,
  Factory,
  CheckCircle,
  CreditCard,
  Sprout,
  Flower2,
  TreePine,
  UserPlus,
} from "lucide-react";
import type { PlatformStats } from "../types";

interface StatsOverviewProps {
  stats: PlatformStats | null;
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <>
      {/* Top-level metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users.total || 0}</div>
            <p className="text-xs text-gray-500">
              +{stats?.users.new_this_month || 0} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Organisations
            </CardTitle>
            <Building2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.organizations.total || 0}</div>
            <p className="text-xs text-gray-500">
              +{stats?.organizations.new_this_month || 0} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Products
            </CardTitle>
            <Package className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.content.total_products || 0}</div>
            <p className="text-xs text-gray-500">
              {stats?.content.total_lcas || 0} LCAs created
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Facilities
            </CardTitle>
            <Factory className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.content.total_facilities || 0}</div>
            <p className="text-xs text-gray-500">
              {stats?.content.total_suppliers || 0} suppliers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription overview */}
      {stats?.subscriptions && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active Subscriptions
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.subscriptions.by_status.active}</div>
              <p className="text-xs text-gray-500">
                {stats.subscriptions.by_status.trial} on trial
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Stripe Connected
              </CardTitle>
              <CreditCard className="h-4 w-4 text-violet-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.subscriptions.with_stripe}</div>
              <p className="text-xs text-gray-500">
                {stats.subscriptions.by_status.pending} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Tier Breakdown
              </CardTitle>
              <TreePine className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1">
                  <Sprout className="h-3 w-3 text-emerald-500" />
                  {stats.subscriptions.by_tier.seed}
                </span>
                <span className="flex items-center gap-1">
                  <Flower2 className="h-3 w-3 text-pink-500" />
                  {stats.subscriptions.by_tier.blossom}
                </span>
                <span className="flex items-center gap-1">
                  <TreePine className="h-3 w-3 text-teal-500" />
                  {stats.subscriptions.by_tier.canopy}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Seed / Blossom / Canopy
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Recent Sign-ups
              </CardTitle>
              <UserPlus className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.subscriptions.recent_signups_7d}</div>
              <p className="text-xs text-gray-500">last 7 days</p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
