import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { AUSTRALIAN_STATES } from '@/lib/constants';

export default function NewEventPage() {
  const { user, primaryOrg } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    site_address: '',
    suburb: '',
    state: '',
    postcode: '',
    pickup_start: '',
    pickup_end: '',
    access_notes: '',
    contact_name: '',
    contact_phone: '',
    contact_email: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!primaryOrg) {
      setError('You need to set up an organization first.');
      return;
    }

    // Validation
    if (!formData.title || !formData.site_address || !formData.suburb || !formData.state || 
        !formData.pickup_start || !formData.pickup_end) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: insertError } = await supabase
        .from('clearance_events')
        .insert({
          org_id: primaryOrg.id,
          created_by: user!.id,
          title: formData.title,
          description: formData.description || null,
          site_address: formData.site_address,
          suburb: formData.suburb,
          state: formData.state,
          postcode: formData.postcode || null,
          pickup_start: new Date(formData.pickup_start).toISOString(),
          pickup_end: new Date(formData.pickup_end).toISOString(),
          access_notes: formData.access_notes || null,
          contact_name: formData.contact_name || null,
          contact_phone: formData.contact_phone || null,
          contact_email: formData.contact_email || null,
          status: 'draft'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      navigate(`/dashboard/events/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <Button variant="ghost" size="sm" className="mb-4 gap-1 pl-0" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Create Clearance Event</h1>
        <p className="text-muted-foreground">
          Set up a new site clearance with pickup window
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Basic Info */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Event Details</h2>
          
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g., Site Clearance - 123 Main St"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Brief description of what's available..."
              value={formData.description}
              onChange={handleChange}
              rows={3}
            />
          </div>
        </div>

        {/* Location */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Pickup Location</h2>
          
          <div className="space-y-2">
            <Label htmlFor="site_address">Site Address *</Label>
            <Input
              id="site_address"
              name="site_address"
              placeholder="123 Main Street"
              value={formData.site_address}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="suburb">Suburb *</Label>
              <Input
                id="suburb"
                name="suburb"
                placeholder="Sydney"
                value={formData.suburb}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
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

          <div className="space-y-2">
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

          <div className="space-y-2">
            <Label htmlFor="access_notes">Access Notes</Label>
            <Textarea
              id="access_notes"
              name="access_notes"
              placeholder="Loading dock at rear, forklift available, parking instructions..."
              value={formData.access_notes}
              onChange={handleChange}
              rows={2}
            />
          </div>
        </div>

        {/* Pickup Window */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Pickup Window</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pickup_start">Start Date/Time *</Label>
              <Input
                id="pickup_start"
                name="pickup_start"
                type="datetime-local"
                value={formData.pickup_start}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickup_end">End Date/Time *</Label>
              <Input
                id="pickup_end"
                name="pickup_end"
                type="datetime-local"
                value={formData.pickup_end}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Site Contact</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input
                id="contact_name"
                name="contact_name"
                placeholder="John Smith"
                value={formData.contact_name}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <Input
                id="contact_phone"
                name="contact_phone"
                placeholder="0400 000 000"
                value={formData.contact_phone}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">Contact Email</Label>
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              placeholder="john@example.com"
              value={formData.contact_email}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Event'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
