import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

// Public Pages
import Index from "./pages/Index";
import Marketplace from "./pages/Marketplace";
import LotDetail from "./pages/LotDetail";
import HowItWorks from "./pages/HowItWorks";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ResetPassword from "./pages/auth/ResetPassword";
import NotFound from "./pages/NotFound";

// Legal / policy pages
import Terms from "./pages/legal/Terms";
import Privacy from "./pages/legal/Privacy";
import ProhibitedMaterials from "./pages/legal/ProhibitedMaterials";
import PickupSafety from "./pages/legal/PickupSafety";
import RefundsAndDisputes from "./pages/legal/RefundsAndDisputes";
import AuctionTerms from "./pages/legal/AuctionTerms";
import BuyerDefaultPolicy from "./pages/legal/BuyerDefaultPolicy";
import ProhibitedBiddingPolicy from "./pages/legal/ProhibitedBiddingPolicy";

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
import EditLot from "./pages/app/seller/EditLot";
import SellerLots from "./pages/app/seller/SellerLots";
import SellerOrders from "./pages/app/seller/SellerOrders";
import SellerPickups from "./pages/app/seller/SellerPickups";

// Buyer Portal
import BuyerOverview from "./pages/app/buyer/BuyerOverview";
import BuyerBids from "./pages/app/buyer/BuyerBids";
import BuyerOrders from "./pages/app/buyer/BuyerOrders";
import BuyerWatchlist from "./pages/app/buyer/BuyerWatchlist";
import BuyerAlerts from "./pages/app/buyer/BuyerAlerts";
import Checkout from "./pages/app/buyer/Checkout";
import CheckoutReturn from "./pages/app/buyer/CheckoutReturn";
import CheckoutCancel from "./pages/app/buyer/CheckoutCancel";

// Common App Pages
import AppSettings from "./pages/app/AppSettings";
import AddRole from "./pages/app/AddRole";
import PaymentSettings from "./pages/app/seller/PaymentSettings";

// Admin
import AdminFees from "./pages/app/admin/AdminFees";
import AdminOverview from "./pages/app/admin/AdminOverview";
import AdminUsers from "./pages/app/admin/AdminUsers";
import AdminListings from "./pages/app/admin/AdminListings";
import AdminOrders from "./pages/app/admin/AdminOrders";
import AdminReports from "./pages/app/admin/AdminReports";
import AdminPayouts from "./pages/app/admin/AdminPayouts";
import AdminLaunch from "./pages/app/admin/AdminLaunch";
import AdminSellers from "./pages/app/admin/AdminSellers";
import AdminBidders from "./pages/app/admin/AdminBidders";
import SellerPayouts from "./pages/app/seller/SellerPayouts";

// Seller bulk
import BulkUpload from "./pages/app/seller/BulkUpload";

// Messaging
import MessagesInbox from "./pages/app/messages/MessagesInbox";
import MessageThread from "./pages/app/messages/MessageThread";

// Orders
import OrderDetail from "./pages/app/orders/OrderDetail";
import NotificationsPage from "./pages/app/Notifications";

