import { PhotoIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import type { OrgSettings } from '../../hooks/useOrgSettings'

interface OrgLogoPanelProps {
    orgSettings: OrgSettings | null
    isAdmin: boolean
    isUploading: boolean
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
    onRemove: () => void
}

export function OrgLogoPanel({
    orgSettings,
    isAdmin,
    isUploading,
    onUpload,
    onRemove,
}: OrgLogoPanelProps) {
    return (
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
                                alt="Default Flonest logo"
                                className="w-full h-full object-contain"
                            />
                        )}
                    </div>

                    <div className="flex-1 space-y-sm">
                        <p className="text-sm text-secondary-text">
                            {orgSettings?.custom_logo_url
                                ? 'Custom logo is active'
                                : 'Using default Flonest logo'}
                        </p>
                        <div className="flex gap-sm flex-wrap">
                            <label>
                                <input
                                    id="logo-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={onUpload}
                                    disabled={isUploading || !isAdmin}
                                    className="hidden"
                                />
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    isLoading={isUploading}
                                    disabled={isUploading || !isAdmin}
                                    className="cursor-pointer"
                                    onClick={() => document.getElementById('logo-upload')?.click()}
                                >
                                    <ArrowUpTrayIcon className="h-4 w-4 mr-xs" />
                                    {isUploading ? 'Uploading...' : 'Upload Logo'}
                                </Button>
                            </label>

                            {orgSettings?.custom_logo_url && isAdmin && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onRemove}
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
    )
}
