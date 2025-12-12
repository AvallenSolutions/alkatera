"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Building2,
  Package,
  Factory,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  Shield,
  BarChart3,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useIsAlkateraAdmin } from "@/hooks/usePermissions";
import { formatDistanceToNow } from "date-fns";

interface PlatformStats {
  users: {
    total: number;
    new_this_month: number;
    new_this_week: number;
  };
  organizations: {
    total: number;
    new_this_month: number;
    with_products: number;
    with_facilities: number;
  };
  content: {
    total_products: number;
    total_facilities: number;
    total_suppliers: number;
    total_lcas: number;
  };
  pending_approvals: {
    activity_data: number;
    facilities: number;
    products: number;
    suppliers: number;
  };
  verification: {
    unverified_supplier_products: number;
  };
  generated_at: string;
}

interface FeatureAdoption {
  products_module: { organizations_using: number; adoption_rate: number };
  facilities_module: { organizations_using: number; adoption_rate: number };
  suppliers_module: { organizations_using: number; adoption_rate: number };
  lca_module: { organizations_using: number; adoption_rate: number };
  total_organizations: number;
}

interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  member_count: number;
  product_count: number;
  facility_count: number;
}

export default function PlatformDashboardPage() {
  const { isAlkateraAdmin, isLoading: authLoading } = useIsAlkateraAdmin();
  const isDevelopment = process.env.NODE_ENV === 'development';
  const hasAccess = isAlkateraAdmin || isDevelopment;
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [featureAdoption, setFeatureAdoption] = useState<FeatureAdoption | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [statsResult, adoptionResult, orgsResult] = await Promise.all([
        supabase.rpc("get_platform_statistics"),
        supabase.rpc("get_feature_adoption"),
        supabase.rpc("get_platform_organizations"),
      ]);

      if (statsResult.data && !statsResult.data.error) {
        setStats(statsResult.data);
      }
      if (adoptionResult.data && !adoptionResult.data.error) {
        setFeatureAdoption(adoptionResult.data);
      }
      if (orgsResult.data && !orgsResult.data.error) {
        setOrganizations(orgsResult.data || []);
      }
    } catch (err) {
      console.error("Error fetching platform data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      fetchData();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [hasAccess, authLoading]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (authLoading || loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            This page is only accessible to Alkatera platform administrators.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalPending = stats
    ? stats.pending_approvals.activity_data +
      stats.pending_approvals.facilities +
      stats.pending_approvals.products +
      stats.pending_approvals.suppliers
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Platform Dashboard
            </h1>
            {isDevelopment && !isAlkateraAdmin && (
              <Badge variant="secondary" className="text-xs">
                Development Mode
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Platform-wide analytics and metrics (no private data)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Pending Approvals
            </CardTitle>
            <CardDescription>
              Data submissions awaiting admin approval across all organisations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalPending === 0 ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                No pending approvals
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Activity Data</span>
                  <Badge variant={stats?.pending_approvals.activity_data ? "secondary" : "outline"}>
                    {stats?.pending_approvals.activity_data || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Facilities</span>
                  <Badge variant={stats?.pending_approvals.facilities ? "secondary" : "outline"}>
                    {stats?.pending_approvals.facilities || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Products</span>
                  <Badge variant={stats?.pending_approvals.products ? "secondary" : "outline"}>
                    {stats?.pending_approvals.products || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Suppliers</span>
                  <Badge variant={stats?.pending_approvals.suppliers ? "secondary" : "outline"}>
                    {stats?.pending_approvals.suppliers || 0}
                  </Badge>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between font-medium">
                    <span>Total Pending</span>
                    <Badge>{totalPending}</Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Feature Adoption
            </CardTitle>
            <CardDescription>
              Module usage across {featureAdoption?.total_organizations || 0} organisations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">Products Module</span>
                  <span className="text-sm font-medium">
                    {featureAdoption?.products_module.adoption_rate || 0}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${featureAdoption?.products_module.adoption_rate || 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">Facilities Module</span>
                  <span className="text-sm font-medium">
                    {featureAdoption?.facilities_module.adoption_rate || 0}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${featureAdoption?.facilities_module.adoption_rate || 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">Suppliers Module</span>
                  <span className="text-sm font-medium">
                    {featureAdoption?.suppliers_module.adoption_rate || 0}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${featureAdoption?.suppliers_module.adoption_rate || 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">LCA Module</span>
                  <span className="text-sm font-medium">
                    {featureAdoption?.lca_module.adoption_rate || 0}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full"
                    style={{ width: `${featureAdoption?.lca_module.adoption_rate || 0}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {stats?.verification.unverified_supplier_products ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Supplier Products Pending Verification</AlertTitle>
          <AlertDescription>
            There are {stats.verification.unverified_supplier_products} supplier products
            awaiting verification. Visit the{" "}
            <a href="/admin/supplier-verification" className="underline font-medium">
              verification queue
            </a>{" "}
            to review them.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Organisations</CardTitle>
          <CardDescription>
            All registered organisations (activity counts only, no private data)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="text-right">Facilities</TableHead>
                <TableHead className="text-right">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">
                    No organisations found
                  </TableCell>
                </TableRow>
              ) : (
                organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell className="text-right">{org.member_count}</TableCell>
                    <TableCell className="text-right">{org.product_count}</TableCell>
                    <TableCell className="text-right">{org.facility_count}</TableCell>
                    <TableCell className="text-right text-gray-500 text-sm">
                      {formatDistanceToNow(new Date(org.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
