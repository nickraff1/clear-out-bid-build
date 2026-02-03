import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AUSTRALIAN_STATES } from '@/lib/constants';
import type { OrgType } from '@/types/database';

export default function OrganizationPage() {
  const { user, primaryOrg, organizations, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    name: primaryOrg?.name ?? '',
    org_type: (primaryOrg?.org_type ?? 'buyer') as OrgType,
    abn: primaryOrg?.abn ?? '',
    phone: primaryOrg?.phone ?? '',
    email: primaryOrg?.email ?? '',
    address: primaryOrg?.address ?? '',
    suburb: primaryOrg?.suburb ?? '',
    state: primaryOrg?.state ?? '',
    postcode: primaryOrg?.postcode ?? ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!formData.name) {
      setError('Organization name is required.');
      return;
    }

    setLoading(true);
    try {
      if (primaryOrg) {
        // Update existing org
        const { error: updateError } = await supabase
          .from('organizations')
          .update({
            name: formData.name,
            org_type: formData.org_type,
            abn: formData.abn || null,
            phone: formData.phone || null,
            email: formData.email || null,
            address: formData.address || null,
            suburb: formData.suburb || null,
            state: formData.state || null,
            postcode: formData.postcode || null
          })
          .eq('id', primaryOrg.id);

        if (updateError) throw updateError;
      } else {
        // Create new org
        const { data: newOrg, error: insertError } = await supabase
          .from('organizations')
          .insert({
            name: formData.name,
            org_type: formData.org_type,
            abn: formData.abn || null,
            phone: formData.phone || null,
            email: formData.email || null,
            address: formData.address || null,
            suburb: formData.suburb || null,
            state: formData.state || null,
            postcode: formData.postcode || null,
            is_approved: true // Auto-approve for now
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Add user as member
        await supabase.from('org_members').insert({
          user_id: user!.id,
          org_id: newOrg.id,
          is_primary: true
        });

        // Add appropriate role
        const role = formData.org_type === 'seller' || formData.org_type === 'fabricator' 
          ? 'seller_admin' 
          : 'buyer_admin';
        
        await supabase.from('user_roles').insert({
          user_id: user!.id,
          role
        });
      }

      setSuccess(true);
      await refreshProfile();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Organization</h1>
        <p className="text-muted-foreground">
          {primaryOrg ? 'Manage your organization details' : 'Set up your organization to start buying or selling'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-success/20 bg-success/10">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">Organization saved successfully!</AlertDescription>
          </Alert>
        )}

        {/* Organization Type */}
        <div className="space-y-4">
          <Label>Organization Type *</Label>
          <RadioGroup
            value={formData.org_type}
            onValueChange={(value) => setFormData(prev => ({ ...prev, org_type: value as OrgType }))}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <Label
              htmlFor="buyer"
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                formData.org_type === 'buyer' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <RadioGroupItem value="buyer" id="buyer" className="sr-only" />
              <Building2 className="h-6 w-6" />
              <span className="font-medium">Buyer</span>
              <span className="text-xs text-muted-foreground text-center">Purchase surplus materials</span>
            </Label>
            <Label
              htmlFor="seller"
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                formData.org_type === 'seller' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <RadioGroupItem value="seller" id="seller" className="sr-only" />
              <Building2 className="h-6 w-6" />
              <span className="font-medium">Seller</span>
              <span className="text-xs text-muted-foreground text-center">Builder clearing sites</span>
            </Label>
            <Label
              htmlFor="fabricator"
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                formData.org_type === 'fabricator' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <RadioGroupItem value="fabricator" id="fabricator" className="sr-only" />
              <Building2 className="h-6 w-6" />
              <span className="font-medium">Fabricator</span>
              <span className="text-xs text-muted-foreground text-center">Buy and sell materials</span>
            </Label>
          </RadioGroup>
        </div>

        {/* Basic Info */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name *</Label>
            <Input
              id="name"
              name="name"
              placeholder="ABC Construction"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="abn">ABN</Label>
              <Input
                id="abn"
                name="abn"
                placeholder="12 345 678 901"
                value={formData.abn}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                placeholder="02 1234 5678"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Business Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="info@abcconstruction.com.au"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Business Address</h2>
          
          <div className="space-y-2">
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              name="address"
              placeholder="123 Business Street"
              value={formData.address}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="suburb">Suburb</Label>
              <Input
                id="suburb"
                name="suburb"
                placeholder="Sydney"
                value={formData.suburb}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select 
                value={formData.state} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, state: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {AUSTRALIAN_STATES.map(state => (
                    <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 max-w-[200px]">
            <Label htmlFor="postcode">Postcode</Label>
            <Input
              id="postcode"
              name="postcode"
              placeholder="2000"
              value={formData.postcode}
              onChange={handleChange}
              maxLength={4}
            />
          </div>
        </div>

        <div className="pt-4">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : primaryOrg ? (
              'Save Changes'
            ) : (
              'Create Organization'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
