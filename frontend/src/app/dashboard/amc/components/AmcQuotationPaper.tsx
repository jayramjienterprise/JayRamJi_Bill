import React from 'react';

export interface AmcQuotationPaperItem {
  serialNumber?: number;
  description: string;
  period?: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface AmcQuotationPaperProps {
  quotation: {
    title?: string;
    quotationNumber: string | null;
    quotationDate: string | Date;
    paymentTerms: string | null;
    validUntil?: string | Date | null;
    quotationType?: 'COMPREHENSIVE' | 'NON_COMPREHENSIVE' | string;
    amountInWords?: string;
    termsAndConditions?: string[];
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
  } | null;
  items: AmcQuotationPaperItem[];
  totals: {
    subtotal: number;
    discount?: number;
    taxTotal?: number;
    grandTotal: number;
  };
  assets: {
    logo?: { secureUrl: string } | null;
    stamp?: { secureUrl: string } | null;
    signature?: { secureUrl: string } | null;
  };
}

export default function AmcQuotationPaper({
  quotation,
  business,
  customer,
  items,
  totals,
  assets,
}: AmcQuotationPaperProps) {
  if (!business || !quotation) {
    return (
      <div className="w-full h-full min-h-[297mm] flex items-center justify-center bg-white text-gray-500 text-sm">
        Loading preview...
      </div>
    );
  }

  const formattedDate = new Date(quotation.quotationDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const isJayRamJi =
    business.name?.toUpperCase().includes('JAY RAMJI') ||
    (business.legalName && business.legalName.toUpperCase().includes('JAY RAMJI')) ||
    (business.displayName && business.displayName.toUpperCase().includes('JAY RAMJI'));

  const rawBusinessAddress =
    business.address?.displayAddress ||
    (business.address?.line1
      ? [
          business.address.line1,
          business.address.line2,
          [business.address.city, business.address.state].filter(Boolean).join('-'),
          business.address.postalCode,
        ]
          .filter(Boolean)
          .join(', ')
      : 'AT- Maruti Chhaya Complex, Nr. Satkar Shopping.St. Xevier School Road, Baroi Road, Mundra-370421');

  const addressLen = rawBusinessAddress.length;
  const addressFontSize =
    addressLen > 115 ? '6.0pt' : addressLen > 95 ? '6.6pt' : addressLen > 75 ? '7.5pt' : '8.5pt';
  const addressLetterSpacing = addressLen > 90 ? '-0.25px' : 'normal';

  const businessPhoneStr = business.contact?.phone ? `Mo:- ${business.contact.phone}` : '';
  const businessEmailStr = business.contact?.email ? `Email: ${business.contact.email}` : '';
  const businessGstinStr = business.taxProfile?.gstin ? `GSTIN: ${business.taxProfile.gstin}` : '';

  const hasPeriod = items.some((it) => it.period && it.period.trim().length > 0);

  const formatCurrency = (val: number) => {
    return (Number(val) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const displayItems = items.map((it, idx) => ({
    ...it,
    serialNumber: it.serialNumber || idx + 1,
  }));

  const amcTypeLabel =
    quotation.quotationType === 'COMPREHENSIVE'
      ? 'Comprehensive AMC'
      : quotation.quotationType === 'NON_COMPREHENSIVE'
        ? 'Non-Comprehensive AMC'
        : quotation.quotationType === 'STANDARD' || quotation.quotationType === 'GENERAL'
          ? ''
          : (quotation.quotationType || '');

  const DEFAULT_ROWS = 10;
  const emptyRowsCount = Math.max(0, DEFAULT_ROWS - displayItems.length);

  const defaultTerms = [
    'This AMC is valid for 1 year from the date of agreement or approval.',
    'Only refrigerant gas is included in the above rates if explicitly configured.',
    'Spare parts are not included. The above rates are for labour charges only.',
    'AC installation charges include up to 10 feet of standard installation.',
    'Additional copper piping beyond 10 feet will be charged on a per-foot basis.',
  ];

  const termsList =
    quotation.termsAndConditions && quotation.termsAndConditions.length > 0
      ? quotation.termsAndConditions
      : defaultTerms;

  return (
    <div
      className="bg-white text-black font-['Arial',_Helvetica,_sans-serif] relative flex flex-col justify-between w-full h-full box-border select-text"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '10mm 15mm 12mm 15mm',
        boxSizing: 'border-box',
        backgroundColor: 'white',
        border: '1.5px solid black',
        fontSize: '8.5pt',
        lineHeight: 1.2,
      }}
    >
      <div>
        {/* Header Table */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            borderBottom: '1.5px solid black',
            paddingBottom: '6px',
            marginBottom: '6px',
          }}
        >
          <tbody>
            <tr>
              <td style={{ width: '25%', textAlign: 'left', verticalAlign: 'middle', border: 'none', padding: 0 }}>
                {assets?.logo?.secureUrl ? (
                  <img
                    src={assets.logo.secureUrl}
                    alt="Logo"
                    style={{ maxHeight: '32mm', maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '32mm',
                      height: '20mm',
                      border: '2px dashed #ccc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      color: '#999',
                      fontWeight: 'bold',
                    }}
                  >
                    LOGO
                  </div>
                )}
              </td>
              <td style={{ width: '75%', textAlign: 'center', verticalAlign: 'middle', border: 'none', padding: 0 }}>
                <h1
                  style={{
                    fontSize: '24pt',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    margin: 0,
                    letterSpacing: '1px',
                    lineHeight: 1.1,
                  }}
                >
                  {business.displayName || business.name}
                </h1>
                {isJayRamJi && (
                  <p style={{ fontSize: '9.5pt', fontWeight: 'bold', margin: '2px 0 0 0' }}>
                    YOUR SATISFACTION, OUR SUCCESS.
                  </p>
                )}
                <p
                  style={{
                    fontSize: addressFontSize,
                    letterSpacing: addressLetterSpacing,
                    fontWeight: 'bold',
                    margin: '3px 0 0 0',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {rawBusinessAddress}
                </p>
                <p style={{ fontSize: '8.5pt', fontWeight: 'bold', margin: '2px 0 0 0' }}>
                  {[businessPhoneStr, businessEmailStr, businessGstinStr].filter(Boolean).join(' | ')}
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Title & AMC Type Section */}
        <div style={{ textAlign: 'center', marginTop: '14px', marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '15pt',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              textAlign: 'center',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {quotation.title || 'QUOTATION INQUIRY'}
          </div>
          <div
            style={{
              fontSize: '10pt',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: '#222222',
              marginTop: '4px',
              lineHeight: 1.2,
            }}
          >
            {amcTypeLabel}
          </div>
        </div>

        {/* Sold To (No Border Box) */}
        <div style={{ textAlign: 'left', marginBottom: '12px' }}>
          <h4 style={{ fontSize: '9.5pt', fontWeight: 'bold', textTransform: 'uppercase', margin: '0 0 3px 0' }}>
            SOLD TO:
          </h4>
          <div style={{ fontSize: '9.5pt', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, lineHeight: 1.25 }}>
            {customer?.name || 'CUSTOMER NAME'}
            {customer?.address?.line1 && (
              <p style={{ fontWeight: 'normal', fontSize: '9pt', margin: '2px 0 0 0' }}>
                {customer.address.line1}
              </p>
            )}
            {customer?.address?.line2 && (
              <p style={{ fontWeight: 'normal', fontSize: '9pt', margin: '2px 0 0 0' }}>
                {customer.address.line2}
              </p>
            )}
            {(customer?.address?.city || customer?.address?.state) && (
              <p style={{ fontWeight: 'normal', fontSize: '9pt', margin: '2px 0 0 0' }}>
                {[customer.address.city, customer.address.state].filter(Boolean).join(' - ')}
                {customer.address?.postalCode ? ', ' + customer.address.postalCode : ''}
              </p>
            )}
            {customer?.contact?.phone && (
              <p style={{ fontWeight: 'normal', fontSize: '9pt', margin: '2px 0 0 0' }}>
                Mo: {customer.contact.phone}
              </p>
            )}
            {customer?.taxProfile?.gstin && (
              <p style={{ fontWeight: 'bold', fontSize: '9pt', marginTop: '3px' }}>
                GSTIN: {customer.taxProfile.gstin}
              </p>
            )}
          </div>
        </div>

        {/* Metadata Table */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '6px',
            border: '1px solid black',
            fontSize: '9pt',
            fontWeight: 'bold',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  width: '22%',
                  borderRight: '1px solid black',
                  borderBottom: '1px solid black',
                  padding: '4px 6px',
                  textAlign: 'left',
                  fontWeight: 'bold',
                  backgroundColor: '#fce4d0',
                  textTransform: 'uppercase',
                }}
              >
                QUTATION NO.
              </th>
              <th
                style={{
                  width: '26%',
                  borderRight: '1px solid black',
                  borderBottom: '1px solid black',
                  padding: '4px 6px',
                  textAlign: 'left',
                  fontWeight: 'bold',
                  backgroundColor: '#fce4d0',
                  textTransform: 'uppercase',
                }}
              >
                Date
              </th>
              <th
                style={{
                  width: '52%',
                  borderBottom: '1px solid black',
                  padding: '4px 6px',
                  textAlign: 'left',
                  fontWeight: 'bold',
                  backgroundColor: '#fce4d0',
                  textTransform: 'uppercase',
                }}
              >
                Payment Terms*
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ borderRight: '1px solid black', padding: '5px 6px', textAlign: 'left', fontWeight: 'bold' }}>
                {quotation.quotationNumber || 'DRAFT'}
              </td>
              <td style={{ borderRight: '1px solid black', padding: '5px 6px', textAlign: 'left', fontWeight: 'bold' }}>
                {formattedDate}
              </td>
              <td style={{ padding: '5px 6px', textAlign: 'left', fontWeight: 'bold' }}>
                {quotation.paymentTerms || '10 Days from the Invoice date'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Items Table */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '8.5pt',
            border: '1px solid black',
            marginBottom: '6px',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  width: hasPeriod ? '6%' : '7%',
                  textAlign: 'center',
                  backgroundColor: '#f6e0d0',
                  borderBottom: '1px solid black',
                  borderRight: '1px solid black',
                  padding: '5px 6px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                }}
              >
                SR. NO.
              </th>
              <th
                style={{
                  width: hasPeriod ? '44%' : '55%',
                  textAlign: 'left',
                  backgroundColor: '#f6e0d0',
                  borderBottom: '1px solid black',
                  borderRight: '1px solid black',
                  padding: '5px 6px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                }}
              >
                DESCRIPTION OF GOODS
              </th>
              {hasPeriod && (
                <th
                  style={{
                    width: '14%',
                    textAlign: 'center',
                    backgroundColor: '#f6e0d0',
                    borderBottom: '1px solid black',
                    borderRight: '1px solid black',
                    padding: '5px 6px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                  }}
                >
                  PERIOD
                </th>
              )}
              <th
                style={{
                  width: '10%',
                  textAlign: 'right',
                  backgroundColor: '#f6e0d0',
                  borderBottom: '1px solid black',
                  borderRight: '1px solid black',
                  padding: '5px 6px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                }}
              >
                QTY
              </th>
              <th
                style={{
                  width: '12%',
                  textAlign: 'right',
                  backgroundColor: '#f6e0d0',
                  borderBottom: '1px solid black',
                  borderRight: '1px solid black',
                  padding: '5px 6px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                }}
              >
                PRICE
              </th>
              <th
                style={{
                  width: hasPeriod ? '14%' : '16%',
                  textAlign: 'right',
                  backgroundColor: '#f6e0d0',
                  borderBottom: '1px solid black',
                  padding: '5px 6px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                }}
              >
                AMOUNT
              </th>
            </tr>
          </thead>
          <tbody>
            {displayItems.map((it, idx) => {
              const isAlt = idx % 2 === 1;
              const bgStyle = isAlt ? '#fafbfc' : '#ffffff';
              return (
                <tr key={idx} style={{ backgroundColor: bgStyle }}>
                  <td
                    style={{
                      textAlign: 'center',
                      borderRight: '1px solid black',
                      borderBottom: '1px solid black',
                      padding: '4px 6px',
                    }}
                  >
                    {it.serialNumber}
                  </td>
                  <td
                    style={{
                      borderRight: '1px solid black',
                      borderBottom: '1px solid black',
                      padding: '4px 6px',
                      fontWeight: 500,
                    }}
                  >
                    {it.description}
                  </td>
                  {hasPeriod && (
                    <td
                      style={{
                        textAlign: 'center',
                        borderRight: '1px solid black',
                        borderBottom: '1px solid black',
                        padding: '4px 6px',
                      }}
                    >
                      {it.period || 'Annual'}
                    </td>
                  )}
                  <td
                    style={{
                      textAlign: 'right',
                      borderRight: '1px solid black',
                      borderBottom: '1px solid black',
                      padding: '4px 6px',
                      fontWeight: 600,
                    }}
                  >
                    {Number(it.quantity || 0)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      borderRight: '1px solid black',
                      borderBottom: '1px solid black',
                      padding: '4px 6px',
                    }}
                  >
                    {formatCurrency(it.unitPrice)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid black',
                      padding: '4px 6px',
                      fontWeight: 600,
                    }}
                  >
                    {formatCurrency(it.amount)}
                  </td>
                </tr>
              );
            })}

            {/* Default 10 rows padding */}
            {Array.from({ length: emptyRowsCount }).map((_, i) => {
              const rowIdx = displayItems.length + i;
              const isAlt = rowIdx % 2 === 1;
              const bgStyle = isAlt ? '#fafbfc' : '#ffffff';
              return (
                <tr key={`empty-${i}`} style={{ backgroundColor: bgStyle, height: '23px' }}>
                  <td style={{ textAlign: 'center', borderRight: '1px solid black', borderBottom: '1px solid black' }}>
                    &nbsp;
                  </td>
                  <td style={{ borderRight: '1px solid black', borderBottom: '1px solid black' }}>&nbsp;</td>
                  {hasPeriod && (
                    <td style={{ borderRight: '1px solid black', borderBottom: '1px solid black' }}>&nbsp;</td>
                  )}
                  <td style={{ borderRight: '1px solid black', borderBottom: '1px solid black' }}>&nbsp;</td>
                  <td style={{ borderRight: '1px solid black', borderBottom: '1px solid black' }}>&nbsp;</td>
                  <td style={{ borderBottom: '1px solid black' }}>&nbsp;</td>
                </tr>
              );
            })}

            {/* Subtotal Row */}
            <tr style={{ backgroundColor: '#fafbfc', fontWeight: 'bold', borderTop: '1.5px solid black' }}>
              <td
                colSpan={hasPeriod ? 3 : 2}
                style={{
                  textAlign: 'center',
                  borderRight: '1px solid black',
                  fontSize: '9pt',
                  padding: '4px 6px',
                }}
              >
                Total
              </td>
              <td style={{ textAlign: 'right', borderRight: '1px solid black', padding: '4px 6px' }}>
                {displayItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0)}
              </td>
              <td style={{ borderRight: '1px solid black' }}></td>
              <td style={{ textAlign: 'right', fontSize: '9.5pt', padding: '4px 6px' }}>
                ₹ {formatCurrency(totals.subtotal || totals.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Terms and Grand Total Block */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid black',
            marginTop: '4px',
            fontSize: '8pt',
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  width: '65%',
                  borderRight: '1px solid black',
                  verticalAlign: 'top',
                  padding: '6px',
                }}
              >
                <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '4px' }}>
                  Terms &amp; Conditions*:-
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: 1.45, fontSize: '8pt' }}>
                  {termsList.map((t, idx) => (
                    <li key={idx}>{t}</li>
                  ))}
                </ul>
              </td>
              <td
                style={{
                  width: '35%',
                  textAlign: 'right',
                  padding: 0,
                  verticalAlign: 'top',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', fontWeight: 'bold' }}>
                  <tbody>
                    {totals.discount ? (
                      <tr style={{ borderBottom: '1px solid black', fontSize: '8.5pt' }}>
                        <td style={{ textAlign: 'left', padding: '8px 10px' }}>Discount</td>
                        <td style={{ textAlign: 'right', padding: '8px 10px' }}>
                          - ₹ {formatCurrency(totals.discount)}
                        </td>
                      </tr>
                    ) : null}
                    {totals.taxTotal ? (
                      <tr style={{ borderBottom: '1px solid black', fontSize: '8.5pt' }}>
                        <td style={{ textAlign: 'left', padding: '8px 10px' }}>GST</td>
                        <td style={{ textAlign: 'right', padding: '8px 10px' }}>
                          ₹ {formatCurrency(totals.taxTotal)}
                        </td>
                      </tr>
                    ) : null}
                    <tr style={{ backgroundColor: '#fce4d0' }}>
                      <td style={{ textAlign: 'left', fontSize: '10.5pt', textTransform: 'uppercase', padding: '8px 10px' }}>
                        TOTAL
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '11pt', fontWeight: 900, padding: '8px 10px' }}>
                        ₹ {formatCurrency(totals.grandTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer Signatures */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: '15px',
          paddingBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '45%' }}>
          <div style={{ height: '70px' }}></div>
          <div style={{ borderBottom: '1px solid black', width: '180px', marginTop: 0 }}></div>
          <span
            style={{
              marginTop: '5px',
              fontSize: '8pt',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              width: '180px',
              textAlign: 'center',
            }}
          >
            SERVICE SUPERVISED BY
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            width: '45%',
            alignItems: 'flex-end',
            textAlign: 'right',
          }}
        >
          <div
            style={{
              width: '180px',
              height: '90px',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              position: 'relative',
              marginBottom: '4px',
              pointerEvents: 'none',
            }}
          >
            {assets?.stamp?.secureUrl && (
              <img
                src={assets.stamp.secureUrl}
                alt="Stamp"
                style={{
                  maxWidth: '260px',
                  maxHeight: '95px',
                  objectFit: 'contain',
                  opacity: 0.92,
                  zIndex: 1,
                  transform: 'rotate(-2deg)',
                }}
              />
            )}
            {assets?.signature?.secureUrl && (
              <img
                src={assets.signature.secureUrl}
                alt="Signature"
                style={{
                  maxHeight: '45px',
                  maxWidth: '170px',
                  objectFit: 'contain',
                  opacity: 0.95,
                  position: 'absolute',
                  bottom: '2px',
                  zIndex: 2,
                }}
              />
            )}
          </div>
          <div style={{ borderBottom: '1px solid black', width: '180px', marginTop: 0 }}></div>
          <span
            style={{
              marginTop: '5px',
              fontSize: '8pt',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              width: '180px',
              textAlign: 'center',
            }}
          >
            SIGNED
          </span>
        </div>
      </div>
    </div>
  );
}
