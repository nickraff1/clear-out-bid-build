import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

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
