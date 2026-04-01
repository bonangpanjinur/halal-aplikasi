import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Shield, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MemberPermission {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  permissions: {
    can_view_data: boolean;
    can_add_data: boolean;
    can_edit_data: boolean;
    can_delete_data: boolean;
    can_manage_members: boolean;
  };
}

interface GroupPermissionsManagerProps {
  groupId: string;
  isOwner: boolean;
}

const PERMISSION_CONFIG = {
  can_view_data: {
    label: "Lihat Data",
    description: "Dapat melihat semua data dalam grup",
    icon: "👁️",
  },
  can_add_data: {
    label: "Tambah Data",
    description: "Dapat menambahkan data baru ke grup",
    icon: "➕",
  },
  can_edit_data: {
    label: "Edit Data",
    description: "Dapat mengubah data yang ada",
    icon: "✏️",
  },
  can_delete_data: {
    label: "Hapus Data",
    description: "Dapat menghapus data dari grup",
    icon: "🗑️",
  },
  can_manage_members: {
    label: "Kelola Anggota",
    description: "Dapat menambah/menghapus anggota grup",
    icon: "👥",
  },
};

export default function GroupPermissionsManager({ groupId, isOwner }: GroupPermissionsManagerProps) {
  const [members, setMembers] = useState<MemberPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchMembersWithPermissions();
  }, [groupId]);

  const fetchMembersWithPermissions = async () => {
    setLoading(true);
    try {
      // Fetch group members
      const { data: groupMembers, error: gmError } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);

      if (gmError || !groupMembers) {
        toast({ title: "Error", description: "Gagal memuat anggota grup", variant: "destructive" });
        setLoading(false);
        return;
      }

      const userIds = groupMembers.map((m) => m.user_id);

      // Fetch profiles and roles
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);
      const { data: roles } = await supabase.from("user_roles").select("*").in("user_id", userIds);

      // Fetch permissions
      const { data: permissions } = await supabase
        .from("group_member_permissions")
        .select("*")
        .eq("group_id", groupId);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]));
      const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]));
      const permissionMap = new Map(
        permissions?.map((p) => [
          `${p.user_id}-${p.permission}`,
          true,
        ])
      );

      const membersData: MemberPermission[] = groupMembers.map((gm) => {
        const profile = profileMap.get(gm.user_id);
        return {
          user_id: gm.user_id,
          full_name: profile?.full_name || null,
          email: profile?.email || null,
          role: roleMap.get(gm.user_id) || null,
          permissions: {
            can_view_data: permissionMap.has(`${gm.user_id}-can_view_data`),
            can_add_data: permissionMap.has(`${gm.user_id}-can_add_data`),
            can_edit_data: permissionMap.has(`${gm.user_id}-can_edit_data`),
            can_delete_data: permissionMap.has(`${gm.user_id}-can_delete_data`),
            can_manage_members: permissionMap.has(`${gm.user_id}-can_manage_members`),
          },
        };
      });

      setMembers(membersData);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      toast({ title: "Error", description: "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = async (userId: string, permission: keyof typeof PERMISSION_CONFIG) => {
    if (!isOwner) {
      toast({ title: "Error", description: "Anda tidak memiliki akses untuk mengubah izin", variant: "destructive" });
      return;
    }

    setUpdating(userId);
    try {
      const member = members.find((m) => m.user_id === userId);
      if (!member) return;

      const hasPermission = member.permissions[permission];

      if (hasPermission) {
        // Remove permission
        const { error } = await supabase
          .from("group_member_permissions")
          .delete()
          .eq("group_id", groupId)
          .eq("user_id", userId)
          .eq("permission", permission);

        if (error) throw error;
      } else {
        // Add permission
        const { error } = await supabase.from("group_member_permissions").insert({
          group_id: groupId,
          user_id: userId,
          permission,
        });

        if (error) throw error;
      }

      // Update local state
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === userId
            ? {
                ...m,
                permissions: {
                  ...m.permissions,
                  [permission]: !hasPermission,
                },
              }
            : m
        )
      );

      toast({
        title: "Berhasil",
        description: `Izin "${PERMISSION_CONFIG[permission].label}" ${hasPermission ? "dihapus" : "ditambahkan"}`,
      });
    } catch (error) {
      console.error("Error updating permission:", error);
      toast({ title: "Error", description: "Gagal memperbarui izin", variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Kelola izin akses untuk setiap anggota grup. Pemilik grup dan super admin memiliki semua izin secara otomatis.
        </AlertDescription>
      </Alert>

      {members.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Belum ada anggota dalam grup
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {members.map((member) => (
            <Card key={member.user_id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{member.full_name || "Tanpa Nama"}</CardTitle>
                    <CardDescription className="text-xs">{member.email}</CardDescription>
                  </div>
                  {member.role && (
                    <Badge variant="outline" className="capitalize">
                      {member.role.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(PERMISSION_CONFIG).map(([permKey, permConfig]) => (
                    <div
                      key={permKey}
                      className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        id={`${member.user_id}-${permKey}`}
                        checked={member.permissions[permKey as keyof typeof PERMISSION_CONFIG]}
                        onCheckedChange={() =>
                          togglePermission(member.user_id, permKey as keyof typeof PERMISSION_CONFIG)
                        }
                        disabled={!isOwner || updating === member.user_id}
                      />
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor={`${member.user_id}-${permKey}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {permConfig.label}
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">{permConfig.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
