
# Fix: "Browse Marketplace" Button Visibility on Dark Background

## Problem
The "Browse Marketplace" button in the CTA section (dark `bg-secondary` background) appears nearly invisible because:
- The `variant="outline"` button has a transparent/white background inherited from the base outline style
- The text uses `text-secondary-foreground` (white) but blends with the light background
- This creates poor contrast making the button text unreadable before hover

## Solution
Change the button from `variant="outline"` with custom classes to `variant="hero-outline"`, which is specifically designed for use on dark backgrounds.

### Current Code (Line 250 in `src/pages/Index.tsx`)
```jsx
<Button size="xl" variant="outline" className="border-secondary-foreground/20 text-secondary-foreground hover:bg-secondary-foreground/10" asChild>
  <Link to="/marketplace">
    Browse Marketplace
  </Link>
</Button>
```

### Fixed Code
```jsx
<Button size="xl" variant="hero-outline" asChild>
  <Link to="/marketplace">
    Browse Marketplace
  </Link>
</Button>
```

## Why This Works
The `hero-outline` variant (defined in `button.tsx`) has proper styling for dark backgrounds:
```typescript
"hero-outline": "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold"
```

This gives:
- Orange border (`border-primary`) - visible on dark background
- Orange text (`text-primary`) - high contrast on charcoal
- On hover: fills with orange and changes text to white

## Files to Modify
| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Replace `variant="outline"` with `variant="hero-outline"` and remove custom classes on line 250 |

## Visual Result
- **Before**: White/invisible text on dark background
- **After**: Orange-outlined button with orange text, clearly visible on the dark charcoal CTA section
