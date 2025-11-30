#!/bin/bash
# Systematic replacement of setState calls with dispatch calls in InvoiceForm.tsx

FILE="/home/user/Flonest/src/components/forms/InvoiceForm.tsx"

# Backup original file
cp "$FILE" "${FILE}.backup"

# Replace all setState calls with dispatch calls
# Pattern: setXxx(value) → dispatch({ type: 'SET_XXX', payload: value })

sed -i 's/setCurrentStep(\([^)]*\))/dispatch({ type: '\''SET_STEP'\'', payload: \1 })/g' "$FILE"
sed -i 's/setIdentifier(\([^)]*\))/dispatch({ type: '\''SET_IDENTIFIER'\'', payload: \1 })/g' "$FILE"
sed -i 's/setIdentifierValid(\([^)]*\))/dispatch({ type: '\''SET_IDENTIFIER_VALID'\'', payload: \1 })/g' "$FILE"
sed -i 's/setIdentifierType(\([^)]*\))/dispatch({ type: '\''SET_IDENTIFIER_TYPE'\'', payload: \1 })/g' "$FILE"
sed -i 's/setSearching(\([^)]*\))/dispatch({ type: '\''SET_SEARCHING'\'', payload: \1 })/g' "$FILE"
sed -i 's/setLookupPerformed(\([^)]*\))/dispatch({ type: '\''SET_LOOKUP_PERFORMED'\'', payload: \1 })/g' "$FILE"
sed -i 's/setSelectedCustomer(\([^)]*\))/dispatch({ type: '\''SET_SELECTED_CUSTOMER'\'', payload: \1 })/g' "$FILE"
sed -i 's/setShowAddNewForm(\([^)]*\))/dispatch({ type: '\''SET_SHOW_ADD_NEW_FORM'\'', payload: \1 })/g' "$FILE"
sed -i 's/setMasterFormData(\([^)]*\))/dispatch({ type: '\''SET_MASTER_FORM_DATA'\'', payload: \1 })/g' "$FILE"
sed -i 's/setProducts(\([^)]*\))/dispatch({ type: '\''SET_PRODUCTS'\'', payload: \1 })/g' "$FILE"
sed -i 's/setLoadingProducts(\([^)]*\))/dispatch({ type: '\''SET_LOADING_PRODUCTS'\'', payload: \1 })/g' "$FILE"
sed -i 's/setItems(\([^)]*\))/dispatch({ type: '\''SET_ITEMS'\'', payload: \1 })/g' "$FILE"
sed -i 's/setErrors(\([^)]*\))/dispatch({ type: '\''SET_ERRORS'\'', payload: \1 })/g' "$FILE"
sed -i 's/setIsSubmitting(\([^)]*\))/dispatch({ type: '\''SET_IS_SUBMITTING'\'', payload: \1 })/g' "$FILE"
sed -i 's/setInternalDraftInvoiceId(\([^)]*\))/dispatch({ type: '\''SET_INTERNAL_DRAFT_ID'\'', payload: \1 })/g' "$FILE"
sed -i 's/setSerialInputs(\([^)]*\))/dispatch({ type: '\''SET_SERIAL_INPUT'\'', payload: \1 })/g' "$FILE"
sed -i 's/setScannerMode(\([^)]*\))/dispatch({ type: '\''SET_SCANNER_MODE'\'', payload: \1 })/g' "$FILE"
sed -i 's/setShowConfirmSheet(\([^)]*\))/dispatch({ type: '\''SET_SHOW_CONFIRM_SHEET'\'', payload: \1 })/g' "$FILE"
sed -i 's/setPendingProduct(\([^)]*\))/dispatch({ type: '\''SET_PENDING_PRODUCT'\'', payload: \1 })/g' "$FILE"
sed -i 's/setPendingQuantity(\([^)]*\))/dispatch({ type: '\''SET_PENDING_QUANTITY'\'', payload: \1 })/g' "$FILE"
sed -i 's/setLoadingDraft(\([^)]*\))/dispatch({ type: '\''SET_LOADING_DRAFT'\'', payload: \1 })/g' "$FILE"
sed -i 's/setDraftLoadError(\([^)]*\))/dispatch({ type: '\''SET_DRAFT_LOAD_ERROR'\'', payload: \1 })/g' "$FILE"
sed -i 's/setIsRetrying(\([^)]*\))/dispatch({ type: '\''SET_IS_RETRYING'\'', payload: \1 })/g' "$FILE"
sed -i 's/setToast(\([^)]*\))/dispatch({ type: '\''SET_TOAST'\'', payload: \1 })/g' "$FILE"
sed -i 's/setLastAutoSaveTime(\([^)]*\))/dispatch({ type: '\''SET_LAST_AUTO_SAVE_TIME'\'', payload: \1 })/g' "$FILE"

echo "Migration complete! Original file backed up to ${FILE}.backup"
echo "Review the changes and test thoroughly."
