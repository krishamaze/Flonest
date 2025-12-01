import { BuildingOfficeIcon } from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { validateGSTIN } from '../../lib/api/gst'
import type { OrgSettings } from '../../hooks/useOrgSettings'
import { useGstManagement } from '../../hooks/settings/useGstManagement'
import { useOrgSettingsForm } from '../../hooks/settings/useOrgSettingsForm'

interface OrgDetailsPanelProps {
    orgSettings: OrgSettings | null
    isAdmin: boolean
}

export function OrgDetailsPanel({
    orgSettings,
    isAdmin,
}: OrgDetailsPanelProps) {
    // SWITCH PHASE: Use hook directly instead of props
    const {
        gstinInput,
        setGstinInput,
        gstinLoading,
        gstinError,
        gstBusinessData,
        onAddGSTIN,
    } = useGstManagement(orgSettings?.id, orgSettings)

    const {
        isEditing,
        setIsEditing,
        formData,
        setFormData,
        onSave,
        onCancelEdit,
        isSaving,
    } = useOrgSettingsForm(orgSettings?.id, orgSettings, isAdmin)

    const gstVerified = orgSettings?.gst_verification_status === 'verified'
    const isUnregistered = !orgSettings?.gst_number || orgSettings.gst_number.trim() === ''
    const hasChanges = orgSettings && (formData.name !== orgSettings.name || formData.phone !== orgSettings.phone)

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base font-medium flex items-center gap-sm">
                    <BuildingOfficeIcon className="h-5 w-5 text-primary" />
                    Organization Details
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-md">
                {/* Legal Name - Read-only after verification */}
                {gstVerified && orgSettings?.legal_name && (
                    <div>
                        <label className="block text-sm font-medium text-secondary-text mb-xs">
                            Legal Name (GST Registered)
                        </label>
                        <Input
                            type="text"
                            value={orgSettings.legal_name}
                            disabled
                            className="bg-neutral-100"
                        />
                        <p className="text-xs text-muted-text mt-xs">
                            From GST verification - immutable. Used on GST invoices and tax documents.
                        </p>
                    </div>
                )}

                {/* Display/Brand Name - Always editable */}
                <div>
                    <Input
                        label={gstVerified ? "Display Name (Brand Name)" : "Organization Name"}
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="How you want your business displayed in the app"
                        disabled={!isEditing}
                        required
                    />
                    {gstVerified && (
                        <p className="text-xs text-muted-text mt-xs">
                            Used in app interface only. Legal name from GST verification is used on invoices and tax documents.
                        </p>
                    )}
                </div>

                {/* Phone Number - Always editable */}
                <Input
                    label="Phone Number"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    disabled={!isEditing}
                />

                {/* GSTIN - Read-only after verification, or input for unregistered */}
                {orgSettings?.gst_number ? (
                    <div>
                        <label className="block text-sm font-medium text-secondary-text mb-xs">
                            GSTIN {gstVerified ? '(Verified)' : '(Pending Verification)'}
                        </label>
                        <div className="flex gap-sm items-center">
                            <Input
                                type="text"
                                value={orgSettings.gst_number}
                                disabled
                                className="bg-neutral-100 flex-1 font-mono"
                            />
                            {gstVerified && (
                                <span className="inline-flex items-center px-sm py-xs rounded-full bg-success-light text-success-dark text-xs font-semibold">
                                    ✓ Verified
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-text mt-xs">
                            {gstVerified
                                ? 'Verified by platform admin - cannot be changed'
                                : 'Awaiting platform admin verification'}
                        </p>
                    </div>
                ) : isAdmin && isUnregistered ? (
                    <div className="space-y-sm">
                        <label className="block text-sm font-medium text-secondary-text">
                            Add GST Registration
                        </label>
                        <div className="space-y-xs">
                            <Input
                                type="text"
                                value={gstinInput}
                                onChange={(e) => {
                                    setGstinInput(e.target.value.toUpperCase().replace(/\s/g, ''))
                                }}
                                placeholder="15-character GSTIN"
                                maxLength={15}
                                className="font-mono"
                                disabled={gstinLoading}
                            />
                            {gstinInput.length > 0 && gstinInput.length < 15 && (
                                <p className="text-xs text-warning">GSTIN must be exactly 15 characters</p>
                            )}
                            {gstinError && (
                                <p className="text-xs text-error">{gstinError}</p>
                            )}
                            {gstBusinessData && (
                                <div className="rounded-md border border-success bg-success-light/20 p-sm text-xs space-y-xs">
                                    <p className="font-semibold text-success-dark">GST Data Found:</p>
                                    <p><strong>Legal Name:</strong> {gstBusinessData.legal_name || 'N/A'}</p>
                                    <p><strong>State:</strong> {gstBusinessData.address.state || 'N/A'}</p>
                                    <p className="text-muted-text">GSTIN will be marked unverified until platform admin verifies.</p>
                                </div>
                            )}
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={onAddGSTIN}
                                disabled={!validateGSTIN(gstinInput) || !gstBusinessData || gstinLoading}
                                isLoading={gstinLoading}
                            >
                                Add GSTIN
                            </Button>
                        </div>
                        <p className="text-xs text-muted-text">
                            After adding GSTIN, it will be reviewed by platform admin before activation.
                        </p>
                    </div>
                ) : null}

                {/* Address - Read-only after verification */}
                {orgSettings?.address && (
                    <div>
                        <label className="block text-sm font-medium text-secondary-text mb-xs">
                            Principal Place of Business {gstVerified ? '(GST Registered)' : ''}
                        </label>
                        <textarea
                            value={orgSettings.address}
                            disabled
                            className="w-full rounded-md border bg-neutral-100 px-md py-sm text-sm"
                            rows={3}
                        />
                        <p className="text-xs text-muted-text mt-xs">
                            {gstVerified
                                ? 'From GST verification - cannot be changed'
                                : 'Will be updated from GST verification'}
                        </p>
                    </div>
                )}

                {/* Edit/Save buttons */}
                {!isEditing ? (
                    <Button
                        variant="secondary"
                        size="lg"
                        className="w-full"
                        onClick={() => setIsEditing(true)}
                    >
                        Edit Details
                    </Button>
                ) : (
                    <div className="flex gap-sm">
                        <Button
                            variant="primary"
                            size="lg"
                            className="flex-1"
                            onClick={onSave}
                            isLoading={isSaving}
                            disabled={!hasChanges || isSaving}
                        >
                            Save Changes
                        </Button>
                        <Button
                            variant="ghost"
                            size="lg"
                            onClick={onCancelEdit}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
