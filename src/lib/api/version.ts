import { supabase } from '../supabase'

// Current frontend version (sync with package.json)
// UPDATE THIS when deploying new versions
export const FRONTEND_VERSION = '1.0.0'

export interface AppVersion {
  version: string
  release_notes?: string
  released_at: string
}

/**
 * Get current backend version from Supabase
 */
export async function getCurrentBackendVersion(): Promise<AppVersion> {
  try {
    const { data, error } = await supabase.rpc('get_current_app_version' as any)

    if (error) {
      console.error('Failed to get backend version:', error)
      return {
        version: FRONTEND_VERSION,
        release_notes: 'Unable to fetch version',
        released_at: new Date().toISOString(),
      }
    }

    if (!data || typeof data !== 'object') {
      return {
        version: FRONTEND_VERSION,
        release_notes: 'Unknown version',
        released_at: new Date().toISOString(),
      }
    }

    const result = data as any
    return {
      version: result.version || FRONTEND_VERSION,
      release_notes: result.release_notes,
      released_at: result.released_at || new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error fetching backend version:', error)
    return {
      version: FRONTEND_VERSION,
      release_notes: 'Error fetching version',
      released_at: new Date().toISOString(),
    }
  }
}

/**
 * Check if frontend and backend versions match
 */
export async function checkVersionSync(): Promise<{
  inSync: boolean
  frontendVersion: string
  backendVersion: string
  message?: string
}> {
  const backendVersion = await getCurrentBackendVersion()
  const inSync = FRONTEND_VERSION === backendVersion.version

  return {
    inSync,
    frontendVersion: FRONTEND_VERSION,
    backendVersion: backendVersion.version,
    message: inSync
      ? 'Versions in sync'
      : `Version mismatch: Frontend ${FRONTEND_VERSION}, Backend ${backendVersion.version}`,
  }
}

