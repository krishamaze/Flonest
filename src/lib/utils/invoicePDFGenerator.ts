/**
 * Invoice PDF Generator
 * 
 * Generates GST-compliant invoice PDFs with proper tax breakdowns,
 * HSN codes, Place of Supply, and legal declarations.
 * 
 * Uses browser's print functionality with optimized CSS for PDF output.
 */

import type { Invoice } from '../../types'
import type { Org } from '../../types'
import type { CustomerWithMaster } from '../../types'
import type { ProductWithMaster } from '../../types'
import { calculateTax, createTaxContext, productToLineItem, determineSupplyType } from './taxCalculationService'
import type { TaxCalculationResult } from './taxCalculationService'

export interface InvoiceWithDetails extends Invoice {
  items: Array<{
    id: string
    product_id: string
    quantity: number
    unit: string
    unit_price: number
    total_amount: number
    description?: string | null
    product?: ProductWithMaster
  }>
  customer?: CustomerWithMaster
  org?: Org
}

/**
 * Get invoice document title based on tax status
 */
export function getInvoiceDocumentTitle(
  orgTaxStatus: string | null,
  supplyType: string
): string {
  // SEZ supplies use "TAX INVOICE" but with zero-rated declaration
  if (supplyType === 'zero_rated') {
    return 'TAX INVOICE'
  }
  
  // Composition scheme uses "BILL OF SUPPLY"
  if (orgTaxStatus === 'registered_composition') {
    return 'BILL OF SUPPLY'
  }
  
  // Unregistered/Consumer uses "BILL OF SUPPLY"
  if (orgTaxStatus === 'unregistered' || orgTaxStatus === 'consumer') {
    return 'BILL OF SUPPLY'
  }
  
  // Regular GST registered uses "TAX INVOICE"
  return 'TAX INVOICE'
}

/**
 * Get Place of Supply state name from state code
 */
export function getStateName(stateCode: string | null): string {
  if (!stateCode) return 'N/A'
  
  const stateMap: Record<string, string> = {
    '01': 'Jammu and Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Odisha',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '25': 'Daman and Diu',
    '26': 'Dadra and Nagar Haveli',
    '27': 'Maharashtra',
    '28': 'Andhra Pradesh',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands',
    '36': 'Telangana',
    '37': 'Andhra Pradesh (New)',
  }
  
  return stateMap[stateCode] || `State Code ${stateCode}`
}

/**
 * Group line items by HSN/SAC code for tax summary
 */
function groupByHSN(lineItems: Array<{
  hsn_sac_code: string | null
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
}>): Map<string, {
  hsn: string
  taxable: number
  cgst: number
  sgst: number
  igst: number
  total_tax: number
}> {
  const grouped = new Map()
  
  for (const item of lineItems) {
    const hsn = item.hsn_sac_code || 'N/A'
    const existing = grouped.get(hsn) || { 
      hsn, 
      taxable: 0, 
      cgst: 0, 
      sgst: 0, 
      igst: 0, 
      total_tax: 0 
    }
    
    existing.taxable += item.taxable_amount
    existing.cgst += item.cgst_amount
    existing.sgst += item.sgst_amount
    existing.igst += item.igst_amount
    existing.total_tax += item.cgst_amount + item.sgst_amount + item.igst_amount
    
    grouped.set(hsn, existing)
  }
  
  return grouped
}

/**
 * Generate invoice HTML for PDF printing
 */
