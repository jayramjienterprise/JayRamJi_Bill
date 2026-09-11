import React from 'react';

export interface AmcContractPaperUnit {
  serialNumber?: number;
  unitBrand?: string | null;
  unitModel?: string | null;
  unitTonnage?: string | null;
  unitSerial?: string | null;
  unitLocation?: string | null;
  acEquipmentId?: any;
}

export interface AmcContractPaperProps {
  contract: {
    contractNumber: string;
    contractType: 'COMPREHENSIVE' | 'NON_COMPREHENSIVE' | string;
    startDate: string | Date;
    endDate: string | Date;
    status: string;
    paymentStatus?: string;
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
    coveredUnits: AmcContractPaperUnit[];
    notes?: string | null;
    createdAt?: string | Date;
  };
  business: {
    name: string;
    displayName?: string | null;
    legalName?: string | null;
    address: {
      line1: string;
      line2?: string | null;
      displayAddress?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string;
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
      email?: string | null;
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

export default function AmcContractPaper({
  contract,
  business,
  customer,
  assets,
}: AmcContractPaperProps) {
  const businessName =
    business?.legalName || business?.displayName || business?.name || 'JAY RAMJI ENTERPRISE';

  const rawBusinessAddress =
    business?.address?.displayAddress ||
    [
      business?.address?.line1,
      business?.address?.line2,
      business?.address?.city,
      business?.address?.state,
      business?.address?.postalCode,
    ]
      .filter(Boolean)
      .join(', ') ||
    'Shop No 4, Radhe Arcade, Kudasan, Gandhinagar, Gujarat - 382421';

  const businessPhoneStr = business?.contact?.phone ? `Mo: ${business.contact.phone}` : 'Mo: +91 98250 99887';
  const businessEmailStr = business?.contact?.email || 'jayramjienterprise@gmail.com';
  const businessGstinStr = business?.taxProfile?.gstin ? `GSTIN: ${business.taxProfile.gstin}` : 'GSTIN: 24AAHFJ8971B1Z3';

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
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const contractTypeLabel =
    contract.contractType === 'COMPREHENSIVE'
      ? 'COMPREHENSIVE ANNUAL MAINTENANCE CONTRACT'
      : 'NON-COMPREHENSIVE ANNUAL MAINTENANCE CONTRACT';

  const balanceAmount = Math.max(
    0,
    (contract.financials?.finalAmount || 0) - (contract.financials?.paidAmount || 0)
  );

  const defaultTerms = [
    'This Annual Maintenance Contract covers routine servicing and breakdown support as specified above.',
    'Routine dry services and quarterly water jet cleanings will be scheduled with mutual convenience.',
    contract.contractType === 'COMPREHENSIVE'
      ? 'Comprehensive coverage includes routine spare parts and motor repairs. Physical damage, external piping damage, or coil mishandling are excluded.'
      : 'Non-comprehensive contract includes labor and routine servicing only. Any replacement spare parts or refrigerant gas refilling will be billed separately upon approval.',
    'Breakdown emergency response time will be within 24 to 48 working hours from registering the service request.',
    'Service visits will be carried out during standard working hours (9:00 AM - 7:00 PM), excluding national holidays.',
    'Payments must be cleared as per the agreed schedule. Failure to clear installments may lead to temporary suspension of breakdown services.',
    'All disputes are subject to local Gandhinagar / Ahmedabad jurisdiction only.',
  ];

  const termsList =
    contract.planSnapshot?.termsAndConditions && contract.planSnapshot.termsAndConditions.length > 0
      ? contract.planSnapshot.termsAndConditions
      : defaultTerms;

  return (
    <div
      id="amc-contract-document"
      style={{
        width: '210mm',
        minHeight: '297mm',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: 'Arial, Helvetica, sans-serif',
        padding: '16mm 18mm',
        boxSizing: 'border-box',
        margin: '0 auto',
        position: 'relative',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      }}
    >
      {/* ---------------------------------------------------- */}
      {/* 1. OFFICIAL BUSINESS HEADER */}
      {/* ---------------------------------------------------- */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'middle', textAlign: 'left', width: '70%' }}>
              <h1
                style={{
                  fontSize: '18pt',
                  fontWeight: 900,
                  margin: 0,
                  textTransform: 'uppercase',
                  color: '#1a365d',
                  letterSpacing: '0.5px',
                  lineHeight: 1.15,
                }}
              >
                {businessName}
              </h1>
              <p style={{ fontSize: '9pt', fontWeight: 600, color: '#4a5568', margin: '3px 0 0 0' }}>
                HVAC Engineering • Sales, Installation & Comprehensive Maintenance Services
              </p>
              <p style={{ fontSize: '8.5pt', color: '#2d3748', margin: '4px 0 0 0', lineHeight: 1.3 }}>
                {rawBusinessAddress}
              </p>
              <p style={{ fontSize: '8.5pt', fontWeight: 'bold', margin: '3px 0 0 0', color: '#1a202c' }}>
                {[businessPhoneStr, businessEmailStr, businessGstinStr].filter(Boolean).join(' | ')}
              </p>
            </td>

            <td style={{ verticalAlign: 'middle', textAlign: 'right', width: '30%' }}>
              {assets?.logo?.secureUrl ? (
                <img
                  src={assets.logo.secureUrl}
                  alt="Company Logo"
                  style={{
                    maxHeight: '75px',
                    maxWidth: '160px',
                    objectFit: 'contain',
                    display: 'inline-block',
                  }}
                />
              ) : (
                <div
                  style={{
                    display: 'inline-block',
                    border: '2px solid #1a365d',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    backgroundColor: '#ebf8ff',
                  }}
                >
                  <span style={{ fontSize: '13pt', fontWeight: 900, color: '#1a365d', letterSpacing: '1px' }}>
                    JRE
                  </span>
                  <div style={{ fontSize: '7pt', fontWeight: 700, color: '#2b6cb0', textTransform: 'uppercase' }}>
                    Jay Ramji Enterprise
                  </div>
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Decorative Divider */}
      <div style={{ height: '2.5px', backgroundColor: '#1a365d', marginBottom: '14px' }} />

      {/* ---------------------------------------------------- */}
      {/* 2. DOCUMENT TITLE & AMC TYPE */}
      {/* ---------------------------------------------------- */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div
          style={{
            fontSize: '15pt',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            color: '#1a202c',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          ANNUAL MAINTENANCE CONTRACT AGREEMENT
        </div>
        <div
          style={{
            fontSize: '9.5pt',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: '#2b6cb0',
            marginTop: '4px',
          }}
        >
          {contractTypeLabel}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. CONTRACT METADATA & CLIENT INFO TABLE */}
      {/* ---------------------------------------------------- */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '14px',
          border: '1px solid #cbd5e0',
          fontSize: '9pt',
        }}
      >
        <tbody>
          <tr>
            {/* Left: Client Details */}
            <td
              style={{
                width: '55%',
                verticalAlign: 'top',
                padding: '8px 10px',
                borderRight: '1px solid #cbd5e0',
                backgroundColor: '#f7fafc',
              }}
            >
              <div style={{ fontSize: '8pt', fontWeight: 800, color: '#718096', textTransform: 'uppercase' }}>
                CLIENT DETAILS (CONTRACT ISSUED TO):
              </div>
              <div style={{ fontSize: '10pt', fontWeight: 900, color: '#1a202c', marginTop: '2px' }}>
                {customer?.name || 'CUSTOMER NAME'}
              </div>
              {customer?.address?.line1 && (
                <div style={{ fontSize: '8.5pt', color: '#4a5568', marginTop: '2px' }}>
                  {customer.address.line1}
                  {customer.address.line2 ? `, ${customer.address.line2}` : ''}
                </div>
              )}
              {(customer?.address?.city || customer?.address?.state) && (
                <div style={{ fontSize: '8.5pt', color: '#4a5568' }}>
                  {[customer.address.city, customer.address.state].filter(Boolean).join(' - ')}
                  {customer.address?.postalCode ? ` - ${customer.address.postalCode}` : ''}
                </div>
              )}
              {customer?.contact?.phone && (
                <div style={{ fontSize: '8.5pt', color: '#2d3748', marginTop: '2px', fontWeight: 600 }}>
                  Contact: {customer.contact.phone}
                </div>
              )}
              {customer?.taxProfile?.gstin && (
                <div style={{ fontSize: '8.5pt', color: '#1a202c', fontWeight: 700, marginTop: '2px' }}>
                  GSTIN: {customer.taxProfile.gstin}
                </div>
              )}
            </td>

            {/* Right: Contract Metadata */}
            <td style={{ width: '45%', verticalAlign: 'top', padding: '8px 10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt' }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 700, color: '#718096', padding: '2px 0' }}>Contract Number:</td>
                    <td style={{ fontWeight: 900, color: '#1a365d', textAlign: 'right', padding: '2px 0' }}>
                      {contract.contractNumber}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700, color: '#718096', padding: '2px 0' }}>Agreement Date:</td>
                    <td style={{ fontWeight: 700, color: '#1a202c', textAlign: 'right', padding: '2px 0' }}>
                      {formatDate(contract.startDate || contract.createdAt)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700, color: '#718096', padding: '2px 0' }}>Validity Period:</td>
                    <td style={{ fontWeight: 700, color: '#1a202c', textAlign: 'right', padding: '2px 0' }}>
                      {formatDate(contract.startDate)} to {formatDate(contract.endDate)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700, color: '#718096', padding: '2px 0' }}>Contract Term:</td>
                    <td style={{ fontWeight: 700, color: '#1a202c', textAlign: 'right', padding: '2px 0' }}>
                      {contract.planSnapshot?.durationMonths || 12} Months
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700, color: '#718096', padding: '2px 0' }}>Contract Status:</td>
                    <td style={{ fontWeight: 800, textAlign: 'right', padding: '2px 0' }}>
                      <span
                        style={{
                          backgroundColor:
                            contract.status === 'ACTIVE'
                              ? '#def7ec'
                              : contract.status === 'PENDING_APPROVAL'
                              ? '#feecdc'
                              : '#edf2f7',
                          color:
                            contract.status === 'ACTIVE'
                              ? '#03543f'
                              : contract.status === 'PENDING_APPROVAL'
                              ? '#9a3412'
                              : '#4a5568',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '7.5pt',
                          textTransform: 'uppercase',
                        }}
                      >
                        {contract.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ---------------------------------------------------- */}
      {/* 4. COVERED EQUIPMENT FLEET TABLE */}
      {/* ---------------------------------------------------- */}
      <div style={{ marginBottom: '14px' }}>
        <div
          style={{
            fontSize: '9pt',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: '#1a365d',
            marginBottom: '4px',
            letterSpacing: '0.5px',
          }}
        >
          1. COVERED AC EQUIPMENT FLEET
        </div>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '8.5pt',
            border: '1px solid #cbd5e0',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#edf2f7', color: '#2d3748', textTransform: 'uppercase' }}>
              <th style={{ border: '1px solid #cbd5e0', padding: '5px 6px', textAlign: 'center', width: '6%' }}>#</th>
              <th style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'left', width: '34%' }}>
                Brand & Model
              </th>
              <th style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'center', width: '16%' }}>
                Capacity / Ton
              </th>
              <th style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'left', width: '22%' }}>
                Serial Number
              </th>
              <th style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'left', width: '22%' }}>
                Premises Location
              </th>
            </tr>
          </thead>
          <tbody>
            {contract.coveredUnits && contract.coveredUnits.length > 0 ? (
              contract.coveredUnits.map((u: any, idx: number) => {
                const eq = u.acEquipmentId || {};
                const brand = u.unitBrand || eq.brand || 'Air Conditioner';
                const model = u.unitModel || eq.modelNumber || '';
                const tonnage = u.unitTonnage || eq.tonnage || '1.5 Ton';
                const serial = u.unitSerial || eq.serialNumber || 'N/A';
                const location = u.unitLocation || eq.installationLocation || 'Premises';

                return (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ border: '1px solid #cbd5e0', padding: '5px 6px', textAlign: 'center' }}>
                      {idx + 1}
                    </td>
                    <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px', fontWeight: 600 }}>
                      {brand} {model ? `(${model})` : ''}
                    </td>
                    <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'center' }}>
                      {tonnage}
                    </td>
                    <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px', fontFamily: 'monospace' }}>
                      {serial}
                    </td>
                    <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px' }}>
                      {location}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} style={{ border: '1px solid #cbd5e0', padding: '8px', textAlign: 'center', color: '#718096' }}>
                  No individual AC units specified. Covered under general premises fleet contract.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 5. SCOPE OF SERVICE & ENTITLEMENTS */}
      {/* ---------------------------------------------------- */}
      <div style={{ marginBottom: '14px' }}>
        <div
          style={{
            fontSize: '9pt',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: '#1a365d',
            marginBottom: '4px',
            letterSpacing: '0.5px',
          }}
        >
          2. SCOPE OF SERVICES & ANNUAL ENTITLEMENTS
        </div>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '8.5pt',
            border: '1px solid #cbd5e0',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#edf2f7', color: '#2d3748', textTransform: 'uppercase' }}>
              <th style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'left', width: '35%' }}>
                Service Type
              </th>
              <th style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'center', width: '20%' }}>
                Frequency
              </th>
              <th style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'center', width: '15%' }}>
                Included Qty
              </th>
              <th style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'left', width: '30%' }}>
                Coverage Scope
              </th>
            </tr>
          </thead>
          <tbody>
            {contract.planSnapshot?.entitlements && contract.planSnapshot.entitlements.length > 0 ? (
              contract.planSnapshot.entitlements.map((ent: any, eIdx: number) => {
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

                return (
                  <tr key={eIdx} style={{ backgroundColor: eIdx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px', fontWeight: 600 }}>
                      {serviceName}
                    </td>
                    <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'center' }}>
                      {ent.scheduling || 'SCHEDULED'}
                    </td>
                    <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'center', fontWeight: 700 }}>
                      {ent.quantity} Visits / Year
                    </td>
                    <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px' }}>
                      {ent.entitlementScope === 'PER_EQUIPMENT' ? 'Per Registered AC Unit' : 'Total Across Agreement'}
                    </td>
                  </tr>
                );
              })
            ) : (
              <>
                <tr>
                  <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px', fontWeight: 600 }}>
                    Routine Dry Cleaning
                  </td>
                  <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'center' }}>Monthly</td>
                  <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'center', fontWeight: 700 }}>
                    8 Visits
                  </td>
                  <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px' }}>Per Registered AC Unit</td>
                </tr>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px', fontWeight: 600 }}>
                    Water Jet Deep Cleaning
                  </td>
                  <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'center' }}>Quarterly</td>
                  <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'center', fontWeight: 700 }}>
                    4 Visits
                  </td>
                  <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px' }}>Per Registered AC Unit</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px', fontWeight: 600 }}>
                    Breakdown / Emergency Repairs
                  </td>
                  <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'center' }}>On Demand</td>
                  <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px', textAlign: 'center', fontWeight: 700 }}>
                    Included
                  </td>
                  <td style={{ border: '1px solid #cbd5e0', padding: '5px 8px' }}>Within 24-48 Hours Response</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 6. FINANCIALS & PAYMENT SCHEDULE */}
      {/* ---------------------------------------------------- */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
        <tbody>
          <tr>
            {/* Left: Bank / Payment Instruction */}
            <td style={{ width: '52%', verticalAlign: 'top', paddingRight: '12px' }}>
              <div
                style={{
                  border: '1px solid #cbd5e0',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  backgroundColor: '#f7fafc',
                  fontSize: '8pt',
                }}
              >
                <div style={{ fontWeight: 800, color: '#1a365d', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Bank Details For Remittance:
                </div>
                <div>Account Name: <strong>{business.bankDetails?.accountHolderName || businessName}</strong></div>
                <div>Bank: <strong>{business.bankDetails?.bankName || 'HDFC Bank Ltd'}</strong></div>
                <div>A/C No: <strong>{business.bankDetails?.accountNumber || '50200049823104'}</strong></div>
                <div>IFSC Code: <strong>{business.bankDetails?.ifsc || 'HDFC0000287'}</strong></div>
                {business.bankDetails?.branch && <div>Branch: {business.bankDetails.branch}</div>}
              </div>
            </td>

            {/* Right: Totals Box */}
            <td style={{ width: '48%', verticalAlign: 'top' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '8.5pt',
                  border: '1px solid #cbd5e0',
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #edf2f7', color: '#4a5568' }}>
                      Contract Base Value:
                    </td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #edf2f7', textAlign: 'right', fontWeight: 600 }}>
                      {formatCurrency(contract.financials?.contractAmount || 0)}
                    </td>
                  </tr>
                  {contract.financials?.discount > 0 && (
                    <tr>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #edf2f7', color: '#e53e3e' }}>
                        Special Discount:
                      </td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #edf2f7', textAlign: 'right', fontWeight: 600, color: '#e53e3e' }}>
                        - {formatCurrency(contract.financials.discount)}
                      </td>
                    </tr>
                  )}
                  {contract.financials?.taxAmount > 0 && (
                    <tr>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #edf2f7', color: '#4a5568' }}>
                        GST / Applicable Taxes:
                      </td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #edf2f7', textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(contract.financials.taxAmount)}
                      </td>
                    </tr>
                  )}
                  <tr style={{ backgroundColor: '#ebf8ff' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 900, color: '#1a365d', fontSize: '9pt' }}>
                      Total Contract Payable:
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 900, color: '#1a365d', fontSize: '9.5pt' }}>
                      {formatCurrency(contract.financials?.finalAmount || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 8px', borderTop: '1px solid #cbd5e0', color: '#2b6cb0' }}>
                      Amount Received:
                    </td>
                    <td style={{ padding: '4px 8px', borderTop: '1px solid #cbd5e0', textAlign: 'right', fontWeight: 700, color: '#2b6cb0' }}>
                      {formatCurrency(contract.financials?.paidAmount || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 8px', fontWeight: 800, color: balanceAmount > 0 ? '#c53030' : '#276749' }}>
                      Outstanding Balance:
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 800, color: balanceAmount > 0 ? '#c53030' : '#276749' }}>
                      {formatCurrency(balanceAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ---------------------------------------------------- */}
      {/* 7. TERMS & CONDITIONS */}
      {/* ---------------------------------------------------- */}
      <div style={{ marginBottom: '18px' }}>
        <div
          style={{
            fontSize: '8.5pt',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: '#1a365d',
            marginBottom: '4px',
            letterSpacing: '0.5px',
          }}
        >
          3. TERMS & CONDITIONS
        </div>
        <ol
          style={{
            margin: 0,
            paddingLeft: '18px',
            fontSize: '7.5pt',
            lineHeight: '1.45',
            color: '#2d3748',
          }}
        >
          {termsList.map((term: string, tIdx: number) => (
            <li key={tIdx} style={{ marginBottom: '2px' }}>
              {term}
            </li>
          ))}
        </ol>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 8. DUAL SIGNATURE & SEAL BLOCK */}
      {/* ---------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: '20px',
          paddingTop: '10px',
        }}
      >
        {/* Left: Customer Acceptance */}
        <div style={{ width: '42%', textAlign: 'center' }}>
          <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '7.5pt', color: '#a0aec0', fontStyle: 'italic' }}>
              [ Customer Seal & Signature ]
            </span>
          </div>
          <div style={{ borderBottom: '1px solid #000000', width: '100%', marginBottom: '4px' }} />
          <div style={{ fontSize: '8pt', fontWeight: 800, textTransform: 'uppercase', color: '#1a202c' }}>
            AUTHORIZED CLIENT SIGNATORY
          </div>
          <div style={{ fontSize: '7pt', color: '#718096' }}>For: {customer?.name}</div>
        </div>

        {/* Right: Jay Ramji Enterprise Authorized Signature & Stamp */}
        <div style={{ width: '45%', textAlign: 'center' }}>
          <div
            style={{
              height: '75px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {assets?.stamp?.secureUrl && (
              <img
                src={assets.stamp.secureUrl}
                alt="Stamp"
                style={{
                  maxHeight: '75px',
                  maxWidth: '130px',
                  objectFit: 'contain',
                  opacity: 0.9,
                  transform: 'rotate(-2deg)',
                  position: 'absolute',
                  zIndex: 1,
                }}
              />
            )}
            {assets?.signature?.secureUrl && (
              <img
                src={assets.signature.secureUrl}
                alt="Signature"
                style={{
                  maxHeight: '40px',
                  maxWidth: '120px',
                  objectFit: 'contain',
                  position: 'absolute',
                  bottom: '4px',
                  zIndex: 2,
                }}
              />
            )}
          </div>
          <div style={{ borderBottom: '1px solid #000000', width: '100%', marginBottom: '4px' }} />
          <div style={{ fontSize: '8pt', fontWeight: 800, textTransform: 'uppercase', color: '#1a202c' }}>
            FOR {businessName}
          </div>
          <div style={{ fontSize: '7pt', color: '#718096' }}>Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
}
