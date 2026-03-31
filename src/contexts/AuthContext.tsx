import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  owner_id: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  owner_id: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [owner_id, setOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    try {
      // Fetch role from user_roles with retry logic
      let { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      // If we get a 406 error (not found), it might be a timing issue
      // Try again after a short delay
      if (roleError && roleError.code === "PGRST116") {
        console.warn("Role not found on first attempt, retrying...");
        await new Promise(resolve => setTimeout(resolve, 500));
        const retry = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .single();
        roleData = retry.data;
        roleError = retry.error;
      }

      if (roleError) {
        console.error("Error fetching role:", roleError);
      }
      setRole(roleData?.role ?? null);

      // Fetch owner_id from profiles
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("owner_id")
        .eq("id", userId)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
      }
      setOwnerId(profileData?.owner_id ?? null);
    } catch (error) {
      console.error("Unexpected error in fetchRole:", error);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Add a small delay to ensure database is ready
          setTimeout(() => fetchRole(session.user.id), 100);
        } else {
          setRole(null);
          setOwnerId(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Add a small delay to ensure database is ready
        setTimeout(() => fetchRole(session.user.id), 100);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setUser(null);
      setSession(null);
      setRole(null);
      setOwnerId(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, role, owner_id, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
