/**
 * useInvoiceFormReducer - Consolidated state management for InvoiceForm
 *
 * Replaces 25 useState calls with a single useReducer for better:
 * - State organization and grouping
 * - Action batching (multiple state updates in one dispatch)
 * - Testability and debugging
 * - Performance (fewer re-renders)
 */

import { useReducer } from 'react'
import type { CustomerWithMaster, InvoiceItemFormData, ProductWithMaster } from '../types'
import type { IdentifierType } from '../lib/utils/identifierValidation'

// ========================================
// State Interface
// ========================================

export type Step = 1 | 2 | 3 | 4
export type ScannerMode = 'closed' | 'scanning' | 'confirming'

export interface InvoiceFormState {
  // Step management
  currentStep: Step

  // Customer lookup state
  identifier: string
  identifierValid: boolean
  identifierType: IdentifierType
  searching: boolean
  lookupPerformed: boolean
  selectedCustomer: CustomerWithMaster | null
  showAddNewForm: boolean
  masterFormData: {
    customer_name: string
    address: string
    email: string
    additionalIdentifier: string
  }

  // Products state
  products: ProductWithMaster[]
  loadingProducts: boolean
  items: InvoiceItemFormData[]
  serialInputs: Record<number, string>

  // Scanner state
  scannerMode: ScannerMode
  showConfirmSheet: boolean
  pendingProduct: ProductWithMaster | null
  pendingQuantity: number

  // Draft loading state
  loadingDraft: boolean
  draftLoadError: string | null
  isRetrying: boolean
  internalDraftInvoiceId: string | null

  // Form state
  errors: Record<string, string>
  isSubmitting: boolean

  // UI feedback
  toast: { message: string; type?: 'success' | 'info' | 'error' } | null
  lastAutoSaveTime: number | null
}

// ========================================
// Action Types
// ========================================

export type InvoiceFormAction =
  // Step navigation
  | { type: 'SET_STEP'; payload: Step }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }

  // Customer lookup actions
  | { type: 'SET_IDENTIFIER'; payload: string }
  | { type: 'SET_IDENTIFIER_VALID'; payload: boolean }
  | { type: 'SET_IDENTIFIER_TYPE'; payload: IdentifierType }
  | { type: 'SET_SEARCHING'; payload: boolean }
  | { type: 'SET_LOOKUP_PERFORMED'; payload: boolean }
  | { type: 'SET_SELECTED_CUSTOMER'; payload: CustomerWithMaster | null }
  | { type: 'SET_SHOW_ADD_NEW_FORM'; payload: boolean }
  | { type: 'SET_MASTER_FORM_DATA'; payload: Partial<InvoiceFormState['masterFormData']> }
  | { type: 'RESET_CUSTOMER_LOOKUP' }

  // Products actions
  | { type: 'SET_PRODUCTS'; payload: ProductWithMaster[] }
  | { type: 'SET_LOADING_PRODUCTS'; payload: boolean }
  | { type: 'SET_ITEMS'; payload: InvoiceItemFormData[] }
  | { type: 'ADD_ITEM'; payload: InvoiceItemFormData }
  | { type: 'UPDATE_ITEM'; payload: { index: number; item: InvoiceItemFormData } }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'SET_SERIAL_INPUT'; payload: { index: number; value: string } }
  | { type: 'RESET_ITEMS' }

  // Scanner actions
  | { type: 'SET_SCANNER_MODE'; payload: ScannerMode }
  | { type: 'SET_SHOW_CONFIRM_SHEET'; payload: boolean }
  | { type: 'SET_PENDING_PRODUCT'; payload: ProductWithMaster | null }
  | { type: 'SET_PENDING_QUANTITY'; payload: number }
  | { type: 'RESET_SCANNER' }

  // Draft loading actions
  | { type: 'SET_LOADING_DRAFT'; payload: boolean }
  | { type: 'SET_DRAFT_LOAD_ERROR'; payload: string | null }
  | { type: 'SET_IS_RETRYING'; payload: boolean }
  | { type: 'SET_INTERNAL_DRAFT_ID'; payload: string | null }
  | { type: 'LOAD_DRAFT_START' }
  | { type: 'LOAD_DRAFT_SUCCESS'; payload: { customer: CustomerWithMaster; items: InvoiceItemFormData[]; draftId: string } }
  | { type: 'LOAD_DRAFT_ERROR'; payload: string }

  // Form state actions
  | { type: 'SET_ERRORS'; payload: Record<string, string> }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_ERROR'; payload: { key: string; message: string } }
  | { type: 'CLEAR_ERROR'; payload: string }
  | { type: 'SET_IS_SUBMITTING'; payload: boolean }

  // UI feedback actions
  | { type: 'SET_TOAST'; payload: { message: string; type?: 'success' | 'info' | 'error' } | null }
  | { type: 'SET_LAST_AUTO_SAVE_TIME'; payload: number | null }

  // Batch actions
  | { type: 'RESET_FORM' }
  | { type: 'INITIALIZE_FORM' }

// ========================================
// Initial State
// ========================================

export const initialInvoiceFormState: InvoiceFormState = {
  // Step management
  currentStep: 1,

  // Customer lookup state
  identifier: '',
  identifierValid: false,
  identifierType: 'invalid',
  searching: false,
  lookupPerformed: false,
  selectedCustomer: null,
  showAddNewForm: false,
  masterFormData: {
    customer_name: '',
    address: '',
    email: '',
    additionalIdentifier: '',
  },

  // Products state
  products: [],
  loadingProducts: false,
  items: [],
  serialInputs: {},

  // Scanner state
  scannerMode: 'closed',
  showConfirmSheet: false,
  pendingProduct: null,
  pendingQuantity: 1,

  // Draft loading state
  loadingDraft: false,
  draftLoadError: null,
  isRetrying: false,
  internalDraftInvoiceId: null,

  // Form state
  errors: {},
  isSubmitting: false,

  // UI feedback
  toast: null,
  lastAutoSaveTime: null,
}

