const ADMIN_EMAILS = (import.meta.env.VITE_PLATFORM_ADMIN_EMAILS || '')
  .split(',')
  .map((email: string) => email.trim().toLowerCase())
  .filter((email: string) => email.length > 0)

export function isPrivilegedAdminEmail(email: string) {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}

export const ADMIN_IDLE_TIMEOUT_MS = Number(
  import.meta.env.VITE_PLATFORM_ADMIN_IDLE_TIMEOUT_MS || 15 * 60 * 1000
)

export const ADMIN_SESSION_MAX_LIFETIME_MS = Number(
  import.meta.env.VITE_PLATFORM_ADMIN_MAX_SESSION_MS || 8 * 60 * 60 * 1000
)

export const ADMIN_DEVICE_BINDING_KEY = 'platformAdminDeviceBinding:v1'
export const ADMIN_SESSION_START_KEY = 'platformAdminSessionStart'
export const ADMIN_LAST_ACTIVITY_KEY = 'platformAdminLastActivity'
export const ADMIN_SSO_PROVIDER = (import.meta.env.VITE_PLATFORM_ADMIN_SSO_PROVIDER || 'azure').trim()
export const ADMIN_SSO_REDIRECT_PATH = (import.meta.env.VITE_PLATFORM_ADMIN_SSO_REDIRECT || '/reviewer').trim()

