import SeoLandingPage from "./SeoLandingPage";

export const SellSurplusSydney = () => (
  <SeoLandingPage
    title="Sell Surplus Building Materials in Sydney | Offcutt"
    metaDescription="List surplus stone, timber, tile and metal offcuts from Sydney building sites. Reach local trades, divert from landfill, and turn waste into revenue."
    h1="Sell surplus building materials across Sydney"
    intro="Turn end-of-job leftovers into income. List stone slabs, timber pack-outs, tile boxes, metal stock and more in minutes — buyers across Sydney's trades and DIY market will see your listing instantly."
    bullets={[
      "List in under 2 minutes from the job site on your phone.",
      "Reach builders, fabricators, renovators and DIYers across Greater Sydney.",
      "Choose fixed price or auction. Set pickup windows that suit your site.",
      "Sellers keep 95% — Offcutt only charges a 5% commission on sold lots.",
    ]}
    cta={{ label: "Start listing", to: "/app/seller/lots/new" }}
  />
);

export const BuyCheapMaterialsSydney = () => (
  <SeoLandingPage
    title="Buy Cheap Building Materials in Sydney | Offcutt Marketplace"
    metaDescription="Browse cheap surplus building materials in Sydney. Stone, timber, tiles, steel and more from verified local sellers. Pickup-ready, often 50%+ off retail."
    h1="Buy cheap building materials direct from Sydney sites"
    intro="Stop paying full retail. Offcutt is Sydney's surplus building materials marketplace — find quality stone offcuts, timber, tiles and steel from local sites at a fraction of the cost. Browse, bid or buy now, then pick up locally."
    bullets={[
      "New listings daily from sites across Greater Sydney.",
      "Filter by suburb, material, condition and price.",
      "Verified sellers and clear pickup windows.",
      "Buyer fee only 5% — no hidden charges.",
    ]}
    cta={{ label: "Browse marketplace", to: "/marketplace" }}
  />
);

export const ConstructionWasteMarketplaceSydney = () => (
  <SeoLandingPage
    title="Construction Waste Marketplace Sydney | Offcutt"
    metaDescription="Sydney's construction waste marketplace. Buy and sell surplus building materials from local sites. Reduce landfill, lower costs and meet sustainability targets."
    h1="Sydney's construction waste marketplace"
    intro="Construction sends millions of tonnes to Sydney landfills every year. Offcutt connects builders, fabricators and trades to keep usable materials in circulation — reducing waste, lowering costs and helping projects hit sustainability targets."
    bullets={[
      "Reduce landfill waste from your site and earn from materials you would have skipped.",
      "Source nearby materials for new builds, renovations and fit-outs.",
      "Track kg diverted from landfill in your seller dashboard.",
      "Built specifically for Sydney's construction industry.",
    ]}
    cta={{ label: "Explore the marketplace", to: "/marketplace" }}
  />
);

export const StoneOffcutsSydney = () => (
  <SeoLandingPage
    title="Stone Offcuts Sydney — Marble, Granite & Engineered Stone | Offcutt"
    metaDescription="Buy stone offcuts in Sydney: marble, granite, engineered stone, porcelain. Direct from stonemasons and fabricators. Pickup across Sydney suburbs."
    h1="Stone offcuts in Sydney"
    intro="Source marble, granite, engineered stone and porcelain offcuts direct from Sydney stonemasons. Perfect for benchtops, splashbacks, hearths, vanities and small projects — at a fraction of slab pricing."
    bullets={[
      "Marble, granite, engineered stone, quartzite and porcelain.",
      "Sourced from Sydney fabricators and benchtop installers.",
      "Pickup from Alexandria, Marrickville, Smithfield and more.",
      "Most lots 50–80% below new slab pricing.",
    ]}
    cta={{ label: "Browse stone offcuts", to: "/marketplace" }}
    category="stone"
  />
);

export const TimberOffcutsSydney = () => (
  <SeoLandingPage
    title="Timber Offcuts Sydney — Hardwood, Pine, Plywood | Offcutt"
    metaDescription="Buy timber offcuts in Sydney: hardwood, pine, plywood, decking, framing. Surplus from Sydney builders and joiners. Pickup local, save big."
    h1="Timber offcuts and surplus in Sydney"
    intro="Find hardwood, pine, plywood, decking, framing and joinery timber from Sydney builders. End-of-job pack-outs and surplus stock at significant savings — ideal for renovators, joiners and DIYers."
    bullets={[
      "Hardwood, pine, plywood, MDF, decking and framing.",
      "End-of-job pack-outs from active Sydney builds.",
      "Pickup from sites across Greater Sydney.",
      "Reduce waste while saving on your next project.",
    ]}
    cta={{ label: "Browse timber offcuts", to: "/marketplace" }}
    category="timber"
  />
);

export const TileOffcutsSydney = () => (
  <SeoLandingPage
    title="Tile Offcuts Sydney — Ceramic, Porcelain, Mosaic | Offcutt"
    metaDescription="Buy surplus tiles in Sydney: ceramic, porcelain, mosaic, natural stone. Boxes and part-boxes from completed projects. Pickup local."
    h1="Tile offcuts and surplus boxes in Sydney"
    intro="Surplus tile boxes and part-boxes from Sydney bathroom, kitchen and commercial projects. Ceramic, porcelain, mosaic and natural stone — perfect for splashbacks, feature walls and small renovations."
    bullets={[
      "Ceramic, porcelain, mosaic and natural stone tiles.",
      "Full boxes and part-boxes from completed Sydney projects.",
      "Verified condition and accurate quantities.",
      "Pickup from suburbs across Sydney.",
    ]}
    cta={{ label: "Browse tile offcuts", to: "/marketplace" }}
    category="tile"
  />
);

export const MetalOffcutsSydney = () => (
  <SeoLandingPage
    title="Metal Offcuts Sydney — Steel, Aluminium, Stainless | Offcutt"
    metaDescription="Buy metal offcuts in Sydney: steel, aluminium, stainless, RHS, plate. Surplus from Sydney fabricators and builders. Pickup local, save on costs."
    h1="Metal offcuts and surplus stock in Sydney"
    intro="Steel, aluminium, stainless, RHS, SHS and plate offcuts from Sydney fabricators and builders. Ideal for small fabrication, repairs, sculpture and trade work — without paying full-length pricing."
    bullets={[
      "Steel, aluminium, stainless steel, copper and brass.",
      "RHS, SHS, plate, sheet and structural offcuts.",
      "Direct from Sydney fabricators and metal shops.",
      "Pickup from industrial suburbs across Sydney.",
    ]}
    cta={{ label: "Browse metal offcuts", to: "/marketplace" }}
    category="metal"
  />
);