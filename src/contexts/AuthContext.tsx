import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
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
  const initialized = useRef(false);

  const fetchRole = async (userId: string) => {
    try {
      // Fetch role and profile in parallel for better performance
      const [roleResponse, profileResponse] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("owner_id")
          .eq("id", userId)
          .maybeSingle()
      ]);

      if (roleResponse.error) {
        console.error("Error fetching role:", roleResponse.error);
      }
      
      if (profileResponse.error) {
        console.error("Error fetching profile:", profileResponse.error);
      }

      setRole(roleResponse.data?.role ?? null);
      setOwnerId(profileResponse.data?.owner_id ?? null);
    } catch (error) {
      console.error("Unexpected error in fetchRole:", error);
      setRole(null);
      setOwnerId(null);
    }
  };

  useEffect(() => {
    // Handle auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        try {
          console.log("Auth state change:", event, currentSession?.user?.id);
          
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          
          if (currentSession?.user) {
            await fetchRole(currentSession.user.id);
          } else {
            setRole(null);
            setOwnerId(null);
          }
        } catch (error) {
          console.error("Error in auth state change:", error);
        } finally {
          setLoading(false);
          initialized.current = true;
        }
      }
    );

    // Initial session check
    const initSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        console.log("Initial session check:", initialSession?.user?.id);
        
        if (!initialized.current) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          
          if (initialSession?.user) {
            await fetchRole(initialSession.user.id);
          }
        }
      } catch (error) {
        console.error("Session initialization error:", error);
      } finally {
        setLoading(false);
        initialized.current = true;
      }
    };

    initSession();

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
