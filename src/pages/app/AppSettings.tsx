import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Check, Loader2, LogOut, User } from 'lucide-react';
import { AUSTRALIAN_STATES } from '@/lib/constants';
import type { Organization } from '@/types/database';

export default function AppSettings() {
  const { user, profile, primaryOrg, signOut, refreshProfile, isSeller } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [profileData, setProfileData] = useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
  });

  const [orgData, setOrgData] = useState({
    name: primaryOrg?.name ?? '',
    abn: primaryOrg?.abn ?? '',
    phone: primaryOrg?.phone ?? '',
    email: primaryOrg?.email ?? '',
    address: primaryOrg?.address ?? '',
    suburb: primaryOrg?.suburb ?? '',
    state: primaryOrg?.state ?? 'NSW',
    postcode: primaryOrg?.postcode ?? '',
  });

  useEffect(() => {
    if (profile) {
      setProfileData({
        full_name: profile.full_name ?? '',
        phone: profile.phone ?? '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (primaryOrg) {
      setOrgData({
        name: primaryOrg.name ?? '',
        abn: primaryOrg.abn ?? '',
        phone: primaryOrg.phone ?? '',
        email: primaryOrg.email ?? '',
        address: primaryOrg.address ?? '',
        suburb: primaryOrg.suburb ?? '',
        state: primaryOrg.state ?? 'NSW',
        postcode: primaryOrg.postcode ?? '',
      });
    }
  }, [primaryOrg]);

  const saveProfile = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
        })
        .eq('id', user!.id);

      if (error) throw error;
      
      await refreshProfile();
      setSuccess('Profile updated successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveOrganization = async () => {
    if (!primaryOrg) return;
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase
        .from('organizations')
        .update(orgData)
        .eq('id', primaryOrg.id);

      if (error) throw error;
      
      await refreshProfile();
      setSuccess('Organization updated successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and organization</p>
      </div>

      {success && (
        <Alert className="border-success/20 bg-success/10">
          <Check className="h-4 w-4 text-success" />
          <AlertDescription className="text-success">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          {primaryOrg && (
            <TabsTrigger value="organization">
              <Building2 className="h-4 w-4 mr-2" />
              Organization
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={profile?.email ?? ''}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="0412 345 678"
                />
              </div>

              <Button onClick={saveProfile} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {primaryOrg && (
          <TabsContent value="organization" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>Manage your business information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org_name">Business Name</Label>
                  <Input
                    id="org_name"
                    value={orgData.name}
                    onChange={(e) => setOrgData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="abn">ABN</Label>
                  <Input
                    id="abn"
                    value={orgData.abn}
                    onChange={(e) => setOrgData(prev => ({ ...prev, abn: e.target.value }))}
                    placeholder="XX XXX XXX XXX"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="org_phone">Phone</Label>
                    <Input
                      id="org_phone"
                      value={orgData.phone}
                      onChange={(e) => setOrgData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org_email">Email</Label>
                    <Input
                      id="org_email"
                      type="email"
                      value={orgData.email}
                      onChange={(e) => setOrgData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={orgData.address}
                    onChange={(e) => setOrgData(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="suburb">Suburb</Label>
                    <Input
                      id="suburb"
                      value={orgData.suburb}
                      onChange={(e) => setOrgData(prev => ({ ...prev, suburb: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Select 
                      value={orgData.state} 
                      onValueChange={(v) => setOrgData(prev => ({ ...prev, state: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AUSTRALIAN_STATES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      value={orgData.postcode}
                      onChange={(e) => setOrgData(prev => ({ ...prev, postcode: e.target.value }))}
                      maxLength={4}
                    />
                  </div>
                </div>

                <Button onClick={saveOrganization} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Organization
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
