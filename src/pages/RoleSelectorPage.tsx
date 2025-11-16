import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getAgentRelationships } from '../lib/agentContext'
import type { AgentRelationship, Org } from '../types'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

export function RoleSelectorPage() {
  const { user, switchToBusinessMode, switchToAgentMode } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [agentRelationships, setAgentRelationships] = useState<{
    relationship: AgentRelationship
    senderOrg: Org
    canManage: boolean
  }[]>([])

  useEffect(() => {
    loadAgentRelationships()
  }, [user])

  const loadAgentRelationships = async () => {
    if (!user) return

    setLoading(true)
    try {
      const relationships = await getAgentRelationships(user.id)
      setAgentRelationships(relationships)
    } catch (error) {
      console.error('Error loading agent relationships:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectBusiness = async () => {
    await switchToBusinessMode()
    navigate('/dashboard')
  }

  const handleSelectAgent = async (senderOrgId: string) => {
    await switchToAgentMode(senderOrgId)
    navigate('/agent/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const hasBusiness = user?.orgId !== null
  const hasAgentRoles = agentRelationships.length > 0

  // If user has only one option, auto-select it
  useEffect(() => {
    if (!loading) {
      if (hasBusiness && !hasAgentRoles) {
        handleSelectBusiness()
      } else if (!hasBusiness && hasAgentRoles && agentRelationships.length === 1) {
        handleSelectAgent(agentRelationships[0].senderOrg.id)
      }
    }
  }, [loading, hasBusiness, hasAgentRoles])

  if (!hasBusiness && !hasAgentRoles) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Access</h2>
          <p className="text-gray-600 mb-6">
            You don't have access to any business or agent portal yet. Please contact your administrator to get invited.
          </p>
          <Button onClick={() => navigate('/login')} variant="secondary">
            Back to Login
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto pt-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome, {user?.email}</h1>
          <p className="text-gray-600">Select how you want to continue</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* My Business Card */}
          {hasBusiness && (
            <Card 
              className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-primary"
              onClick={handleSelectBusiness}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">My Business</h2>
                <p className="text-gray-600 mb-4">
                  Manage your own organization, inventory, and sales
                </p>
                <div className="mt-auto">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {user?.role === 'org_owner'
                      ? 'Org Owner'
                      : user?.role === 'branch_head'
                      ? 'Branch Head'
                      : user?.role === 'advisor'
                      ? 'Advisor'
                      : user?.role}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Agent Portal Card */}
          {hasAgentRoles && (
            <Card className="p-6 border-2 border-transparent hover:border-primary transition-colors">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Agent Portal</h2>
                <p className="text-gray-600 mb-4">
                  Manage delivery challans and sales for other businesses
                </p>
                
                {agentRelationships.length === 1 ? (
                  <Button
                    onClick={() => handleSelectAgent(agentRelationships[0].senderOrg.id)}
                    className="w-full"
                  >
                    Continue as Agent
                  </Button>
                ) : (
                  <div className="w-full space-y-2">
                    <p className="text-sm text-gray-500 mb-2">Select a business:</p>
                    {agentRelationships.map((rel) => (
                      <Button
                        key={rel.relationship.id}
                        onClick={() => handleSelectAgent(rel.senderOrg.id)}
                        variant="secondary"
                        className="w-full justify-between"
                      >
                        <span>{rel.senderOrg.name}</span>
                        {rel.canManage ? (
                          <span className="text-xs text-green-600">Agent</span>
                        ) : (
                          <span className="text-xs text-blue-600">Helper</span>
                        )}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="mt-8 text-center">
          <Button
            onClick={() => navigate('/login')}
            variant="ghost"
            className="text-gray-600"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  )
}

