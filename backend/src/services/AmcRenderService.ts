export interface AmcQuotationRenderData {
  quotation: {
    id: string;
    quotationNumber: string;
    quotationDate: Date | string;
    validUntil?: Date | string;
    paymentTerms: string;
    quotationType?: string;
    title?: string;
    termsAndConditions?: string[];
  };
  business: {
    name: string;
    displayName?: string | null;
    legalName: string | null;
    address: {
      line1: string;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string;
      displayAddress?: string | null;
    };
    contact: {
      phone?: string | null;
      email?: string | null;
    };
    taxProfile?: {
      gstin?: string | null;
      pan?: string | null;
    } | null;
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
    period?: string | null;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  totals: {
    subtotal: number;
    discount?: number;
    taxTotal?: number;
    grandTotal: number;
    currency?: string;
  };
  assets: {
    logo?: { secureUrl: string } | null;
    stamp?: { secureUrl: string } | null;
    signature?: { secureUrl: string } | null;
  };
}

export class AmcRenderService {
  public static render(data: AmcQuotationRenderData): string {
    const { quotation, business, customer, items, totals, assets } = data;

    const formattedDate = new Date(quotation.quotationDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const isJayRamJi = (business.name && business.name.toUpperCase().includes('JAY RAMJI')) ||
                       (business.displayName && business.displayName.toUpperCase().includes('JAY RAMJI')) ||
                       (business.legalName && business.legalName.toUpperCase().includes('JAY RAMJI'));

    const sloganHtml = isJayRamJi ? `<p style="font-size: 10.5pt; font-weight: bold; margin: 0; margin-top: 2px;">YOUR SATISFACTION, OUR SUCCESS.</p>` : '';

    const logoHtml = assets.logo?.secureUrl
      ? `<img src="${assets.logo.secureUrl}" style="max-height: 32mm; max-width: 100%; object-fit: contain;" />`
      : `<div style="width: 32mm; height: 20mm; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #999; font-weight: bold;">LOGO</div>`;

    const signatureHtml = assets.signature?.secureUrl
      ? `<img src="${assets.signature.secureUrl}" class="overlay-signature" />`
      : '';
    const stampHtml = assets.stamp?.secureUrl
      ? `<img src="${assets.stamp.secureUrl}" class="overlay-stamp" />`
      : '';

    const businessPhoneStr = business.contact?.phone ? `Mo:- ${business.contact.phone}` : '';
    const businessEmailStr = business.contact?.email ? `Email: ${business.contact.email}` : '';
    const businessGstinStr = business.taxProfile?.gstin ? `GSTIN: ${business.taxProfile.gstin}` : '';

    const rawBusinessAddress = (business.address as any)?.displayAddress || (
      business.address?.line1
        ? [
            business.address.line1,
            business.address.line2,
            [business.address.city, business.address.state].filter(Boolean).join('-'),
            business.address.postalCode,
          ]
            .filter(Boolean)
            .join(', ')
        : 'AT- Maruti Chhaya Complex, Nr. Satkar Shopping.St. Xevier School Road, Baroi Road, Mundra-370421'
    );

    const addressLen = rawBusinessAddress.length;
    const addressFontSize = addressLen > 115 ? '6.0pt' : addressLen > 95 ? '6.6pt' : addressLen > 75 ? '7.5pt' : '8.5pt';
    const addressLetterSpacing = addressLen > 90 ? '-0.25px' : 'normal';

    // Determine if table should show PERIOD column or QTY column
    const hasPeriod = items.some(it => it.period && it.period.trim().length > 0);

    const formatCurrency = (val: number) => {
      return val.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    // Build rows
    const rowsHtml = items.map((it, idx) => {
      const isAlt = idx % 2 === 1;
      const bgStyle = isAlt ? 'background-color: #fafbfc;' : 'background-color: #ffffff;';
      return `
        <tr style="${bgStyle}">
          <td style="text-align: center; border-right: 1px solid black; border-bottom: 1px solid black;">${it.serialNumber || (idx + 1)}</td>
          <td style="border-right: 1px solid black; border-bottom: 1px solid black; font-weight: 500;">${it.description}</td>
          ${hasPeriod
            ? `<td style="text-align: center; border-right: 1px solid black; border-bottom: 1px solid black;">${it.period || 'Annual'}</td>`
            : `<td style="text-align: right; border-right: 1px solid black; border-bottom: 1px solid black;">${it.quantity.toFixed(2)}</td>`
          }
          <td style="text-align: right; border-right: 1px solid black; border-bottom: 1px solid black;">${formatCurrency(it.unitPrice)}</td>
          <td style="text-align: right; border-bottom: 1px solid black; font-weight: 600;">${formatCurrency(it.amount)}</td>
        </tr>
      `;
    }).join('');

    // Determine AMC Type Label
    const amcTypeLabel = quotation.quotationType === 'COMPREHENSIVE'
      ? 'Comprehensive AMC'
      : quotation.quotationType === 'NON_COMPREHENSIVE'
        ? 'Non-Comprehensive AMC'
        : (quotation.quotationType || 'AMC');

    // Default 10 rows (empty or filled)
    const DEFAULT_ROWS = 10;
    const emptyRowsCount = Math.max(0, DEFAULT_ROWS - items.length);
    let emptyRowsHtml = '';
    for (let i = 0; i < emptyRowsCount; i++) {
      const rowIdx = items.length + i;
      const isAlt = rowIdx % 2 === 1;
      const bgStyle = isAlt ? 'background-color: #fafbfc;' : 'background-color: #ffffff;';
      emptyRowsHtml += `
        <tr style="${bgStyle}; height: 23px;">
          <td style="text-align: center; border-right: 1px solid black; border-bottom: 1px solid black;">&nbsp;</td>
          <td style="border-right: 1px solid black; border-bottom: 1px solid black;">&nbsp;</td>
          <td style="border-right: 1px solid black; border-bottom: 1px solid black;">&nbsp;</td>
          <td style="border-right: 1px solid black; border-bottom: 1px solid black;">&nbsp;</td>
          <td style="border-bottom: 1px solid black;">&nbsp;</td>
        </tr>
      `;
    }

    const defaultTerms = [
      'This AMC is valid for 1 year from the date of agreement or approval.',
      'Only refrigerant gas is included in the above rates if explicitly configured.',
      'Spare parts are not included. The above rates are for labour charges only.',
      'AC installation charges include up to 10 feet of standard installation.',
      'Additional copper piping beyond 10 feet will be charged on a per-foot basis.',
    ];

    const termsList = (quotation.termsAndConditions && quotation.termsAndConditions.length > 0)
      ? quotation.termsAndConditions
      : defaultTerms;

    const termsHtml = termsList.map(t => `<li>${t}</li>`).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${quotation.title || 'QUOTATION INQUIRY'}</title>
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
            min-height: 297mm;
            padding: 10mm 15mm 12mm 15mm;
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
            border-bottom: 1.5px solid black;
            padding-bottom: 6px;
            margin-bottom: 6px;
          }
          .header-grid-table td {
            border: none;
            padding: 0;
            vertical-align: middle;
          }
          .business-title-centered {
            font-size: 24pt;
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
          .quotation-heading-section {
            text-align: center;
            margin-top: 14px;
            margin-bottom: 16px;
          }
          .quotation-title-centered {
            font-size: 15pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            text-align: center;
            margin: 0;
            line-height: 1.2;
          }
          .amc-type-subtitle {
            font-size: 10pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #222222;
            margin-top: 4px;
            line-height: 1.2;
          }
          .sold-to-block {
            text-align: left;
            margin-bottom: 12px;
            padding: 0;
          }
          .sold-to-title {
            font-size: 9.5pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 0 0 3px 0;
          }
          .customer-details-box {
            font-size: 9.5pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 0;
            line-height: 1.25;
          }
          .customer-details-box p {
            font-weight: normal;
            font-size: 9pt;
            margin: 2px 0 0 0;
          }
          .metadata-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6px;
            border: 1px solid black;
            font-size: 9pt;
            font-weight: bold;
          }
          .metadata-table th {
            border-right: 1px solid black;
            border-bottom: 1px solid black;
            padding: 4px 6px;
            text-align: left;
            font-weight: bold;
            background-color: #fce4d0;
            text-transform: uppercase;
          }
          .metadata-table td {
            border-right: 1px solid black;
            padding: 5px 6px;
            text-align: left;
            font-weight: bold;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5pt;
            border: 1px solid black;
            margin-bottom: 6px;
          }
          .items-table th {
            background-color: #f6e0d0;
            border-bottom: 1px solid black;
            border-right: 1px solid black;
            padding: 5px 6px;
            font-weight: bold;
            text-align: left;
            text-transform: uppercase;
          }
          .items-table td {
            padding: 4px 6px;
          }
          .terms-total-grid {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid black;
            margin-top: 4px;
            font-size: 8pt;
          }
          .terms-total-grid td {
            vertical-align: top;
            padding: 6px;
          }
          .terms-col {
            width: 65%;
            border-right: 1px solid black;
          }
          .totals-col {
            width: 35%;
            text-align: right;
            padding: 0 !important;
          }
          .totals-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5pt;
            font-weight: bold;
          }
          .totals-table td {
            padding: 8px 10px;
          }
          .footer-container {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 15px;
            padding-bottom: 8px;
          }
          .sign-box {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            width: 45%;
          }
          .sign-box.right {
            align-items: flex-end;
            text-align: right;
          }
          .line {
            border-bottom: 1px solid black;
            width: 180px;
            margin-top: 0;
          }
          .sign-subtitle {
            margin-top: 5px;
            font-size: 8pt;
            font-weight: bold;
            text-transform: uppercase;
            width: 180px;
            text-align: center;
          }
          .overlay-container {
            width: 180px;
            height: 90px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            position: relative;
            margin-bottom: 4px;
            pointer-events: none;
          }
          .overlay-signature {
            max-height: 45px;
            max-width: 170px;
            object-fit: contain;
            opacity: 0.95;
            position: absolute;
            bottom: 2px;
            z-index: 2;
          }
          .overlay-stamp {
            max-width: 260px;
            max-height: 95px;
            object-fit: contain;
            opacity: 0.92;
            z-index: 1;
            transform: rotate(-2deg);
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
                  <h1 class="business-title-centered">${business.displayName || business.name}</h1>
                  ${sloganHtml}
                  <p style="font-size: ${addressFontSize}; letter-spacing: ${addressLetterSpacing}; font-weight: bold; margin: 3px 0 0 0; text-transform: uppercase; white-space: nowrap;">
                    ${rawBusinessAddress}
                  </p>
                  <p style="font-size: 8.5pt; font-weight: bold; margin: 2px 0 0 0;">
                    ${businessPhoneStr} ${businessEmailStr ? `| ${businessEmailStr}` : ''} ${businessGstinStr ? `| ${businessGstinStr}` : ''}
                  </p>
                </td>
              </tr>
            </table>

            <!-- Title & AMC Type -->
            <div class="quotation-heading-section">
              <div class="quotation-title-centered">${quotation.title || 'QUOTATION INQUIRY'}</div>
              <div class="amc-type-subtitle">${amcTypeLabel}</div>
            </div>

            <!-- Sold To -->
            <div class="sold-to-block">
              <h4 class="sold-to-title">SOLD TO:</h4>
              <div class="customer-details-box">
                ${customer.name}
                ${customer.address?.line1 ? `<p>${customer.address.line1}</p>` : ''}
                ${customer.address?.line2 ? `<p>${customer.address.line2}</p>` : ''}
                ${(customer.address?.city || customer.address?.state) ? `<p>${[customer.address.city, customer.address.state].filter(Boolean).join(' - ')}${customer.address?.postalCode ? ', ' + customer.address.postalCode : ''}</p>` : ''}
                ${customer.contact?.phone ? `<p>Mo: ${customer.contact.phone}</p>` : ''}
                ${customer.taxProfile?.gstin ? `<p style="font-weight: bold; font-size: 9pt; margin-top: 3px;">GSTIN: ${customer.taxProfile.gstin}</p>` : ''}
              </div>
            </div>

            <!-- Metadata Table -->
            <table class="metadata-table">
              <thead>
                <tr>
                  <th style="width: 22%;">QUTATION NO.</th>
                  <th style="width: 26%;">Date</th>
                  <th style="width: 52%;">Payment Terms*</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${quotation.quotationNumber}</td>
                  <td>${formattedDate}</td>
                  <td>${quotation.paymentTerms || '10 Days from the Invoice date'}</td>
                </tr>
              </tbody>
            </table>

            <!-- Items Table -->
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 8%; text-align: center;">SR. NO.</th>
                  <th style="width: 54%;">DESCRIPTION OF GOODS</th>
                  ${hasPeriod
                    ? `<th style="width: 14%; text-align: center;">PERIOD</th>`
                    : `<th style="width: 10%; text-align: right;">QTY</th>`
                  }
                  <th style="width: 12%; text-align: right;">PRICE</th>
                  <th style="width: 16%; text-align: right;">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
                ${emptyRowsHtml}
                <!-- Subtotal Row -->
                <tr style="background-color: #fafbfc; font-weight: bold; border-top: 1.5px solid black;">
                  <td colspan="2" style="text-align: center; border-right: 1px solid black; font-size: 9pt;">Total</td>
                  ${hasPeriod
                    ? `<td style="border-right: 1px solid black;"></td>`
                    : `<td style="text-align: right; border-right: 1px solid black;">${items.reduce((s, it) => s + it.quantity, 0).toFixed(2)}</td>`
                  }
                  <td style="border-right: 1px solid black;"></td>
                  <td style="text-align: right; font-size: 9.5pt;">₹ ${formatCurrency(totals.subtotal || totals.grandTotal)}</td>
                </tr>
              </tbody>
            </table>

            <!-- Terms and Grand Total Block -->
            <table class="terms-total-grid">
              <tr>
                <td class="terms-col">
                  <div style="font-weight: bold; text-decoration: underline; margin-bottom: 4px;">Terms & Conditions*:-</div>
                  <ul style="margin: 0; padding-left: 18px; line-height: 1.45; font-size: 8pt;">
                    ${termsHtml}
                  </ul>
                </td>
                <td class="totals-col">
                  <table class="totals-table">
                    ${totals.discount ? `
                      <tr style="border-bottom: 1px solid black; font-size: 8.5pt;">
                        <td style="text-align: left;">Discount</td>
                        <td style="text-align: right;">- ₹ ${formatCurrency(totals.discount)}</td>
                      </tr>
                    ` : ''}
                    ${totals.taxTotal ? `
                      <tr style="border-bottom: 1px solid black; font-size: 8.5pt;">
                        <td style="text-align: left;">GST</td>
                        <td style="text-align: right;">₹ ${formatCurrency(totals.taxTotal)}</td>
                      </tr>
                    ` : ''}
                    <tr style="background-color: #fce4d0;">
                      <td style="text-align: left; font-size: 10.5pt; text-transform: uppercase;">TOTAL</td>
                      <td style="text-align: right; font-size: 11pt; font-weight: 900;">₹ ${formatCurrency(totals.grandTotal)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </div>

          <!-- Footer Signatures -->
          <div class="footer-container">
            <div class="sign-box">
              <div style="height: 70px;"></div>
              <div class="line"></div>
              <span class="sign-subtitle">SERVICE SUPERVISED BY</span>
            </div>

            <div class="sign-box right">
              <div class="overlay-container">
                ${stampHtml}
                ${signatureHtml}
              </div>
              <div class="line"></div>
              <span class="sign-subtitle">SIGNED</span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export default AmcRenderService;
