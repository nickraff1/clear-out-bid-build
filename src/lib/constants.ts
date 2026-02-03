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
  { name: 'Doors & Frames', slug: 'doors-frames', icon: 'door-open' },
  { name: 'Windows & Glazing', slug: 'windows-glazing', icon: 'square' },
  { name: 'Timber & Flooring', slug: 'timber-flooring', icon: 'layers' },
  { name: 'Stone & Tiles', slug: 'stone-tiles', icon: 'grid-3x3' },
  { name: 'Plumbing', slug: 'plumbing', icon: 'droplets' },
  { name: 'Electrical', slug: 'electrical', icon: 'zap' },
  { name: 'Hardware & Fixings', slug: 'hardware-fixings', icon: 'wrench' },
  { name: 'Insulation', slug: 'insulation', icon: 'thermometer' },
  { name: 'Roofing', slug: 'roofing', icon: 'home' },
  { name: 'Landscaping', slug: 'landscaping', icon: 'tree-palm' },
  { name: 'Steel & Metal', slug: 'steel-metal', icon: 'hard-hat' },
  { name: 'Other', slug: 'other', icon: 'package' },
] as const;

export const BID_INCREMENTS = [
  { upTo: 100, increment: 5 },
  { upTo: 500, increment: 10 },
  { upTo: 1000, increment: 25 },
  { upTo: 5000, increment: 50 },
  { upTo: 10000, increment: 100 },
  { upTo: 50000, increment: 250 },
  { upTo: Infinity, increment: 500 },
] as const;

export const AUCTION_CONFIG = {
  softCloseMinutes: 2, // Extend by 2 minutes if bid in last minute
  softCloseThresholdSeconds: 60, // Last 60 seconds triggers extension
  maxExtensions: 10, // Maximum number of extensions
} as const;

export function getBidIncrement(currentBid: number): number {
  const rule = BID_INCREMENTS.find(r => currentBid < r.upTo);
  return rule?.increment ?? 500;
}

export function getMinNextBid(currentBid: number): number {
  return currentBid + getBidIncrement(currentBid);
}
