import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function AppRedirect() {
  const { user, isLoading, isAdmin, isSeller, isBuyer } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect based on role
  if (isAdmin) {
    return <Navigate to="/app/admin/overview" replace />;
  }
  
  if (isSeller) {
    return <Navigate to="/app/seller/overview" replace />;
  }

  // Default to buyer
  return <Navigate to="/app/buyer/overview" replace />;
}
