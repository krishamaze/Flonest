import { ThemeSupa } from '@supabase/auth-ui-shared'

/**
 * Custom Auth UI theme matching the dashboard's elegant gray/blue design
 * Based on ThemeSupa with customizations for primary colors and styling
 */
export const customAuthTheme = {
  default: {
    colors: {
      brand: '#0284c7', // primary-600
      brandAccent: '#0369a1', // primary-700
      brandButtonText: 'white',
      defaultButtonBackground: '#f3f4f6', // gray-100
      defaultButtonBackgroundHover: '#e5e7eb', // gray-200
      defaultButtonBorder: '#d1d5db', // gray-300
      defaultButtonText: '#111827', // gray-900
      dividerBackground: '#e5e7eb', // gray-200
      inputBackground: 'white',
      inputBorder: '#d1d5db', // gray-300
      inputBorderHover: '#9ca3af', // gray-400
      inputBorderFocus: '#0284c7', // primary-600
      inputText: '#111827', // gray-900
      inputLabelText: '#374151', // gray-700
      inputPlaceholder: '#9ca3af', // gray-400
      messageText: '#111827', // gray-900
      messageTextDanger: '#dc2626', // red-600
      anchorTextColor: '#0284c7', // primary-600
      anchorTextHoverColor: '#0369a1', // primary-700
    },
    space: {
      spaceSmall: '4px',
      spaceMedium: '8px',
      spaceLarge: '16px',
      labelBottomMargin: '8px',
      anchorBottomMargin: '4px',
      emailInputSpacing: '4px',
      socialAuthSpacing: '4px',
      buttonPadding: '10px 16px',
      inputPadding: '10px 16px',
    },
    fontSizes: {
      baseBodySize: '16px',
      baseInputSize: '16px',
      baseLabelSize: '14px',
      baseButtonSize: '16px',
    },
    fonts: {
      bodyFontFamily: `'Inter', system-ui, -apple-system, sans-serif`,
      buttonFontFamily: `'Inter', system-ui, -apple-system, sans-serif`,
      inputFontFamily: `'Inter', system-ui, -apple-system, sans-serif`,
      labelFontFamily: `'Inter', system-ui, -apple-system, sans-serif`,
    },
    fontWeights: {
      buttonFontWeight: '500',
      inputFontWeight: '400',
      inputLabelFontWeight: '500',
    },
    borderWidths: {
      buttonBorderWidth: '1px',
      inputBorderWidth: '1px',
    },
    radii: {
      borderRadiusButton: '8px',
      buttonBorderRadius: '8px',
      inputBorderRadius: '8px',
    },
  },
}

/**
 * Appearance configuration for Auth UI
 */
export const authAppearance = {
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
}

