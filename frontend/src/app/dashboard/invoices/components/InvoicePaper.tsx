import React from 'react';

export interface InvoiceItem {
  serialNumber?: number;
  description: string;
  quantity: number;
  unitPrice: number; // float (Rupees)
  amount: number; // float (Rupees)
  type?: 'PRODUCT' | 'SERVICE';
}

export interface InvoiceTotals {
  partsTotal: number; // float
  laborTotal: number; // float
  discount: number; // float (positive value if discount applied)
  taxTotal: number; // float
  rounding: number; // float
  grandTotal: number; // float
  subtotal: number; // float
}

export interface InvoicePaperProps {
  invoice: {
    invoiceNumber: string | null;
    invoiceDate: string | Date;
    paymentTerms: string | null;
    amountInWords: string;
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
    invoiceTitle?: string;
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
  items: InvoiceItem[];
  totals: InvoiceTotals;
  assets: {
    logo?: { secureUrl: string } | null;
    stamp?: { secureUrl: string } | null;
    signature?: { secureUrl: string } | null;
  };
  isDraft?: boolean;
}

export default function InvoicePaper({
  invoice,
  business,
  customer,
  items,
  totals,
  assets,
  isDraft = false,
}: InvoicePaperProps) {
  if (!business || !invoice) {
    return (
      <div className="w-full h-full min-h-[297mm] flex items-center justify-center bg-white text-gray-500 text-sm">
        Loading preview...
      </div>
    );
  }

  // Format invoice date
  const formattedDate = new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Business address lines
  const businessAddrLines = [
    business.address?.line1,
    business.address?.line2,
    business.address?.city,
    business.address?.state,
    business.address?.postalCode ? `${business.address.state}-${business.address.postalCode}` : business.address?.state,
  ].filter(Boolean);
  
  const businessAddrStr = businessAddrLines.join(', ');
  const businessPhoneStr = business.contact?.phone ? `Contact No.: ${business.contact.phone}` : '';
  const businessEmailStr = business.contact?.email ? `Email: ${business.contact.email}` : '';
  const businessGstinStr = business.taxProfile?.gstin ? `GSTIN: ${business.taxProfile.gstin}` : '';

  // Determine item list with serial numbers
  const displayItems = items.map((it, idx) => ({
    ...it,
    serialNumber: idx + 1,
  }));

  // Table 1 requires exactly 11 item rows.
  // Pad with empty rows if items.length < 11.
  const paddingRowsCount = Math.max(0, 11 - displayItems.length);

  // Compute robust parts and labor amounts from items if not provided directly on totals
  const computedPartsTotal = typeof totals?.partsTotal === 'number'
    ? totals.partsTotal
    : displayItems.filter(it => it.type === 'PRODUCT' || (it as any).section === 'PART' || (it as any).section === 'ITEM').reduce((sum, it) => sum + (it.amount || 0), 0);

  const computedLaborTotal = typeof totals?.laborTotal === 'number'
    ? totals.laborTotal
    : displayItems.filter(it => it.type === 'SERVICE' || (it as any).section === 'LABOUR').reduce((sum, it) => sum + (it.amount || 0), 0);

  const subtotalValue = typeof totals?.subtotal === 'number'
    ? totals.subtotal
    : (typeof (totals as any)?.subtotalMinor === 'number' ? (totals as any).subtotalMinor / 100 : (computedPartsTotal + computedLaborTotal));

  const discountValue = typeof totals?.discount === 'number'
    ? totals.discount
    : (typeof (totals as any)?.discountMinor === 'number' ? (totals as any).discountMinor / 100 : 0);

  const taxTotalValue = typeof totals?.taxTotal === 'number'
    ? totals.taxTotal
    : (typeof (totals as any)?.taxTotalMinor === 'number' ? (totals as any).taxTotalMinor / 100 : 0);

  const roundingValue = typeof totals?.rounding === 'number'
    ? totals.rounding
    : (typeof (totals as any)?.roundingMinor === 'number' ? (totals as any).roundingMinor / 100 : 0);

  const grandTotalValue = typeof totals?.grandTotal === 'number'
    ? totals.grandTotal
    : (typeof (totals as any)?.grandTotalMinor === 'number' ? (totals as any).grandTotalMinor / 100 : (subtotalValue - discountValue + taxTotalValue + roundingValue));

  // Dynamic breakdown rows for the totals card on the right
  const breakdownRows: Array<{ label: string; amount: number; isTotal?: boolean }> = [
    { label: 'PARTS', amount: computedPartsTotal },
    { label: 'LABOR', amount: computedLaborTotal },
  ];

  if (discountValue > 0) {
    breakdownRows.push({ label: 'DISCOUNT', amount: -discountValue });
  }

  breakdownRows.push({ label: 'TAX', amount: taxTotalValue });

  if (Math.abs(roundingValue) > 0) {
    breakdownRows.push({ label: 'ROUNDING', amount: roundingValue });
  }

  breakdownRows.push({ label: 'TOTAL', amount: grandTotalValue, isTotal: true });

  const effectiveBusinessName = business.displayName || business.name || 'JAY RAMJI ENTERPRISE';
  const isJayRamJi = effectiveBusinessName.toUpperCase().includes('JAY RAMJI') || 
                     (business.legalName && business.legalName.toUpperCase().includes('JAY RAMJI'));

  return (
    <div 
      className="bg-white text-black font-['Arial',_Helvetica,_sans-serif] relative flex flex-col justify-between w-full h-full box-border"
      style={{
        padding: '10mm 17mm 15mm 17mm',
        fontSize: '8.5pt',
        lineHeight: '1.2',
      }}
    >
      <div>
        {/* 1. Header Section - 1x2 layout grid mimicking DOCX Header Table */}
        <div className="grid grid-cols-12 gap-4 items-center border-b border-black pb-2 mb-2">
          {/* Column 1: Logo */}
          <div className="col-span-3 flex justify-start items-center">
            {assets?.logo?.secureUrl ? (
              <img
                src={assets.logo.secureUrl}
                alt="Business Logo"
                className="max-h-32 max-w-full object-contain"
              />
            ) : (
              <div className="w-32 h-20 border-2 border-dashed border-gray-300 flex items-center justify-center text-[11px] text-gray-400 font-bold">
                LOGO
              </div>
            )}
          </div>
          
          <div className="col-span-9 text-center space-y-0.5">
            <h1 className="text-[26pt] font-black uppercase text-black leading-none tracking-wide">
              {effectiveBusinessName}
            </h1>
            {isJayRamJi && (
              <p className="text-[10.5pt] font-bold text-black leading-tight">
                YOUR SATISFACTION, OUR SUCCESS.
              </p>
            )}
            {(() => {
              const rawBusinessAddress = business.address?.displayAddress || (
                business.address?.line1
                  ? [
                      business.address.line1,
                      business.address.line2,
                      [business.address.city, business.address.state].filter(Boolean).join('-'),
                      business.address.postalCode,
                    ]
                      .filter(Boolean)
                      .join(', ')
                  : 'Shop no. 4, Plot no. 45, Baroi Road, Rushab Nagar, Mundra-Kutch, 370421'
              );
              const addressLen = rawBusinessAddress.length;
              const addressFontSize = addressLen > 115 ? '6.0pt' : addressLen > 95 ? '6.6pt' : addressLen > 75 ? '7.5pt' : '8.5pt';
              const addressLetterSpacing = addressLen > 90 ? '-0.25px' : 'normal';

              return (
                <p 
                  className="font-bold text-black uppercase leading-tight whitespace-nowrap"
                  style={{
                    fontSize: addressFontSize,
                    letterSpacing: addressLetterSpacing,
                  }}
                >
                  {rawBusinessAddress}
                </p>
              );
            })()}
            <p className="text-[8.5pt] font-bold text-black leading-tight">
              {businessPhoneStr} {businessEmailStr} {businessGstinStr && `| ${businessGstinStr}`}
            </p>
          </div>
        </div>

        {/* 2. Document Title */}
        <div className="text-center font-bold text-[14pt] text-black uppercase tracking-wider mt-2.5 mb-2.5 leading-none">
          {business.invoiceTitle || 'TAX INVOICE'}
        </div>

        {/* 3. Sold To Section */}
        <div className="mb-2 text-left">
          <span className="font-bold text-[10pt] text-black block leading-tight">
            SOLD TO:
          </span>
          <div className="text-[10pt] text-black font-bold uppercase mt-1 leading-normal pl-1 space-y-0.5">
            <h3>{customer.name}</h3>
            {customer.address?.line1 && <p className="font-normal text-[9pt]">{customer.address.line1}</p>}
            {customer.address?.line2 && <p className="font-normal text-[9pt]">{customer.address.line2}</p>}
            {(customer.address?.city || customer.address?.state) && (
              <p className="font-normal text-[9pt]">
                {[customer.address.city, customer.address.state].filter(Boolean).join(', ')}
                {customer.address?.postalCode ? ` - ${customer.address.postalCode}` : ''}
              </p>
            )}
            {customer.contact?.phone && <p className="font-normal text-[9pt]">Mo: {customer.contact.phone}</p>}
            {customer.taxProfile?.gstin && (
              <p className="font-bold text-[9.5pt] mt-1">GSTIN: {customer.taxProfile.gstin}</p>
            )}
          </div>
        </div>

        {/* 4. Metadata Table - exactly 3 columns matching DOCX Table 0 */}
        <div className="w-full mb-2">
          <table className="w-full border-collapse border border-black text-[10pt] font-bold">
            <thead>
              <tr className="bg-[#fce4d0] border-b border-black">
                <th className="py-1 px-2 border-r border-black text-left w-[21.6%] font-bold uppercase">Invoice No.</th>
                <th className="py-1 px-2 border-r border-black text-left w-[25.5%] font-bold uppercase">Invoice Date</th>
                <th className="py-1 px-2 text-left w-[52.9%] font-bold uppercase">Terms of Payment*</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black text-black font-bold">
                <td className="py-1 px-2 border-r border-black uppercase">
                  {isDraft ? 'DRAFT' : (invoice.invoiceNumber || 'DRAFT')}
                </td>
                <td className="py-1 px-2 border-r border-black">
                  {formattedDate}
                </td>
                <td className="py-1 px-2 uppercase">
                  {invoice.paymentTerms || (business as any)?.invoiceSettings?.defaultPaymentTerms || (business as any)?.paymentTerms || 'Within 15 days clear payment'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 5. Items Table - Table 1 matching DOCX width ratios & spacing */}
        <div className="w-full mb-2">
          <table className="w-full border-collapse border border-black text-[8.5pt]">
            <thead>
              <tr className="bg-[#f6e0d0] border-b border-black font-bold uppercase text-black">
                <th className="py-1 px-2 border-r border-black text-center w-[7.3%]">SR NO.</th>
                <th className="py-1 px-2 border-r border-black text-left w-[43.8%]">DESCRIPTION OF GOODS</th>
                <th className="py-1 px-2 border-r border-black text-center w-[8.9%]">QTY</th>
                <th className="py-1 px-2 border-r border-black text-right w-[20.0%]">PRICE</th>
                <th className="py-1 px-2 text-right w-[20.0%]">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {/* Actual line items */}
              {displayItems.map((it) => (
                <tr key={it.serialNumber} className="border-b border-black font-medium text-black min-h-[15pt]">
                  <td className="py-1 px-2 border-r border-black text-center">{it.serialNumber}</td>
                  <td className="py-1 px-2 border-r border-black uppercase whitespace-pre-wrap">{it.description}</td>
                  <td className="py-1 px-2 border-r border-black text-center font-bold">{it.quantity}</td>
                  <td className="py-1 px-2 border-r border-black text-right font-semibold">
                    {it.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-1 px-2 text-right font-bold">
                    {it.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              
              {/* Padding rows to maintain exact A4 height layout */}
              {paddingRowsCount > 0 &&
                Array.from({ length: paddingRowsCount }).map((_, i) => (
                  <tr key={`pad-${i}`} className="border-b border-black h-[15.5pt]">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black"></td>
                    <td></td>
                  </tr>
                ))}

              {/* Subtotal Row */}
              <tr className="border-b border-black font-bold h-[17.5pt]">
                <td colSpan={2} className="py-1.5 px-2 border-r border-black text-left font-bold">
                  Total
                </td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="py-1.5 px-2 text-right font-bold">
                  ₹{subtotalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {/* Dynamic Footer section row details */}
              <tr className="align-top">
                {/* Column 0,1,2: Bank Details & Amount in Words merged block */}
                <td 
                  colSpan={3} 
                  rowSpan={breakdownRows.length} 
                  className="p-2 border-r border-black border-b border-black text-left uppercase space-y-1 select-text"
                >
                  <div>
                    <span className="font-bold text-[8.5pt]">Amount In Words:-</span>
                    <p className="font-bold text-[8.5pt] mt-0.5">{invoice.amountInWords}</p>
                  </div>
                  <div className="h-2"></div>
                  <div className="space-y-0.5">
                    <span className="font-bold text-[8.5pt] block mb-1">Bank Details:-</span>
                    <p><span className="font-bold text-black">AC Name:</span> {business.bankDetails?.accountHolderName || '-'}</p>
                    <p><span className="font-bold text-black">AC NO:</span> {business.bankDetails?.accountNumber || '-'}</p>
                    <p><span className="font-bold text-black">Branch:</span> {business.bankDetails?.branch || '-'}</p>
                    <p><span className="font-bold text-black">IFSC Code:</span> {business.bankDetails?.ifsc || '-'}</p>
                    <p><span className="font-bold text-black">PAN NO:</span> {business.taxProfile?.pan || '-'}</p>
                  </div>
                </td>

                {/* Column 3: First breakdown label */}
                <td className="py-1 px-2 border-r border-black border-b border-black text-left font-semibold">
                  {breakdownRows[0].label}
                </td>
                {/* Column 4: First breakdown amount */}
                <td className="py-1 px-2 border-b border-black text-right font-bold">
                  ₹{(breakdownRows[0]?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {/* Columns 3 and 4: Remaining breakdown rows */}
              {breakdownRows.slice(1).map((row, idx) => (
                <tr 
                  key={idx}
                  className="align-middle"
                  style={{
                    backgroundColor: row.isTotal ? '#e7e6e6' : 'transparent',
                  }}
                >
                  {/* Column 3 */}
                  <td 
                    className="py-1 px-2 border-r border-black border-b border-black text-left"
                    style={{
                      fontWeight: row.isTotal ? 'bold' : '600',
                    }}
                  >
                    {row.label}
                  </td>
                  {/* Column 4 */}
                  <td className="py-1 px-2 border-b border-black text-right font-bold">
                    ₹{(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Signatory and Supervision Footer Block */}
      <div>
        <div className="flex justify-between items-end text-[10px] select-none">
          {/* Left Signatory */}
          <div className="flex flex-col justify-end w-1/2">
            <div className="h-[120px]"></div>
            <div className="border-b border-black w-48"></div>
            <span className="text-[8pt] mt-1.5 font-bold text-gray-500 uppercase">
              SERVICE SUPERVISED BY
            </span>
          </div>

          {/* Right Signatory & Stamp Stack */}
          <div className="flex flex-col items-end justify-end w-1/2 text-right">
            {/* Stamp & Signature container - strictly ABOVE the line */}
            <div className="w-48 h-[120px] flex items-end justify-center relative mb-2 pointer-events-none">
              {assets?.stamp?.secureUrl && (
                <img
                  src={assets.stamp.secureUrl}
                  alt="Business Stamp"
                  style={{
                    width: '128px',
                    maxWidth: '128px',
                    maxHeight: '100px',
                    objectFit: 'contain',
                    // transform: 'rotate(-2deg)',
                  }}
                  className="opacity-95 select-none"
                />
              )}
              {assets?.signature?.secureUrl && (
                <img
                  src={assets.signature.secureUrl}
                  alt="Authorized Signature"
                  style={{
                    width: '180px',
                    maxHeight: '100px',
                    objectFit: 'contain',
                  }}
                  className="absolute bottom-1 opacity-95 z-20"
                />
              )}
            </div>
            
            <div className="border-b border-black w-48"></div>
            <span className="text-[8pt] mt-1.5 font-bold text-gray-500 uppercase w-48 text-center">
              Authorized Signatory
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
