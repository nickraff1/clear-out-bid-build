// Offcutt Constants

export const BRAND = {
  name: 'Offcutt',
  tagline: 'Construction Surplus Marketplace',
  description: 'Buy and sell unused construction materials. One-hit clearance events for builders, great deals for buyers.',
};

export const LOT_CONDITIONS = [
  { value: 'unused', label: 'Unused', description: 'Brand new, never installed' },
  { value: 'like_new', label: 'Like New', description: 'Excellent condition, minimal handling' },
  { value: 'good', label: 'Good', description: 'Good condition, may have minor marks' },
  { value: 'fair', label: 'Fair', description: 'Functional, visible wear' },
] as const;

export const PRICING_TYPES = [
  { value: 'fixed', label: 'Fixed Price', description: 'Buyers pay the listed price' },
  { value: 'auction', label: 'Auction', description: 'Buyers bid, highest wins' },
] as const;

export const ORDER_STATUSES = [
  { value: 'pending_payment', label: 'Pending Payment', color: 'warning' },
  { value: 'paid', label: 'Paid', color: 'success' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup', color: 'info' },
  { value: 'collected', label: 'Collected', color: 'success' },
  { value: 'cancelled', label: 'Cancelled', color: 'destructive' },
  { value: 'disputed', label: 'Disputed', color: 'warning' },
] as const;

export const AUSTRALIAN_STATES = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NT', label: 'Northern Territory' },
] as const;

export const DEFAULT_CATEGORIES = [
  { name: 'Doors & Windows', slug: 'doors-windows', icon: 'door-open' },
  { name: 'Timber & Joinery', slug: 'timber-joinery', icon: 'layers' },
  { name: 'Flooring', slug: 'flooring', icon: 'grid-3x3' },
  { name: 'Stone & Benchtops', slug: 'stone-benchtops', icon: 'grid-3x3' },
  { name: 'Electrical', slug: 'electrical', icon: 'zap' },
  { name: 'Fixtures & Fittings', slug: 'fixtures-fittings', icon: 'wrench' },
  { name: 'Insulation & Cladding', slug: 'insulation-cladding', icon: 'thermometer' },
  { name: 'Steel & Metal', slug: 'steel-metal', icon: 'hard-hat' },
  { name: 'Industrial', slug: 'industrial', icon: 'package' },
  { name: 'Office & Commercial', slug: 'office-commercial', icon: 'package' },
] as const;

export const BID_INCREMENTS = [
  { upTo: Infinity, increment: 1 },
] as const;

export const AUCTION_CONFIG = {
  softCloseMinutes: 2, // Extend by 2 minutes if bid in last minute
  softCloseThresholdSeconds: 60, // Last 60 seconds triggers extension
  maxExtensions: 10, // Maximum number of extensions
} as const;

export function getBidIncrement(currentBid: number): number {
  const rule = BID_INCREMENTS.find(r => currentBid < r.upTo);
  return rule?.increment ?? 1;
}

export function getMinNextBid(currentBid: number): number {
  return currentBid + getBidIncrement(currentBid);
}
