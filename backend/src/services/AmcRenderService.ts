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

export interface AmcContractRenderData {
  contract: {
    id: string;
    contractNumber: string;
    contractType: string;
    startDate: Date | string;
    endDate: Date | string;
    status: string;
    paymentStatus: string;
    financials: {
      contractAmount: number;
      discount: number;
      taxAmount: number;
      finalAmount: number;
      paidAmount: number;
    };
    planSnapshot?: {
      planName?: string;
      planType?: string;
      durationMonths?: number;
      entitlements?: Array<{
        serviceType: string;
        scheduling: string;
        quantity: number;
        entitlementScope: string;
      }>;
      gasCoverage?: {
        included: boolean;
        refrigerantTypes?: string[];
        quantityLimitKg?: number | null;
      };
      termsAndConditions?: string[];
    };
    coveredUnits: Array<{
      serialNumber?: number;
      brand?: string | null;
      model?: string | null;
      tonnage?: string | null;
      serial?: string | null;
      location?: string | null;
    }>;
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
    bankDetails?: {
      bankName?: string | null;
      accountHolderName?: string | null;
      accountNumber?: string | null;
      ifsc?: string | null;
      branch?: string | null;
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
  assets?: {
    logo?: { secureUrl?: string | null } | null;
    signature?: { secureUrl?: string | null } | null;
    stamp?: { secureUrl?: string | null } | null;
  } | null;
}

export class AmcRenderService {
  public static renderContract(data: AmcContractRenderData): string {
    const { contract, business, customer, assets } = data;

    const formatDate = (val: any) => {
      if (!val) return 'N/A';
      try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      } catch {
        return String(val);
      }
    };

    const formatCurrency = (val: number) => {
      return (val || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const businessName =
      business.legalName || business.displayName || business.name || 'JAY RAMJI ENTERPRISE';

    const rawBusinessAddress =
      business.address.displayAddress ||
      [
        business.address.line1,
        business.address.line2,
        business.address.city,
        business.address.state,
        business.address.postalCode,
      ]
        .filter(Boolean)
        .join(', ') ||
      'Shop No 4, Radhe Arcade, Kudasan, Gandhinagar, Gujarat - 382421';

    const businessPhoneStr = business.contact?.phone ? `Mo: ${business.contact.phone}` : 'Mo: +91 98250 99887';
    const businessEmailStr = business.contact?.email || 'jayramjienterprise@gmail.com';
    const businessGstinStr = business.taxProfile?.gstin ? `GSTIN: ${business.taxProfile.gstin}` : 'GSTIN: 24AAHFJ8971B1Z3';

    const contractTypeLabel =
      contract.contractType === 'COMPREHENSIVE'
        ? 'COMPREHENSIVE ANNUAL MAINTENANCE CONTRACT'
        : 'NON-COMPREHENSIVE ANNUAL MAINTENANCE CONTRACT';

    const balanceAmount = Math.max(
      0,
      (contract.financials?.finalAmount || 0) - (contract.financials?.paidAmount || 0)
    );

    const defaultTerms = [
      'This Annual Maintenance Contract covers routine servicing and breakdown support as specified.',
      'Routine dry services and quarterly water jet cleanings will be scheduled with mutual convenience.',
      contract.contractType === 'COMPREHENSIVE'
        ? 'Comprehensive coverage includes routine electrical & mechanical spare parts and motor repairs. Physical damage, external piping damage, or coil mishandling are excluded.'
        : 'Non-comprehensive contract includes labor and routine servicing only. Any replacement spare parts or refrigerant gas refilling will be billed separately upon customer approval.',
      'Breakdown emergency response time will be within 24 to 48 working hours from registering the service request.',
      'Service visits will be carried out during standard working hours (9:00 AM - 7:00 PM), excluding national holidays.',
      'Payments must be cleared as per the agreed schedule. Failure to clear installments may lead to temporary suspension of breakdown services.',
      'All disputes are subject to local Gandhinagar / Ahmedabad jurisdiction only.',
    ];

    const termsList =
      contract.planSnapshot?.termsAndConditions && contract.planSnapshot.termsAndConditions.length > 0
        ? contract.planSnapshot.termsAndConditions
        : defaultTerms;

    const logoHtml = assets?.logo?.secureUrl
      ? `<img src="${assets.logo.secureUrl}" alt="Logo" style="max-height: 75px; max-width: 160px; object-fit: contain;" />`
      : `<div style="display: inline-block; border: 2px solid #1a365d; padding: 6px 12px; border-radius: 6px; text-align: center; background-color: #ebf8ff;">
           <span style="font-size: 14pt; font-weight: 900; color: #1a365d; letter-spacing: 1px;">JRE</span>
           <div style="font-size: 7pt; font-weight: 700; color: #2b6cb0; text-transform: uppercase;">Jay Ramji Enterprise</div>
         </div>`;

    const stampHtml = assets?.stamp?.secureUrl
      ? `<img src="${assets.stamp.secureUrl}" alt="Stamp" style="max-height: 75px; max-width: 130px; object-fit: contain; opacity: 0.9; transform: rotate(-2deg); position: absolute; z-index: 1;" />`
      : '';

    const signatureHtml = assets?.signature?.secureUrl
      ? `<img src="${assets.signature.secureUrl}" alt="Signature" style="max-height: 40px; max-width: 120px; object-fit: contain; position: absolute; bottom: 4px; z-index: 2;" />`
      : '';

    const coveredUnitsRows = contract.coveredUnits && contract.coveredUnits.length > 0
      ? contract.coveredUnits.map((u, idx) => `
          <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
            <td style="border: 1px solid #cbd5e0; padding: 5px 6px; text-align: center;">${idx + 1}</td>
            <td style="border: 1px solid #cbd5e0; padding: 5px 8px; font-weight: 600;">${u.brand || 'Air Conditioner'} ${u.model ? `(${u.model})` : ''}</td>
            <td style="border: 1px solid #cbd5e0; padding: 5px 8px; text-align: center;">${u.tonnage || '1.5 Ton'}</td>
            <td style="border: 1px solid #cbd5e0; padding: 5px 8px; font-family: monospace;">${u.serial || 'N/A'}</td>
            <td style="border: 1px solid #cbd5e0; padding: 5px 8px;">${u.location || 'Premises'}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="5" style="border: 1px solid #cbd5e0; padding: 8px; text-align: center; color: #718096;">General premises fleet contract</td></tr>`;

    const entitlementsRows = contract.planSnapshot?.entitlements && contract.planSnapshot.entitlements.length > 0
      ? contract.planSnapshot.entitlements.map((ent, idx) => {
          const serviceName =
            ent.serviceType === 'DRY_SERVICE'
              ? 'Routine Dry Filter & Coil Clean'
              : ent.serviceType === 'WATER_SERVICE'
              ? 'Deep Water Jet Cleaning Service'
              : ent.serviceType === 'BREAKDOWN_REPAIR'
              ? 'Emergency Breakdown Call-Outs'
              : ent.serviceType === 'GAS_CHARGING'
              ? 'Refrigerant Pressure Check / Top-Up'
              : ent.serviceType.replace('_', ' ');

          return `
            <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
              <td style="border: 1px solid #cbd5e0; padding: 5px 8px; font-weight: 600;">${serviceName}</td>
              <td style="border: 1px solid #cbd5e0; padding: 5px 8px; text-align: center;">${ent.scheduling || 'SCHEDULED'}</td>
              <td style="border: 1px solid #cbd5e0; padding: 5px 8px; text-align: center; font-weight: 700;">${ent.quantity} Visits / Year</td>
              <td style="border: 1px solid #cbd5e0; padding: 5px 8px;">${ent.entitlementScope === 'PER_EQUIPMENT' ? 'Per Registered AC Unit' : 'Total Across Agreement'}</td>
            </tr>
          `;
        }).join('')
      : `
        <tr>
          <td style="border: 1px solid #cbd5e0; padding: 5px 8px; font-weight: 600;">Routine Dry Cleaning</td>
          <td style="border: 1px solid #cbd5e0; padding: 5px 8px; text-align: center;">Monthly</td>
          <td style="border: 1px solid #cbd5e0; padding: 5px 8px; text-align: center; font-weight: 700;">8 Visits</td>
          <td style="border: 1px solid #cbd5e0; padding: 5px 8px;">Per Registered AC Unit</td>
        </tr>
        <tr style="background-color: #f9fafb;">
          <td style="border: 1px solid #cbd5e0; padding: 5px 8px; font-weight: 600;">Water Jet Deep Cleaning</td>
          <td style="border: 1px solid #cbd5e0; padding: 5px 8px; text-align: center;">Quarterly</td>
          <td style="border: 1px solid #cbd5e0; padding: 5px 8px; text-align: center; font-weight: 700;">4 Visits</td>
          <td style="border: 1px solid #cbd5e0; padding: 5px 8px;">Per Registered AC Unit</td>
        </tr>
        <tr>
          <td style="border: 1px solid #cbd5e0; padding: 5px 8px; font-weight: 600;">Breakdown / Emergency Repairs</td>
          <td style="border: 1px solid #cbd5e0; padding: 5px 8px; text-align: center;">On Demand</td>
          <td style="border: 1px solid #cbd5e0; padding: 5px 8px; text-align: center; font-weight: 700;">Included</td>
          <td style="border: 1px solid #cbd5e0; padding: 5px 8px;">Within 24-48 Hours Response</td>
        </tr>
      `;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>AMC Contract Agreement #${contract.contractNumber}</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #ffffff;
            color: #000000;
            -webkit-print-color-adjust: exact;
          }
          .contract-page {
            width: 210mm;
            min-height: 297mm;
            padding: 14mm 16mm;
            box-sizing: border-box;
            margin: 0 auto;
            background-color: #ffffff;
          }
        </style>
      </head>
      <body>
        <div class="contract-page">
          <!-- Header -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
            <tr>
              <td style="vertical-align: middle; text-align: left; width: 70%;">
                <h1 style="font-size: 17pt; font-weight: 900; margin: 0; text-transform: uppercase; color: #1a365d; letter-spacing: 0.5px; line-height: 1.15;">
                  ${businessName}
                </h1>
                <p style="font-size: 8.5pt; font-weight: 600; color: #4a5568; margin: 2px 0 0 0;">
                  HVAC Engineering • Sales, Installation & Comprehensive Maintenance Services
                </p>
                <p style="font-size: 8pt; color: #2d3748; margin: 3px 0 0 0; line-height: 1.3;">
                  ${rawBusinessAddress}
                </p>
                <p style="font-size: 8pt; font-weight: bold; margin: 2px 0 0 0; color: #1a202c;">
                  ${[businessPhoneStr, businessEmailStr, businessGstinStr].filter(Boolean).join(' | ')}
                </p>
              </td>
              <td style="vertical-align: middle; text-align: right; width: 30%;">
                ${logoHtml}
              </td>
            </tr>
          </table>

          <div style="height: 2.5px; background-color: #1a365d; margin-bottom: 12px;"></div>

          <!-- Title -->
          <div style="text-align: center; margin-bottom: 14px;">
            <div style="font-size: 14pt; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #1a202c; margin: 0; line-height: 1.2;">
              ANNUAL MAINTENANCE CONTRACT AGREEMENT
            </div>
            <div style="font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.8px; color: #2b6cb0; margin-top: 3px;">
              ${contractTypeLabel}
            </div>
          </div>

          <!-- Metadata & Client Info -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1px solid #cbd5e0; font-size: 8.5pt;">
            <tr>
              <td style="width: 55%; vertical-align: top; padding: 6px 8px; border-right: 1px solid #cbd5e0; background-color: #f7fafc;">
                <div style="font-size: 7.5pt; font-weight: 800; color: #718096; text-transform: uppercase;">
                  CLIENT DETAILS (CONTRACT ISSUED TO):
                </div>
                <div style="font-size: 9.5pt; font-weight: 900; color: #1a202c; margin-top: 2px;">
                  ${customer.name}
                </div>
                ${customer.address?.line1 ? `<div style="font-size: 8pt; color: #4a5568; margin-top: 2px;">${customer.address.line1}</div>` : ''}
                ${(customer.address?.city || customer.address?.state) ? `<div style="font-size: 8pt; color: #4a5568;">${[customer.address.city, customer.address.state].filter(Boolean).join(' - ')}</div>` : ''}
                ${customer.contact?.phone ? `<div style="font-size: 8pt; color: #2d3748; margin-top: 2px; font-weight: 600;">Contact: ${customer.contact.phone}</div>` : ''}
                ${customer.taxProfile?.gstin ? `<div style="font-size: 8pt; color: #1a202c; font-weight: 700; margin-top: 2px;">GSTIN: ${customer.taxProfile.gstin}</div>` : ''}
              </td>
              <td style="width: 45%; vertical-align: top; padding: 6px 8px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 8pt;">
                  <tr>
                    <td style="font-weight: 700; color: #718096; padding: 1px 0;">Contract Number:</td>
                    <td style="font-weight: 900; color: #1a365d; text-align: right; padding: 1px 0;">${contract.contractNumber}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 700; color: #718096; padding: 1px 0;">Agreement Date:</td>
                    <td style="font-weight: 700; color: #1a202c; text-align: right; padding: 1px 0;">${formatDate(contract.startDate)}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 700; color: #718096; padding: 1px 0;">Validity Period:</td>
                    <td style="font-weight: 700; color: #1a202c; text-align: right; padding: 1px 0;">${formatDate(contract.startDate)} to ${formatDate(contract.endDate)}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 700; color: #718096; padding: 1px 0;">Contract Term:</td>
                    <td style="font-weight: 700; color: #1a202c; text-align: right; padding: 1px 0;">${contract.planSnapshot?.durationMonths || 12} Months</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 700; color: #718096; padding: 1px 0;">Status:</td>
                    <td style="font-weight: 800; text-align: right; padding: 1px 0; text-transform: uppercase;">${contract.status.replace('_', ' ')}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- 1. Covered Equipment Fleet -->
          <div style="margin-bottom: 12px;">
            <div style="font-size: 8.5pt; font-weight: 800; text-transform: uppercase; color: #1a365d; margin-bottom: 3px; letter-spacing: 0.5px;">
              1. COVERED AC EQUIPMENT FLEET
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 8pt; border: 1px solid #cbd5e0;">
              <thead>
                <tr style="background-color: #edf2f7; color: #2d3748; text-transform: uppercase;">
                  <th style="border: 1px solid #cbd5e0; padding: 4px 6px; text-align: center; width: 6%;">#</th>
                  <th style="border: 1px solid #cbd5e0; padding: 4px 6px; text-align: left; width: 34%;">Brand & Model</th>
                  <th style="border: 1px solid #cbd5e0; padding: 4px 6px; text-align: center; width: 16%;">Capacity</th>
                  <th style="border: 1px solid #cbd5e0; padding: 4px 6px; text-align: left; width: 22%;">Serial Number</th>
                  <th style="border: 1px solid #cbd5e0; padding: 4px 6px; text-align: left; width: 22%;">Premises Location</th>
                </tr>
              </thead>
              <tbody>
                ${coveredUnitsRows}
              </tbody>
            </table>
          </div>

          <!-- 2. Scope & Entitlements -->
          <div style="margin-bottom: 12px;">
            <div style="font-size: 8.5pt; font-weight: 800; text-transform: uppercase; color: #1a365d; margin-bottom: 3px; letter-spacing: 0.5px;">
              2. SCOPE OF SERVICES & ANNUAL ENTITLEMENTS
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 8pt; border: 1px solid #cbd5e0;">
              <thead>
                <tr style="background-color: #edf2f7; color: #2d3748; text-transform: uppercase;">
                  <th style="border: 1px solid #cbd5e0; padding: 4px 6px; text-align: left; width: 35%;">Service Type</th>
                  <th style="border: 1px solid #cbd5e0; padding: 4px 6px; text-align: center; width: 20%;">Frequency</th>
                  <th style="border: 1px solid #cbd5e0; padding: 4px 6px; text-align: center; width: 15%;">Included Qty</th>
                  <th style="border: 1px solid #cbd5e0; padding: 4px 6px; text-align: left; width: 30%;">Coverage Scope</th>
                </tr>
              </thead>
              <tbody>
                ${entitlementsRows}
              </tbody>
            </table>
          </div>

          <!-- 3. Financials & Bank Details -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
            <tr>
              <td style="width: 52%; vertical-align: top; padding-right: 10px;">
                <div style="border: 1px solid #cbd5e0; border-radius: 4px; padding: 6px 8px; background-color: #f7fafc; font-size: 7.5pt;">
                  <div style="font-weight: 800; color: #1a365d; text-transform: uppercase; margin-bottom: 3px;">
                    Bank Details For Remittance:
                  </div>
                  <div>Account Name: <strong>${business.bankDetails?.accountHolderName || businessName}</strong></div>
                  <div>Bank: <strong>${business.bankDetails?.bankName || 'HDFC Bank Ltd'}</strong></div>
                  <div>A/C No: <strong>${business.bankDetails?.accountNumber || '50200049823104'}</strong></div>
                  <div>IFSC Code: <strong>${business.bankDetails?.ifsc || 'HDFC0000287'}</strong></div>
                  ${business.bankDetails?.branch ? `<div>Branch: ${business.bankDetails.branch}</div>` : ''}
                </div>
              </td>
              <td style="width: 48%; vertical-align: top;">
                <table style="width: 100%; border-collapse: collapse; font-size: 8pt; border: 1px solid #cbd5e0;">
                  <tr>
                    <td style="padding: 3px 6px; border-bottom: 1px solid #edf2f7; color: #4a5568;">Contract Base Value:</td>
                    <td style="padding: 3px 6px; border-bottom: 1px solid #edf2f7; text-align: right; font-weight: 600;">₹ ${formatCurrency(contract.financials?.contractAmount || 0)}</td>
                  </tr>
                  ${contract.financials?.discount > 0 ? `
                    <tr>
                      <td style="padding: 3px 6px; border-bottom: 1px solid #edf2f7; color: #e53e3e;">Discount:</td>
                      <td style="padding: 3px 6px; border-bottom: 1px solid #edf2f7; text-align: right; font-weight: 600; color: #e53e3e;">- ₹ ${formatCurrency(contract.financials.discount)}</td>
                    </tr>
                  ` : ''}
                  ${contract.financials?.taxAmount > 0 ? `
                    <tr>
                      <td style="padding: 3px 6px; border-bottom: 1px solid #edf2f7; color: #4a5568;">GST:</td>
                      <td style="padding: 3px 6px; border-bottom: 1px solid #edf2f7; text-align: right; font-weight: 600;">₹ ${formatCurrency(contract.financials.taxAmount)}</td>
                    </tr>
                  ` : ''}
                  <tr style="background-color: #ebf8ff;">
                    <td style="padding: 4px 6px; font-weight: 900; color: #1a365d;">Total Contract Payable:</td>
                    <td style="padding: 4px 6px; text-align: right; font-weight: 900; color: #1a365d;">₹ ${formatCurrency(contract.financials?.finalAmount || 0)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 6px; border-top: 1px solid #cbd5e0; color: #2b6cb0;">Amount Received:</td>
                    <td style="padding: 3px 6px; border-top: 1px solid #cbd5e0; text-align: right; font-weight: 700; color: #2b6cb0;">₹ ${formatCurrency(contract.financials?.paidAmount || 0)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 6px; font-weight: 800; color: ${balanceAmount > 0 ? '#c53030' : '#276749'};">Outstanding Balance:</td>
                    <td style="padding: 3px 6px; text-align: right; font-weight: 800; color: ${balanceAmount > 0 ? '#c53030' : '#276749'};">₹ ${formatCurrency(balanceAmount)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- 4. Terms & Conditions -->
          <div style="margin-bottom: 14px;">
            <div style="font-size: 8pt; font-weight: 800; text-transform: uppercase; color: #1a365d; margin-bottom: 3px;">
              3. TERMS & CONDITIONS
            </div>
            <ol style="margin: 0; padding-left: 16px; font-size: 7pt; line-height: 1.4; color: #2d3748;">
              ${termsList.map(t => `<li style="margin-bottom: 1px;">${t}</li>`).join('')}
            </ol>
          </div>

          <!-- Dual Signatures -->
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 16px;">
            <div style="width: 42%; text-align: center;">
              <div style="height: 50px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 7pt; color: #a0aec0; font-style: italic;">[ Customer Seal & Signature ]</span>
              </div>
              <div style="border-bottom: 1px solid #000000; width: 100%; margin-bottom: 3px;"></div>
              <div style="font-size: 7.5pt; font-weight: 800; text-transform: uppercase;">AUTHORIZED CLIENT SIGNATORY</div>
              <div style="font-size: 6.5pt; color: #718096;">For: ${customer.name}</div>
            </div>

            <div style="width: 45%; text-align: center;">
              <div style="height: 65px; position: relative; display: flex; align-items: center; justify-content: center;">
                ${stampHtml}
                ${signatureHtml}
              </div>
              <div style="border-bottom: 1px solid #000000; width: 100%; margin-bottom: 3px;"></div>
              <div style="font-size: 7.5pt; font-weight: 800; text-transform: uppercase;">FOR ${businessName}</div>
              <div style="font-size: 6.5pt; color: #718096;">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

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
          <td style="text-align: center; border-right: 1px solid black; border-bottom: 1px solid black; padding: 4px 6px;">${it.serialNumber || (idx + 1)}</td>
          <td style="border-right: 1px solid black; border-bottom: 1px solid black; font-weight: 500; padding: 4px 6px;">${it.description}</td>
          ${hasPeriod
            ? `<td style="text-align: center; border-right: 1px solid black; border-bottom: 1px solid black; padding: 4px 6px;">${it.period || 'Annual'}</td>`
            : ''
          }
          <td style="text-align: right; border-right: 1px solid black; border-bottom: 1px solid black; font-weight: 600; padding: 4px 6px;">${Number(it.quantity || 0)}</td>
          <td style="text-align: right; border-right: 1px solid black; border-bottom: 1px solid black; padding: 4px 6px;">${formatCurrency(it.unitPrice)}</td>
          <td style="text-align: right; border-bottom: 1px solid black; font-weight: 600; padding: 4px 6px;">${formatCurrency(it.amount)}</td>
        </tr>
      `;
    }).join('');

    // Determine AMC Type Label
    const amcTypeLabel = quotation.quotationType === 'COMPREHENSIVE'
      ? 'Comprehensive AMC'
      : quotation.quotationType === 'NON_COMPREHENSIVE'
        ? 'Non-Comprehensive AMC'
        : quotation.quotationType === 'STANDARD' || quotation.quotationType === 'GENERAL'
          ? ''
          : (quotation.quotationType || '');

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
          ${hasPeriod ? `<td style="border-right: 1px solid black; border-bottom: 1px solid black;">&nbsp;</td>` : ''}
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
                  <th style="width: ${hasPeriod ? '6%' : '7%'}; text-align: center;">SR. NO.</th>
                  <th style="width: ${hasPeriod ? '44%' : '55%'};">DESCRIPTION OF GOODS</th>
                  ${hasPeriod
                    ? `<th style="width: 14%; text-align: center;">PERIOD</th>`
                    : ''
                  }
                  <th style="width: 10%; text-align: right;">QTY</th>
                  <th style="width: 12%; text-align: right;">PRICE</th>
                  <th style="width: ${hasPeriod ? '14%' : '16%'}; text-align: right;">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
                ${emptyRowsHtml}
                <!-- Subtotal Row -->
                <tr style="background-color: #fafbfc; font-weight: bold; border-top: 1.5px solid black;">
                  <td colspan="${hasPeriod ? 3 : 2}" style="text-align: center; border-right: 1px solid black; font-size: 9pt;">Total</td>
                  <td style="text-align: right; border-right: 1px solid black; padding: 4px 6px;">${items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)}</td>
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
