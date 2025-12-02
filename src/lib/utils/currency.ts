/**
 * Currency configuration
 * 
 * Centralized currency symbol for the application.
 * In the future, this can be made configurable via user settings.
 */

export const CURRENCY_SYMBOL = '₹'

/**
 * Format a number as currency
 * @param amount - The amount to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, decimals: number = 2): string {
  return `${CURRENCY_SYMBOL}${amount.toFixed(decimals)}`
}
