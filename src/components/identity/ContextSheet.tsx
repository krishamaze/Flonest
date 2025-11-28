import { useState } from 'react'
import { 
  BuildingOffice2Icon, 
  UsersIcon, 
  ExclamationTriangleIcon, 
  CheckIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { formatRole } from '../../lib/formatRole'
import { Drawer } from '../ui/Drawer'

interface ContextSheetProps {
  isOpen: boolean
  onClose: () => void
}

export function ContextSheet({ isOpen, onClose }: ContextSheetProps) {
  const {
    memberships,
    currentOrg,
    switchToOrg,
    agentRelationships,
    currentAgentContext,
    switchToAgentContext,
  } = useAuth()
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  const handleSelectOrg = async (orgId: string) => {
    setSwitchingId(orgId)
    await switchToOrg(orgId)
    setSwitchingId(null)
    onClose()
  }

  const handleSelectAgent = async (relationshipId: string) => {
    setSwitchingId(relationshipId)
    await switchToAgentContext(relationshipId)
    setSwitchingId(null)
    onClose()
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Switch Context"
    >
      <div className="space-y-lg pb-safe-bottom p-md">
        <section aria-label="My businesses">
          <header className="mb-sm flex items-center gap-sm text-xs font-semibold uppercase tracking-wide text-muted-text">
            <BuildingOffice2Icon className="h-4 w-4" aria-hidden="true" />
            My businesses
          </header>
          {memberships.length === 0 ? (
            <p className="text-sm text-secondary-text">
              You haven&apos;t joined any organizations yet.
            </p>
          ) : (
            <div className="space-y-xs">
              {memberships.map((membership) => {
                const isCurrent = currentOrg?.orgId === membership.orgId
                const isPending = membership.lifecycleState === 'onboarding_pending'
                return (
                  <button
                    key={membership.orgId}
                    onClick={() => handleSelectOrg(membership.orgId)}
                    className={`w-full rounded-lg border px-md py-sm text-left transition-colors focus:outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      isCurrent
                        ? 'border-primary bg-primary-light/30'
                        : 'border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-md">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-primary-text truncate">
                          {membership.orgName}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-xs text-xs text-secondary-text">
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 uppercase tracking-wide">
                            {formatRole(membership.role)}
                          </span>
                          {isPending && (
                            <span className="flex items-center gap-1 rounded-full bg-warning-light px-2 py-0.5 text-warning-dark">
                              <ExclamationTriangleIcon className="h-3 w-3" />
                              Setup pending
                            </span>
                          )}
                        </div>
                      </div>
                      {isCurrent && (
                        <CheckIcon className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                      {switchingId === membership.orgId && !isCurrent && (
                        <div className="text-xs text-muted-text">Switching…</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {agentRelationships.length > 0 && (
          <section aria-label="Agent contexts">
            <header className="mb-sm flex items-center gap-sm text-xs font-semibold uppercase tracking-wide text-muted-text">
              <UsersIcon className="h-4 w-4" aria-hidden="true" />
              Acting as agent for
            </header>
            <div className="space-y-xs">
              {agentRelationships.map((relationship) => {
                const isCurrent =
                  currentAgentContext?.relationshipId === relationship.relationshipId
                return (
                  <button
                    key={relationship.relationshipId}
                    onClick={() => handleSelectAgent(relationship.relationshipId)}
                    className={`w-full rounded-lg border px-md py-sm text-left transition-colors focus:outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      isCurrent
                        ? 'border-primary bg-primary-light/30'
                        : 'border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-md">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-primary-text truncate">
                          {relationship.senderOrgName}
                        </p>
                        <p className="mt-1 text-xs text-secondary-text">
                          Role:{' '}
                          {relationship.canManage ? 'Agent (owner)' : 'Agent helper access'}
                        </p>
                      </div>
                      {isCurrent && (
                        <CheckIcon className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                      {switchingId === relationship.relationshipId && !isCurrent && (
                        <div className="text-xs text-muted-text">Switching…</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </Drawer>
  )
}


