"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";

export type Permission =
  | "data.submit"
  | "data.submit_direct"
  | "data.approve"
  | "data.view"
  | "data.export"
  | "reports.create"
  | "reports.download"
  | "reports.publish"
  | "lca.create"
  | "lca.edit"
  | "lca.run_calculations"
  | "lca.finalize"
  | "lca.view"
  | "admin.manage_users"
  | "admin.edit_organization"
  | "admin.manage_settings"
  | "admin.view_audit_log"
  | "platform.view_analytics"
  | "platform.manage_organizations"
  | "platform.verify_data";

export type UserRole = "alkatera_admin" | "company_admin" | "company_user" | "advisor";

interface PermissionsState {
  permissions: Permission[];
  userRole: UserRole | null;
  isAlkateraAdmin: boolean;
  isOrgAdmin: boolean;
  isOrgUser: boolean;
  isAdvisor: boolean;
  isLoading: boolean;
  canSubmitDirectly: boolean;
  canApproveData: boolean;
  pendingApprovalCount: number;
}

export function usePermissions(): PermissionsState & {
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  refreshPermissions: () => Promise<void>;
} {
  const { currentOrganization } = useOrganization();
  const [state, setState] = useState<PermissionsState>({
    permissions: [],
    userRole: null,
    isAlkateraAdmin: false,
    isOrgAdmin: false,
    isOrgUser: false,
    isAdvisor: false,
    isLoading: true,
    canSubmitDirectly: false,
    canApproveData: false,
    pendingApprovalCount: 0,
  });

  const fetchPermissions = useCallback(async () => {
    if (!currentOrganization?.id) {
      setState((prev) => ({
        ...prev,
        permissions: [],
        userRole: null,
        isAlkateraAdmin: false,
        isOrgAdmin: false,
        isOrgUser: false,
        isAdvisor: false,
        isLoading: false,
        canSubmitDirectly: false,
        canApproveData: false,
        pendingApprovalCount: 0,
      }));
      return;
    }

    try {
      const [
        permissionsResult,
        roleResult,
        alkateraResult,
        canSubmitResult,
        canApproveResult,
        pendingCountResult,
      ] = await Promise.all([
        supabase.rpc("get_user_permissions", { org_id: currentOrganization.id }),
        supabase.rpc("get_my_organization_role", { org_id: currentOrganization.id }),
        supabase.rpc("is_alkatera_admin"),
        supabase.rpc("can_submit_directly", { org_id: currentOrganization.id }),
        supabase.rpc("can_approve_data", { org_id: currentOrganization.id }),
        supabase.rpc("get_pending_approval_count"),
      ]);

      const permissions = (permissionsResult.data as Permission[]) || [];
      const userRole = roleResult.data as UserRole | null;
      const isAlkateraAdmin = alkateraResult.data === true;
      const canSubmitDirectly = canSubmitResult.data === true;
      const canApproveData = canApproveResult.data === true;
      const pendingApprovalCount = (pendingCountResult.data as number) || 0;

      setState({
        permissions,
        userRole,
        isAlkateraAdmin,
        isOrgAdmin: userRole === "company_admin" || isAlkateraAdmin,
        isOrgUser: userRole === "company_user",
        isAdvisor: userRole === "advisor",
        isLoading: false,
        canSubmitDirectly,
        canApproveData,
        pendingApprovalCount,
      });
    } catch (error) {
      console.error("Error fetching permissions:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (state.isAlkateraAdmin) {
        if (permission.startsWith("platform.")) {
          return true;
        }
      }
      return state.permissions.includes(permission);
    },
    [state.permissions, state.isAlkateraAdmin]
  );

  const hasAnyPermission = useCallback(
    (permissions: Permission[]): boolean => {
      return permissions.some((p) => hasPermission(p));
    },
    [hasPermission]
  );

  const hasAllPermissions = useCallback(
    (permissions: Permission[]): boolean => {
      return permissions.every((p) => hasPermission(p));
    },
    [hasPermission]
  );

  return {
    ...state,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions: fetchPermissions,
  };
}

export function useIsAlkateraAdmin(): {
  isAlkateraAdmin: boolean;
  isLoading: boolean;
} {
  const [isAlkateraAdmin, setIsAlkateraAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      try {
        const { data, error } = await supabase.rpc("is_alkatera_admin");
        if (!error) {
          setIsAlkateraAdmin(data === true);
        }
      } catch (err) {
        console.error("Error checking Alkatera admin status:", err);
      } finally {
        setIsLoading(false);
      }
    }
    checkAdmin();
  }, []);

  return { isAlkateraAdmin, isLoading };
}

export function useIsAdvisor(): {
  isAdvisor: boolean;
  isAccreditedAdvisor: boolean;
  isLoading: boolean;
} {
  const [isAdvisor, setIsAdvisor] = useState(false);
  const [isAccreditedAdvisor, setIsAccreditedAdvisor] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAdvisor() {
      try {
        const { data, error } = await supabase.rpc("is_accredited_advisor");
        if (!error) {
          setIsAccreditedAdvisor(data === true);
          setIsAdvisor(data === true);
        }
      } catch (err) {
        console.error("Error checking advisor status:", err);
      } finally {
        setIsLoading(false);
      }
    }
    checkAdvisor();
  }, []);

  return { isAdvisor, isAccreditedAdvisor, isLoading };
}

export interface AdvisorOrganization {
  organization_id: string;
  organization_name: string;
  granted_at: string;
}

export function useAdvisorOrganizations(): {
  organizations: AdvisorOrganization[];
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const [organizations, setOrganizations] = useState<AdvisorOrganization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrganizations = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_advisor_organizations");
      if (!error && data) {
        setOrganizations(data);
      }
    } catch (err) {
      console.error("Error fetching advisor organizations:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  return { organizations, isLoading, refresh: fetchOrganizations };
}

export function usePendingApprovals(): {
  pendingCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const { currentOrganization } = useOrganization();
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    if (!currentOrganization?.id) {
      setPendingCount(0);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_pending_approval_count");
      if (!error) {
        setPendingCount(data || 0);
      }
    } catch (err) {
      console.error("Error fetching pending approval count:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return { pendingCount, isLoading, refresh: fetchCount };
}
