import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function AppRedirect() {
  const { user, isLoading, isAdmin, isSeller, isBuyer, isAdminAssistMode } = useAuth();

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

  // Check localStorage for recently selected role (handles fresh onboarding)
  const storedRole = localStorage.getItem(`user_role_${user.id}`);

  // Redirect based on role
  if (isAdminAssistMode) {
    return <Navigate to="/app/seller/overview" replace />;
  }

  if (isAdmin) {
    return <Navigate to="/app/admin/overview" replace />;
  }
  
  if (isSeller || storedRole === 'seller') {
    return <Navigate to="/app/seller/overview" replace />;
  }

  if (isBuyer || storedRole === 'buyer') {
    return <Navigate to="/app/buyer/overview" replace />;
  }

  // Default to buyer for users with no role yet
  return <Navigate to="/app/buyer/overview" replace />;
}