export function generateInvoiceHTML(
  invoice: InvoiceWithDetails,
  org: Org,
  customer: CustomerWithMaster | null
): string {
  if (!customer) {
    throw new Error('Customer is required for invoice generation')
  }

  // Calculate tax using the tax calculation service
  const taxContext = createTaxContext(org, customer)
  const lineItems = (invoice.items || []).map(item => {
    const product = item.product as ProductWithMaster | undefined
    const taxRate = product?.tax_rate ?? product?.master_product?.gst_rate ?? null
    const hsnSacCode = product?.hsn_sac_code ?? product?.master_product?.hsn_code ?? null
    
    return productToLineItem(
      item.total_amount || 0,
      taxRate,
      hsnSacCode
    )
  })
  
  const taxResult: TaxCalculationResult = calculateTax(taxContext, lineItems, true)
  const supplyType = determineSupplyType(taxContext.org, taxContext.customer)
  
  // Group by HSN for tax summary table
  const hsnGroups = groupByHSN(taxResult.line_items)
  
  // Determine base supply type (intrastate vs interstate) for column display
  // Zero-rated supplies can still be interstate (SEZ → different state)
  const isInterstateBase = supplyType === 'zero_rated' 
    ? (org.state_code !== customer.state_code && org.state_code && customer.state_code)
    : supplyType === 'interstate'
  const isIntrastateBase = supplyType === 'intrastate' || 
    (supplyType === 'zero_rated' && org.state_code === customer.state_code && org.state_code && customer.state_code)
  
  const documentTitle = getInvoiceDocumentTitle(org.tax_status, supplyType)
  
  // Format date
  const invoiceDate = invoice.created_at 
    ? new Date(invoice.created_at).toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      })
    : 'N/A'
  
  // Place of Supply
  const placeOfSupply = customer.state_code 
    ? getStateName(customer.state_code)
    : (customer.master_customer?.state_code ? getStateName(customer.master_customer.state_code) : 'N/A')
  
  // Seller details
  const sellerState = org.state_code ? getStateName(org.state_code) : org.state || 'N/A'
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${documentTitle} - ${invoice.invoice_number}</title>
  <style>
    @media print {
      @page {
        size: A4;
        margin: 15mm;
      }
      body {
        margin: 0;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #000;
      background: #fff;
      padding: 20px;
    }
    
    .invoice-container {
      max-width: 210mm;
      margin: 0 auto;
      background: #fff;
    }
    
    .invoice-header {
      border-bottom: 3px solid #000;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    
    .invoice-title {
      font-size: 24px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .invoice-number {
      text-align: center;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 5px;
    }
    
    .invoice-date {
      text-align: center;
      font-size: 12px;
      color: #333;
    }
    
    .parties-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 20px;
    }
    
    .party-box {
      border: 1px solid #000;
      padding: 10px;
    }
    
    .party-label {
      font-weight: bold;
      font-size: 11px;
      text-transform: uppercase;
      margin-bottom: 8px;
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
    }
    
    .party-name {
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 5px;
    }
    
    .party-detail {
      font-size: 11px;
      margin-bottom: 3px;
      line-height: 1.4;
    }
    
    .party-detail strong {
      font-weight: 600;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 11px;
    }
    
    .items-table th {
      background: #f0f0f0;
      border: 1px solid #000;
      padding: 8px 5px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
    }
    
    .items-table td {
      border: 1px solid #000;
      padding: 6px 5px;
      vertical-align: top;
    }
    
    .items-table .text-right {
      text-align: right;
    }
    
    .items-table .text-center {
      text-align: center;
    }
    
    .tax-summary {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .tax-breakup {
      border: 1px solid #000;
      padding: 10px;
    }
    
    .tax-breakup-title {
      font-weight: bold;
      font-size: 11px;
      text-transform: uppercase;
      margin-bottom: 8px;
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
    }
    
    .tax-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 11px;
      border-bottom: 1px dotted #666;
    }
    
    .tax-row:last-child {
      border-bottom: none;
    }
    
    .tax-row-label {
      font-weight: 500;
    }
    
    .tax-row-amount {
      font-weight: 600;
    }
    
    .totals-box {
      border: 1px solid #000;
      padding: 10px;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 12px;
    }
    
    .total-row.subtotal {
      border-bottom: 1px solid #000;
      margin-bottom: 5px;
      padding-bottom: 8px;
    }
    
    .total-row.grand-total {
      border-top: 2px solid #000;
      margin-top: 8px;
      padding-top: 8px;
      font-size: 14px;
      font-weight: bold;
    }
    
    .declarations {
      border: 1px solid #000;
      padding: 10px;
      margin-bottom: 20px;
      font-size: 10px;
      line-height: 1.6;
    }
    
    .declaration-title {
      font-weight: bold;
      font-size: 11px;
      text-transform: uppercase;
      margin-bottom: 8px;
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
    }
    
    .declaration-item {
      margin-bottom: 5px;
    }
    
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 40px;
    }
    
    .signature-box {
      text-align: center;
    }
    
    .signature-line {
      border-top: 1px solid #000;
      margin-top: 50px;
      padding-top: 5px;
      font-size: 11px;
      font-weight: 600;
    }
    
    .sez-declaration {
      background: #fffacd;
      border: 2px solid #000;
      padding: 12px;
      margin-bottom: 15px;
      font-weight: 600;
      font-size: 11px;
      text-align: center;
      text-transform: uppercase;
    }
    
    .amount-in-words {
      border: 1px solid #000;
      padding: 8px;
      margin-bottom: 15px;
      font-size: 11px;
      font-style: italic;
    }
    
    .amount-in-words-label {
      font-weight: 600;
      margin-right: 5px;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="invoice-header">
      <div class="invoice-title">${documentTitle}</div>
      <div class="invoice-number">Invoice No: ${invoice.invoice_number || 'N/A'}</div>
      <div class="invoice-date">Date: ${invoiceDate}</div>
    </div>
    
    <!-- SEZ Declaration (if applicable) -->
    ${supplyType === 'zero_rated' ? `
      <div class="sez-declaration">
        ${taxResult.tax_label}
      </div>
    ` : ''}
    
    <!-- Parties Section -->
    <div class="parties-section">
      <!-- Seller Details -->
      <div class="party-box">
        <div class="party-label">Sold By</div>
        <div class="party-name">${org.name || 'N/A'}</div>
        <div class="party-detail">${org.address || ''}</div>
        ${org.gst_number ? `<div class="party-detail"><strong>GSTIN:</strong> ${org.gst_number}</div>` : ''}
        ${org.tax_identifier ? `<div class="party-detail"><strong>PAN:</strong> ${org.tax_identifier}</div>` : ''}
        ${org.state_code ? `<div class="party-detail"><strong>State:</strong> ${sellerState} (Code: ${org.state_code})</div>` : ''}
        ${org.phone ? `<div class="party-detail"><strong>Phone:</strong> ${org.phone}</div>` : ''}
      </div>
      
      <!-- Buyer Details -->
      <div class="party-box">
        <div class="party-label">Bill To</div>
        <div class="party-name">${customer.master_customer?.legal_name || customer.alias_name || 'N/A'}</div>
        <div class="party-detail">${customer.billing_address || customer.master_customer?.address || ''}</div>
        ${customer.gst_number || customer.master_customer?.gstin ? `
          <div class="party-detail"><strong>GSTIN:</strong> ${customer.gst_number || customer.master_customer?.gstin}</div>
        ` : ''}
        ${customer.master_customer?.pan ? `
          <div class="party-detail"><strong>PAN:</strong> ${customer.master_customer.pan}</div>
        ` : ''}
        ${customer.state_code || customer.master_customer?.state_code ? `
          <div class="party-detail"><strong>State:</strong> ${getStateName(customer.state_code || customer.master_customer?.state_code || null)} (Code: ${customer.state_code || customer.master_customer?.state_code})</div>
        ` : ''}
        ${customer.master_customer?.mobile ? `
          <div class="party-detail"><strong>Phone:</strong> ${customer.master_customer.mobile}</div>
        ` : ''}
      </div>
    </div>
    
    <!-- Place of Supply -->
    <div style="margin-bottom: 15px; font-size: 11px; font-weight: 600;">
      <strong>Place of Supply:</strong> ${placeOfSupply}
    </div>
    
    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 5%;">S.No</th>
          <th style="width: 30%;">Description</th>
          <th style="width: 10%;">HSN/SAC</th>
          <th style="width: 8%;">Qty</th>
          <th style="width: 8%;">Unit</th>
          <th style="width: 12%;" class="text-right">Rate</th>
          <th style="width: 12%;" class="text-right">Taxable Value</th>
          ${isIntrastateBase ? `
            <th style="width: 7%;" class="text-right">CGST<br/>Rate</th>
            <th style="width: 7%;" class="text-right">CGST<br/>Amount</th>
            <th style="width: 7%;" class="text-right">SGST<br/>Rate</th>
            <th style="width: 7%;" class="text-right">SGST<br/>Amount</th>
          ` : isInterstateBase ? `
            <th style="width: 14%;" class="text-right">IGST<br/>Rate</th>
            <th style="width: 14%;" class="text-right">IGST<br/>Amount</th>
          ` : ''}
          <th style="width: 12%;" class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${taxResult.line_items.map((item, index) => {
          const invoiceItem = invoice.items[index]
          const product = invoiceItem?.product as ProductWithMaster | undefined
          const productName = product?.name || product?.master_product?.name || 'Unknown Product'
          const quantity = invoiceItem?.quantity || 0
          const unit = invoiceItem?.unit || 'pcs'
          const unitPrice = invoiceItem?.unit_price || 0
          
          if (isIntrastateBase) {
            return `
              <tr>
                <td class="text-center">${index + 1}</td>
                <td>${productName}</td>
                <td class="text-center">${item.hsn_sac_code || 'N/A'}</td>
                <td class="text-center">${quantity}</td>
                <td class="text-center">${unit}</td>
                <td class="text-right">₹${unitPrice.toFixed(2)}</td>
                <td class="text-right">₹${item.taxable_amount.toFixed(2)}</td>
                <td class="text-right">${(item.tax_rate / 2).toFixed(2)}%</td>
                <td class="text-right">₹${item.cgst_amount.toFixed(2)}</td>
                <td class="text-right">${(item.tax_rate / 2).toFixed(2)}%</td>
                <td class="text-right">₹${item.sgst_amount.toFixed(2)}</td>
                <td class="text-right">₹${item.total_amount.toFixed(2)}</td>
              </tr>
            `
          } else if (isInterstateBase) {
            // Interstate (including zero-rated SEZ interstate supplies)
            return `
              <tr>
                <td class="text-center">${index + 1}</td>
                <td>${productName}</td>
                <td class="text-center">${item.hsn_sac_code || 'N/A'}</td>
                <td class="text-center">${quantity}</td>
                <td class="text-center">${unit}</td>
                <td class="text-right">₹${unitPrice.toFixed(2)}</td>
                <td class="text-right">₹${item.taxable_amount.toFixed(2)}</td>
                <td class="text-right">${item.tax_rate.toFixed(2)}%</td>
                <td class="text-right">₹${item.igst_amount.toFixed(2)}</td>
                <td class="text-right">₹${item.total_amount.toFixed(2)}</td>
              </tr>
            `
          } else {
            // Exempt (unregistered/consumer) - no tax columns
            return `
              <tr>
                <td class="text-center">${index + 1}</td>
                <td>${productName}</td>
                <td class="text-center">${item.hsn_sac_code || 'N/A'}</td>
                <td class="text-center">${quantity}</td>
                <td class="text-center">${unit}</td>
                <td class="text-right">₹${unitPrice.toFixed(2)}</td>
                <td class="text-right">₹${item.taxable_amount.toFixed(2)}</td>
                <td class="text-right" colspan="4">${taxResult.tax_label}</td>
                <td class="text-right">₹${item.total_amount.toFixed(2)}</td>
              </tr>
            `
          }
        }).join('')}
      </tbody>
    </table>
    
    <!-- HSN-wise Tax Summary -->
    <div style="margin-bottom: 20px;">
      <div style="font-weight: bold; font-size: 12px; margin-bottom: 8px; text-transform: uppercase;">HSN/SAC-wise Summary</div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 20%;">HSN/SAC</th>
            <th style="width: 20%;" class="text-right">Taxable Value</th>
            ${isIntrastateBase ? `
              <th style="width: 15%;" class="text-right">CGST</th>
              <th style="width: 15%;" class="text-right">SGST</th>
            ` : isInterstateBase ? `
              <th style="width: 15%;" class="text-right">IGST</th>
            ` : ''}
            <th style="width: 15%;" class="text-right">Total Tax</th>
          </tr>
        </thead>
        <tbody>
          ${[...hsnGroups.values()].map(g => {
            if (isIntrastateBase) {
              return `
                <tr>
                  <td>${g.hsn}</td>
                  <td class="text-right">₹${g.taxable.toFixed(2)}</td>
                  <td class="text-right">₹${g.cgst.toFixed(2)}</td>
                  <td class="text-right">₹${g.sgst.toFixed(2)}</td>
                  <td class="text-right">₹${g.total_tax.toFixed(2)}</td>
                </tr>
              `
            } else if (isInterstateBase) {
              return `
                <tr>
                  <td>${g.hsn}</td>
                  <td class="text-right">₹${g.taxable.toFixed(2)}</td>
                  <td class="text-right">₹${g.igst.toFixed(2)}</td>
                  <td class="text-right">₹${g.total_tax.toFixed(2)}</td>
                </tr>
              `
            } else {
              return `
                <tr>
                  <td>${g.hsn}</td>
                  <td class="text-right">₹${g.taxable.toFixed(2)}</td>
                  <td class="text-right">₹${g.total_tax.toFixed(2)}</td>
                </tr>
              `
            }
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <!-- Tax Summary and Totals -->
    <div class="tax-summary">
      <div class="tax-breakup">
        <div class="tax-breakup-title">Tax Summary</div>
        ${isIntrastateBase ? `
          <div class="tax-row">
            <span class="tax-row-label">CGST</span>
            <span class="tax-row-amount">₹${taxResult.cgst_amount.toFixed(2)}</span>
          </div>
          <div class="tax-row">
            <span class="tax-row-label">SGST</span>
            <span class="tax-row-amount">₹${taxResult.sgst_amount.toFixed(2)}</span>
          </div>
        ` : isInterstateBase ? `
          <div class="tax-row">
            <span class="tax-row-label">IGST</span>
            <span class="tax-row-amount">₹${taxResult.igst_amount.toFixed(2)}</span>
          </div>
        ` : `
          <div class="tax-row">
            <span class="tax-row-label">${taxResult.tax_label}</span>
            <span class="tax-row-amount">₹0.00</span>
          </div>
        `}
        <div class="tax-row" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #000;">
          <span class="tax-row-label"><strong>Total Tax</strong></span>
          <span class="tax-row-amount"><strong>₹${taxResult.total_tax.toFixed(2)}</strong></span>
        </div>
      </div>
      
      <div class="totals-box">
        <div class="total-row subtotal">
          <span><strong>Subtotal</strong></span>
          <span><strong>₹${taxResult.subtotal.toFixed(2)}</strong></span>
        </div>
        ${isIntrastateBase ? `
          <div class="total-row">
            <span>CGST</span>
            <span>₹${taxResult.cgst_amount.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>SGST</span>
            <span>₹${taxResult.sgst_amount.toFixed(2)}</span>
          </div>
        ` : isInterstateBase ? `
          <div class="total-row">
            <span>IGST</span>
            <span>₹${taxResult.igst_amount.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="total-row grand-total">
          <span>Grand Total</span>
          <span>₹${taxResult.grand_total.toFixed(2)}</span>
        </div>
      </div>
    </div>
    
    <!-- Amount in Words -->
    <div class="amount-in-words">
      <span class="amount-in-words-label">Amount in Words:</span>
      ${numberToWords(taxResult.grand_total)} Only
    </div>
    
    <!-- Declarations -->
    <div class="declarations">
      <div class="declaration-title">Terms & Conditions</div>
      <div class="declaration-item">
        • This is a computer-generated invoice and does not require a signature.
      </div>
      <div class="declaration-item">
        • Subject to ${sellerState} jurisdiction.
      </div>
      ${supplyType === 'zero_rated' ? `
        <div class="declaration-item" style="font-weight: 600; margin-top: 8px;">
          • ${taxResult.tax_label}
        </div>
      ` : ''}
      ${org.tax_status === 'registered_composition' ? `
        <div class="declaration-item" style="font-weight: 600; margin-top: 8px;">
          • Registered under Composition Scheme - No Input Tax Credit available.
        </div>
      ` : ''}
    </div>
    
    <!-- Signatures -->
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line">Authorized Signatory</div>
      </div>
      <div class="signature-box">
        <div class="signature-line">Receiver's Signature</div>
      </div>
    </div>
  </div>
  
  <div class="no-print" style="text-align: center; margin-top: 20px; padding: 20px;">
    <button onclick="window.print()" style="padding: 12px 24px; font-size: 16px; background: #E2C33D; color: #000; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
      Print / Save as PDF
    </button>
  </div>
</body>
</html>
  `
}

/**
 * Convert number to words (Indian numbering system)
 */
function numberToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  
  function convertHundreds(num: number): string {
    let result = ''
    if (num >= 100) {
      result += ones[Math.floor(num / 100)] + ' Hundred '
      num %= 100
    }
    if (num >= 20) {
      result += tens[Math.floor(num / 10)] + ' '
      num %= 10
    } else if (num >= 10) {
      result += teens[num - 10] + ' '
      return result
    }
    if (num > 0) {
      result += ones[num] + ' '
    }
    return result
  }
  
  let rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)
  
  let words = ''
  
  if (rupees >= 10000000) {
    words += convertHundreds(Math.floor(rupees / 10000000)) + 'Crore '
    rupees %= 10000000
  }
  if (rupees >= 100000) {
    words += convertHundreds(Math.floor(rupees / 100000)) + 'Lakh '
    rupees %= 100000
  }
  if (rupees >= 1000) {
    words += convertHundreds(Math.floor(rupees / 1000)) + 'Thousand '
    rupees %= 1000
  }
  if (rupees > 0) {
    words += convertHundreds(rupees)
  }
  
  if (!words.trim()) {
    words = 'Zero '
  }
  
  words += 'Rupees'
  
  if (paise > 0) {
    words += ' and ' + convertHundreds(paise) + 'Paise'
  }
  
  return words.trim()
}

/**
 * Open invoice in new window for printing/PDF
 */
export function printInvoice(
  invoice: InvoiceWithDetails,
  org: Org,
  customer: CustomerWithMaster | null
): void {
  const html = generateInvoiceHTML(invoice, org, customer)
  const printWindow = window.open('', '_blank')
  
  if (!printWindow) {
    alert('Please allow popups to print invoice')
    return
  }
  
  printWindow.document.write(html)
  printWindow.document.close()
  
  // Wait for content to load, then trigger print dialog
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }
}

/**
 * Download invoice as PDF (opens print dialog)
 */
export function downloadInvoicePDF(
  invoice: InvoiceWithDetails,
  org: Org,
  customer: CustomerWithMaster | null
): void {
  printInvoice(invoice, org, customer)
}

