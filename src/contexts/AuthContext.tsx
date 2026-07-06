import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, Organization, OrgMember, AppRole } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  organizations: OrgMember[];
  roles: AppRole[];
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isSeller: boolean;
  isBuyer: boolean;
  primaryOrg: Organization | null;
  adminAssistOrg: Organization | null;
  isAdminAssistMode: boolean;
  startAdminSellerAssist: (orgId: string) => Promise<{ error: Error | null }>;
  exitAdminSellerAssist: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizations, setOrganizations] = useState<OrgMember[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adminAssistOrg, setAdminAssistOrg] = useState<Organization | null>(null);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Fetch organizations with org details
      const { data: orgData } = await supabase
        .from('org_members')
        .select('*, organization:organizations(*)')
        .eq('user_id', userId);
      
      if (orgData) {
        setOrganizations(orgData as OrgMember[]);
      }

      // Fetch roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (rolesData) {
        setRoles(rolesData.map(r => r.role as AppRole));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Keep loading=true until profile, orgs, and roles are populated so
          // RoleGuard does not redirect before roles are known.
          setIsLoading(true);
          setTimeout(() => {
            fetchUserData(session.user.id).finally(() => setIsLoading(false));
          }, 0);
        } else {
          setProfile(null);
          setOrganizations([]);
          setRoles([]);
          setAdminAssistOrg(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchUserData(session.user.id);
      }

      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName }
      }
    });
    
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  const isAdmin = roles.includes('admin');
  const isSeller = roles.some(r => r === 'seller_admin' || r === 'seller_staff');
  const isBuyer = roles.some(r => r === 'buyer_admin' || r === 'buyer_staff');

  useEffect(() => {
    if (!user || !isAdmin) {
      setAdminAssistOrg(null);
      return;
    }

    const storedOrgId = localStorage.getItem(`admin_seller_assist_org_${user.id}`);
    if (!storedOrgId) {
      setAdminAssistOrg(null);
      return;
    }

    supabase
      .from('organizations')
      .select('*')
      .eq('id', storedOrgId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          localStorage.removeItem(`admin_seller_assist_org_${user.id}`);
          setAdminAssistOrg(null);
          return;
        }
        setAdminAssistOrg(data as Organization);
      });
  }, [user, isAdmin]);
  
  const ownPrimaryOrg = organizations.find(o => o.is_primary)?.organization as Organization ?? 
                        organizations[0]?.organization as Organization ?? null;
  const primaryOrg = isAdmin && adminAssistOrg ? adminAssistOrg : ownPrimaryOrg;
  const isAdminAssistMode = isAdmin && Boolean(adminAssistOrg);

  const startAdminSellerAssist = async (orgId: string) => {
    if (!user || !isAdmin) {
      return { error: new Error('Admin access required') };
    }

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();

    if (error || !data) {
      return { error: new Error(error?.message ?? 'Seller organisation not found') };
    }

    const org = data as Organization;
    if (!['seller', 'fabricator'].includes(org.org_type)) {
      return { error: new Error('Only seller organisations can be assisted from the seller portal') };
    }

    const { error: logError } = await (supabase.rpc as any)('admin_log_seller_assist', {
      _seller_org_id: orgId,
      _action: 'enter_full_seller_portal_assist',
      _entity_type: 'organization',
      _entity_id: orgId,
      _metadata: { source: 'admin_sellers_table' },
      _target_user_id: null,
    });
    if (logError) {
      console.warn('Admin seller assist audit log failed:', logError.message);
    }

    localStorage.setItem(`admin_seller_assist_org_${user.id}`, orgId);
    setAdminAssistOrg(org);
    return { error: null };
  };

  const exitAdminSellerAssist = () => {
    if (user && adminAssistOrg?.id) {
      void (supabase.rpc as any)('admin_log_seller_assist', {
        _seller_org_id: adminAssistOrg.id,
        _action: 'exit_full_seller_portal_assist',
        _entity_type: 'organization',
        _entity_id: adminAssistOrg.id,
        _metadata: { source: 'app_layout' },
        _target_user_id: null,
      });
    }
    if (user) {
      localStorage.removeItem(`admin_seller_assist_org_${user.id}`);
    }
    setAdminAssistOrg(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      organizations,
      roles,
      isLoading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      isAdmin,
      isSeller,
      isBuyer,
      primaryOrg,
      adminAssistOrg,
      isAdminAssistMode,
      startAdminSellerAssist,
      exitAdminSellerAssist
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
