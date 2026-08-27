'use client';

import { useEffect, useState, use } from 'react';
import { apiClient } from '../../../lib/api/client';
import InvoicePaper from '../../dashboard/invoices/components/InvoicePaper';


export default function PublicInvoiceSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadPublicInvoice() {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiClient.getPublicInvoice(token);
      setInvoice(data.invoice);
    } catch (err: any) {
      setErrorMsg(err.message || 'The requested invoice link is not available or has expired.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPublicInvoice();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 mb-4"></div>
        <p className="text-sm text-gray-500 font-semibold">Loading official document...</p>
      </div>
    );
  }

  if (errorMsg || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white border border-gray-200 p-8 rounded-2xl shadow-sm space-y-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 font-black text-lg">
            !
          </div>
          <h2 className="text-lg font-bold text-gray-900">Document Unavailable</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            {errorMsg || 'This sharing link has expired, been revoked, or is invalid.'}
          </p>
        </div>
      </div>
    );
  }

  const { business, customer, items, totals, snapshotUrl, pdfUrl } = invoice;

  const partsTotal = items.filter((it: any) => it.type === 'PRODUCT').reduce((sum: number, it: any) => sum + it.lineTotalMinor / 100, 0);
  const laborTotal = items.filter((it: any) => it.type === 'SERVICE').reduce((sum: number, it: any) => sum + it.lineTotalMinor / 100, 0);

  const addressLine = [
    business.address?.line1,
    business.address?.line2,
    business.address?.city,
    business.address?.state,
    business.address?.postalCode ? `${business.address.state}-${business.address.postalCode}` : business.address?.state,
  ].filter(Boolean).join(', ');
  const phoneLine = business.contact?.phone ? `Mo:- ${business.contact.phone}` : '';
  const headerDetails = [addressLine, phoneLine].filter(Boolean).join(' ');

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center space-y-6">
      {/* Top Customer Info Panel */}
      <div className="w-full max-w-[210mm] bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Invoice: {invoice.invoiceNumber}</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Issued by {business.name} to {customer.name}
          </p>
        </div>
        {pdfUrl && (
          <a
            href={pdfUrl}
            download={`${invoice.invoiceNumber || 'bill'}.pdf`}
            target="_blank"
            rel="noreferrer"
            className="px-5 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-bold shadow-sm transition text-center cursor-pointer"
          >
            Download Official PDF
          </a>
        )}
      </div>

      {/* Visual Bill template */}
      <div className="flex justify-center w-full overflow-x-auto">
        <div className="invoice-paper bg-white text-black border-[1.5px] border-black shadow-lg w-[210mm] min-h-[297mm] h-[297mm] box-border relative select-none">
          <InvoicePaper
            invoice={{
              invoiceNumber: invoice.invoiceNumber,
              invoiceDate: invoice.invoiceDate,
              paymentTerms: invoice.paymentTerms,
              amountInWords: invoice.amountInWords,
            }}
            business={business}
            customer={customer}
            items={items.map((it: any) => ({
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPriceMinor / 100,
              amount: it.lineTotalMinor / 100,
              type: it.type,
            }))}
            totals={{
              partsTotal,
              laborTotal,
              discount: (totals.discountMinor || 0) / 100,
              taxTotal: ((totals.taxTotalMinor || totals.taxes?.reduce((sum: number, t: any) => sum + (t.amountMinor || 0), 0) || 0) / 100),
              rounding: (totals.roundingMinor || 0) / 100,
              grandTotal: totals.grandTotalMinor / 100,
              subtotal: (totals.subtotalMinor || (totals.grandTotalMinor - (totals.taxTotalMinor || 0) + (totals.discountMinor || 0))) / 100,
            }}
            assets={{
              logo: business.logo,
              stamp: business.stamp,
              signature: business.signature,
            }}
            isDraft={invoice.status === 'DRAFT'}
          />
        </div>
      </div>
    </div>
  );
}
