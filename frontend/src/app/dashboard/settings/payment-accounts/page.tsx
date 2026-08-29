'use client';

import Link from 'next/link';
import PaymentAccountsManager from '../components/PaymentAccountsManager';

export default function PaymentAccountsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-xs text-text-secondary">
        <Link href="/dashboard/settings" className="hover:underline">Settings</Link>
        <span>/</span>
        <span className="text-text-primary font-bold">Payment Accounts</span>
      </div>

      <PaymentAccountsManager />
    </div>
  );
}
