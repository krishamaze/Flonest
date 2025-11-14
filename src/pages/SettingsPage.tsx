import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { 
  UserCircleIcon, 
  BuildingOfficeIcon,
  PhotoIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase'
import { toast } from 'react-toastify'
import { canManageOrgSettings } from '../lib/permissions'

interface OrgSettings {
  id: string
  name: string
  custom_logo_url: string | null
  phone: string | null
  address: string | null
  gstin: string | null
}

export function SettingsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    gstin: '',
  })

  const isAdmin = canManageOrgSettings(user)

  useEffect(() => {
    loadOrgSettings()
  }, [user])

  const loadOrgSettings = async () => {
    if (!user?.orgId) return

    try {
      const { data, error } = await supabase
        .from('orgs')
        .select('id, name, custom_logo_url, phone, address, gst_number')
        .eq('id', user.orgId)
        .single()

      if (error) throw error

      if (data) {
        setOrgSettings(data as any)
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
          gstin: data.gst_number || '',
        })
      }
    } catch (error: any) {
      console.error('Error loading org settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!user?.orgId || !isAdmin) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('orgs')
        .update({
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          gst_number: formData.gstin,
        })
        .eq('id', user.orgId)

      if (error) throw error

      toast.success('Settings saved successfully')
      await loadOrgSettings()
    } catch (error: any) {
      console.error('Error saving settings:', error)
      toast.error(error.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user?.orgId || !isAdmin) return
    
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB')
      return
    }

    setUploading(true)
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.orgId}-${Date.now()}.${fileExt}`
      const filePath = `org-logos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath)

      // Update org with logo URL
      const { error: updateError } = await supabase
        .from('orgs')
        .update({ custom_logo_url: publicUrl })
        .eq('id', user.orgId)

      if (updateError) throw updateError

      toast.success('Logo uploaded successfully')
      await loadOrgSettings()
    } catch (error: any) {
      console.error('Error uploading logo:', error)
      toast.error(error.message || 'Failed to upload logo')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (!user?.orgId || !isAdmin || !orgSettings?.custom_logo_url) return

    try {
      // Update org to remove logo
      const { error } = await supabase
        .from('orgs')
        .update({ custom_logo_url: null })
        .eq('id', user.orgId)

      if (error) throw error

      toast.success('Logo removed successfully')
      await loadOrgSettings()
    } catch (error: any) {
      console.error('Error removing logo:', error)
      toast.error(error.message || 'Failed to remove logo')
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="space-y-md">
        <div>
          <h1 className="text-xl font-semibold text-primary-text">Settings</h1>
          <p className="mt-xs text-sm text-secondary-text">
            Only organization admins can access settings
          </p>
        </div>
        <Card>
          <CardContent className="p-lg text-center text-secondary-text">
            You don't have permission to access this page.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-md">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-primary-text">Settings</h1>
        <p className="mt-xs text-sm text-secondary-text">
          Manage your organization profile and settings
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-sm">
            <UserCircleIcon className="h-5 w-5 text-primary" />
            Your Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-md">
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-xs">
              Email
            </label>
            <Input
              type="email"
              value={user?.email || ''}
              disabled
              className="bg-neutral-100"
            />
            <p className="text-xs text-muted-text mt-xs">
              Email cannot be changed
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-text mb-xs">
              Role
            </label>
            <Input
              type="text"
              value={user?.role === 'admin' ? 'Owner/Admin' : user?.role || ''}
              disabled
              className="bg-neutral-100 capitalize"
            />
          </div>
        </CardContent>
      </Card>

      {/* Organization Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-sm">
            <PhotoIcon className="h-5 w-5 text-primary" />
            Organization Logo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-md">
          <div className="flex items-center gap-md">
            {/* Logo Preview */}
            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-white shadow-md p-2 border border-neutral-200">
              {orgSettings?.custom_logo_url ? (
                <img 
                  src={orgSettings.custom_logo_url} 
                  alt="Organization logo" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <img 
                  src="/pwa-192x192.png" 
                  alt="Default finetune logo" 
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="flex-1 space-y-sm">
              <p className="text-sm text-secondary-text">
                {orgSettings?.custom_logo_url 
                  ? 'Custom logo is active' 
                  : 'Using default finetune logo'}
              </p>
              <div className="flex gap-sm flex-wrap">
                <label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={uploading}
                    disabled={uploading}
                    className="cursor-pointer"
                    onClick={() => document.getElementById('logo-upload')?.click()}
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 mr-xs" />
                    {uploading ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                </label>

                {orgSettings?.custom_logo_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="text-error"
                  >
                    Remove Logo
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-text">
                Recommended: Square image, PNG or JPG, max 2MB
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-sm">
            <BuildingOfficeIcon className="h-5 w-5 text-primary" />
            Organization Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-md">
          <Input
            label="Organization Name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter organization name"
            required
          />

          <Input
            label="Phone Number"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+91 98765 43210"
          />

          <div>
            <label className="block text-sm font-medium text-secondary-text mb-xs">
              Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Enter business address"
              rows={3}
              className="w-full rounded-md border border-neutral-200 bg-bg-card px-md py-sm text-sm text-primary-text placeholder-muted-text focus:border-primary focus:outline-2 focus:outline-primary focus:outline-offset-2 transition-base"
            />
          </div>

          <Input
            label="GSTIN (Optional)"
            type="text"
            value={formData.gstin}
            onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
          />

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleSaveSettings}
            isLoading={saving}
            disabled={saving}
          >
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

