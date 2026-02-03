import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { ActivePortal } from '@/components/app/PortalSwitcher';

const STORAGE_KEY_PREFIX = 'active_portal_';

export function useActivePortal(): [ActivePortal, (portal: ActivePortal) => void] {
  const { user, isSeller, isBuyer, isAdmin } = useAuth();
  
  const [activePortal, setActivePortal] = useState<ActivePortal>(() => {
    if (!user) return 'buyer';
    
    // Check localStorage for saved preference
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${user.id}`);
    if (stored === 'seller' || stored === 'buyer') {
      return stored;
    }
    
    // Default based on roles
    if (isSeller && !isBuyer) return 'seller';
    return 'buyer';
  });

  // Update when user or roles change
  useEffect(() => {
    if (!user) return;
    
    // Check localStorage for saved preference
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${user.id}`);
    if (stored === 'seller' || stored === 'buyer') {
      // Validate the stored portal is still valid for the user
      if (stored === 'seller' && isSeller) {
        setActivePortal('seller');
        return;
      }
      if (stored === 'buyer' && isBuyer) {
        setActivePortal('buyer');
        return;
      }
    }
    
    // If no valid stored preference, default based on current roles
    if (isSeller && !isBuyer) {
      setActivePortal('seller');
    } else if (isBuyer) {
      setActivePortal('buyer');
    }
  }, [user, isSeller, isBuyer]);

  const updateActivePortal = (portal: ActivePortal) => {
    if (!user) return;
    
    setActivePortal(portal);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${user.id}`, portal);
  };

  return [activePortal, updateActivePortal];
}