// SEO Landing Pages
import {
  SellSurplusSydney,
  BuyCheapMaterialsSydney,
  ConstructionWasteMarketplaceSydney,
  StoneOffcutsSydney,
  TimberOffcutsSydney,
  TileOffcutsSydney,
  MetalOffcutsSydney,
} from "./pages/seo/pages";

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
          <OnboardingWizard />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/lot/:id" element={<LotDetail />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Legal / Policy */}
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/prohibited-materials" element={<ProhibitedMaterials />} />
            <Route path="/pickup-safety" element={<PickupSafety />} />
            <Route path="/refunds-and-disputes" element={<RefundsAndDisputes />} />
            <Route path="/auction-terms" element={<AuctionTerms />} />
            <Route path="/buyer-default-policy" element={<BuyerDefaultPolicy />} />
            <Route path="/prohibited-bidding-policy" element={<ProhibitedBiddingPolicy />} />

            {/* SEO Landing Pages */}
            <Route path="/sell-surplus-building-materials-sydney" element={<SellSurplusSydney />} />
            <Route path="/buy-cheap-building-materials-sydney" element={<BuyCheapMaterialsSydney />} />
            <Route path="/construction-waste-marketplace-sydney" element={<ConstructionWasteMarketplaceSydney />} />
            <Route path="/stone-offcuts-sydney" element={<StoneOffcutsSydney />} />
            <Route path="/timber-offcuts-sydney" element={<TimberOffcutsSydney />} />
            <Route path="/tile-offcuts-sydney" element={<TileOffcutsSydney />} />
            <Route path="/metal-offcuts-sydney" element={<MetalOffcutsSydney />} />
            
            {/* App Portal Routes */}
            <Route path="/app" element={<AppRedirect />} />
            <Route element={<AppLayout />}>
              {/* Seller Routes */}
              <Route path="/app/seller/overview" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <SellerOverview />
                </RoleGuard>
              } />
              <Route path="/app/seller/events" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <SellerEvents />
                </RoleGuard>
              } />
              <Route path="/app/seller/events/new" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <CreateEvent />
                </RoleGuard>
              } />
              <Route path="/app/seller/events/:id" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <EventDetail />
                </RoleGuard>
              } />
              <Route path="/app/seller/lots" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <SellerLots />
                </RoleGuard>
              } />
              <Route path="/app/seller/lots/new" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <CreateLot />
                </RoleGuard>
              } />
              <Route path="/app/seller/lots/:id/edit" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <EditLot />
                </RoleGuard>
              } />
              <Route path="/app/seller/orders" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <SellerOrders />
                </RoleGuard>
              } />
              <Route path="/app/seller/pickups" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <SellerPickups />
                </RoleGuard>
              } />

              {/* Buyer Routes */}
              <Route path="/app/buyer/overview" element={
                <RoleGuard allowedRoles={['buyer', 'admin']}>
                  <BuyerOverview />
                </RoleGuard>
              } />
              <Route path="/app/buyer/bids" element={
                <RoleGuard allowedRoles={['buyer', 'admin']}>
                  <BuyerBids />
                </RoleGuard>
              } />
              <Route path="/app/buyer/orders" element={
                <RoleGuard allowedRoles={['buyer', 'admin']}>
                  <BuyerOrders />
                </RoleGuard>
              } />
              <Route path="/app/buyer/watchlist" element={
                <RoleGuard allowedRoles={['buyer', 'admin']}>
                  <BuyerWatchlist />
                </RoleGuard>
              } />
              <Route path="/app/buyer/alerts" element={
                <RoleGuard allowedRoles={['buyer', 'admin']}>
                  <BuyerAlerts />
                </RoleGuard>
              } />
              <Route path="/app/buyer/checkout/:orderId" element={
                <RoleGuard allowedRoles={['buyer', 'admin']}>
                  <Checkout />
                </RoleGuard>
              } />
              <Route path="/app/buyer/checkout/return" element={
                <RoleGuard allowedRoles={['buyer', 'admin']}>
                  <CheckoutReturn />
                </RoleGuard>
              } />
              <Route path="/app/buyer/checkout/cancel" element={
                <RoleGuard allowedRoles={['buyer', 'admin']}>
                  <CheckoutCancel />
                </RoleGuard>
              } />

              {/* Seller Payment Settings */}
              <Route path="/app/seller/payments" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <PaymentSettings />
                </RoleGuard>
              } />
              <Route path="/app/seller/payouts" element={
                <RoleGuard allowedRoles={['seller', 'admin']}>
                  <SellerPayouts />
                </RoleGuard>
              } />

              {/* Admin */}
              <Route path="/app/admin/fees" element={
                <RoleGuard allowedRoles={['admin']}>
                  <AdminFees />
                </RoleGuard>
              } />
              <Route path="/app/admin/overview" element={
                <RoleGuard allowedRoles={['admin']}><AdminOverview /></RoleGuard>
              } />
              <Route path="/app/admin/analytics" element={
                <RoleGuard allowedRoles={['admin']}><AdminOverview /></RoleGuard>
              } />
              <Route path="/app/admin/users" element={
                <RoleGuard allowedRoles={['admin']}><AdminUsers /></RoleGuard>
              } />
              <Route path="/app/admin/listings" element={
                <RoleGuard allowedRoles={['admin']}><AdminListings /></RoleGuard>
              } />
              <Route path="/app/admin/moderation" element={
                <RoleGuard allowedRoles={['admin']}><AdminReports /></RoleGuard>
              } />
              <Route path="/app/admin/reports" element={
                <RoleGuard allowedRoles={['admin']}><AdminReports /></RoleGuard>
              } />
              <Route path="/app/admin/orders" element={
                <RoleGuard allowedRoles={['admin']}><AdminOrders /></RoleGuard>
              } />
              <Route path="/app/admin/payouts" element={
                <RoleGuard allowedRoles={['admin']}><AdminPayouts /></RoleGuard>
              } />
              <Route path="/app/admin/launch" element={
                <RoleGuard allowedRoles={['admin']}><AdminLaunch /></RoleGuard>
              } />
              <Route path="/app/admin/sellers" element={
                <RoleGuard allowedRoles={['admin']}><AdminSellers /></RoleGuard>
              } />
              <Route path="/app/admin/bidders" element={
                <RoleGuard allowedRoles={['admin']}><AdminBidders /></RoleGuard>
              } />

              {/* Notifications (any signed-in user) */}
              <Route path="/app/notifications" element={<NotificationsPage />} />

              {/* Seller bulk upload */}
              <Route path="/app/seller/bulk-upload" element={
                <RoleGuard allowedRoles={['seller', 'admin']}><BulkUpload /></RoleGuard>
              } />

              {/* Common Routes */}
              <Route path="/app/settings" element={<AppSettings />} />
              <Route path="/app/add-role" element={<AddRole />} />

              {/* Messages (buyer + seller) */}
              <Route path="/app/messages" element={<MessagesInbox />} />
              <Route path="/app/messages/:id" element={<MessageThread />} />

              {/* Order detail (buyer + seller) */}
              <Route path="/app/orders/:orderId" element={<OrderDetail />} />
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
