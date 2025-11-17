import { useState, createContext, useContext, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BuildingOffice2Icon,
  UsersIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ArrowRightCircleIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

function formatRole(role: string | null | undefined) {
  if (!role) return 'Select or create an organization'
  const map: Record<string, string> = {
    org_owner: 'Owner',
    branch_head: 'Branch Head',
    advisor: 'Advisor',
    agent: 'Agent',
  }
  return map[role] || role
}

interface OrgSwitcherContextType {
  openSwitcher: () => void
  getOrgDisplayInfo: () => { label: string; subtitle: string }
}

const OrgSwitcherContext = createContext<OrgSwitcherContextType | null>(null)

export function useOrgSwitcher() {
  const context = useContext(OrgSwitcherContext)
  if (!context) {
    throw new Error('useOrgSwitcher must be used within OrgSwitcherProvider')
  }
  return context
}

function OrgSwitcherModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const {
    memberships,
    currentOrg,
    switchToOrg,
    agentRelationships,
    currentAgentContext,
    switchToAgentContext,
    refreshMemberships,
  } = useAuth()
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [creationError, setCreationError] = useState<string | null>(null)

  const closeSheet = () => {
    onClose()
    setSwitchingId(null)
  }

  const handleSelectOrg = async (orgId: string) => {
    setSwitchingId(orgId)
    await switchToOrg(orgId)
    closeSheet()
  }

  const handleSelectAgent = async (relationshipId: string) => {
    setSwitchingId(relationshipId)
    await switchToAgentContext(relationshipId)
    closeSheet()
  }

  const handleStartBusiness = async () => {
    if (isCreating) return
    try {
      setCreationError(null)
      setIsCreating(true)
      const { data, error } = await supabase.rpc('create_default_org_for_user')
      if (error) {
        throw error
      }

      await refreshMemberships()
      const newOrgId = (data as { org_id?: string } | null)?.org_id
      if (newOrgId) {
        await switchToOrg(newOrgId)
      }
      closeSheet()
      navigate('/setup', { replace: true })
    } catch (err: any) {
      console.error('Failed to create organization:', err)
      setCreationError(err?.message || 'Failed to create organization. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinOrg = () => {
    closeSheet()
    navigate('/join-org', { replace: false })
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[120] bg-black/40"
        onClick={closeSheet}
        aria-hidden="true"
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[121] safe-bottom"
        role="dialog"
        aria-modal="true"
        aria-label="Organization switcher"
      >
            <div className="mx-auto max-h-[70vh] w-full max-w-lg rounded-t-2xl bg-bg-card shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-neutral-200 px-lg py-md">
                <div>
                  <p className="text-base font-semibold text-primary-text">Switch organization</p>
                  <p className="text-xs text-muted-text">
                    Choose a business or agent context to work in.
                  </p>
                </div>
                <button
                  onClick={closeSheet}
                  className="rounded-md p-sm text-muted-text hover:bg-neutral-100 focus:outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-label="Close switcher"
                >
                  ✕
                </button>
              </div>

              <div className="max-h-[calc(70vh-120px)] overflow-y-auto px-lg py-md space-y-lg">
                <section aria-label="My businesses">
                  <header className="mb-sm flex items-center gap-sm text-xs font-semibold uppercase tracking-wide text-muted-text">
                    <BuildingOffice2Icon className="h-4 w-4" aria-hidden="true" />
                    My businesses
                  </header>
                  {memberships.length === 0 ? (
                    <p className="text-sm text-secondary-text">
                      You haven&apos;t joined any organizations yet. Start a new business or join an
                      existing one below.
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

                <section aria-label="Actions" className="space-y-sm">
                  <button
                    onClick={handleStartBusiness}
                    disabled={isCreating}
                    className="flex w-full items-center gap-sm rounded-lg bg-primary text-white px-md py-sm text-sm font-semibold shadow focus:outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <ArrowRightCircleIcon className="h-5 w-5" aria-hidden="true" />
                    {isCreating ? 'Creating business…' : 'Start a new business'}
                  </button>
                  <button
                    onClick={handleJoinOrg}
                    className="flex w-full items-center gap-sm rounded-lg border border-neutral-200 bg-white px-md py-sm text-sm font-semibold text-primary-text shadow-sm focus:outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <UsersIcon className="h-5 w-5" aria-hidden="true" />
                    Join existing organization
                  </button>
                  {creationError && (
                    <p className="text-sm text-error break-words">{creationError}</p>
                  )}
                </section>
              </div>
            </div>
          </div>
    </>
  )
}

export function OrgSwitcherProvider({ children }: { children: ReactNode }) {
  const {
    user,
    currentOrg,
    currentAgentContext,
  } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  const inAgentMode = user?.contextMode === 'agent' && currentAgentContext
  const triggerLabel = inAgentMode
    ? currentAgentContext?.senderOrgName ?? 'Agent portal'
    : currentOrg?.orgName ?? 'Select organization'
  const triggerSubtitle = inAgentMode ? 'Agent mode' : formatRole(currentOrg?.role)

  const openSwitcher = () => setIsOpen(true)
  const closeSwitcher = () => setIsOpen(false)

  const getOrgDisplayInfo = () => ({
    label: triggerLabel,
    subtitle: triggerSubtitle,
  })

  return (
    <OrgSwitcherContext.Provider value={{ openSwitcher, getOrgDisplayInfo }}>
      {children}
      <OrgSwitcherModal isOpen={isOpen} onClose={closeSwitcher} />
    </OrgSwitcherContext.Provider>
  )
}

export function OrgSwitcher() {
  const { openSwitcher, getOrgDisplayInfo } = useOrgSwitcher()
  const { label, subtitle } = getOrgDisplayInfo()

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label="Switch organization"
      onClick={openSwitcher}
      className="flex items-center gap-sm rounded-lg border border-neutral-200 bg-white/60 px-sm py-xs text-left shadow-sm focus:outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-primary-text leading-tight truncate max-w-[160px]">
          {label}
        </span>
        <span className="text-xs text-muted-text leading-tight truncate max-w-[160px]">
          {subtitle}
        </span>
      </div>
      <ChevronDownIcon className="h-4 w-4 text-muted-text flex-shrink-0" aria-hidden="true" />
    </button>
  )
}

