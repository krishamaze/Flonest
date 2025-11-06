import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { syncUserProfile } from '../lib/userSync'
import type { AuthUser } from '../types'

interface AuthContextType {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        loadUserProfile(session.user)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        loadUserProfile(session.user)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserProfile = async (authUser: User) => {
    try {
      // First, try to get existing membership with profile and org
      // Get all memberships and use the first one (in case user has multiple orgs)
      const { data: memberships, error } = await supabase
        .from('memberships')
        .select('*, profiles(*), orgs(*)')
        .eq('profile_id', authUser.id)
        .limit(1)

      if (error) throw error

      const membership = memberships && memberships.length > 0 ? memberships[0] : null

      // If membership doesn't exist, sync it automatically
      if (!membership) {
        console.log('User profile not found, syncing...')
        const syncedData = await syncUserProfile(authUser)

        if (syncedData && syncedData.profile && syncedData.membership && syncedData.org) {
          setUser({
            id: syncedData.profile.id,
            email: syncedData.profile.email,
            orgId: syncedData.org.id,
            role: (syncedData.membership.role || 'viewer') as 'owner' | 'staff' | 'viewer',
          })
        } else {
          console.error('Failed to sync user profile')
        }
      } else if (membership && membership.profiles && membership.orgs) {
        // Membership exists, use it
        const profile = membership.profiles as any
        const org = membership.orgs as any
        setUser({
          id: profile.id,
          email: profile.email,
          orgId: org.id,
          role: (membership.role || 'viewer') as 'owner' | 'staff' | 'viewer',
        })
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) throw error
    // Note: User profile and membership will be created automatically on first login via syncUserProfile
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

