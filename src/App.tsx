import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

// Public Pages
import Index from "./pages/Index";
import Marketplace from "./pages/Marketplace";
import LotDetail from "./pages/LotDetail";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ResetPassword from "./pages/auth/ResetPassword";
import NotFound from "./pages/NotFound";

// App Portal
import AppLayout from "./components/app/AppLayout";
import AppRedirect from "./components/app/AppRedirect";
import RoleGuard from "./components/app/RoleGuard";

// Seller Portal
import SellerOverview from "./pages/app/seller/SellerOverview";
import SellerEvents from "./pages/app/seller/SellerEvents";
import CreateEvent from "./pages/app/seller/CreateEvent";
import EventDetail from "./pages/app/seller/EventDetail";
import CreateLot from "./pages/app/seller/CreateLot";
import SellerLots from "./pages/app/seller/SellerLots";
import SellerOrders from "./pages/app/seller/SellerOrders";
import SellerPickups from "./pages/app/seller/SellerPickups";

// Buyer Portal
import BuyerOverview from "./pages/app/buyer/BuyerOverview";
import BuyerBids from "./pages/app/buyer/BuyerBids";
import BuyerOrders from "./pages/app/buyer/BuyerOrders";
import BuyerWatchlist from "./pages/app/buyer/BuyerWatchlist";
import BuyerAlerts from "./pages/app/buyer/BuyerAlerts";

// Common App Pages
import AppSettings from "./pages/app/AppSettings";

// Legacy Dashboard (keep for now)
import Dashboard from "./pages/Dashboard";
import DashboardOverview from "./pages/dashboard/Overview";
import WatchlistPage from "./pages/dashboard/Watchlist";
import OrdersPage from "./pages/dashboard/Orders";
import EventsPage from "./pages/dashboard/Events";
import NewEventPage from "./pages/dashboard/NewEvent";
import OrganizationPage from "./pages/dashboard/Organization";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/lot/:id" element={<LotDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* App Portal Routes */}
            <Route path="/app" element={<AppRedirect />} />
            <Route path="/app" element={<AppLayout />}>
              {/* Seller Routes */}
              <Route path="seller/overview" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <SellerOverview />
                </RoleGuard>
              } />
              <Route path="seller/events" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <SellerEvents />
                </RoleGuard>
              } />
              <Route path="seller/events/new" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <CreateEvent />
                </RoleGuard>
              } />
              <Route path="seller/events/:id" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <EventDetail />
                </RoleGuard>
              } />
              <Route path="seller/lots" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <SellerLots />
                </RoleGuard>
              } />
              <Route path="seller/lots/new" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <CreateLot />
                </RoleGuard>
              } />
              <Route path="seller/orders" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <SellerOrders />
                </RoleGuard>
              } />
              <Route path="seller/pickups" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <SellerPickups />
                </RoleGuard>
              } />

              {/* Buyer Routes */}
              <Route path="buyer/overview" element={
                <RoleGuard allowedRoles={['buyer', 'admin']}>
                  <BuyerOverview />
                </RoleGuard>
              } />
              <Route path="buyer/bids" element={
                <RoleGuard allowedRoles={['buyer', 'admin']}>
                  <BuyerBids />
                </RoleGuard>
              } />
              <Route path="buyer/orders" element={
                <RoleGuard allowedRoles={['buyer', 'admin']}>
                  <BuyerOrders />
                </RoleGuard>
              } />
              <Route path="buyer/watchlist" element={
                <RoleGuard allowedRoles={['buyer', 'admin']}>
                  <BuyerWatchlist />
                </RoleGuard>
              } />
              <Route path="buyer/alerts" element={
                <RoleGuard allowedRoles={['buyer', 'admin']}>
                  <BuyerAlerts />
                </RoleGuard>
              } />

              {/* Common Routes */}
              <Route path="settings" element={<AppSettings />} />
            </Route>

            {/* Legacy Dashboard Routes */}
            <Route path="/dashboard" element={<Dashboard />}>
              <Route index element={<DashboardOverview />} />
              <Route path="watchlist" element={<WatchlistPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="events/new" element={<NewEventPage />} />
              <Route path="organization" element={<OrganizationPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
