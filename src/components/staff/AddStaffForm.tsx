import { useState, FormEvent, useEffect } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Drawer } from '../ui/Drawer'
import { Select } from '../ui/Select'
import { isMobileDevice } from '../../lib/deviceDetection'
import { useAuth } from '../../contexts/AuthContext'
import { createStaffMembership } from '../../lib/api/memberships'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-toastify'

interface AddStaffFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function AddStaffForm({ isOpen, onClose, onSuccess }: AddStaffFormProps) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [branchId, setBranchId] = useState<string>('')
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [userFound, setUserFound] = useState<any>(null)

  // Load branches when form opens
  useEffect(() => {
    if (isOpen && user?.orgId) {
      loadBranches()
    }
  }, [isOpen, user?.orgId])

  const loadBranches = async () => {
    if (!user?.orgId) return

    try {
      // Query branches table (using type assertion since types may not be updated yet)
      const { data, error } = await (supabase as any)
        .from('branches')
        .select('*')
        .eq('org_id', user.orgId)
        .order('name')

      if (error) throw error
      setBranches(data || [])

      // If user is branch_head, set their branch as default
      if (user.role === 'branch_head' && user.branchId) {
        setBranchId(user.branchId)
      } else if (data && data.length > 0) {
        // Owner: set first branch as default
        setBranchId(data[0].id)
      }
    } catch (error) {
      console.error('Error loading branches:', error)
      toast.error('Failed to load branches')
    }
  }

  const searchUser = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address')
      return
    }

    setSearching(true)
    try {
      // Search for user by email in profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()

      if (error) throw error

      if (!data) {
        toast.error('User not found. They need to sign up first.')
        setUserFound(null)
        return
      }

      // Check if user already has membership in this org
      const { data: existingMembership } = await supabase
        .from('memberships')
        .select('id')
        .eq('profile_id', data.id)
        .eq('org_id', user?.orgId || '')
        .maybeSingle()

      if (existingMembership) {
        toast.error('User already has a membership in this organization')
        setUserFound(null)
        return
      }

      setUserFound(data)
      toast.success('User found!')
    } catch (error: any) {
      toast.error(error.message || 'Error searching for user')
      setUserFound(null)
    } finally {
      setSearching(false)
    }
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

    if (!userFound?.id || !branchId) {
      toast.error('Missing required information')
      return
    }

    setLoading(true)
    try {
      await createStaffMembership(userFound.id, branchId, userFound.email || '')
      toast.success(
        user?.role === 'owner'
          ? 'Staff member added successfully'
          : 'Staff member added and pending approval'
      )
      setEmail('')
      setUserFound(null)
      setBranchId('')
      onSuccess?.()
      onClose()
    } catch (error: any) {
      toast.error(error.message || 'Failed to add staff member')
    } finally {
      setLoading(false)
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
              setUserFound(null)
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

      {user?.role === 'owner' && (
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
            Staff will be added to your branch and require owner approval
          </p>
        </div>
      )}

      <div className="flex gap-sm pt-md">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setEmail('')
            setUserFound(null)
            onClose()
          }}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!userFound || !branchId || loading}
          isLoading={loading}
          className="flex-1"
        >
          {user?.role === 'owner' ? 'Add Staff' : 'Request Approval'}
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

