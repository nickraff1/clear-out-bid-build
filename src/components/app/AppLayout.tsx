import { Navigate, Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Loader2, LayoutDashboard, Package, Calendar, ShoppingCart, Heart, Bell, Settings, Building2, Users, BarChart3, Gavel, Clock, Tag, PlusCircle, FileText, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const { user, isLoading, isAdmin, isSeller, isBuyer, profile } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Role-based nav items
  const buyerNav = [
    { to: '/app/buyer/overview', label: 'Overview', icon: LayoutDashboard },
    { to: '/app/buyer/bids', label: 'My Bids', icon: Gavel },
    { to: '/app/buyer/orders', label: 'Orders', icon: ShoppingCart },
    { to: '/app/buyer/watchlist', label: 'Watchlist', icon: Heart },
    { to: '/app/buyer/alerts', label: 'Alerts', icon: Bell },
  ];

  const sellerNav = [
    { to: '/app/seller/overview', label: 'Overview', icon: LayoutDashboard },
    { to: '/app/seller/events', label: 'Events', icon: Calendar },
    { to: '/app/seller/lots', label: 'All Lots', icon: Package },
    { to: '/app/seller/orders', label: 'Sales', icon: FileText },
    { to: '/app/seller/pickups', label: 'Pickups', icon: Truck },
  ];

  const adminNav = [
    { to: '/app/admin/overview', label: 'Overview', icon: LayoutDashboard },
    { to: '/app/admin/organizations', label: 'Organizations', icon: Building2 },
    { to: '/app/admin/moderation', label: 'Moderation', icon: Package },
    { to: '/app/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/app/admin/users', label: 'Users', icon: Users },
  ];

  const commonNav = [
    { to: '/app/settings', label: 'Settings', icon: Settings },
  ];

  // Determine which nav to show
  let navItems = buyerNav;
  let portalTitle = 'Buyer Portal';
  
  if (isAdmin) {
    navItems = adminNav;
    portalTitle = 'Admin Portal';
  } else if (isSeller) {
    navItems = sellerNav;
    portalTitle = 'Seller Portal';
  }

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <Layout hideFooter>
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar">
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                <span className="text-lg font-bold text-primary-foreground">
                  {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
                </span>
              </div>
              <div className="overflow-hidden">
                <p className="font-medium text-sidebar-foreground truncate">{profile?.full_name ?? 'User'}</p>
                <p className="text-sm text-sidebar-foreground/60 truncate">{portalTitle}</p>
              </div>
            </div>
          </div>
          
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive(item.to)
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            
            <div className="pt-4 mt-4 border-t border-sidebar-border">
              {commonNav.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive(item.to)
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Quick Actions */}
            {isSeller && (
              <div className="pt-4 mt-4 border-t border-sidebar-border">
                <Button asChild className="w-full" size="sm">
                  <Link to="/app/seller/events/new">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New Event
                  </Link>
                </Button>
              </div>
            )}
          </nav>
        </aside>

        {/* Mobile Nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background z-50">
          <nav className="flex justify-around p-2">
            {navItems.slice(0, 5).map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors',
                  isActive(item.to)
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>
    </Layout>
  );
}
