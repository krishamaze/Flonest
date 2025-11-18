import { useState, FormEvent, useEffect } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Drawer } from '../ui/Drawer'
import { Select } from '../ui/Select'
import { isMobileDevice } from '../../lib/deviceDetection'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-toastify'
import { useBranches, useSearchUser, useCreateAdvisorMembership } from '../../hooks/useAdvisors'

interface AddAdvisorFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function AddAdvisorForm({ isOpen, onClose, onSuccess }: AddAdvisorFormProps) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [branchId, setBranchId] = useState<string>('')
  const [shouldSearch, setShouldSearch] = useState(false)

  // React Query hooks
  const { data: branches = [] } = useBranches(user?.orgId)
  const { data: userFound, isLoading: searching, error: searchError } = useSearchUser(
    shouldSearch ? email : '',
    user?.orgId
  )
  const createMutation = useCreateAdvisorMembership()

  // Set default branch when branches load
  useEffect(() => {
    if (branches.length > 0 && !branchId) {
      if (user?.role === 'branch_head' && user.branchId) {
        setBranchId(user.branchId)
      } else {
        setBranchId(branches[0].id)
      }
    }
  }, [branches, branchId, user?.role, user?.branchId])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEmail('')
      setBranchId('')
      setShouldSearch(false)
    }
  }, [isOpen])

  // Handle search errors
  useEffect(() => {
    if (searchError) {
      if (searchError.message.includes('already has a membership')) {
        toast.error('User already has a membership in this organization')
      } else {
        toast.error(searchError.message || 'Error searching for user')
      }
      setShouldSearch(false)
    } else if (shouldSearch && userFound && !searching) {
      toast.success('User found!')
      setShouldSearch(false)
    }
  }, [searchError, userFound, searching, shouldSearch])

  const searchUser = () => {
    if (!email.trim()) {
      toast.error('Please enter an email address')
      return
    }
    setShouldSearch(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!userFound || !branchId) {
      toast.error('Please search and find a user first, and select a branch')
      return
    }

    if (!user?.orgId) {
      toast.error('Organization not found')
      return
    }

    try {
      // OPTIMISTIC UPDATE: Mutation invalidates pending memberships cache
      await createMutation.mutateAsync({
        userId: userFound.id,
        branchId,
        email: userFound.email || '',
      })
      toast.success(
        user?.role === 'org_owner'
          ? 'Advisor added successfully'
          : 'Advisor added and pending approval'
      )
      setEmail('')
      setBranchId('')
      setShouldSearch(false)
      onSuccess?.()
      onClose()
    } catch (error: any) {
      // Error handling is done by mutation
      toast.error(error.message || 'Failed to add advisor')
    }
  }

  const FormContent = (
    <form onSubmit={handleSubmit} className="space-y-md">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-primary-text mb-xs">
          Email Address
        </label>
        <div className="flex gap-sm">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setShouldSearch(false) // Reset search when email changes
            }}
            placeholder="user@example.com"
            required
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={searchUser}
            disabled={searching || !email.trim()}
            isLoading={searching}
          >
            Search
          </Button>
        </div>
        {userFound && (
          <p className="mt-xs text-sm text-success">
            ✓ Found: {userFound.full_name || userFound.email}
          </p>
        )}
      </div>

      {user?.role === 'org_owner' && (
        <div>
          <label htmlFor="branch" className="block text-sm font-medium text-primary-text mb-xs">
            Branch
          </label>
          <Select
            id="branch"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            required
            options={[
              { value: '', label: 'Select a branch' },
              ...branches.map((branch: any) => ({
                value: branch.id,
                label: branch.name,
              })),
            ]}
          />
        </div>
      )}

      {user?.role === 'branch_head' && user.branchId && (
        <div>
          <label className="block text-sm font-medium text-primary-text mb-xs">
            Branch
          </label>
          <Input
            value={branches.find((b) => b.id === user.branchId)?.name || 'Your Branch'}
            disabled
            className="bg-neutral-100"
          />
          <p className="mt-xs text-xs text-secondary-text">
            Advisor will be added to your branch and require admin approval
          </p>
        </div>
      )}

      <div className="flex gap-sm pt-md">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setEmail('')
            setShouldSearch(false)
            onClose()
          }}
          className="flex-1"
        >
          Cancel
        </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!userFound || !branchId || createMutation.isPending}
            isLoading={createMutation.isPending}
            className="flex-1"
          >
          {user?.role === 'org_owner' ? 'Add Advisor' : 'Request Approval'}
        </Button>
      </div>
    </form>
  )

  if (isMobileDevice()) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title="Add Staff Member">
        {FormContent}
      </Drawer>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Staff Member">
      {FormContent}
    </Modal>
  )
}

