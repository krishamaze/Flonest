import { BuildingOfficeIcon } from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import type { OrgMembershipSummary } from '../../hooks/useAuthQuery'
import type { AgentContextInfo } from '../../lib/agentContext'

interface OrgSwitcherPanelProps {
    memberships: OrgMembershipSummary[]
    agentRelationships: AgentContextInfo[]
    onSwitch: () => void
}

export function OrgSwitcherPanel({ memberships, agentRelationships, onSwitch }: OrgSwitcherPanelProps) {
    if (memberships.length <= 1 && agentRelationships.length === 0) {
        return null
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base font-medium flex items-center gap-sm">
                    <BuildingOfficeIcon className="h-5 w-5 text-primary" />
                    Organization
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-md">
                <div>
                    <p className="text-sm text-secondary-text mb-md">
                        {memberships.length > 1
                            ? `You have access to ${memberships.length} organization${memberships.length > 1 ? 's' : ''}. Switch between them or manage agent contexts.`
                            : agentRelationships.length > 0
                                ? 'You can switch between your business and agent contexts.'
                                : 'Switch between organizations or agent contexts.'}
                    </p>
                    <Button
                        variant="primary"
                        onClick={onSwitch}
                        className="w-full sm:w-auto"
                    >
                        Switch Organization
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
