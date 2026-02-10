import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { Layout } from '@/components/Layout';
import { Mail, User, Shield, GraduationCap, Edit2, Check, X, Lock, Copy, Camera, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Profile {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
  avatar_url?: string | null;
}

export default function Profile() {
  const { toast } = useToast();
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user?.id]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/auth/profile');
      setProfile(response.data.data);
      setFormData({ username: response.data.data.username });
    } catch (error: any) {
      console.error('Failed to fetch profile:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to load profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!formData.username.trim()) {
      toast({
        title: 'Error',
        description: 'Username cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await api.patch('/auth/profile', {
        username: formData.username.trim(),
      });

      setProfile(response.data.data);
      setEditing(false);
      // Sync global auth state
      await refreshProfile();
      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'All password fields are required',
        variant: 'destructive',
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'New password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'New passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    setChangingPassword(true);
    try {
      await api.patch('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      setShowPasswordDialog(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      
      toast({
        title: 'Success',
        description: 'Password changed successfully',
      });
    } catch (error: any) {
      console.error('Failed to change password:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to change password',
        variant: 'destructive',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-5 w-5 text-red-500" />;
      case 'teacher':
        return <GraduationCap className="h-5 w-5 text-blue-500" />;
      case 'student':
        return <User className="h-5 w-5 text-green-500" />;
      default:
        return <User className="h-5 w-5" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'teacher':
        return 'bg-blue-100 text-blue-800';
      case 'student':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Account ID copied to clipboard',
    });
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image size must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await api.post('/auth/upload-avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setProfile(response.data.data);
      // Sync global auth state so nav/avatar updates
      await refreshProfile();
      toast({
        title: 'Success',
        description: 'Profile picture updated successfully',
      });
    } catch (error: any) {
      console.error('Failed to upload avatar:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to upload profile picture',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarDelete = async () => {
    setUploadingAvatar(true);
    try {
      const response = await api.delete('/auth/avatar');
      setProfile(response.data.data);
      await refreshProfile();
      toast({
        title: 'Success',
        description: 'Profile picture removed successfully',
      });
    } catch (error: any) {
      console.error('Failed to delete avatar:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to remove profile picture',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const getInitials = (username: string) => {
    return username
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto py-6">
          <div className="text-center py-12 text-muted-foreground">
            Loading profile...
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-6">
        <h1 className="text-4xl font-bold mb-6">My Profile</h1>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Profile Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Manage your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {profile && (
                <>
                  {/* Profile Picture */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Profile Picture</label>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20">
                        <AvatarImage 
                          src={profile.avatar_url ? `http://localhost:5000${profile.avatar_url}` : undefined} 
                          alt={profile.username} 
                        />
                        <AvatarFallback className="text-xl">
                          {getInitials(profile.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={uploadingAvatar}
                            onClick={() => document.getElementById('avatar-upload')?.click()}
                          >
                            <Camera className="mr-2 h-4 w-4" />
                            {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
                          </Button>
                          {profile.avatar_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={uploadingAvatar}
                              onClick={handleAvatarDelete}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG or GIF. Max 5MB.
                        </p>
                        <input
                          id="avatar-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarUpload}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Username</label>
                    {editing ? (
                      <Input
                        value={formData.username}
                        onChange={(e) => setFormData({ username: e.target.value })}
                        placeholder="Enter username"
                      />
                    ) : (
                      <p className="text-lg font-semibold">{profile.username}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <p className="text-lg">{profile.email}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Email cannot be changed
                    </p>
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Role</label>
                    <div className="flex items-center gap-2">
                      {getRoleIcon(profile.role)}
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getRoleBadgeColor(
                          profile.role
                        )}`}
                      >
                        {profile.role}
                      </span>
                    </div>
                  </div>

                  {/* Member Since */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Member Since</label>
                    <p className="text-lg">{formatDate(profile.created_at)}</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4 border-t">
                    {!editing ? (
                      <Button onClick={() => setEditing(true)} variant="default">
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit Profile
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={handleSaveProfile}
                          disabled={saving}
                          variant="default"
                        >
                          <Check className="mr-2 h-4 w-4" />
                          {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                        <Button
                          onClick={() => {
                            setEditing(false);
                            setFormData({ username: profile.username });
                          }}
                          variant="outline"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Account Type</p>
                <p className="text-lg font-semibold capitalize">{profile?.role}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Email Status</p>
                <p className="text-lg font-semibold">Verified</p>
              </div>

              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Account ID</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-xs font-mono break-all">{profile?.id.slice(0, 8)}...</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToClipboard(profile?.id || '')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Account Security</CardTitle>
            <CardDescription>Manage your account security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Password</p>
                <p className="text-sm text-muted-foreground">Keep your account secure</p>
              </div>
              <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>
                <Lock className="mr-2 h-4 w-4" />
                Change Password
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                placeholder="Enter current password"
              />
            </div>

            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="Enter new password (min 6 characters)"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="flex-1"
              >
                <Lock className="mr-2 h-4 w-4" />
                {changingPassword ? 'Changing...' : 'Change Password'}
              </Button>
              <Button
                onClick={() => {
                  setShowPasswordDialog(false);
                  setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                  });
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
