import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";

interface SupplierPermissions {
  canInviteSuppliers: boolean;
  canCreateSuppliers: boolean;
  canEditSuppliers: boolean;
  canDeleteSuppliers: boolean;
  isLoading: boolean;
}

export function useSupplierPermissions(): SupplierPermissions {
  const { currentOrganization } = useOrganization();
  const [permissions, setPermissions] = useState<SupplierPermissions>({
    canInviteSuppliers: false,
    canCreateSuppliers: false,
    canEditSuppliers: false,
    canDeleteSuppliers: false,
    isLoading: true,
  });

  useEffect(() => {
    async function checkPermissions() {
      if (!currentOrganization?.id) {
        setPermissions({
          canInviteSuppliers: false,
          canCreateSuppliers: false,
          canEditSuppliers: false,
          canDeleteSuppliers: false,
          isLoading: false,
        });
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setPermissions({
            canInviteSuppliers: false,
            canCreateSuppliers: false,
            canEditSuppliers: false,
            canDeleteSuppliers: false,
            isLoading: false,
          });
          return;
        }

        const { data: roleData, error: roleError } = await supabase.rpc(
          "get_my_organization_role",
          { org_id: currentOrganization.id }
        );

        if (roleError) {
          console.error("Error checking organization role:", roleError);
          setPermissions({
            canInviteSuppliers: true,
            canCreateSuppliers: false,
            canEditSuppliers: false,
            canDeleteSuppliers: false,
            isLoading: false,
          });
          return;
        }

        const isOrgAdmin = roleData === "company_admin";

        const { data: alkateraAdminData, error: alkateraError } = await supabase.rpc(
          "is_alkatera_admin"
        );

        if (alkateraError) {
          console.error("Error checking Alkatera admin status:", alkateraError);
        }

        const isAlkateraAdmin = alkateraAdminData === true;

        const hasAdminAccess = isOrgAdmin || isAlkateraAdmin;

        setPermissions({
          canInviteSuppliers: true,
          canCreateSuppliers: hasAdminAccess,
          canEditSuppliers: hasAdminAccess,
          canDeleteSuppliers: hasAdminAccess,
          isLoading: false,
        });
      } catch (error) {
        console.error("Error checking supplier permissions:", error);
        setPermissions({
          canInviteSuppliers: false,
          canCreateSuppliers: false,
          canEditSuppliers: false,
          canDeleteSuppliers: false,
          isLoading: false,
        });
      }
    }

    checkPermissions();
  }, [currentOrganization?.id]);

  return permissions;
}
