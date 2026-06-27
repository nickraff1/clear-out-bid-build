import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoleGuardProps {
  allowedRoles: ('admin' | 'seller' | 'buyer')[];
  children: React.ReactNode;
}

export default function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user, isLoading, isAdmin, isSeller, isBuyer } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check localStorage for recently selected role (handles fresh onboarding)
  const storedRole = user ? localStorage.getItem(`user_role_${user.id}`) : null;
  
  // Determine actual roles including localStorage fallback
  const effectiveIsSeller = isSeller || storedRole === 'seller';
  const effectiveIsBuyer = isBuyer || storedRole === 'buyer';

  const hasAccess = 
    (allowedRoles.includes('admin') && isAdmin) ||
    (allowedRoles.includes('seller') && effectiveIsSeller) ||
    (allowedRoles.includes('buyer') && effectiveIsBuyer) ||
    // If user has no role, default to buyer access
    (allowedRoles.includes('buyer') && !isAdmin && !effectiveIsSeller);

  if (!hasAccess) {
    if (allowedRoles.length === 1 && allowedRoles.includes('admin')) {
      return (
        <div className="p-6">
          <div className="dashboard-card max-w-xl mx-auto text-center space-y-3">
            <ShieldAlert className="h-10 w-10 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold">You do not have admin access</h1>
            <p className="text-sm text-muted-foreground">
              This area is restricted to Offcutt administrators. Ask an existing admin to grant your account the admin role, or use the documented one-time bootstrap SQL.
            </p>
            <Button variant="outline" onClick={() => window.location.assign('/app')}>
              Return to your dashboard
            </Button>
          </div>
        </div>
      );
    }

    // Redirect to appropriate portal
    if (isAdmin) {
      return <Navigate to="/app/admin/overview" replace />;
    }
    if (effectiveIsSeller) {
      return <Navigate to="/app/seller/overview" replace />;
    }
    return <Navigate to="/app/buyer/overview" replace />;
  }

  return <>{children}</>;
}
