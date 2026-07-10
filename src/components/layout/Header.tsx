import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Menu, X, Search, Bell, User, LogOut, LayoutDashboard, Heart } from 'lucide-react';
import { useState } from 'react';
import { BRAND } from '@/lib/constants';
import offcuttLogo from '@/assets/offcutt-logo.svg.asset.json';

export function Header() {
  const { user, profile, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center" aria-label={BRAND.name}>
          <img src={offcuttLogo.url} alt={`${BRAND.name} logo`} className="h-9 w-auto" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/marketplace" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Marketplace
          </Link>
          <Link to="/how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            How It Works
          </Link>
          <Link to="/app" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            For Sellers
          </Link>
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/marketplace">
              <Search className="h-5 w-5" />
            </Link>
          </Button>
          
          {!isLoading && (
            <>
              {user ? (
                <>
                  <Button variant="ghost" size="icon" asChild>
                    <Link to="/app/buyer/watchlist">
                      <Heart className="h-5 w-5" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <Link to="/app">
                      <Bell className="h-5 w-5" />
                    </Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={profile?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getInitials(profile?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">{profile?.full_name ?? 'User'}</p>
                          <p className="text-xs text-muted-foreground">{profile?.email}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/app" className="cursor-pointer">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/app/settings" className="cursor-pointer">
                          <User className="mr-2 h-4 w-4" />
                          Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link to="/login">Log In</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/signup">Sign Up</Link>
                  </Button>
                </>
              )}
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container py-4 space-y-3">
            <Link
              to="/marketplace"
              className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted"
              onClick={() => setMobileMenuOpen(false)}
            >
              Marketplace
            </Link>
            <Link
              to="/how-it-works"
              className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted"
              onClick={() => setMobileMenuOpen(false)}
            >
              How It Works
            </Link>
            <Link
              to="/app"
              className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted"
              onClick={() => setMobileMenuOpen(false)}
            >
              For Sellers
            </Link>
            <div className="border-t border-border pt-3 space-y-2">
              {user ? (
                <>
                  <Link
                    to="/app"
                    className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setMobileMenuOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm font-medium rounded-md hover:bg-muted text-destructive"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    className="block px-3 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground text-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
