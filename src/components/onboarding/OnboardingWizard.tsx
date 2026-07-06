import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ensureUserRoleOrganization } from '@/lib/organizations';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Building2, 
  ShoppingCart, 
  ArrowRight, 
  Check,
  Package,
  Gavel,
  Plus,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingState {
  has_completed_onboarding: boolean;
  onboarding_step: number;
  selected_role: 'buyer' | 'seller' | null;
}

export function OnboardingWizard() {
  const { user, profile, isSeller, isBuyer, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<'buyer' | 'seller' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingRole, setLoadingRole] = useState<'buyer' | 'seller' | null>(null);

  // Check if user needs onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user) return;

      // Check localStorage first for quick check
      const localOnboarded = localStorage.getItem(`onboarding_complete_${user.id}`);
      if (localOnboarded === 'true') return;

      // Check if user already has an organization
      const { data: orgMembership } = await supabase
        .from('org_members')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      // If user has org membership, they've likely completed onboarding
      if (orgMembership && orgMembership.length > 0) {
        localStorage.setItem(`onboarding_complete_${user.id}`, 'true');
        return;
      }

      // Show onboarding wizard
      setOpen(true);
    };

    checkOnboarding();
  }, [user]);

  // Determine role from existing data
  useEffect(() => {
    if (isSeller) {
      setSelectedRole('seller');
      setStep(2);
    } else if (isBuyer) {
      setSelectedRole('buyer');
      setStep(2);
    }
  }, [isSeller, isBuyer]);

  const handleRoleSelect = async (role: 'buyer' | 'seller') => {
    if (!user) {
      toast({
        title: 'Not authenticated',
        description: 'Please log in to continue',
        variant: 'destructive'
      });
      return;
    }

    setSelectedRole(role);
    setIsLoading(true);
    setLoadingRole(role);

    try {
      console.log('[Onboarding] Starting role selection:', role);
      
      const org = await ensureUserRoleOrganization({
        userId: user.id,
        email: profile?.email || user.email,
        fullName: profile?.full_name,
        role,
        isPrimary: true,
      });

      console.log('[Onboarding] Role organization ready:', org.id);

      // Store role selection in localStorage for immediate navigation
      localStorage.setItem(`user_role_${user.id}`, role);

      // Refresh auth context to get new roles
      await refreshProfile();
      
      toast({
        title: 'Setup complete!',
        description: `You're now set up as a ${role}`,
      });

      console.log('[Onboarding] Setup complete, moving to step 2');
      setStep(2);
    } catch (error: any) {
      console.error('[Onboarding] Error setting up role:', error);
      toast({
        title: 'Setup failed',
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setLoadingRole(null);
    }
  };

  const handleComplete = () => {
    if (user) {
      localStorage.setItem(`onboarding_complete_${user.id}`, 'true');
    }
    setOpen(false);
    
    // Navigate to appropriate starting point
    if (selectedRole === 'seller') {
      navigate('/app/seller/events/new');
    } else {
      navigate('/marketplace');
    }
  };

  const handleSkip = () => {
    if (user) {
      localStorage.setItem(`onboarding_complete_${user.id}`, 'true');
    }
    setOpen(false);
  };

  const sellerChecklist = [
    { 
      title: 'Create your first event', 
      description: 'Set up a clearance event with pickup details',
      icon: Plus,
      action: () => { handleComplete(); navigate('/app/seller/events/new'); }
    },
    { 
      title: 'Add your first lot', 
      description: 'List an item with photos and pricing',
      icon: Package,
      action: () => { handleComplete(); navigate('/app/seller/overview'); }
    },
    { 
      title: 'Publish and go live', 
      description: 'Make your listings visible to buyers',
      icon: Check,
      action: () => { handleComplete(); }
    },
  ];

  const buyerChecklist = [
    { 
      title: 'Browse the marketplace', 
      description: 'Discover construction surplus in your area',
      icon: ShoppingCart,
      action: () => { handleComplete(); navigate('/marketplace'); }
    },
    { 
      title: 'Place your first bid', 
      description: 'Find an auction and make an offer',
      icon: Gavel,
      action: () => { handleComplete(); navigate('/marketplace'); }
    },
    { 
      title: 'Win and collect', 
      description: 'Pick up your purchased items',
      icon: Check,
      action: () => { handleComplete(); }
    },
  ];

  const checklist = selectedRole === 'seller' ? sellerChecklist : buyerChecklist;
  const progress = step === 1 ? 33 : 66;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {step === 1 ? 'Welcome to Offcutt!' : `Let's get started`}
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? 'How would you like to use the platform?' 
              : `Here's your ${selectedRole === 'seller' ? 'seller' : 'buyer'} checklist to get started`
            }
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="h-2 mb-6" />

        {step === 1 && (
          <div className="grid gap-4">
            <button
              onClick={() => handleRoleSelect('buyer')}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left',
                'hover:border-primary hover:bg-primary/5',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                loadingRole === 'buyer' && 'border-primary bg-primary/5'
              )}
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                {loadingRole === 'buyer' ? (
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                ) : (
                  <ShoppingCart className="h-6 w-6 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">I want to buy</h3>
                <p className="text-sm text-muted-foreground">
                  Browse and bid on construction surplus materials
                </p>
              </div>
              {loadingRole === 'buyer' ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              ) : (
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            <button
              onClick={() => handleRoleSelect('seller')}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left',
                'hover:border-primary hover:bg-primary/5',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                loadingRole === 'seller' && 'border-primary bg-primary/5'
              )}
            >
              <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                {loadingRole === 'seller' ? (
                  <Loader2 className="h-6 w-6 text-secondary-foreground animate-spin" />
                ) : (
                  <Building2 className="h-6 w-6 text-secondary-foreground" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">I want to sell</h3>
                <p className="text-sm text-muted-foreground">
                  Clear out surplus materials from your construction projects
                </p>
              </div>
              {loadingRole === 'seller' ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              ) : (
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-3">
              {checklist.map((item, index) => (
                <button
                  key={index}
                  onClick={item.action}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-lg border transition-all text-left w-full',
                    'hover:border-primary hover:bg-primary/5',
                    index === 0 ? 'border-primary bg-primary/5' : ''
                  )}
                >
                  <div className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
                    index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  {index === 0 && (
                    <ArrowRight className="h-5 w-5 text-primary" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={handleSkip}>
                Skip for now
              </Button>
              <Button onClick={checklist[0].action}>
                Get Started
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
