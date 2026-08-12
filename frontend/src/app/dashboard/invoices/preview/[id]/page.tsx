'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '../../../../../lib/api/client';

export default function InvoicePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadPreview() {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const preview = await apiClient.getInvoicePreview(id);
      setData(preview.data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate invoice preview');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreview();
  }, [id]);

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 mx-auto mb-4"></div>
        <p className="text-sm text-text-secondary">Generating visual bill rendering...</p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-sm rounded-lg font-medium">
        {errorMsg || 'Failed to load render details'}
      </div>
    );
  }

  const { invoice, business, customer, items, totals, assets } = data;

  return (
    <div className="space-y-6">
      {/* Action controls (no-print) */}
      <div className="flex items-center justify-between no-print bg-surface-app border border-border-app p-4 rounded-xl shadow-sm">
        <div className="flex space-x-3">
          <Link
            href="/dashboard/invoices"
            className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-secondary rounded-lg text-xs font-semibold cursor-pointer"
          >
            ← Back to Registry
          </Link>
          {invoice.status === 'DRAFT' && (
            <Link
              href={`/dashboard/invoices/edit/${invoice.id}`}
              className="px-4 py-2 bg-primary-900/10 hover:bg-primary-900/20 text-primary-700 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Edit Draft
            </Link>
          )}
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
        >
          Print / Save PDF
        </button>
      </div>

      {/* Styled Printable A4 Document Layout */}
      <div className="flex justify-center bg-surface-2-app/20 p-2 md:p-6 rounded-xl border border-border-app overflow-x-auto">
        <div className="invoice-paper bg-white text-black p-[15mm] border border-border-app shadow-lg w-[210mm] min-height-[297mm] box-border relative flex flex-col justify-between">
          
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden;
              }
              .invoice-paper, .invoice-paper * {
                visibility: visible;
              }
              .invoice-paper {
                position: absolute;
                left: 0;
                top: 0;
                width: 210mm;
                height: 297mm;
                border: none !important;
                box-shadow: none !important;
                padding: 10mm !important;
                margin: 0 !important;
              }
              .no-print {
                display: none !important;
              }
            }
            @page {
              size: A4 portrait;
              margin: 0;
            }
          `}</style>

          <div className="space-y-6">
            {/* 1. Header Section */}
            <div className="flex items-start justify-between border-b border-black pb-4">
              <div className="flex items-center space-x-4">
                {assets?.logo?.secureUrl ? (
                  <img
                    src={assets.logo.secureUrl}
                    alt="Logo"
                    className="w-16 h-16 object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 border border-gray-300 rounded flex items-center justify-center font-bold text-xs text-gray-400">
                    No Logo
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-extrabold tracking-wide uppercase">{business.name}</h1>
                  <p className="text-[10px] leading-relaxed text-gray-600 mt-1 whitespace-pre-line">
                    {business.address?.line1}
                    {business.address?.line2 ? `, ${business.address.line2}` : ''}
                    {business.address?.city ? `\n${business.address.city}` : ''}
                    {business.address?.state ? `, ${business.address.state}` : ''}
                    {business.address?.postalCode ? ` - ${business.address.postalCode}` : ''}
                    {business.contact?.phone ? `\nMo: ${business.contact.phone}` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-lg font-black tracking-widest text-primary-800 uppercase border-b-2 border-black pb-1">
                  {business.invoiceTitle}
                </h2>
                {business.taxProfile?.gstin && (
                  <p className="text-[10px] font-semibold text-gray-700 mt-2">
                    GSTIN: {business.taxProfile.gstin}
                  </p>
                )}
              </div>
            </div>

            {/* 2. Customer and Metadata Section */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="border border-black p-3 rounded">
                <h4 className="font-extrabold uppercase border-b border-gray-200 pb-1 mb-1.5 text-[10px] text-gray-500 tracking-wider">
                  SOLD TO:
                </h4>
                <h3 className="font-bold text-sm">{customer.name}</h3>
                <div className="text-[10px] text-gray-600 space-y-0.5 mt-1 leading-relaxed">
                  {customer.address?.line1 && <p>{customer.address.line1}</p>}
                  {customer.address?.line2 && <p>{customer.address.line2}</p>}
                  {(customer.address?.city || customer.address?.state) && (
                    <p>{[customer.address.city, customer.address.state].filter(Boolean).join(', ')}</p>
                  )}
                  {customer.contact?.phone && <p>Mo: {customer.contact.phone}</p>}
                  {customer.taxProfile?.gstin && <p className="font-semibold mt-1">GSTIN: {customer.taxProfile.gstin}</p>}
                </div>
              </div>

              <div className="border border-black p-3 rounded flex flex-col justify-between">
                <div>
                  <h4 className="font-extrabold uppercase border-b border-gray-200 pb-1 mb-1.5 text-[10px] text-gray-500 tracking-wider">
                    Invoice Metadata
                  </h4>
                  <div className="grid grid-cols-2 gap-y-1 text-[10px]">
                    <span className="font-semibold text-gray-500">Invoice No:</span>
                    <span className="font-bold text-right text-black">
                      {invoice.invoiceNumber ? invoice.invoiceNumber : `#${invoice.id.slice(-6).toUpperCase()}`}
                    </span>

                    <span className="font-semibold text-gray-500">Invoice Date:</span>
                    <span className="font-bold text-right">
                      {new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>

                    {invoice.paymentTerms && (
                      <>
                        <span className="font-semibold text-gray-500">Payment Terms:</span>
                        <span className="font-bold text-right leading-tight">{invoice.paymentTerms}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Items Table */}
            <div className="border border-black rounded overflow-hidden">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-black text-[10px] font-bold uppercase">
                    <th className="py-2 px-3 border-r border-black w-12 text-center">SR.</th>
                    <th className="py-2 px-3 border-r border-black">DESCRIPTION OF GOODS</th>
                    <th className="py-2 px-3 border-r border-black w-14 text-center">QTY</th>
                    <th className="py-2 px-3 border-r border-black w-24 text-right">PRICE (₹)</th>
                    <th className="py-2 px-3 w-28 text-right">AMOUNT (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((it: any) => (
                    <tr key={it.serialNumber} className="text-[10px] hover:bg-gray-50">
                      <td className="py-2 px-3 border-r border-black text-center font-semibold text-gray-600">
                        {it.serialNumber}
                      </td>
                      <td className="py-2 px-3 border-r border-black font-medium whitespace-pre-wrap">
                        {it.description}
                      </td>
                      <td className="py-2 px-3 border-r border-black text-center font-bold">
                        {it.quantity}
                      </td>
                      <td className="py-2 px-3 border-r border-black text-right font-semibold">
                        {it.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right font-bold">
                        {it.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {/* Visual padding rows if list is small, to maintain Excel height proportion */}
                  {items.length < 5 &&
                    Array.from({ length: 5 - items.length }).map((_, i) => (
                      <tr key={`pad-${i}`} className="h-6 text-[10px]">
                        <td className="border-r border-black"></td>
                        <td className="border-r border-black"></td>
                        <td className="border-r border-black"></td>
                        <td className="border-r border-black"></td>
                        <td></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* 4. Subtotal & Totals Breakdowns */}
            <div className="grid grid-cols-5 gap-4">
              <div className="col-span-3 border border-black p-3 rounded text-[10px] space-y-2">
                <div>
                  <h4 className="font-extrabold uppercase border-b border-gray-200 pb-1 mb-1 text-gray-500 tracking-wider">
                    Bank Details
                  </h4>
                  <div className="space-y-0.5 leading-relaxed">
                    <p><span className="font-semibold">A/C Name:</span> {business.bankDetails?.accountHolderName || '-'}</p>
                    <p><span className="font-semibold">Bank Name:</span> {business.bankDetails?.bankName || '-'}</p>
                    <p><span className="font-semibold">A/C No:</span> {business.bankDetails?.accountNumber || '-'}</p>
                    <p><span className="font-semibold">IFSC Code:</span> {business.bankDetails?.ifsc || '-'}</p>
                    <p><span className="font-semibold">PAN NO:</span> {business.taxProfile?.pan || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="col-span-2 border border-black p-3 rounded text-xs space-y-1.5 flex flex-col justify-between">
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal:</span>
                    <span className="font-semibold text-black">₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-danger-app">
                      <span>Discount:</span>
                      <span>-₹{totals.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {totals.taxes?.map((t: any, i: number) => (
                    <div key={i} className="flex justify-between">
                      <span>{t.type} ({(t.rateBps / 100).toFixed(1)}%):</span>
                      <span>₹{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  {Math.abs(totals.rounding) > 0 && (
                    <div className="flex justify-between text-gray-400">
                      <span>Rounding:</span>
                      <span>{totals.rounding > 0 ? '+' : ''}₹{totals.rounding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-black pt-1.5 flex justify-between font-black text-sm text-black">
                  <span>TOTAL:</span>
                  <span>₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* 5. Amount in Words block */}
            <div className="border border-black p-3 rounded text-[10px]">
              <span className="font-bold uppercase tracking-wider text-gray-500 block mb-1">
                Amount In Words:
              </span>
              <p className="font-bold text-black uppercase">{invoice.amountInWords}</p>
            </div>
          </div>

          {/* 6. Footer Area (Service supervised & signatures) */}
          <div className="grid grid-cols-2 gap-4 text-[10px] mt-12 border-t border-gray-100 pt-6">
            <div className="flex flex-col justify-between h-24">
              <span className="font-bold uppercase tracking-wider text-gray-500">Service Supervised By:</span>
              <div className="border-b border-black w-48 mt-8"></div>
              <span>Supervisor Name / Designation</span>
            </div>

            <div className="flex flex-col items-end justify-between h-24 text-right relative">
              <span className="font-bold uppercase tracking-wider text-gray-500">Authorized Signatory</span>
              
              {/* Overlapping Stamp & Signature if configured */}
              <div className="flex items-center space-x-4 absolute right-0 bottom-4 pointer-events-none">
                {assets?.signature?.secureUrl && (
                  <img
                    src={assets.signature.secureUrl}
                    alt="Signature"
                    className="h-12 w-24 object-contain opacity-80"
                  />
                )}
                {assets?.stamp?.secureUrl && (
                  <img
                    src={assets.stamp.secureUrl}
                    alt="Stamp"
                    className="h-16 w-16 object-contain opacity-70"
                  />
                )}
              </div>

              <div className="border-b border-black w-48 mt-8"></div>
              <span className="font-semibold text-gray-700">For JAY RAMJI ENTERPRISE</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
