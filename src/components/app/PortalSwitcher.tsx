import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  ShoppingCart, 
  ChevronDown, 
  Plus,
  Loader2,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ActivePortal = 'buyer' | 'seller';

interface PortalSwitcherProps {
  activePortal: ActivePortal;
  onPortalChange: (portal: ActivePortal) => void;
}

export function PortalSwitcher({ activePortal, onPortalChange }: PortalSwitcherProps) {
  const { user, isSeller, isBuyer, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [addingRoleType, setAddingRoleType] = useState<'buyer' | 'seller' | null>(null);

  const hasBothRoles = isSeller && isBuyer;
  const canAddSeller = isBuyer && !isSeller;
  const canAddBuyer = isSeller && !isBuyer;

  const handlePortalSwitch = (portal: ActivePortal) => {
    if (portal === activePortal) return;
    
    onPortalChange(portal);
    
    // Navigate to the new portal's overview
    if (portal === 'seller') {
      navigate('/app/seller/overview');
    } else {
      navigate('/app/buyer/overview');
    }
  };

  const handleAddRole = async (role: 'buyer' | 'seller') => {
    if (!user) return;
    
    setIsAddingRole(true);
    setAddingRoleType(role);

    try {
      // Create organization for the new role
      const orgName = profile?.full_name 
        ? `${profile.full_name}'s ${role === 'seller' ? 'Business' : 'Account'}` 
        : `My ${role === 'seller' ? 'Business' : 'Account'}`;
      
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          org_type: role,
          email: profile?.email || user.email,
          is_approved: true,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add user as org member
      const { error: memberError } = await supabase
        .from('org_members')
        .insert({
          org_id: org.id,
          user_id: user.id,
          is_primary: false // Not primary since they already have one
        });

      if (memberError) throw memberError;

      // Add user role
      const roleValue = role === 'seller' ? 'seller_admin' : 'buyer_admin';
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: roleValue
        });

      if (roleError) throw roleError;

      // Refresh auth context
      await refreshProfile();
      
      toast({
        title: `${role === 'seller' ? 'Seller' : 'Buyer'} account created!`,
        description: `You can now ${role === 'seller' ? 'sell items' : 'browse and buy'} on Offcutt`,
      });

      // Switch to the new portal
      handlePortalSwitch(role);
    } catch (error: unknown) {
      console.error('Error adding role:', error);
      const message = error instanceof Error ? error.message : 'Please try again';
      toast({
        title: 'Failed to add account',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setIsAddingRole(false);
      setAddingRoleType(null);
    }
  };

  const currentPortalInfo = activePortal === 'seller' 
    ? { label: 'Seller Portal', icon: Building2 }
    : { label: 'Buyer Portal', icon: ShoppingCart };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-between px-3 py-2 h-auto"
        >
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-8 w-8 rounded-md flex items-center justify-center",
              activePortal === 'seller' ? 'bg-primary/10' : 'bg-primary/10'
            )}>
              <currentPortalInfo.icon className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium text-sm text-primary">{currentPortalInfo.label}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Switch Portal</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Buyer Portal Option */}
        {isBuyer && (
          <DropdownMenuItem 
            onClick={() => handlePortalSwitch('buyer')}
            className="cursor-pointer"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            <span>Buyer Portal</span>
            {activePortal === 'buyer' && (
              <Check className="h-4 w-4 ml-auto text-primary" />
            )}
          </DropdownMenuItem>
        )}
        
        {/* Seller Portal Option */}
        {isSeller && (
          <DropdownMenuItem 
            onClick={() => handlePortalSwitch('seller')}
            className="cursor-pointer"
          >
            <Building2 className="h-4 w-4 mr-2" />
            <span>Seller Portal</span>
            {activePortal === 'seller' && (
              <Check className="h-4 w-4 ml-auto text-primary" />
            )}
          </DropdownMenuItem>
        )}

        {/* Add Role Options */}
        {(canAddSeller || canAddBuyer) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Add Account
            </DropdownMenuLabel>
            
            {canAddSeller && (
              <DropdownMenuItem 
                onClick={() => handleAddRole('seller')}
                disabled={isAddingRole}
                className="cursor-pointer"
              >
                {addingRoleType === 'seller' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                <span>Become a Seller</span>
              </DropdownMenuItem>
            )}
            
            {canAddBuyer && (
              <DropdownMenuItem 
                onClick={() => handleAddRole('buyer')}
                disabled={isAddingRole}
                className="cursor-pointer"
              >
                {addingRoleType === 'buyer' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                <span>Become a Buyer</span>
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
