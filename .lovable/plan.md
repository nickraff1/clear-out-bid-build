
# Fix Plan: Onboarding RLS Policies & Seller Portal Access

## Problem Summary
When clicking "I want to buy" or "I want to sell" in the onboarding wizard, users get the error: **"new row violates row-level security policy for table 'org_members'"**

This happens because the current database policies only allow existing organization members to add new members, creating an impossible situation for first-time users.

## Root Cause Analysis

### Issue 1: org_members INSERT Policy
The current policy requires you to already be a member of an organization to add yourself as a member:
```sql
CREATE POLICY "Org admins can manage members" ON public.org_members 
FOR ALL USING (public.is_org_member(auth.uid(), org_id) OR public.is_admin(auth.uid()));
```

### Issue 2: user_roles INSERT Policy  
Only admins can create roles, but new users aren't admins:
```sql
CREATE POLICY "Admins can manage roles" ON public.user_roles 
FOR ALL USING (public.is_admin(auth.uid()));
```

## Solution

### Part 1: Database Migration - Fix RLS Policies

Create new policies that allow:
1. Authenticated users to create their own organization membership (only for themselves)
2. Authenticated users to create their own initial role (only for themselves)

```text
Migration Changes:

1. Drop the overly restrictive policies for INSERT on org_members and user_roles

2. Add new policy for org_members:
   - Allow users to INSERT a row where user_id = their own auth.uid()
   - This allows self-registration during onboarding

3. Add new policy for user_roles:
   - Allow users to INSERT a row where user_id = their own auth.uid()
   - This allows users to assign themselves an initial role
```

### Part 2: Verify Seller Portal Access

The seller portal already exists with these routes:
- `/app/seller/overview` - Dashboard
- `/app/seller/events` - Manage events  
- `/app/seller/events/new` - Create new event
- `/app/seller/lots` - Manage lots
- `/app/seller/lots/new` - Create new lot with photo upload
- `/app/seller/orders` - View sales
- `/app/seller/pickups` - Manage pickups

Once the RLS fix is applied, users who select "I want to sell" will:
1. Get an organization created
2. Get added as an org_member
3. Get the `seller_admin` role assigned
4. Be redirected to `/app/seller/events/new` to create their first event

### Part 3: Update OnboardingWizard for Robustness

Add additional error handling and ensure the wizard:
- Shows clear loading states on buttons
- Displays specific error messages if any step fails
- Uses localStorage fallback for immediate navigation after role assignment

## Technical Details

### SQL Migration
```sql
-- Allow users to add themselves to organizations
DROP POLICY IF EXISTS "Org admins can manage members" ON public.org_members;

CREATE POLICY "Users can add themselves to orgs" ON public.org_members 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Org members can manage their org members" ON public.org_members 
FOR UPDATE USING (public.is_org_member(auth.uid(), org_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Org members can delete org members" ON public.org_members 
FOR DELETE USING (public.is_org_member(auth.uid(), org_id) OR public.is_admin(auth.uid()));

-- Allow users to assign themselves initial roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can assign themselves roles" ON public.user_roles 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update roles" ON public.user_roles 
FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles" ON public.user_roles 
FOR DELETE USING (public.is_admin(auth.uid()));
```

### Files to Modify
1. **New Migration** - Fix RLS policies for `org_members` and `user_roles`
2. **OnboardingWizard.tsx** - Minor improvements for error handling (already has toast notifications)

## What This Fixes

After implementing:
1. Users can click "I want to buy" or "I want to sell" without RLS errors
2. Organizations are created successfully
3. Users are added as org members
4. Users get their buyer_admin or seller_admin role
5. Sellers are redirected to the seller portal to create their first event
6. Buyers are redirected to the marketplace

## Existing Seller Portal Features

The seller portal is already fully built with:
- **Event Creation**: 3-step wizard (basics, constraints, review)
- **Lot Creation**: Photo uploads, pricing (fixed/auction), compliance tags
- **Dashboard**: Stats, recent events, upcoming pickups
- **Sales Management**: View and manage orders
- **Pickup Management**: Track collection status

## Security Considerations

The new policies are secure because:
- Users can only add THEMSELVES to organizations (`user_id = auth.uid()`)
- Users can only assign roles to THEMSELVES (`user_id = auth.uid()`)
- Existing UPDATE/DELETE restrictions remain admin-only
- This follows the principle of least privilege for self-service onboarding
