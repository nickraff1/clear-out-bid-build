import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Calendar, Check, Loader2, MapPin, Settings } from 'lucide-react';
import { AUSTRALIAN_STATES } from '@/lib/constants';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'basics', title: 'Event Basics', description: 'Project name and location' },
  { id: 'constraints', title: 'Site Constraints', description: 'Access and pickup details' },
  { id: 'review', title: 'Review', description: 'Confirm and create' },
];

type EventFormData = {
  title: string;
  description: string;
  site_address: string;
  suburb: string;
  state: string;
  postcode: string;
  pickup_start: string;
  pickup_end: string;
  access_notes: string;
  has_forklift: boolean;
  has_dock: boolean;
  pickup_hours: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
};

export default function CreateEvent() {
  const navigate = useNavigate();
  const { user, primaryOrg } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState<EventFormData>({
    // Step 1: Basics
    title: '',
    description: '',
    site_address: '',
    suburb: '',
    state: 'NSW',
    postcode: '',
    pickup_start: '',
    pickup_end: '',
    
    // Step 2: Constraints
    access_notes: '',
    has_forklift: false,
    has_dock: false,
    pickup_hours: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
  });

  const updateFormData = <K extends keyof EventFormData>(field: K, value: EventFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    setError('');
    
    if (step === 0) {
      if (!formData.title.trim()) {
        setError('Event title is required');
        return false;
      }
      if (!formData.site_address.trim()) {
        setError('Site address is required');
        return false;
      }
      if (!formData.suburb.trim()) {
        setError('Suburb is required');
        return false;
      }
      if (!formData.pickup_start || !formData.pickup_end) {
        setError('Pickup dates are required');
        return false;
      }
      if (new Date(formData.pickup_start) >= new Date(formData.pickup_end)) {
        setError('Pickup end must be after pickup start');
        return false;
      }
    }
    
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!primaryOrg || !user) return;
    
    setLoading(true);
    setError('');

    try {
      // Build access notes with constraints
      let accessNotes = formData.access_notes;
      const constraints = [];
      if (formData.has_forklift) constraints.push('Forklift available');
      if (formData.has_dock) constraints.push('Loading dock access');
      if (formData.pickup_hours) constraints.push(`Pickup hours: ${formData.pickup_hours}`);
      if (constraints.length > 0) {
        accessNotes = `${accessNotes}\n\n${constraints.join(' • ')}`.trim();
      }

      const { data, error: insertError } = await supabase
        .from('clearance_events')
        .insert({
          org_id: primaryOrg.id,
          created_by: user.id,
          title: formData.title,
          description: formData.description || null,
          site_address: formData.site_address,
          suburb: formData.suburb,
          state: formData.state,
          postcode: formData.postcode || null,
          pickup_start: formData.pickup_start,
          pickup_end: formData.pickup_end,
          access_notes: accessNotes || null,
          contact_name: formData.contact_name || null,
          contact_phone: formData.contact_phone || null,
          contact_email: formData.contact_email || null,
          status: 'draft',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Navigate to the event details to add lots
      navigate(`/app/seller/events/${data.id}?created=true`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Create Clearance Event</h1>
        <p className="text-muted-foreground">Set up a new event to start listing your surplus materials</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-full border-2 font-medium transition-colors',
                index < currentStep
                  ? 'bg-primary border-primary text-primary-foreground'
                  : index === currentStep
                  ? 'border-primary text-primary'
                  : 'border-muted-foreground/30 text-muted-foreground'
              )}
            >
              {index < currentStep ? <Check className="h-5 w-5" /> : index + 1}
            </div>
            <div className="hidden sm:block ml-3">
              <p className={cn(
                'text-sm font-medium',
                index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn(
                'w-12 sm:w-24 h-0.5 mx-4',
                index < currentStep ? 'bg-primary' : 'bg-muted-foreground/30'
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentStep === 0 && <MapPin className="h-5 w-5" />}
            {currentStep === 1 && <Settings className="h-5 w-5" />}
            {currentStep === 2 && <Check className="h-5 w-5" />}
            {STEPS[currentStep].title}
          </CardTitle>
          <CardDescription>{STEPS[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Basics */}
          {currentStep === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Westfield Tower Fitout Clearance"
                  value={formData.title}
                  onChange={(e) => updateFormData('title', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the materials available..."
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="site_address">Site Address *</Label>
                <Input
                  id="site_address"
                  placeholder="123 Main Street"
                  value={formData.site_address}
                  onChange={(e) => updateFormData('site_address', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="suburb">Suburb *</Label>
                  <Input
                    id="suburb"
                    placeholder="Sydney CBD"
                    value={formData.suburb}
                    onChange={(e) => updateFormData('suburb', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Select value={formData.state} onValueChange={(v) => updateFormData('state', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUSTRALIAN_STATES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  placeholder="2000"
                  value={formData.postcode}
                  onChange={(e) => updateFormData('postcode', e.target.value)}
                  maxLength={4}
                  className="w-32"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pickup_start">Pickup Start *</Label>
                  <Input
                    id="pickup_start"
                    type="datetime-local"
                    value={formData.pickup_start}
                    onChange={(e) => updateFormData('pickup_start', e.target.value)}
                    onInput={(e) => updateFormData('pickup_start', e.currentTarget.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickup_end">Pickup End *</Label>
                  <Input
                    id="pickup_end"
                    type="datetime-local"
                    value={formData.pickup_end}
                    onChange={(e) => updateFormData('pickup_end', e.target.value)}
                    onInput={(e) => updateFormData('pickup_end', e.currentTarget.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 2: Constraints */}
          {currentStep === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="access_notes">Access Notes</Label>
                <Textarea
                  id="access_notes"
                  placeholder="Entry via loading dock on Smith Street. Report to site office on Level 1."
                  value={formData.access_notes}
                  onChange={(e) => updateFormData('access_notes', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-4">
                <Label>Site Facilities</Label>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has_forklift"
                      checked={formData.has_forklift}
                      onCheckedChange={(checked) => updateFormData('has_forklift', checked)}
                    />
                    <Label htmlFor="has_forklift" className="font-normal">Forklift available</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="has_dock"
                      checked={formData.has_dock}
                      onCheckedChange={(checked) => updateFormData('has_dock', checked)}
                    />
                    <Label htmlFor="has_dock" className="font-normal">Loading dock access</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pickup_hours">Pickup Hours</Label>
                <Input
                  id="pickup_hours"
                  placeholder="e.g., 7am - 4pm weekdays only"
                  value={formData.pickup_hours}
                  onChange={(e) => updateFormData('pickup_hours', e.target.value)}
                />
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-medium mb-4">Site Contact (Optional)</h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_name">Name</Label>
                    <Input
                      id="contact_name"
                      placeholder="John Smith"
                      value={formData.contact_name}
                      onChange={(e) => updateFormData('contact_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_phone">Phone</Label>
                    <Input
                      id="contact_phone"
                      placeholder="0412 345 678"
                      value={formData.contact_phone}
                      onChange={(e) => updateFormData('contact_phone', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_email">Email</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      placeholder="john@example.com"
                      value={formData.contact_email}
                      onChange={(e) => updateFormData('contact_email', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Review */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="rounded-lg border p-4 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Event Title</p>
                  <p className="font-medium">{formData.title}</p>
                </div>
                
                {formData.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-sm">{formData.description}</p>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{formData.site_address}</p>
                    <p className="text-sm">{formData.suburb}, {formData.state} {formData.postcode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pickup Window</p>
                    <p className="font-medium">
                      {formData.pickup_start && new Date(formData.pickup_start).toLocaleDateString('en-AU', { 
                        weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
                      })}
                    </p>
                    <p className="text-sm">
                      to {formData.pickup_end && new Date(formData.pickup_end).toLocaleDateString('en-AU', { 
                        weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>

                {(formData.has_forklift || formData.has_dock || formData.access_notes) && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Site Details</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.has_forklift && (
                        <span className="text-xs bg-muted px-2 py-1 rounded">Forklift available</span>
                      )}
                      {formData.has_dock && (
                        <span className="text-xs bg-muted px-2 py-1 rounded">Loading dock</span>
                      )}
                    </div>
                    {formData.access_notes && (
                      <p className="text-sm">{formData.access_notes}</p>
                    )}
                  </div>
                )}

                {formData.contact_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Site Contact</p>
                    <p className="font-medium">{formData.contact_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formData.contact_phone} {formData.contact_email && `• ${formData.contact_email}`}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  Your event will be created as a <strong>draft</strong>. You can add lots and publish it when you're ready.
                </p>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Create Event
          </Button>
        )}
      </div>
    </div>
  );
}
