
# Comprehensive Fix Plan for Offcutt Marketplace

## Issues Identified

After thorough investigation, I've found the following problems:

### 1. Onboarding Wizard Buttons Not Working
**Root Cause**: The `handleRoleSelect` function is throwing an error because when inserting into the `organizations` table, the `org_type` field expects the database enum value ('seller' or 'buyer'), but there may be a conflict or the database insert is failing silently.

**Technical Details**:
- The buttons are clickable but the async operation fails
- The error is likely being caught and logged to console, but not displayed to user
- The `isLoading` state prevents re-clicking during the operation

### 2. Seller Portal Not Accessible
**Root Cause**: After role selection fails, the user has no role assigned, so:
- `RoleGuard` redirects them to login or buyer portal
- `AppRedirect` routes them to `/app/buyer/overview` by default
- The sidebar shows "Buyer Portal" even when they should be a seller

### 3. Bidding Functionality Causing Blank Screen
**Root Cause**: The auction engine edge function call is failing. Possible issues:
- Edge function may not be properly deployed
- CORS headers or auth token issues
- The `supabase.functions.invoke()` error is not being caught properly

### 4. Missing Navigation Links
- "For Sellers" in header may still point to `/for-sellers` instead of `/app`

---

## Fix Implementation Plan

### Phase 1: Fix Onboarding Wizard (Critical)

**File**: `src/components/onboarding/OnboardingWizard.tsx`

1. **Add proper error handling and user feedback**:
   - Display toast notifications for errors
   - Show loading state with spinner
   - Add console logging for debugging

2. **Fix the role selection logic**:
   - Ensure organization creation uses correct enum values
   - Handle RLS policy conflicts gracefully
   - Add fallback for users who already have partial setup

3. **Add visual feedback**:
   - Show loading spinner on the clicked button
   - Disable buttons during operation
   - Display error messages to user

### Phase 2: Fix Seller Portal Access

**File**: `src/components/app/AppRedirect.tsx`

1. **Update redirect logic**:
   - If user has no roles but just completed onboarding, route based on localStorage flag
   - Add more robust role detection

**File**: `src/components/app/RoleGuard.tsx`

2. **Improve role guard**:
   - Handle case where user just signed up and roles are loading
   - Allow seller access for users who completed seller onboarding

### Phase 3: Fix Bidding Functionality

**File**: `src/pages/LotDetail.tsx`

1. **Improve error handling in handleBid**:
   - Add try-catch with specific error messages
   - Handle network errors vs function errors
   - Prevent blank screen by showing error state

2. **Add defensive coding**:
   - Check for undefined responses
   - Add loading states during bid submission

**File**: `supabase/functions/auction-engine/index.ts`

3. **Ensure edge function is robust**:
   - Verify CORS headers are complete
   - Add more logging for debugging
   - Handle edge cases

### Phase 4: Fix Navigation Links

**File**: `src/components/layout/Header.tsx`

1. **Update "For Sellers" link**:
   - Change from `/for-sellers` to `/app` (which redirects based on role)
   - Or create a proper `/for-sellers` info page

### Phase 5: Deploy and Test Edge Function

1. **Redeploy auction-engine**:
   - Ensure the function is properly deployed
   - Test with curl to verify it responds

---

## Detailed Code Changes

### OnboardingWizard.tsx Changes

```typescript
// Add toast import
import { useToast } from '@/hooks/use-toast';

// In component:
const { toast } = useToast();

// Improved handleRoleSelect:
const handleRoleSelect = async (role: 'buyer' | 'seller') => {
  setSelectedRole(role);
  setIsLoading(true);

  try {
    // Create organization
    const orgName = profile?.full_name 
      ? `${profile.full_name}'s ${role === 'seller' ? 'Business' : 'Account'}` 
      : `My ${role === 'seller' ? 'Business' : 'Account'}`;
    
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        org_type: role,
        email: profile?.email || user?.email,
        is_approved: true,
      })
      .select()
      .single();

    if (orgError) {
      console.error('Org creation error:', orgError);
      toast({
        title: 'Error creating organization',
        description: orgError.message,
        variant: 'destructive'
      });
      return;
    }

    // Add user as org member
    const { error: memberError } = await supabase
      .from('org_members')
      .insert({
        org_id: org.id,
        user_id: user!.id,
        is_primary: true
      });

    if (memberError) {
      console.error('Member creation error:', memberError);
      toast({
        title: 'Error joining organization',
        description: memberError.message,
        variant: 'destructive'
      });
      return;
    }

    // Add user role
    const roleValue = role === 'seller' ? 'seller_admin' : 'buyer_admin';
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: user!.id,
        role: roleValue
      });

    if (roleError) {
      console.error('Role creation error:', roleError);
      toast({
        title: 'Error assigning role',
        description: roleError.message,
        variant: 'destructive'
      });
      return;
    }

    // Success
    await refreshProfile();
    toast({
      title: 'Setup complete!',
      description: `You're now set up as a ${role}`,
    });
    setStep(2);
  } catch (error: any) {
    console.error('Error setting up role:', error);
    toast({
      title: 'Setup failed',
      description: error.message || 'Please try again',
      variant: 'destructive'
    });
  } finally {
    setIsLoading(false);
  }
};
```

### LotDetail.tsx Bidding Fix

```typescript
const handleBid = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!user) {
    navigate('/login');
    return;
  }
  
  if (!primaryOrg) {
    setBidError('Please complete your account setup first');
    return;
  }
  
  if (!lot) return;

  setBidError('');
  setBidSuccess(false);
  
  const amount = parseFloat(bidAmount);
  const minBid = getMinNextBid(lot.current_bid ?? lot.start_price ?? 0);
  
  if (isNaN(amount) || amount < minBid) {
    setBidError(`Minimum bid is $${minBid.toLocaleString()}`);
    return;
  }

  setBidLoading(true);
  try {
    const { data, error } = await supabase.functions.invoke('auction-engine', {
      body: {
        action: 'place-bid',
        lot_id: lot.id,
        amount,
        org_id: primaryOrg.id
      }
    });

    // Handle function invocation errors
    if (error) {
      console.error('Edge function error:', error);
      setBidError(error.message || 'Failed to place bid. Please try again.');
      return;
    }
    
    // Handle application-level errors from the function
    if (data?.error) {
      setBidError(data.error);
      return;
    }

    // Success
    setBidSuccess(true);
    setBidAmount('');
    
    // Refresh lot data
    fetchLot();
    fetchBids();
  } catch (error: any) {
    console.error('Bid submission error:', error);
    setBidError('Network error. Please check your connection and try again.');
  } finally {
    setBidLoading(false);
  }
};
```

### Header.tsx Navigation Fix

Ensure "For Sellers" link points to `/app` which redirects based on role, or to a dedicated `/for-sellers` info page.

---

## Testing Plan

After implementation:

1. **Test Onboarding**:
   - Create new account
   - Click "I want to sell" - verify organization and role are created
   - Verify redirect to seller portal

2. **Test Seller Portal**:
   - Access `/app/seller/overview`
   - Create new event
   - Add lot with photos
   - Publish lot

3. **Test Bidding**:
   - Log in as buyer
   - Navigate to auction lot
   - Place bid
   - Verify bid appears and lot updates

4. **Test All Navigation**:
   - Check every header link
   - Check every sidebar link
   - Verify no 404s

---

## About Credits

I cannot provide refunds as I'm an AI assistant without access to billing systems. For credit-related concerns, please:
- Contact Lovable support via the help menu
- Visit https://docs.lovable.dev for support options
- Check your account settings for billing history
