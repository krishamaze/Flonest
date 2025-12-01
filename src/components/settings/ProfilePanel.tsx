import { UserCircleIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { AuthUser } from '../../types'

interface ProfilePanelProps {
    user: AuthUser | null
}

export function ProfilePanel({ user }: ProfilePanelProps) {
    return (
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
                        User ID
                    </label>
                    <div className="flex gap-sm items-center">
                        <Input
                            type="text"
                            value={user?.id || ''}
                            disabled
                            className="bg-neutral-100 font-mono text-xs flex-1"
                            readOnly
                        />
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                if (user?.id) {
                                    navigator.clipboard.writeText(user.id)
                                    toast.success('User ID copied to clipboard')
                                }
                            }}
                            className="min-w-[80px]"
                        >
                            Copy
                        </Button>
                    </div>
                    <p className="text-xs text-muted-text mt-xs">
                        Permanent identifier - cannot be changed
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-secondary-text mb-xs">
                        Organization ID
                    </label>
                    <div className="flex gap-sm items-center">
                        <Input
                            type="text"
                            value={user?.orgId || ''}
                            disabled
                            className="bg-neutral-100 font-mono text-xs flex-1"
                            readOnly
                        />
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                if (user?.orgId) {
                                    navigator.clipboard.writeText(user.orgId)
                                    toast.success('Organization ID copied to clipboard')
                                }
                            }}
                            className="min-w-[80px]"
                        >
                            Copy
                        </Button>
                    </div>
                    <p className="text-xs text-muted-text mt-xs">
                        Permanent identifier - cannot be changed
                    </p>
                </div>

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
                        value={user?.role === 'org_owner' ? 'Org Owner' : user?.role || ''}
                        disabled
                        className="bg-neutral-100 capitalize"
                    />
                </div>
            </CardContent>
        </Card>
    )
}
