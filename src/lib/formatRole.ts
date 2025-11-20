export function formatRole(role: string | null | undefined) {
  if (!role) return 'Select or create an organization'
  const map: Record<string, string> = {
    org_owner: 'Owner',
    branch_head: 'Branch Head',
    advisor: 'Advisor',
    agent: 'Agent',
  }
  return map[role] || role
}

