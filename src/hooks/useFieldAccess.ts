import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface FieldAccess {
  field_name: string;
  can_view: boolean;
  can_edit: boolean;
}

export function useFieldAccess(targetRole?: string) {
  const { role } = useAuth();
  const [fields, setFields] = useState<FieldAccess[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveRole = targetRole || role;
  // Only super_admin has unrestricted field access across all tenants
  // Owner has full access to their own tenant data (enforced by RLS at database level)
  const isSuperRole = effectiveRole === "super_admin";

  useEffect(() => {
    if (!effectiveRole) return;
    // Super admin and owner don't need field access configuration
    if (isSuperRole || effectiveRole === "owner") {
      setFields([]);
      setLoading(false);
      return;
    }
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("field_access")
        .select("field_name, can_view, can_edit")
        .eq("role", effectiveRole as any);
      setFields((data as FieldAccess[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, [effectiveRole]);

  const canView = (field: string) => {
    // Super admin has full access
    if (isSuperRole) return true;
    // Owner has full access to their own data (enforced by RLS at database level)
    if (effectiveRole === "owner") return true;
    // Other roles follow field access configuration
    return fields.find((f) => f.field_name === field)?.can_view ?? false;
  };
  const canEdit = (field: string) => {
    // Super admin has full access
    if (isSuperRole) return true;
    // Owner has full access to their own data (enforced by RLS at database level)
    if (effectiveRole === "owner") return true;
    // Other roles follow field access configuration
    return fields.find((f) => f.field_name === field)?.can_edit ?? false;
  };

  return { fields, loading, canView, canEdit };
}

export function useAllFieldAccess() {
  const [allAccess, setAllAccess] = useState<Record<string, FieldAccess[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase.from("field_access").select("*");
      const grouped: Record<string, FieldAccess[]> = {};
      (data ?? []).forEach((row: any) => {
        if (!grouped[row.role]) grouped[row.role] = [];
        grouped[row.role].push({
          field_name: row.field_name,
          can_view: row.can_view,
          can_edit: row.can_edit,
        });
      });
      setAllAccess(grouped);
      setLoading(false);
    };
    fetch();
  }, []);

  return { allAccess, loading, refetch: () => {
    const fetch = async () => {
      const { data } = await supabase.from("field_access").select("*");
      const grouped: Record<string, FieldAccess[]> = {};
      (data ?? []).forEach((row: any) => {
        if (!grouped[row.role]) grouped[row.role] = [];
        grouped[row.role].push({
          field_name: row.field_name,
          can_view: row.can_view,
          can_edit: row.can_edit,
        });
      });
      setAllAccess(grouped);
    };
    fetch();
  }};
}
