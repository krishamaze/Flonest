import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
// MainLayout is handled by routing
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Modal } from '../components/ui/Modal'
import { toast } from 'react-toastify'
import { 
  getAgentsForOrg,
  searchPotentialAgents,
  createAgentRelationship,
  revokeAgentRelationship,
  reactivateAgentRelationship,
  getAgentHelpers,
  grantPortalPermission,
  revokePortalPermission
} from '../lib/api/agentRelationships'
import { 
  UserPlusIcon, 
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { canManageAgents } from '../lib/permissions'

export function AgentsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [agents, setAgents] = useState<any[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<any>(null)
  const [showHelpersModal, setShowHelpersModal] = useState(false)

  useEffect(() => {
    if (!user || !canManageAgents(user)) {
      navigate('/')
      return
    }
    loadAgents()
  }, [user])

  const loadAgents = async () => {
    if (!user?.orgId) return

    try {
      setLoading(true)
      const data = await getAgentsForOrg(user.orgId)
      setAgents(data)
    } catch (error) {
      console.error('Error loading agents:', error)
      toast.error('Failed to load agents')
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async (relationshipId: string) => {
    if (!confirm('Are you sure you want to revoke this agent relationship?')) return

    try {
      await revokeAgentRelationship(relationshipId)
      toast.success('Agent relationship revoked')
      loadAgents()
    } catch (error: any) {
      toast.error(error.message || 'Failed to revoke relationship')
    }
  }

  const handleReactivate = async (relationshipId: string) => {
    try {
      await reactivateAgentRelationship(relationshipId)
      toast.success('Agent relationship reactivated')
      loadAgents()
    } catch (error: any) {
      toast.error(error.message || 'Failed to reactivate relationship')
    }
  }

  const handleManageHelpers = async (agent: any) => {
    setSelectedAgent(agent)
    setShowHelpersModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-xl">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="pb-20">
      <div className="space-y-md max-w-4xl mx-auto pb-32">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Agents</h1>
          <Button onClick={() => setShowAddModal(true)} variant="primary">
            <UserPlusIcon className="h-5 w-5 mr-xs" />
            Add Agent
          </Button>
        </div>

        {/* Agents List */}
        {agents.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="p-xl text-center">
              <UserGroupIcon className="h-12 w-12 text-text-muted mx-auto mb-md" />
              <p className="text-text-secondary mb-md">
                No agents added yet
              </p>
              <Button onClick={() => setShowAddModal(true)} variant="primary">
                Add Your First Agent
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-sm">
            {agents.map((agent) => (
              <Card key={agent.relationship.id} className="shadow-sm">
                <CardContent className="p-md">
                  <div className="flex items-start justify-between mb-sm">
                    <div className="flex-1">
                      <h3 className="font-semibold text-text-primary">
                        {agent.agentProfile.full_name || agent.agentProfile.email}
                      </h3>
                      <p className="text-sm text-text-secondary">{agent.agentProfile.email}</p>
                      {agent.agentOrg && (
                        <p className="text-xs text-text-muted mt-xs">
                          Organization: {agent.agentOrg.name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-xs">
                      {agent.relationship.status === 'active' && (
                        <span className="px-sm py-xs bg-success/10 text-success text-xs font-semibold rounded-full flex items-center gap-xs">
                          <CheckCircleIcon className="h-3 w-3" />
                          Active
                        </span>
                      )}
                      {agent.relationship.status === 'revoked' && (
                        <span className="px-sm py-xs bg-error/10 text-error text-xs font-semibold rounded-full flex items-center gap-xs">
                          <XCircleIcon className="h-3 w-3" />
                          Revoked
                        </span>
                      )}
                    </div>
                  </div>

                  {agent.relationship.notes && (
                    <p className="text-sm text-text-secondary mb-sm">
                      Note: {agent.relationship.notes}
                    </p>
                  )}

                  <div className="flex gap-sm">
                    {agent.relationship.status === 'active' && (
                      <>
                        <Button
                          onClick={() => navigate(`/agents/${agent.relationship.id}/issue-dc`)}
                          variant="primary"
                          size="sm"
                          className="flex-1"
                        >
                          Issue DC
                        </Button>
                        <Button
                          onClick={() => handleManageHelpers(agent)}
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                        >
                          Manage Helpers
                        </Button>
                        <Button
                          onClick={() => handleRevoke(agent.relationship.id)}
                          variant="danger"
                          size="sm"
                        >
                          Revoke
                        </Button>
                      </>
                    )}
                    {agent.relationship.status === 'revoked' && (
                      <Button
                        onClick={() => handleReactivate(agent.relationship.id)}
                        variant="primary"
                        size="sm"
                        className="w-full"
                      >
                        <ArrowPathIcon className="h-4 w-4 mr-xs" />
                        Reactivate
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add Agent Modal */}
        <AddAgentModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            loadAgents()
          }}
          currentOrgId={user?.orgId || ''}
          currentUserId={user?.id || ''}
        />

        {/* Manage Helpers Modal */}
        {selectedAgent && (
          <ManageHelpersModal
            isOpen={showHelpersModal}
            onClose={() => {
              setShowHelpersModal(false)
              setSelectedAgent(null)
            }}
            relationshipId={selectedAgent.relationship.id}
            agentUserId={selectedAgent.agentProfile.id}
          />
        )}
      </div>
    </div>
  )
}

// Add Agent Modal Component
function AddAgentModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  currentOrgId,
  currentUserId
}: { 
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  currentOrgId: string
  currentUserId: string
}) {
  const [email, setEmail] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSearch = async () => {
    if (!email.trim()) return

    try {
      setSearching(true)
      const results = await searchPotentialAgents(email, currentOrgId)
      setSearchResults(results)
      if (results.length === 0) {
        toast.error('No eligible users found')
      }
    } catch (error: any) {
      toast.error(error.message || 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedUser) return

    try {
      setSubmitting(true)
      await createAgentRelationship(
        currentOrgId,
        selectedUser.id,
        currentUserId,
        notes
      )
      toast.success('Agent added successfully')
      onSuccess()
    } catch (error: any) {
      toast.error(error.message || 'Failed to add agent')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Agent">
      <div className="space-y-md">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-xs">
            Search by Email
          </label>
          <div className="flex gap-sm">
            <Input
              type="email"
              placeholder="agent@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button
              onClick={handleSearch}
              variant="primary"
              disabled={!email.trim()}
              isLoading={searching}
            >
              Search
            </Button>
          </div>
          <p className="text-xs text-text-muted mt-xs">
            Only organization admins can be appointed as agents
          </p>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && !selectedUser && (
          <div className="space-y-xs">
            <p className="text-sm font-medium text-text-primary">Select User:</p>
            {searchResults.map((result) => (
              <button
                key={result.id}
                onClick={() => setSelectedUser(result)}
                className="w-full p-md border border-border-color rounded-md hover:bg-bg-hover hover:border-primary transition-all text-left"
              >
                <p className="font-medium text-text-primary">{result.full_name || result.email}</p>
                <p className="text-sm text-text-secondary">{result.email}</p>
                <p className="text-xs text-text-muted">Organization: {result.org.name}</p>
              </button>
            ))}
          </div>
        )}

        {/* Selected User */}
        {selectedUser && (
          <Card className="bg-bg-selected">
            <CardContent className="p-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-text-primary">{selectedUser.full_name || selectedUser.email}</p>
                  <p className="text-sm text-text-secondary">{selectedUser.email}</p>
                  <p className="text-xs text-text-muted">Organization: {selectedUser.org.name}</p>
                </div>
                <Button onClick={() => setSelectedUser(null)} variant="ghost" size="sm">
                  Change
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {selectedUser && (
          <div>
            <label className="block text-sm font-medium text-text-primary mb-xs">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this agent..."
              className="w-full px-md py-sm border border-border-color rounded-md min-h-[80px]"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-sm">
          <Button onClick={onClose} variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="primary"
            className="flex-1"
            disabled={!selectedUser || submitting}
            isLoading={submitting}
          >
            Add Agent
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// Manage Helpers Modal Component
function ManageHelpersModal({
  isOpen,
  onClose,
  relationshipId,
  agentUserId
}: {
  isOpen: boolean
  onClose: () => void
  relationshipId: string
  agentUserId: string
}) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [helpers, setHelpers] = useState<any[]>([])
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [granting, setGranting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadHelpers()
      loadAvailableUsers()
    }
  }, [isOpen])

  const loadHelpers = async () => {
    try {
      const data = await getAgentHelpers(relationshipId)
      setHelpers(data)
    } catch (error) {
      console.error('Error loading helpers:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableUsers = async () => {
    // Load branch_heads and advisors from agent's org
    // For now, simplified - would query memberships table
    setAvailableUsers([])
  }

  const handleGrant = async () => {
    if (!selectedUserId || !user) return

    try {
      setGranting(true)
      await grantPortalPermission(relationshipId, selectedUserId, user.id)
      toast.success('Portal access granted')
      setSelectedUserId('')
      loadHelpers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to grant access')
    } finally {
      setGranting(false)
    }
  }

  const handleRevoke = async (permissionId: string) => {
    if (!confirm('Remove portal access for this helper?')) return

    try {
      await revokePortalPermission(permissionId)
      toast.success('Portal access revoked')
      loadHelpers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to revoke access')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Agent Helpers">
      <div className="space-y-md">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            <p className="text-sm text-text-secondary">
              Grant your team members access to help manage this agent portal
            </p>

            {/* Current Helpers */}
            {helpers.length > 0 && (
              <div>
                <p className="text-sm font-medium text-text-primary mb-sm">Current Helpers:</p>
                <div className="space-y-xs">
                  {helpers.map((helper) => (
                    <div
                      key={helper.permission.id}
                      className="flex items-center justify-between p-sm border border-border-color rounded-md"
                    >
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {helper.helper.full_name || helper.helper.email}
                        </p>
                        <p className="text-xs text-text-secondary">{helper.role}</p>
                      </div>
                      <Button
                        onClick={() => handleRevoke(helper.permission.id)}
                        variant="danger"
                        size="sm"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Helper - Placeholder for now */}
            <p className="text-xs text-text-muted text-center py-md">
              Helper management UI to be completed
            </p>
          </>
        )}

        <Button onClick={onClose} variant="secondary" className="w-full">
          Close
        </Button>
      </div>
    </Modal>
  )
}

