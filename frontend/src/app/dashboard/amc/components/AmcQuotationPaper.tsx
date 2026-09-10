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
    quotationNumber: string | null;
    quotationDate: string | Date;
    paymentTerms: string | null;
    validUntil?: string | Date | null;
    quotationType: 'COMPREHENSIVE' | 'NON_COMPREHENSIVE' | string;
    amountInWords: string;
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

  const formattedDate = new Date(quotation.quotationDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const businessAddrLines = [
    business.address?.line1,
    business.address?.line2,
    business.address?.city,
    business.address?.state,
    business.address?.postalCode
      ? `${business.address.state}-${business.address.postalCode}`
      : business.address?.state,
  ].filter(Boolean);

  const businessAddrStr = businessAddrLines.join(', ');
  const businessPhoneStr = business.contact?.phone ? `Contact No.: ${business.contact.phone}` : '';
  const businessEmailStr = business.contact?.email ? `Email: ${business.contact.email}` : '';
  const businessGstinStr = business.taxProfile?.gstin ? `GSTIN: ${business.taxProfile.gstin}` : '';

  const displayItems = items.map((it, idx) => ({
    ...it,
    serialNumber: idx + 1,
  }));

  const paddingRowsCount = Math.max(0, 8 - displayItems.length);

  const subtotalValue = totals.subtotal || 0;
  const taxTotalValue = totals.taxTotal || 0;
  const grandTotalValue = totals.grandTotal || 0;

  const defaultTerms = [
    'This AMC quotation is valid for 30 days from issuance date.',
    quotation.quotationType === 'COMPREHENSIVE'
      ? 'Comprehensive AMC: Routine scheduled maintenance and eligible components are covered.'
      : 'Non-Comprehensive AMC: Labour & routine inspection included. Spare parts & gas are chargeable.',
    'Payment Terms: ' + (quotation.paymentTerms || '10 Days from Invoice Date'),
    'Emergency breakdown calls will be attended to within 24 to 48 hours.',
  ];

  const termsList =
    quotation.termsAndConditions && quotation.termsAndConditions.length > 0
      ? quotation.termsAndConditions
      : defaultTerms;

  const isComprehensive = quotation.quotationType === 'COMPREHENSIVE';

  return (
    <div
      className="bg-white text-black font-['Arial',_Helvetica,_sans-serif] relative flex flex-col justify-between w-full h-full box-border"
      style={{
        padding: '10mm 15mm 12mm 15mm',
        fontSize: '8.5pt',
        lineHeight: '1.2',
        border: '1.5px solid black',
      }}
    >
      <div>
        {/* 1. Header Section */}
        <div className="grid grid-cols-12 gap-3 items-center border-b border-black pb-2 mb-2">
          <div className="col-span-3 flex justify-start items-center">
            {assets?.logo?.secureUrl ? (
              <img
                src={assets.logo.secureUrl}
                alt="Logo"
                style={{
                  maxHeight: '28mm',
                  maxWidth: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div className="w-24 h-16 border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400 font-bold">
                LOGO
              </div>
            )}
          </div>

          <div className="col-span-9 text-center space-y-0.5">
            <h1 className="text-[20pt] font-black uppercase tracking-wide leading-none text-black">
              {business.displayName || business.name || 'JAY RAMJI ENTERPRISE'}
            </h1>
            <p className="text-[9pt] font-bold tracking-tight text-gray-800">
              YOUR SATISFACTION, OUR SUCCESS.
            </p>
            <p className="text-[7.5pt] text-gray-700 leading-tight">
              {businessAddrStr || 'Mundra Highway Road, Mundra-Gujarat, 370421'}
            </p>
            <p className="text-[7.5pt] font-medium text-gray-700">
              {[businessPhoneStr, businessEmailStr, businessGstinStr].filter(Boolean).join(' | ')}
            </p>
          </div>
        </div>

        {/* 2. Document Title Box */}
        <div className="text-center mb-2">
          <div className="inline-block border border-black px-6 py-1 font-bold text-center uppercase tracking-widest text-[11pt] bg-neutral-50">
            AMC QUOTATION
          </div>
          <div className="text-[8pt] font-black text-primary-700 uppercase tracking-wider mt-0.5">
            {isComprehensive ? 'COMPREHENSIVE AMC CONTRACT' : 'NON-COMPREHENSIVE AMC CONTRACT'}
          </div>
        </div>

        {/* 3. SOLD TO Box */}
        <div className="border border-black p-2 mb-2 text-left bg-neutral-50/50">
          <div className="text-[8.5pt] font-bold text-gray-600 uppercase mb-0.5">SOLD TO:</div>
          <div className="text-[9pt] font-bold uppercase text-black">
            {customer?.name || 'CUSTOMER NAME'}
          </div>
          <div className="text-[8pt] text-gray-700 leading-tight">
            {[
              customer?.address?.line1,
              customer?.address?.line2,
              customer?.address?.city,
              customer?.address?.state,
              customer?.address?.postalCode,
            ]
              .filter(Boolean)
              .join(', ') || 'CUSTOMER ADDRESS'}
          </div>
          {customer?.contact?.phone && (
            <div className="text-[8pt] text-gray-700">Contact: {customer.contact.phone}</div>
          )}
          {customer?.taxProfile?.gstin && (
            <div className="text-[8pt] font-bold text-gray-800">
              GSTIN: {customer.taxProfile.gstin}
            </div>
          )}
        </div>

        {/* 4. Metadata Strip */}
        <table className="w-full border-collapse border border-black mb-2 text-[8pt] font-bold">
          <thead>
            <tr className="bg-[#fce4d0]">
              <th className="border-r border-black p-1 text-left uppercase w-1/3">
                QUOTATION NO.
              </th>
              <th className="border-r border-black p-1 text-left uppercase w-1/3">
                QUOTATION DATE
              </th>
              <th className="p-1 text-left uppercase w-1/3">TERMS OF PAYMENT / VALIDITY</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-r border-black p-1 text-left text-[8.5pt]">
                {quotation.quotationNumber || 'DRAFT'}
              </td>
              <td className="border-r border-black p-1 text-left">{formattedDate}</td>
              <td className="p-1 text-left">{quotation.paymentTerms || '10 Days from Invoice date'}</td>
            </tr>
          </tbody>
        </table>

        {/* 5. AMC Table */}
        <table className="w-full border-collapse border border-black text-[8pt]">
          <thead>
            <tr className="bg-[#fce4d0] font-bold border-b border-black text-center">
              <th className="border-r border-black p-1.5 w-10">SR NO.</th>
              <th className="border-r border-black p-1.5 text-left">DESCRIPTION OF SERVICE / GOODS</th>
              <th className="border-r border-black p-1.5 w-24">PERIOD</th>
              <th className="border-r border-black p-1.5 w-12">QTY</th>
              <th className="border-r border-black p-1.5 w-20 text-right">RATE</th>
              <th className="p-1.5 w-24 text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.map((item, idx) => (
              <tr key={idx} className="border-b border-black/30 text-left">
                <td className="border-r border-black p-1 text-center font-medium">
                  {item.serialNumber}
                </td>
                <td className="border-r border-black p-1 font-semibold">{item.description}</td>
                <td className="border-r border-black p-1 text-center font-medium text-gray-700">
                  {item.period || '-'}
                </td>
                <td className="border-r border-black p-1 text-center font-semibold">
                  {item.quantity}
                </td>
                <td className="border-r border-black p-1 text-right font-medium">
                  ₹{Number(item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-1 text-right font-bold">
                  ₹{Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}

            {Array.from({ length: paddingRowsCount }).map((_, i) => (
              <tr key={`pad-${i}`} className="border-b border-black/20 h-6">
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td></td>
              </tr>
            ))}

            {/* Total Row */}
            <tr className="border-t border-b border-black font-bold bg-neutral-50">
              <td colSpan={2} className="p-1.5 border-r border-black text-left">
                Total
              </td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="border-r border-black"></td>
              <td className="p-1.5 text-right font-black">
                ₹{subtotalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>

            {/* Terms and Financial Breakdown */}
            <tr className="align-top">
              <td colSpan={4} className="p-2 border-r border-black border-b border-black text-left">
                <div>
                  <span className="font-bold text-[8pt] uppercase block mb-1">
                    Terms & Conditions:
                  </span>
                  <ol className="list-decimal pl-3.5 space-y-0.5 text-[7.5pt] text-gray-800">
                    {termsList.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ol>
                </div>

                <div className="mt-2 pt-2 border-t border-dashed border-gray-300">
                  <span className="font-bold text-[7.5pt] block mb-0.5">Amount In Words:</span>
                  <p className="font-bold text-[8pt] text-primary-900">{quotation.amountInWords}</p>
                </div>

                <div className="mt-2 pt-1 text-[7.5pt] text-gray-700">
                  <span className="font-bold">Bank Details: </span>
                  {business.bankDetails?.bankName} | A/C: {business.bankDetails?.accountNumber} | IFSC: {business.bankDetails?.ifsc}
                </div>
              </td>

              <td colSpan={2} className="p-0 border-b border-black">
                <table className="w-full border-collapse text-[8pt]">
                  <tbody>
                    <tr className="border-b border-black/30">
                      <td className="p-1.5 font-bold border-r border-black">SUBTOTAL</td>
                      <td className="p-1.5 text-right font-bold">
                        ₹{subtotalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    {taxTotalValue > 0 && (
                      <tr className="border-b border-black/30">
                        <td className="p-1.5 font-bold border-r border-black">GST (18%)</td>
                        <td className="p-1.5 text-right font-bold">
                          ₹{taxTotalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-[#e7e6e6] font-black">
                      <td className="p-1.5 border-r border-black">GRAND TOTAL</td>
                      <td className="p-1.5 text-right">
                        ₹{grandTotalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 6. Footer Signatures */}
      <div className="pt-4">
        <div className="flex justify-between items-end text-[8pt]">
          <div className="flex flex-col justify-end w-1/2">
            <div className="h-14"></div>
            <div className="border-b border-black w-44"></div>
            <span className="text-[7.5pt] mt-1 font-bold text-gray-600 uppercase">
              SERVICE SUPERVISED BY
            </span>
          </div>

          <div className="flex flex-col items-end justify-end w-1/2 text-right">
            <div className="w-44 h-14 flex items-end justify-center relative mb-1 pointer-events-none">
              {assets?.stamp?.secureUrl && (
                <img
                  src={assets.stamp.secureUrl}
                  alt="Business Stamp"
                  className="w-24 max-h-14 object-contain opacity-95"
                />
              )}
              {assets?.signature?.secureUrl && (
                <img
                  src={assets.signature.secureUrl}
                  alt="Authorized Signature"
                  className="w-32 max-h-14 object-contain absolute bottom-0 opacity-95 z-20"
                />
              )}
            </div>
            <div className="border-b border-black w-44"></div>
            <span className="text-[7.5pt] mt-1 font-bold text-gray-600 uppercase w-44 text-center">
              Authorized Signatory
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
