import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, ShoppingCart, Loader2, ArrowLeft, Check } from 'lucide-react';

export default function AddRole() {
  const { user, profile, isSeller, isBuyer, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Determine which role to add
  const roleToAdd = isSeller ? 'buyer' : 'seller';
  const currentRole = isSeller ? 'seller' : 'buyer';

  const handleAddRole = async () => {
    if (!user) {
      toast({
        title: 'Not authenticated',
        description: 'Please log in to continue',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);

    try {
      // Create organization for the new role
      const orgName = profile?.full_name 
        ? `${profile.full_name}'s ${roleToAdd === 'seller' ? 'Business' : 'Buyer Account'}` 
        : `My ${roleToAdd === 'seller' ? 'Business' : 'Buyer Account'}`;
      
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          org_type: roleToAdd,
          email: profile?.email || user.email,
          is_approved: true,
        })
        .select()
        .single();

      if (orgError) {
        console.error('[AddRole] Org creation error:', orgError);
        toast({
          title: 'Error creating organization',
          description: orgError.message,
          variant: 'destructive'
        });
        return;
      }

      // Add user as org member
      const { error: memberError } = await supabase
        .from('org_members')
        .insert({
          org_id: org.id,
          user_id: user.id,
          is_primary: false // Not primary since they already have a primary org
        });

      if (memberError) {
        console.error('[AddRole] Member creation error:', memberError);
        toast({
          title: 'Error joining organization',
          description: memberError.message,
          variant: 'destructive'
        });
        return;
      }

      // Add user role
      const roleValue = roleToAdd === 'seller' ? 'seller_admin' : 'buyer_admin';
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: roleValue
        });

      if (roleError) {
        console.error('[AddRole] Role creation error:', roleError);
        toast({
          title: 'Error assigning role',
          description: roleError.message,
          variant: 'destructive'
        });
        return;
      }

      // Refresh auth context to get new roles
      await refreshProfile();
      
      // Update localStorage to switch to the new portal
      localStorage.setItem(`active_portal_${user.id}`, roleToAdd);
      
      toast({
        title: 'Role added!',
        description: `You can now ${roleToAdd === 'seller' ? 'sell items' : 'browse and buy'} on Offcutt`,
      });

      // Navigate to the new portal
      if (roleToAdd === 'seller') {
        navigate('/app/seller/overview');
      } else {
        navigate('/app/buyer/overview');
      }
    } catch (error: any) {
      console.error('[AddRole] Error:', error);
      toast({
        title: 'Setup failed',
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // If user already has both roles, redirect
  if (isSeller && isBuyer) {
    return (
      <div className="container max-w-lg mx-auto py-12 px-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Check className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>You're all set!</CardTitle>
            <CardDescription>
              You already have access to both buyer and seller portals.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-lg mx-auto py-12 px-4">
      <Button 
        variant="ghost" 
        onClick={() => navigate(-1)}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            {roleToAdd === 'seller' ? (
              <Building2 className="h-8 w-8 text-primary" />
            ) : (
              <ShoppingCart className="h-8 w-8 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {roleToAdd === 'seller' ? 'Become a Seller' : 'Become a Buyer'}
          </CardTitle>
          <CardDescription className="text-base">
            {roleToAdd === 'seller' 
              ? 'Start selling your surplus construction materials to buyers across Australia.'
              : 'Browse and bid on construction surplus materials from sellers near you.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2">What you'll get:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {roleToAdd === 'seller' ? (
                <>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Create clearance events for your surplus materials
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    List items with fixed prices or auctions
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Manage pickups and track sales
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Receive payments directly to your account
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Browse surplus materials from construction sites
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Place bids on auction items
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Track your orders and pickups
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Save searches and get alerts
                  </li>
                </>
              )}
            </ul>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            You'll still have access to your {currentRole} portal. You can switch between them anytime.
          </div>

          <Button 
            className="w-full" 
            size="lg"
            onClick={handleAddRole}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                {roleToAdd === 'seller' ? 'Start Selling' : 'Start Buying'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