// ========================================
// Reducer Function
// ========================================

export function invoiceFormReducer(
  state: InvoiceFormState,
  action: InvoiceFormAction
): InvoiceFormState {
  switch (action.type) {
    // Step navigation
    case 'SET_STEP':
      return { ...state, currentStep: action.payload }

    case 'NEXT_STEP':
      return { ...state, currentStep: Math.min(4, state.currentStep + 1) as Step }

    case 'PREV_STEP':
      return { ...state, currentStep: Math.max(1, state.currentStep - 1) as Step }

    // Customer lookup
    case 'SET_IDENTIFIER':
      return { ...state, identifier: action.payload }

    case 'SET_IDENTIFIER_VALID':
      return { ...state, identifierValid: action.payload }

    case 'SET_IDENTIFIER_TYPE':
      return { ...state, identifierType: action.payload }

    case 'SET_SEARCHING':
      return { ...state, searching: action.payload }

    case 'SET_LOOKUP_PERFORMED':
      return { ...state, lookupPerformed: action.payload }

    case 'SET_SELECTED_CUSTOMER':
      return { ...state, selectedCustomer: action.payload }

    case 'SET_SHOW_ADD_NEW_FORM':
      return { ...state, showAddNewForm: action.payload }

    case 'SET_MASTER_FORM_DATA':
      return {
        ...state,
        masterFormData: { ...state.masterFormData, ...action.payload },
      }

    case 'RESET_CUSTOMER_LOOKUP':
      return {
        ...state,
        identifier: '',
        identifierValid: false,
        identifierType: 'invalid',
        searching: false,
        lookupPerformed: false,
        selectedCustomer: null,
        showAddNewForm: false,
        masterFormData: {
          customer_name: '',
          address: '',
          email: '',
          additionalIdentifier: '',
        },
      }

    // Products
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload }

    case 'SET_LOADING_PRODUCTS':
      return { ...state, loadingProducts: action.payload }

    case 'SET_ITEMS':
      return { ...state, items: action.payload }

    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] }

    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map((item, idx) =>
          idx === action.payload.index ? action.payload.item : item
        ),
      }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((_, idx) => idx !== action.payload),
        serialInputs: Object.fromEntries(
          Object.entries(state.serialInputs).filter(([key]) => parseInt(key) !== action.payload)
        ),
      }

    case 'SET_SERIAL_INPUT':
      return {
        ...state,
        serialInputs: {
          ...state.serialInputs,
          [action.payload.index]: action.payload.value,
        },
      }

    case 'RESET_ITEMS':
      return { ...state, items: [], serialInputs: {} }

    // Scanner
    case 'SET_SCANNER_MODE':
      return { ...state, scannerMode: action.payload }

    case 'SET_SHOW_CONFIRM_SHEET':
      return { ...state, showConfirmSheet: action.payload }

    case 'SET_PENDING_PRODUCT':
      return { ...state, pendingProduct: action.payload }

    case 'SET_PENDING_QUANTITY':
      return { ...state, pendingQuantity: action.payload }

    case 'RESET_SCANNER':
      return {
        ...state,
        scannerMode: 'closed',
        showConfirmSheet: false,
        pendingProduct: null,
        pendingQuantity: 1,
      }

    // Draft loading
    case 'SET_LOADING_DRAFT':
      return { ...state, loadingDraft: action.payload }

    case 'SET_DRAFT_LOAD_ERROR':
      return { ...state, draftLoadError: action.payload }

    case 'SET_IS_RETRYING':
      return { ...state, isRetrying: action.payload }

    case 'SET_INTERNAL_DRAFT_ID':
      return { ...state, internalDraftInvoiceId: action.payload }

    case 'LOAD_DRAFT_START':
      return {
        ...state,
        loadingDraft: true,
        draftLoadError: null,
      }

    case 'LOAD_DRAFT_SUCCESS':
      return {
        ...state,
        loadingDraft: false,
        draftLoadError: null,
        selectedCustomer: action.payload.customer,
        items: action.payload.items,
        internalDraftInvoiceId: action.payload.draftId,
        currentStep: 2, // Move to products step after loading draft
      }

    case 'LOAD_DRAFT_ERROR':
      return {
        ...state,
        loadingDraft: false,
        draftLoadError: action.payload,
      }

    // Form state
    case 'SET_ERRORS':
      return { ...state, errors: action.payload }

    case 'CLEAR_ERRORS':
      return { ...state, errors: {} }

    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.payload.key]: action.payload.message },
      }

    case 'CLEAR_ERROR':
      return {
        ...state,
        errors: Object.fromEntries(
          Object.entries(state.errors).filter(([key]) => key !== action.payload)
        ),
      }

    case 'SET_IS_SUBMITTING':
      return { ...state, isSubmitting: action.payload }

    // UI feedback
    case 'SET_TOAST':
      return { ...state, toast: action.payload }

    case 'SET_LAST_AUTO_SAVE_TIME':
      return { ...state, lastAutoSaveTime: action.payload }

    // Batch actions
    case 'RESET_FORM':
      return initialInvoiceFormState

    case 'INITIALIZE_FORM':
      return {
        ...initialInvoiceFormState,
        products: state.products, // Keep products loaded
        loadingProducts: state.loadingProducts,
      }

    default:
      return state
  }
}

// ========================================
// Custom Hook
// ========================================

export function useInvoiceFormReducer() {
  return useReducer(invoiceFormReducer, initialInvoiceFormState)
}
