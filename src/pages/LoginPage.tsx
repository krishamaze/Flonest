import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'
import { customAuthTheme } from '../lib/authTheme'

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 shadow-lg">
            <span className="text-3xl font-bold text-white">I</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory System</h1>
          <p className="mt-2 text-gray-600">Sign in to manage your inventory</p>
        </div>

        {/* Auth UI Card */}
        <div className="rounded-lg bg-white p-8 shadow-sm border border-gray-200">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: customAuthTheme,
              className: {
                container: 'auth-container',
                button: 'auth-button',
                input: 'auth-input',
                label: 'auth-label',
                anchor: 'auth-anchor',
                divider: 'auth-divider',
                loader: 'auth-loader',
                message: 'auth-message',
              },
            }}
            providers={[]}
            redirectTo={window.location.origin}
            onlyThirdPartyProviders={false}
            magicLink={false}
            view="sign_in"
            showLinks={true}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Email',
                  password_label: 'Password',
                  email_input_placeholder: 'you@example.com',
                  password_input_placeholder: '••••••••',
                  button_label: 'Sign In',
                  loading_button_label: 'Signing in...',
                  social_provider_text: 'Sign in with {{provider}}',
                  link_text: "Don't have an account? Sign up",
                },
                sign_up: {
                  email_label: 'Email',
                  password_label: 'Password',
                  email_input_placeholder: 'you@example.com',
                  password_input_placeholder: '••••••••',
                  button_label: 'Sign Up',
                  loading_button_label: 'Signing up...',
                  social_provider_text: 'Sign up with {{provider}}',
                  link_text: 'Already have an account? Sign in',
                  confirmation_text: 'Check your email for the confirmation link',
                },
                forgotten_password: {
                  email_label: 'Email',
                  password_label: 'Password',
                  email_input_placeholder: 'you@example.com',
                  button_label: 'Send reset password instructions',
                  loading_button_label: 'Sending...',
                  link_text: 'Forgot your password?',
                  confirmation_text: 'Check your email for the password reset link',
                },
              },
            }}
          />
        </div>

        {/* Demo credentials hint */}
        <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm text-blue-800 font-medium mb-1">Demo Account</p>
          <p className="text-xs text-blue-600">
            Email: <span className="font-mono">demo@example.com</span>
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Or sign up to create your own account with automatic tenant setup
          </p>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500">
          Powered by Supabase Auth • Secure & Reliable
        </p>
      </div>
    </div>
  )
}

