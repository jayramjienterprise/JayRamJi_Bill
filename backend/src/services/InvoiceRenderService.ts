export interface InvoiceRenderData {
  invoice: {
    id: string;
    invoiceNumber: string | null;
    invoiceDate: Date | string;
    amountInWords: string;
    paymentTerms: string | null;
    notes: string | null;
  };
  business: {
    name: string;
    legalName: string | null;
    address: {
      line1: string;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country: string;
    };
    contact: {
      phone?: string | null;
      email?: string | null;
    };
    taxProfile?: {
      gstin?: string | null;
      pan?: string | null;
    } | null;
    bankDetails?: {
      bankName?: string | null;
      accountHolderName?: string | null;
      accountNumber?: string | null;
      ifsc?: string | null;
      branch?: string | null;
    } | null;
    invoiceTitle: string;
  };
  customer: {
    name: string;
    address?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string | null;
    } | null;
    contact?: {
      phone?: string | null;
    } | null;
    taxProfile?: {
      gstin?: string | null;
    } | null;
  };
  items: Array<{
    serialNumber: number;
    description: string;
    uom: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  totals: {
    subtotal: number;
    discount: number;
    taxableAmount: number;
    taxes: Array<{
      type: string;
      rateBps: number;
      amount: number;
    }>;
    taxTotal: number;
    rounding: number;
    grandTotal: number;
    currency: string;
  };
  assets: {
    logo?: { secureUrl: string } | null;
    stamp?: { secureUrl: string } | null;
    signature?: { secureUrl: string } | null;
  };
}

