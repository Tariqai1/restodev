import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Order Desk',
  description: 'Privacy Policy and data protection terms for Order Desk restaurant ordering system.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F2] text-[#2A2312] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6 sm:p-10 border border-[#E8DECA] shadow-sm space-y-8">
        <div className="border-b border-[#E8DECA] pb-6">
          <Link href="/" className="text-xs font-bold text-amber-700 uppercase tracking-wider hover:underline flex items-center gap-1.5 mb-3">
            <i className="fa-solid fa-arrow-left text-[10px]" /> Back to Home
          </Link>
          <h1 className="font-heading text-3xl font-extrabold text-[#2A2312] tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs text-[#736852] mt-1">
            Last updated: September 26, 2026 • Effective Date: January 1, 2026
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#2A2312]">1. Information We Collect</h2>
          <p className="text-sm text-[#736852] leading-relaxed">
            Order Desk operates as a technology platform for restaurants. When you scan a QR code at a table, we collect minimal information necessary to deliver and coordinate your dining service:
          </p>
          <ul className="list-disc list-inside text-sm text-[#736852] space-y-1.5 pl-2">
            <li><strong>Session &amp; Table Identifiers:</strong> Table number, session tokens, and timestamps to associate food orders with your physical table.</li>
            <li><strong>Guest Details (Optional):</strong> Your name or mobile number if voluntarily entered for order notifications, receipts, or loyalty rewards.</li>
            <li><strong>Order History:</strong> Dish items, quantities, dietary specifications, and special kitchen notes.</li>
            <li><strong>Technical Diagnostics:</strong> Browser type, approximate device viewport size, and connection state to ensure real-time socket delivery to kitchen display screens.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#2A2312]">2. How We Use Information</h2>
          <p className="text-sm text-[#736852] leading-relaxed">
            Your information is strictly used to fulfill your dining experience:
          </p>
          <ul className="list-disc list-inside text-sm text-[#736852] space-y-1.5 pl-2">
            <li>Routing orders to kitchen staff (KOT) and floor captains in real time.</li>
            <li>Calculating totals, applicable taxes (CGST/SGST), and applying authorized dining discounts.</li>
            <li>Generating digital itemized bills and settlement receipts.</li>
            <li>We do not sell, rent, or monetize personal guest information to third-party advertisers.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#2A2312]">3. Payment Information</h2>
          <p className="text-sm text-[#736852] leading-relaxed">
            When you pay via UPI QR code or card terminal, transactions are processed directly by authorized payment gateways or restaurant POS hardware. Order Desk never stores or processes complete credit card numbers, CVVs, or bank account credentials on its servers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#2A2312]">4. Data Retention &amp; Security</h2>
          <p className="text-sm text-[#736852] leading-relaxed">
            Active dining session tokens automatically expire once the table bill is settled or closed by restaurant staff. Order archives are preserved for restaurant accounting and legal compliance in encrypted databases with strict role-based access control.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#2A2312]">5. Cookies &amp; Local Storage</h2>
          <p className="text-sm text-[#736852] leading-relaxed">
            We utilize browser localStorage solely for operational continuity (such as remembering your active cart items across page refreshes during your dining visit). We do not deploy cross-site tracking cookies.
          </p>
        </section>

        <section className="space-y-3 border-t border-[#E8DECA] pt-6">
          <h2 className="text-lg font-bold text-[#2A2312]">6. Contact &amp; Grievances</h2>
          <p className="text-sm text-[#736852] leading-relaxed">
            If you have questions regarding data privacy or wish to request data erasure for your restaurant visits, contact our privacy desk at:
          </p>
          <div className="p-3.5 bg-[#F4EFE2] rounded-xl text-xs font-mono text-[#2A2312]">
            privacy@orderdesk.io
          </div>
        </section>
      </div>
    </div>
  );
}

