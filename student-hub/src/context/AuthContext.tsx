import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, ensureSupabaseConfigured } from "@/lib/supabase";
import { api } from "@/services/api";

interface User {
  id: string;
  email: string;
  username: string;
  role: "student" | "teacher" | "admin" | "superadmin";
  avatar_url?: string | null;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadSession = async () => {
      try {
        ensureSupabaseConfigured();
      } catch (err: any) {
        console.error(err.message);
        setLoading(false);
        return;
      }

      // Get persisted session (if any) and set token for backend API
      const { data: sessionData } = await supabase.auth.getSession();
      const session = (sessionData as any)?.session;
      if (session?.access_token) {
        localStorage.setItem('token', session.access_token);
      }

      const { data } = await supabase.auth.getUser();
      if (data.user) await loadProfile(data.user.id);
      setLoading(false);
    };
    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      // session may be null when signed out
      if (session?.user) {
        if ((session as any)?.access_token) {
          localStorage.setItem('token', (session as any).access_token);
        }
        loadProfile(session.user.id);
      } else {
        localStorage.removeItem('token');
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      // Use backend route which fetches the profile server-side (bypasses RLS recursion issues)
      const response = await api.get(`/auth/profile/${userId}`);
      const profile = response.data?.data;
      setUser(profile || null);
      return profile || null;
    } catch (err: any) {
      console.error('loadProfile (server) error:', err?.response?.data || err.message || err);
      setUser(null);
      return null;
    }
  };

  const refreshProfile = async () => {
    try {
      ensureSupabaseConfigured();
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (userId) {
        await loadProfile(userId);
      }
    } catch (err: any) {
      console.error('refreshProfile error:', err?.message || err);
    }
  };

  const getRedirectPath = (role: string) => (role === "admin" ? "/admin" : "/dashboard");

  // LOGIN
  const login = async (email: string, password: string) => {
    ensureSupabaseConfigured();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error("User not returned from Supabase");

    // Persist token to be used by backend API
    if (data.session?.access_token) {
      localStorage.setItem('token', data.session.access_token);
    }

    const profile = await loadProfile(data.user.id);
    if (!profile) throw new Error('Unable to load user profile');

    navigate(getRedirectPath(profile.role));
  };

  // REGISTER - route through backend so profile insert runs with service-role key
  const register = async (username: string, email: string, password: string, role: string) => {
    ensureSupabaseConfigured();

    // Call backend register endpoint which uses the service role key server-side
    const response = await api.post('/auth/register', { username, email, password, role });

    // Backend returns { status: 'success', message, user: { id, username, role } }
    const registeredUser = response.data?.user;
    if (!registeredUser?.id) throw new Error('Registration failed: no user id returned from server');

    // Load the profile from Supabase profiles table and set state
    await loadProfile(registeredUser.id);

    // Redirect
    navigate(getRedirectPath(role));
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, refreshProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;
