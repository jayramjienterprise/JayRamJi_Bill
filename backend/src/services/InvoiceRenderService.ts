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
    type?: 'SERVICE' | 'PRODUCT';
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

    const partsTotal = items.filter(it => it.type === 'PRODUCT' || (it as any).section === 'PART' || (it as any).section === 'ITEM').reduce((sum, it) => sum + (it.amount || 0), 0);
    const laborTotal = items.filter(it => it.type === 'SERVICE' || (it as any).section === 'LABOUR').reduce((sum, it) => sum + (it.amount || 0), 0);

    // Populate billing item rows
    let rowsHtml = '';
    items.forEach((it) => {
      rowsHtml += `
        <tr style="height: 14.15pt;">
          <td style="border: 1px solid black; padding: 6px; text-align: center;">${it.serialNumber}</td>
          <td style="border: 1px solid black; padding: 6px; white-space: pre-wrap; text-align: left;">${it.description}</td>
          <td style="border: 1px solid black; padding: 6px; text-align: center; font-weight: bold;">${it.quantity}</td>
          <td style="border: 1px solid black; padding: 6px; text-align: right; font-weight: 600;">${(it.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="border: 1px solid black; padding: 6px; text-align: right; font-weight: bold;">${(it.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    });

    // Add padding rows to maintain visual layout height if items are few
    const paddingCount = Math.max(0, 11 - items.length);
    for (let i = 0; i < paddingCount; i++) {
      rowsHtml += `
        <tr style="height: 14.15pt;">
          <td style="border: 1px solid black;"></td>
          <td style="border: 1px solid black;"></td>
          <td style="border: 1px solid black;"></td>
          <td style="border: 1px solid black;"></td>
          <td style="border: 1px solid black;"></td>
        </tr>
      `;
    }

    // Subtotal Row
    const subtotalValue = typeof totals?.subtotal === 'number' ? totals.subtotal : (partsTotal + laborTotal);
    const discountValue = typeof totals?.discount === 'number' ? totals.discount : 0;
    const taxTotalValue = typeof totals?.taxTotal === 'number' ? totals.taxTotal : 0;
    const roundingValue = typeof totals?.rounding === 'number' ? totals.rounding : 0;
    const grandTotalValue = typeof totals?.grandTotal === 'number' ? totals.grandTotal : (subtotalValue - discountValue + taxTotalValue + roundingValue);

    rowsHtml += `
      <tr style="font-weight: bold; height: 14.15pt;">
        <td colspan="2" style="border: 1px solid black; padding: 6px; text-align: left;">Total</td>
        <td style="border: 1px solid black;"></td>
        <td style="border: 1px solid black;"></td>
        <td style="border: 1px solid black; padding: 6px; text-align: right; font-weight: bold;">₹${subtotalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    `;

    // Dynamic Breakdown Rows
    const breakdownRows: Array<{ label: string; amount: number; isTotal?: boolean }> = [
      { label: 'PARTS', amount: partsTotal },
      { label: 'LABOR', amount: laborTotal }
    ];
    if (discountValue > 0) {
      breakdownRows.push({ label: 'DISCOUNT', amount: -discountValue });
    }
    breakdownRows.push({ label: 'TAX', amount: taxTotalValue });
    if (Math.abs(roundingValue) > 0) {
      breakdownRows.push({ label: 'ROUNDING', amount: roundingValue });
    }
    breakdownRows.push({ label: 'TOTAL', amount: grandTotalValue, isTotal: true });

    // Merged Left block with the first breakdown row
    rowsHtml += `
      <tr style="vertical-align: top;">
        <td colspan="3" rowspan="${breakdownRows.length}" style="border: 1px solid black; padding: 8px; text-align: left; text-transform: uppercase;">
          <div>
            <span style="font-weight: bold; font-size: 8.5pt;">Amount In Words:-</span>
            <p style="font-weight: bold; font-size: 8.5pt; margin: 2px 0 0 0;">${invoice.amountInWords}</p>
          </div>
          <div style="height: 10px;"></div>
          <div style="font-size: 8.5pt; line-height: 1.3;">
            <span style="font-weight: bold; display: block; margin-bottom: 4px;">Bank Details:-</span>
            <div><span style="font-weight: bold;">AC Name:</span> ${business.bankDetails?.accountHolderName || '-'}</div>
            <div><span style="font-weight: bold;">AC NO:</span> ${business.bankDetails?.accountNumber || '-'}</div>
            <div><span style="font-weight: bold;">Branch:</span> ${business.bankDetails?.branch || '-'}</div>
            <div><span style="font-weight: bold;">IFSC Code:</span> ${business.bankDetails?.ifsc || '-'}</div>
            <div><span style="font-weight: bold;">PAN NO:</span> ${business.taxProfile?.pan || '-'}</div>
          </div>
        </td>
        <td style="border: 1px solid black; padding: 6px; text-align: left; font-size: 8.5pt; font-weight: 600;">
          ${breakdownRows[0].label}
        </td>
        <td style="border: 1px solid black; padding: 6px; text-align: right; font-size: 8.5pt; font-weight: bold;">
          ₹${breakdownRows[0].amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </td>
      </tr>
    `;

    // Remaining breakdown rows
    breakdownRows.slice(1).forEach((row) => {
      rowsHtml += `
        <tr style="vertical-align: middle; ${row.isTotal ? 'background-color: #e7e6e6;' : ''}">
          <td style="border: 1px solid black; padding: 6px; text-align: left; font-size: 8.5pt; ${row.isTotal ? 'font-weight: bold;' : 'font-weight: 600;'}">
            ${row.label}
          </td>
          <td style="border: 1px solid black; padding: 6px; text-align: right; font-size: 8.5pt; font-weight: bold;">
            ₹${row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </td>
        </tr>
      `;
    });

    const isJayRamJi = business.name.toUpperCase().includes('JAY RAMJI') || 
                       (business.legalName && business.legalName.toUpperCase().includes('JAY RAMJI'));

    const sloganHtml = isJayRamJi ? `<p style="font-size: 10.5pt; font-weight: bold; margin: 0; margin-top: 2px;">YOUR SATISFACTION, OUR SUCCESS.</p>` : '';

    const logoHtml = assets.logo?.secureUrl
      ? `<img src="${assets.logo.secureUrl}" style="max-height: 20mm; max-width: 100%; object-fit: contain;" />`
      : `<div style="width: 24mm; height: 16mm; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999; font-weight: bold;">LOGO</div>`;

    const signatureHtml = assets.signature?.secureUrl
      ? `<img src="${assets.signature.secureUrl}" class="overlay-signature" />`
      : '';
    const stampHtml = assets.stamp?.secureUrl
      ? `<img src="${assets.stamp.secureUrl}" class="overlay-stamp" />`
      : '';

    const businessPhoneStr = business.contact?.phone ? `Contact No.: ${business.contact.phone}` : '';
    const businessEmailStr = business.contact?.email ? `Email: ${business.contact.email}` : '';
    const businessGstinStr = business.taxProfile?.gstin ? `GSTIN: ${business.taxProfile.gstin}` : '';

    // Render HTML template
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Tax Invoice</title>
        <style>
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 0;
            background-color: white;
            color: black;
            -webkit-print-color-adjust: exact;
          }
          .invoice-paper {
            width: 210mm;
            height: 297mm;
            padding: 10mm 17mm 15mm 17mm;
            box-sizing: border-box;
            background-color: white;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            border: 1.5px solid black;
          }
          .header-grid-table {
            width: 100%;
            border-collapse: collapse;
            border-bottom: 1px solid black;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .header-grid-table td {
            border: none;
            padding: 0;
            vertical-align: middle;
          }
          .business-title-centered {
            font-size: 26pt;
            font-weight: 900;
            text-transform: uppercase;
            margin: 0;
            letter-spacing: 1px;
            line-height: 1.1;
          }
          .business-branding-cell {
            text-align: center;
            width: 75%;
          }
          .logo-cell {
            width: 25%;
            text-align: left;
          }
          .tax-invoice-centered {
            font-size: 14pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            text-align: center;
            margin-bottom: 8px;
            line-height: 1.2;
          }
          .sold-to-block {
            text-align: left;
            margin-bottom: 8px;
          }
          .sold-to-title {
            font-size: 10pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 0 0 4px 0;
          }
          .customer-details-box {
            font-size: 10pt;
            font-weight: bold;
            text-transform: uppercase;
            padding-left: 4px;
            margin: 0;
            line-height: 1.3;
          }
          .customer-details-box p {
            font-weight: normal;
            font-size: 9pt;
            margin: 2px 0 0 0;
          }
          .metadata-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
            border: 1px solid black;
            font-size: 10pt;
            font-weight: bold;
          }
          .metadata-table th {
            border-right: 1px solid black;
            border-bottom: 1px solid black;
            padding: 4px 8px;
            text-align: left;
            font-weight: bold;
            background-color: #fce4d0;
            text-transform: uppercase;
          }
          .metadata-table td {
            border-right: 1px solid black;
            padding: 6px 8px;
            text-align: left;
            font-weight: bold;
            text-transform: uppercase;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5pt;
            border: 1px solid black;
            margin-bottom: 8px;
          }
          .items-table th {
            background-color: #f6e0d0;
            border-bottom: 1px solid black;
            border-right: 1px solid black;
            padding: 4px 8px;
            font-weight: bold;
            text-align: left;
            text-transform: uppercase;
          }
          .items-table td {
            padding: 4px 8px;
          }
          .footer-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
            margin-top: 15px;
          }
          .sign-box {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 85px;
            width: 50%;
          }
          .sign-box.right {
            align-items: flex-end;
            position: relative;
            text-align: right;
          }
          .sign-title {
            font-weight: bold;
            color: black;
            text-transform: uppercase;
            font-size: 8.5pt;
          }
          .line {
            border-bottom: 1px solid black;
            width: 180px;
            margin-top: auto;
          }
          .sign-subtitle {
            margin-top: 6px;
            font-size: 8pt;
            font-weight: bold;
            color: #666;
            text-transform: uppercase;
          }
          .overlay-container {
            display: flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            right: 24px;
            bottom: 12px;
            pointer-events: none;
          }
          .overlay-signature {
            max-height: 55px;
            max-width: 140px;
            width: auto;
            height: auto;
            object-fit: contain;
            opacity: 0.95;
            position: absolute;
            z-index: 2;
          }
          .overlay-stamp {
            max-height: 120px;
            max-width: 160px;
            width: auto;
            height: auto;
            object-fit: contain;
            opacity: 0.9;
            z-index: 1;
            transform: rotate(-3deg);
          }
        </style>
      </head>
      <body>
        <div class="invoice-paper">
          <div>
            <!-- Header Table -->
            <table class="header-grid-table">
              <tr>
                <td class="logo-cell">
                  ${logoHtml}
                </td>
                <td class="business-branding-cell">
                  <h1 class="business-title-centered">${business.name}</h1>
                  ${sloganHtml}
                  <p style="font-size: 9pt; font-weight: bold; margin: 4px 0 0 0; text-transform: uppercase;">Shop no. 4, Plot no. 45, Baroi Road, Rushab Nagar, Mundra-Kutch, 370421</p>
                  <p style="font-size: 9pt; font-weight: bold; margin: 2px 0 0 0;">${businessPhoneStr} ${businessEmailStr} ${businessGstinStr && `| ${businessGstinStr}`}</p>
                </td>
              </tr>
            </table>

            <!-- Title -->
            <div class="tax-invoice-centered">${business.invoiceTitle || 'TAX INVOICE'}</div>

            <!-- Sold To -->
            <div class="sold-to-block">
              <h4 class="sold-to-title">SOLD TO:</h4>
              <div class="customer-details-box">
                ${customer.name}
                ${customer.address?.line1 ? `<p>${customer.address.line1}</p>` : ''}
                ${customer.address?.line2 ? `<p>${customer.address.line2}</p>` : ''}
                ${(customer.address?.city || customer.address?.state) ? `<p>${[customer.address.city, customer.address.state].filter(Boolean).join(', ')}${customer.address?.postalCode ? ' - ' + customer.address.postalCode : ''}</p>` : ''}
                ${customer.contact?.phone ? `<p>Mo: ${customer.contact.phone}</p>` : ''}
                ${customer.taxProfile?.gstin ? `<p style="font-weight: bold; font-size: 9.5pt; margin-top: 4px;">GSTIN: ${customer.taxProfile.gstin}</p>` : ''}
              </div>
            </div>

            <!-- Metadata Table -->
            <table class="metadata-table">
              <thead>
                <tr>
                  <th style="width: 21.6%;">Invoice No.</th>
                  <th style="width: 25.5%;">Invoice Date</th>
                  <th style="width: 52.9%;">Terms of Payment*</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${invoice.invoiceNumber || 'DRAFT'}</td>
                  <td>${formattedDate}</td>
                  <td>${invoice.paymentTerms || 'IMMEDIATE BILLING'}</td>
                </tr>
              </tbody>
            </table>

            <!-- Items Table -->
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 7.3%; text-align: center;">SR NO.</th>
                  <th style="width: 43.8%;">DESCRIPTION OF GOODS</th>
                  <th style="width: 8.9%; text-align: center;">QTY</th>
                  <th style="width: 20.0%; text-align: right;">PRICE</th>
                  <th style="width: 20.0%; text-align: right; border-right: none;">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Footer Signatures -->
          <div class="footer-container" style="align-items: flex-end;">
            <div class="sign-box" style="justify-content: flex-end;">
              <div class="line"></div>
              <span class="sign-subtitle">Supervisor Name / Designation</span>
            </div>

            <div class="sign-box right" style="justify-content: flex-end;">
              <div class="overlay-container" style="bottom: 12px;">
                ${signatureHtml}
                ${stampHtml}
              </div>
              <div class="line"></div>
              <span class="sign-subtitle">Authorized Signatory</span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
