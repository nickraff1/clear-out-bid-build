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

  const hasAccess = 
    (allowedRoles.includes('admin') && isAdmin) ||
    (allowedRoles.includes('seller') && isSeller) ||
    (allowedRoles.includes('buyer') && isBuyer) ||
    // If user has no role, default to buyer access
    (allowedRoles.includes('buyer') && !isAdmin && !isSeller);

  if (!hasAccess) {
    // Redirect to appropriate portal
    if (isAdmin) {
      return <Navigate to="/app/admin/overview" replace />;
    }
    if (isSeller) {
      return <Navigate to="/app/seller/overview" replace />;
    }
    return <Navigate to="/app/buyer/overview" replace />;
  }

  return <>{children}</>;
}
