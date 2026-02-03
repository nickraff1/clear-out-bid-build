import { Navigate, Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Loader2, LayoutDashboard, Package, Calendar, ShoppingCart, Heart, Bell, Settings, Building2, Users, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Dashboard() {
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

  // Determine which nav items to show based on role
  const navItems = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, show: true },
    { to: '/dashboard/orders', label: 'Orders', icon: ShoppingCart, show: true },
    { to: '/dashboard/watchlist', label: 'Watchlist', icon: Heart, show: isBuyer || (!isSeller && !isAdmin) },
    { to: '/dashboard/events', label: 'Events', icon: Calendar, show: isSeller },
    { to: '/dashboard/lots', label: 'My Lots', icon: Package, show: isSeller },
    { to: '/dashboard/organization', label: 'Organization', icon: Building2, show: true },
    { to: '/dashboard/notifications', label: 'Notifications', icon: Bell, show: true },
    { to: '/dashboard/settings', label: 'Settings', icon: Settings, show: true },
    // Admin items
    { to: '/dashboard/admin/organizations', label: 'Organizations', icon: Users, show: isAdmin },
    { to: '/dashboard/admin/moderation', label: 'Moderation', icon: Package, show: isAdmin },
    { to: '/dashboard/admin/analytics', label: 'Analytics', icon: BarChart3, show: isAdmin },
  ].filter(item => item.show);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Layout hideFooter>
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col border-r border-border bg-muted/30">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                <span className="text-lg font-bold text-primary-foreground">
                  {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
                </span>
              </div>
              <div className="overflow-hidden">
                <p className="font-medium truncate">{profile?.full_name ?? 'User'}</p>
                <p className="text-sm text-muted-foreground truncate">{profile?.email}</p>
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
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
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
