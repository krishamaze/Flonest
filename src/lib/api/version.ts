import { supabase } from '../supabase'

// Current frontend version
// IMPORTANT: Keep this in sync with package.json version
// When deploying new versions:
// 1. Update version in package.json
// 2. Update FRONTEND_VERSION here to match
// 3. GitHub Action will automatically update database app version after deployment
//
// Note: Schema versions are tracked separately and updated manually after schema migrations.
// See docs/SCHEMA_MIGRATIONS.md for schema version update process.
export const FRONTEND_VERSION = '1.0.2'

export interface AppVersion {
  version: string
  release_notes?: string
  released_at: string
  schema_version?: string
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
        schema_version: '1.0.0',
      }
    }

    if (!data || typeof data !== 'object') {
      return {
        version: FRONTEND_VERSION,
        release_notes: 'Unknown version',
        released_at: new Date().toISOString(),
        schema_version: '1.0.0',
      }
    }

    const result = data as any
    return {
      version: result.version || FRONTEND_VERSION,
      release_notes: result.release_notes,
      released_at: result.released_at || new Date().toISOString(),
      schema_version: result.schema_version || '1.0.0',
    }
  } catch (error) {
    console.error('Error fetching backend version:', error)
    return {
      version: FRONTEND_VERSION,
      release_notes: 'Error fetching version',
      released_at: new Date().toISOString(),
      schema_version: '1.0.0',
    }
  }
}

/**
 * Get current schema version from Supabase
 * Useful for monitoring and admin dashboards
 */
export async function getCurrentSchemaVersion(): Promise<string> {
  try {
    const backendVersion = await getCurrentBackendVersion()
    return backendVersion.schema_version || '1.0.0'
  } catch (error) {
    console.error('Error fetching schema version:', error)
    return '1.0.0'
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

