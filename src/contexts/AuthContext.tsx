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
      // First, try to get existing profile
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle()

      if (error) throw error

      // If profile doesn't exist, sync it automatically
      if (!data) {
        console.log('User profile not found, syncing...')
        const syncedProfile = await syncUserProfile(authUser)

        if (syncedProfile && syncedProfile.user_id && syncedProfile.email && syncedProfile.tenant_id) {
          setUser({
            id: syncedProfile.user_id,
            email: syncedProfile.email,
            tenantId: syncedProfile.tenant_id,
            role: (syncedProfile.role || 'viewer') as 'owner' | 'staff' | 'viewer',
          })
        } else {
          console.error('Failed to sync user profile')
        }
      } else if (data && data.user_id && data.email && data.tenant_id) {
        // Profile exists, use it
        setUser({
          id: data.user_id,
          email: data.email,
          tenantId: data.tenant_id,
          role: (data.role || 'viewer') as 'owner' | 'staff' | 'viewer',
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
    // Note: User must be added to team_members table manually or via database trigger
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