export class InvoiceRenderService {
  public static render(data: InvoiceRenderData): string {
    const { invoice, business, customer, items, totals, assets } = data;

    // Date formatting helper
    const formattedDate = new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    // Populate billing item rows
    let rowsHtml = '';
    items.forEach((it) => {
      rowsHtml += `
        <tr class="item-row">
          <td style="text-align: center; border-right: 1px solid black; padding: 6px;">${it.serialNumber}</td>
          <td style="border-right: 1px solid black; padding: 6px; white-space: pre-wrap;">${it.description}</td>
          <td style="text-align: center; border-right: 1px solid black; padding: 6px;">${it.quantity}</td>
          <td style="text-align: right; border-right: 1px solid black; padding: 6px;">${it.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="text-align: right; padding: 6px; font-weight: bold;">${it.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    });

    // Add padding rows to maintain visual layout height if items are few
    if (items.length < 5) {
      for (let i = 0; i < (5 - items.length); i++) {
        rowsHtml += `
          <tr class="padding-row" style="height: 24px;">
            <td style="border-right: 1px solid black;"></td>
            <td style="border-right: 1px solid black;"></td>
            <td style="border-right: 1px solid black;"></td>
            <td style="border-right: 1px solid black;"></td>
            <td></td>
          </tr>
        `;
      }
    }

    // Populate taxes breakdown
    let taxesHtml = '';
    totals.taxes.forEach((t) => {
      taxesHtml += `
        <div class="summary-line">
          <span>${t.type} (${(t.rateBps / 100).toFixed(1)}%):</span>
          <span>₹${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      `;
    });

    // Logo image rendering logic
    const logoHtml = assets.logo?.secureUrl
      ? `<img src="${assets.logo.secureUrl}" class="logo" />`
      : `<div class="logo-placeholder">No Logo</div>`;

    // Stamp & signature overlays
    const signatureHtml = assets.signature?.secureUrl
      ? `<img src="${assets.signature.secureUrl}" class="overlay-signature" />`
      : '';
    const stampHtml = assets.stamp?.secureUrl
      ? `<img src="${assets.stamp.secureUrl}" class="overlay-stamp" />`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Tax Invoice</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: white;
            color: black;
            -webkit-print-color-adjust: exact;
          }
          .invoice-paper {
            width: 210mm;
            height: 297mm;
            padding: 15mm;
            box-sizing: border-box;
            background-color: white;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header-container {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid black;
            padding-bottom: 12px;
          }
          .header-left {
            display: flex;
            align-items: center;
          }
          .logo {
            width: 64px;
            height: 64px;
            object-fit: contain;
            margin-right: 16px;
          }
          .logo-placeholder {
            width: 64px;
            height: 64px;
            border: 1px dashed #ccc;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #999;
            margin-right: 16px;
          }
          .business-title {
            font-size: 20px;
            font-weight: 900;
            text-transform: uppercase;
            margin: 0;
            letter-spacing: 0.5px;
          }
          .business-details {
            font-size: 10px;
            color: #444;
            margin: 4px 0 0 0;
            line-height: 1.4;
          }
          .header-right {
            text-align: right;
          }
          .invoice-title {
            font-size: 18px;
            font-weight: 900;
            text-transform: uppercase;
            margin: 0;
            border-bottom: 2px solid black;
            padding-bottom: 4px;
            letter-spacing: 1px;
          }
          .business-gstin {
            font-size: 10px;
            font-weight: bold;
            margin-top: 8px;
          }
          .grid-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-top: 16px;
          }
          .info-card {
            border: 1px solid black;
            padding: 10px;
            border-radius: 4px;
            font-size: 11px;
          }
          .card-title {
            font-size: 10px;
            font-weight: bold;
            color: #666;
            text-transform: uppercase;
            border-bottom: 1px solid #eee;
            padding-bottom: 4px;
            margin: 0 0 6px 0;
            letter-spacing: 0.5px;
          }
          .customer-name {
            font-size: 13px;
            font-weight: bold;
            margin: 0 0 4px 0;
          }
          .customer-details {
            margin: 0;
            color: #444;
            line-height: 1.4;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
          }
          .meta-label {
            font-weight: bold;
            color: #666;
            padding: 2px 0;
            text-align: left;
          }
          .meta-val {
            font-weight: bold;
            text-align: right;
            padding: 2px 0;
          }
          .items-container {
            border: 1px solid black;
            border-radius: 4px;
            margin-top: 16px;
            overflow: hidden;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          .items-table th {
            background-color: #f3f4f6;
            border-bottom: 1px solid black;
            padding: 8px;
            font-weight: bold;
            text-align: left;
            text-transform: uppercase;
            font-size: 9px;
          }
          .items-table th.border-r {
            border-right: 1px solid black;
          }
          .items-table td {
            padding: 6px 8px;
          }
          .item-row {
            border-bottom: 1px solid #eee;
          }
          .item-row td {
            font-size: 10px;
          }
          .financials-grid {
            display: grid;
            grid-template-columns: 3fr 2fr;
            gap: 16px;
            margin-top: 16px;
          }
          .bank-card {
            border: 1px solid black;
            padding: 10px;
            border-radius: 4px;
            font-size: 10px;
            line-height: 1.4;
          }
          .bank-title {
            font-weight: bold;
            text-transform: uppercase;
            color: #666;
            border-bottom: 1px solid #eee;
            padding-bottom: 4px;
            margin: 0 0 6px 0;
          }
          .totals-card {
            border: 1px solid black;
            padding: 10px;
            border-radius: 4px;
            font-size: 11px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .summary-line {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #444;
            margin-bottom: 4px;
          }
          .grand-total-line {
            border-top: 1px solid black;
            padding-top: 6px;
            display: flex;
            justify-content: space-between;
            font-weight: 900;
            font-size: 13px;
          }
          .words-card {
            border: 1px solid black;
            padding: 10px;
            border-radius: 4px;
            margin-top: 16px;
            font-size: 10px;
          }
          .words-title {
            font-weight: bold;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .words-val {
            font-weight: bold;
            text-transform: uppercase;
          }
          .footer-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-top: 40px;
            font-size: 10px;
          }
          .sign-box {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 90px;
          }
          .sign-box.right {
            align-items: flex-end;
            position: relative;
          }
          .sign-title {
            font-weight: bold;
            color: #666;
            text-transform: uppercase;
          }
          .line {
            border-bottom: 1px solid black;
            width: 180px;
            margin-top: 30px;
          }
          .sign-subtitle {
            margin-top: 4px;
          }
          .overlay-container {
            display: flex;
            align-items: center;
            position: absolute;
            right: 0;
            bottom: 15px;
            pointer-events: none;
          }
          .overlay-signature {
            height: 48px;
            width: 96px;
            object-fit: contain;
            opacity: 0.85;
            margin-right: -20px;
          }
          .overlay-stamp {
            height: 64px;
            width: 64px;
            object-fit: contain;
            opacity: 0.75;
          }
        </style>
      </head>
      <body>
        <div class="invoice-paper">
          <div>
            <!-- Header -->
            <div class="header-container">
              <div class="header-left">
                ${logoHtml}
                <div>
                  <h1 class="business-title">${business.name}</h1>
                  <p class="business-details">
                    ${business.address.line1 || ''}${business.address.line2 ? ', ' + business.address.line2 : ''}<br/>
                    ${business.address.city || ''}${business.address.state ? ', ' + business.address.state : ''}${business.address.postalCode ? ' - ' + business.address.postalCode : ''}<br/>
                    ${business.contact.phone ? 'Mo: ' + business.contact.phone : ''}
                  </p>
                </div>
              </div>
              <div class="header-right">
                <h2 class="invoice-title">${business.invoiceTitle}</h2>
                ${business.taxProfile?.gstin ? `<div class="business-gstin">GSTIN: ${business.taxProfile.gstin}</div>` : ''}
              </div>
            </div>

            <!-- Customer & Meta -->
            <div class="grid-info">
              <div class="info-card">
                <h3 class="card-title">SOLD TO:</h3>
                <h4 class="customer-name">${customer.name}</h4>
                <p class="customer-details">
                  ${customer.address?.line1 || ''}${customer.address?.line2 ? '<br/>' + customer.address.line2 : ''}<br/>
                  ${[customer.address?.city, customer.address?.state].filter(Boolean).join(', ')}${customer.address?.postalCode ? ' - ' + customer.address.postalCode : ''}<br/>
                  ${customer.contact?.phone ? 'Mo: ' + customer.contact.phone : ''}
                  ${customer.taxProfile?.gstin ? `<br/><strong>GSTIN: ${customer.taxProfile.gstin}</strong>` : ''}
                </p>
              </div>

              <div class="info-card" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <h3 class="card-title">Invoice Details</h3>
                  <table class="meta-table">
                    <tr>
                      <td class="meta-label">Invoice No:</td>
                      <td class="meta-val">${invoice.invoiceNumber || '#' + invoice.id.slice(-6).toUpperCase()}</td>
                    </tr>
                    <tr>
                      <td class="meta-label">Invoice Date:</td>
                      <td class="meta-val">${formattedDate}</td>
                    </tr>
                    ${invoice.paymentTerms ? `
                      <tr>
                        <td class="meta-label">Payment Terms:</td>
                        <td class="meta-val">${invoice.paymentTerms}</td>
                      </tr>
                    ` : ''}
                  </table>
                </div>
              </div>
            </div>

            <!-- Items Table -->
            <div class="items-container">
              <table class="items-table">
                <thead>
                  <tr>
                    <th class="border-r" style="width: 40px; text-align: center;">SR.</th>
                    <th class="border-r">DESCRIPTION OF GOODS</th>
                    <th class="border-r" style="width: 50px; text-align: center;">QTY</th>
                    <th class="border-r" style="width: 90px; text-align: right;">PRICE (₹)</th>
                    <th style="width: 100px; text-align: right;">AMOUNT (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>

            <!-- Financials grid -->
            <div class="financials-grid">
              <div class="bank-card">
                <h3 class="bank-title">Bank Details</h3>
                <div><strong>A/C Name:</strong> ${business.bankDetails?.accountHolderName || '-'}</div>
                <div><strong>Bank Name:</strong> ${business.bankDetails?.bankName || '-'}</div>
                <div><strong>A/C No:</strong> ${business.bankDetails?.accountNumber || '-'}</div>
                <div><strong>IFSC Code:</strong> ${business.bankDetails?.ifsc || '-'}</div>
                <div style="margin-top: 4px;"><strong>PAN NO:</strong> ${business.taxProfile?.pan || '-'}</div>
              </div>

              <div class="totals-card">
                <div style="width: 100%;">
                  <div class="summary-line">
                    <span>Subtotal:</span>
                    <span>₹${totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  ${totals.discount > 0 ? `
                    <div class="summary-line" style="color: #b91c1c;">
                      <span>Discount:</span>
                      <span>-₹${totals.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ` : ''}
                  ${taxesHtml}
                  ${Math.abs(totals.rounding) > 0 ? `
                    <div class="summary-line" style="color: #999;">
                      <span>Rounding:</span>
                      <span>${totals.rounding > 0 ? '+' : ''}₹${totals.rounding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ` : ''}
                </div>
                <div class="grand-total-line">
                  <span>TOTAL:</span>
                  <span>₹${totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <!-- Amount in words -->
            <div class="words-card">
              <div class="words-title">Amount In Words:</div>
              <div class="words-val">${invoice.amountInWords}</div>
            </div>
          </div>

          <!-- Footer signatory block -->
          <div class="footer-container">
            <div class="sign-box">
              <span class="sign-title">Service Supervised By:</span>
              <div class="line"></div>
              <span class="sign-subtitle">Supervisor Name / Designation</span>
            </div>

            <div class="sign-box right">
              <span class="sign-title">Authorized Signatory</span>
              <div class="overlay-container">
                ${signatureHtml}
                ${stampHtml}
              </div>
              <div class="line"></div>
              <span class="sign-subtitle" style="font-weight: bold;">For ${business.name}</span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
