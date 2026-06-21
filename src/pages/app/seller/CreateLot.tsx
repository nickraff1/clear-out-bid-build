import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Camera, Check, Gavel, Loader2, Tag, Trash2, X } from 'lucide-react';
import { DEFAULT_CATEGORIES, LOT_CONDITIONS } from '@/lib/constants';
import type { ClearanceEvent, ComplianceTag } from '@/types/database';

const COMPLIANCE_TAGS = [
  'Fire Rated',
  'Acoustic',
  'Timber Grade',
  'Stone Thickness',
  'Waterproof',
  'Insulated',
  'UV Resistant',
  'Anti-Slip',
];

export default function CreateLot() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, primaryOrg } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<ClearanceEvent[]>([]);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);

  const [formData, setFormData] = useState({
    event_id: searchParams.get('eventId') || '',
    category: '',
    title: '',
    description: '',
    quantity: 1,
    unit: 'each',
    condition: 'unused',
    pricing_type: 'fixed' as 'fixed' | 'auction',
    fixed_price: '',
    start_price: '',
    reserve_price: '',
    auction_end: '',
    compliance_tags: [] as string[],
    publish: false,
  });

  useEffect(() => {
    if (primaryOrg) {
      fetchEvents();
    }
  }, [primaryOrg]);

  const fetchEvents = async () => {
    const { data } = await supabase
      .from('clearance_events')
      .select('*')
      .eq('org_id', primaryOrg!.id)
      .in('status', ['draft', 'active'])
      .order('created_at', { ascending: false });

    if (data) {
      setEvents(data);
      // If no event selected and only one event exists, auto-select it
      if (!formData.event_id && data.length === 1) {
        setFormData(prev => ({ ...prev, event_id: data[0].id }));
      }
    }
  };

  // Auto-create a default "Ongoing listings" event if seller has none
  const ensureDefaultEvent = async (): Promise<string | null> => {
    if (formData.event_id) return formData.event_id;
    if (events.length > 0) return events[0].id;
    if (!primaryOrg || !user) return null;
    const now = new Date();
    const end = new Date(); end.setMonth(end.getMonth() + 3);
    const { data, error } = await supabase
      .from('clearance_events')
      .insert({
        org_id: primaryOrg.id,
        created_by: user.id,
        title: 'Ongoing listings',
        site_address: primaryOrg.address ?? 'TBC',
        suburb: primaryOrg.suburb ?? 'TBC',
        state: primaryOrg.state ?? 'NSW',
        postcode: primaryOrg.postcode ?? '',
        pickup_start: now.toISOString(),
        pickup_end: end.toISOString(),
        status: 'active',
      })
      .select('id').single();
    if (error) {
      console.error('ensureDefaultEvent', error);
      return null;
    }
    return data.id;
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleComplianceTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      compliance_tags: prev.compliance_tags.includes(tag)
        ? prev.compliance_tags.filter(t => t !== tag)
        : [...prev.compliance_tags, tag]
    }));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setPhotos(prev => [...prev, ...newPhotos].slice(0, 10)); // Max 10 photos
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const validate = (): boolean => {
    setError('');
    
    if (!formData.category) {
      setError('Please select a category');
      return false;
    }
    if (!formData.title.trim()) {
      setError('Title is required');
      return false;
    }
    if (formData.quantity < 1) {
      setError('Quantity must be at least 1');
      return false;
    }
    if (photos.length === 0) {
      setError('At least one photo is required');
      return false;
    }
    
    if (formData.pricing_type === 'fixed') {
      if (!formData.fixed_price || parseFloat(formData.fixed_price) <= 0) {
        setError('Fixed price must be greater than 0');
        return false;
      }
    } else {
      if (!formData.start_price || parseFloat(formData.start_price) <= 0) {
        setError('Starting price must be greater than 0');
        return false;
      }
      if (!formData.auction_end) {
        setError('Auction end date is required');
        return false;
      }
      if (new Date(formData.auction_end) <= new Date()) {
        setError('Auction end must be in the future');
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validate() || !user) return;
    
    setLoading(true);
    setError('');

    try {
      // Ensure we have an event (auto-create default if seller has none)
      const eventId = await ensureDefaultEvent();
      if (!eventId) {
        setError('Could not create or find a clearance event. Please try again.');
        setLoading(false);
        return;
      }

      // Create lot
      const lotData: any = {
        event_id: eventId,
        category_id: null, // Will need to map category slug to ID
        title: formData.title,
        description: formData.description || null,
        quantity: formData.quantity,
        unit: formData.unit,
        condition: formData.condition,
        pricing_type: formData.pricing_type,
        status: formData.publish ? 'active' : 'draft',
      };

      if (formData.pricing_type === 'fixed') {
        lotData.fixed_price = parseFloat(formData.fixed_price);
      } else {
        lotData.start_price = parseFloat(formData.start_price);
        lotData.reserve_price = formData.reserve_price ? parseFloat(formData.reserve_price) : null;
        lotData.auction_end = formData.auction_end;
      }

      const { data: lot, error: lotError } = await supabase
        .from('lots')
        .insert(lotData)
        .select()
        .single();

      if (lotError) throw lotError;

      // Upload photos to Supabase Storage
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const fileExt = photo.file.name.split('.').pop();
        const fileName = `${lot.id}/${Date.now()}-${i}.${fileExt}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('lot-photos')
          .upload(fileName, photo.file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          // Continue with other photos even if one fails
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('lot-photos')
          .getPublicUrl(fileName);

        // Save to lot_media table
        await supabase.from('lot_media').insert({
          lot_id: lot.id,
          url: urlData.publicUrl,
          type: 'image',
          is_primary: i === 0,
          sort_order: i,
        });
      }

      // Navigate back to listings
      navigate(`/app/seller/lots?created=1`);
    } catch (err: any) {
      setError(err.message || 'Failed to create lot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Add New Lot</h1>
        <p className="text-muted-foreground">List an item for sale in your clearance event</p>
      </div>

      <div className="space-y-6">
        {/* Event Selection (optional - skipped when seller has no events) */}
        {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Clearance event (optional)</CardTitle>
            <CardDescription>Group this listing under an existing material drop, or leave blank to list it on its own.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={formData.event_id || 'none'} onValueChange={(v) => updateFormData('event_id', v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No event — list on its own</SelectItem>
                {events.map(event => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title} ({event.suburb})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        )}

        {/* Photos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Photos *</CardTitle>
            <CardDescription>Add at least 1 photo. First photo will be the main image.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-square">
                  <img
                    src={photo.preview}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  {index === 0 && (
                    <Badge className="absolute top-1 left-1 text-xs">Main</Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              
              {photos.length < 10 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-primary transition-colors"
                >
                  <Camera className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Add Photo</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={formData.category} onValueChange={(v) => updateFormData('category', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_CATEGORIES.map(cat => (
                    <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Solid Oak Internal Doors (6 units)"
                value={formData.title}
                onChange={(e) => updateFormData('title', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the item, dimensions, condition..."
                value={formData.description}
                onChange={(e) => updateFormData('description', e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={formData.quantity}
                  onChange={(e) => updateFormData('quantity', parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select value={formData.unit} onValueChange={(v) => updateFormData('unit', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="each">Each</SelectItem>
                    <SelectItem value="sqm">Sqm</SelectItem>
                    <SelectItem value="lm">Linear m</SelectItem>
                    <SelectItem value="pack">Pack</SelectItem>
                    <SelectItem value="lot">Lot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Condition *</Label>
              <Select value={formData.condition} onValueChange={(v) => updateFormData('condition', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOT_CONDITIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label} - {c.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Compliance Tags</CardTitle>
            <CardDescription>Optional - add relevant certifications or specs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {COMPLIANCE_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleComplianceTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    formData.compliance_tags.includes(tag)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {formData.compliance_tags.includes(tag) && (
                    <Check className="h-3 w-3 inline mr-1" />
                  )}
                  {tag}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={formData.pricing_type}
              onValueChange={(v: 'fixed' | 'auction') => updateFormData('pricing_type', v)}
              className="grid grid-cols-2 gap-4"
            >
              <Label
                htmlFor="fixed"
                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  formData.pricing_type === 'fixed' ? 'border-primary bg-primary/5' : 'border-muted'
                }`}
              >
                <RadioGroupItem value="fixed" id="fixed" />
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Fixed Price
                  </p>
                  <p className="text-sm text-muted-foreground">Sell at set price</p>
                </div>
              </Label>
              <Label
                htmlFor="auction"
                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  formData.pricing_type === 'auction' ? 'border-primary bg-primary/5' : 'border-muted'
                }`}
              >
                <RadioGroupItem value="auction" id="auction" />
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Gavel className="h-4 w-4" />
                    Auction
                  </p>
                  <p className="text-sm text-muted-foreground">Accept bids</p>
                </div>
              </Label>
            </RadioGroup>

            {formData.pricing_type === 'fixed' ? (
              <div className="space-y-2">
                <Label htmlFor="fixed_price">Price ($) *</Label>
                <Input
                  id="fixed_price"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={formData.fixed_price}
                  onChange={(e) => updateFormData('fixed_price', e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_price">Starting Price ($) *</Label>
                    <Input
                      id="start_price"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={formData.start_price}
                      onChange={(e) => updateFormData('start_price', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reserve_price">Reserve (Optional)</Label>
                    <Input
                      id="reserve_price"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={formData.reserve_price}
                      onChange={(e) => updateFormData('reserve_price', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auction_end">Auction Ends *</Label>
                  <Input
                    id="auction_end"
                    type="datetime-local"
                    value={formData.auction_end}
                    onChange={(e) => updateFormData('auction_end', e.target.value)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              updateFormData('publish', false);
              handleSubmit();
            }}
            disabled={loading}
          >
            Save as Draft
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              updateFormData('publish', true);
              handleSubmit();
            }}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Publish Lot
          </Button>
        </div>
      </div>
    </div>
  );
}
