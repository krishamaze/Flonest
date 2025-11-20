import { useAuth } from '../../contexts/AuthContext'

function formatRole(role: string | null | undefined): string {
  if (!role) return ''
  const map: Record<string, string> = {
    org_owner: 'Owner',
    branch_head: 'Branch Head',
    advisor: 'Advisor',
    agent: 'Agent',
  }
  return map[role] || role
}

export function RoleTag() {
  const { user, currentOrg, currentAgentContext } = useAuth()

  // Don't show for platform admins
  if (user?.platformAdmin) {
    return null
  }

  // In agent mode, show agent role
  if (user?.contextMode === 'agent' && currentAgentContext) {
    return (
      <span
        className="rounded text-xs font-normal text-secondary-text bg-neutral-100"
        style={{
          paddingLeft: 'var(--spacing-xs)',
          paddingRight: 'var(--spacing-xs)',
          paddingTop: '2px',
          paddingBottom: '2px',
        }}
      >
        Agent
      </span>
    )
  }

  // Show role from current org membership
  const role = currentOrg?.role || user?.role
  const roleLabel = formatRole(role)

  if (!roleLabel) {
    return null
  }

  return (
    <span
      className="rounded text-xs font-normal text-secondary-text bg-neutral-100"
      style={{
        paddingLeft: 'var(--spacing-xs)',
        paddingRight: 'var(--spacing-xs)',
        paddingTop: '2px',
        paddingBottom: '2px',
      }}
    >
      {roleLabel}
    </span>
  )
}

