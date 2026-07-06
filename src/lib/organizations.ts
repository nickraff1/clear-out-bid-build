import { supabase } from '@/integrations/supabase/client';

type MarketplaceRole = 'buyer' | 'seller';

interface EnsureRoleOrganizationArgs {
  userId: string;
  email?: string | null;
  fullName?: string | null;
  role: MarketplaceRole;
  isPrimary?: boolean;
}

const organizationNameForRole = (fullName: string | null | undefined, role: MarketplaceRole) => {
  if (fullName) {
    return `${fullName}'s ${role === 'seller' ? 'Business' : 'Account'}`;
  }
  return `My ${role === 'seller' ? 'Business' : 'Account'}`;
};

export async function ensureUserRoleOrganization({
  userId,
  email,
  fullName,
  role,
  isPrimary = false,
}: EnsureRoleOrganizationArgs) {
  const existing = await supabase
    .from('org_members')
    .select('id, org_id, organization:organizations!inner(*)')
    .eq('user_id', userId)
    .eq('organization.org_type', role)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data?.organization) {
    const roleValue = role === 'seller' ? 'seller_admin' : 'buyer_admin';
    await supabase.from('user_roles').upsert({ user_id: userId, role: roleValue }, { onConflict: 'user_id,role' });
    return existing.data.organization;
  }

  const org = await supabase
    .from('organizations')
    .insert({
      name: organizationNameForRole(fullName, role),
      org_type: role,
      email,
      is_approved: true,
    })
    .select()
    .single();

  if (org.error) throw org.error;

  const member = await supabase
    .from('org_members')
    .insert({
      org_id: org.data.id,
      user_id: userId,
      is_primary: isPrimary,
    });

  if (member.error) throw member.error;

  const roleValue = role === 'seller' ? 'seller_admin' : 'buyer_admin';
  const userRole = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: roleValue }, { onConflict: 'user_id,role' });

  if (userRole.error) throw userRole.error;

  return org.data;
}
