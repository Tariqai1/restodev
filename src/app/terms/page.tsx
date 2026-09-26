import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms & Conditions | Order Desk',
  description: 'Terms of Service and operating agreement for Order Desk restaurant operations platform.',
};

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F2] text-[#2A2312] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6 sm:p-10 border border-[#E8DECA] shadow-sm space-y-8">
        <div className="border-b border-[#E8DECA] pb-6">
          <Link href="/" className="text-xs font-bold text-amber-700 uppercase tracking-wider hover:underline flex items-center gap-1.5 mb-3">
            <i className="fa-solid fa-arrow-left text-[10px]" /> Back to Home
          </Link>
          <h1 className="font-heading text-3xl font-extrabold text-[#2A2312] tracking-tight">
            Terms &amp; Conditions
          </h1>
          <p className="text-xs text-[#736852] mt-1">
            Last updated: September 26, 2026 • Effective Date: January 1, 2026
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#2A2312]">1. Acceptance of Terms</h2>
          <p className="text-sm text-[#736852] leading-relaxed">
            By accessing or using Order Desk (whether as a dining guest scanning a table QR code or as a restaurant operator managing staff and kitchen tickets), you agree to be bound by these Terms and Conditions and our Privacy Policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#2A2312]">2. Table Ordering &amp; Kitchen Dispatch</h2>
          <p className="text-sm text-[#736852] leading-relaxed">
            Order Desk facilitates real-time menu browsing and order dispatch directly to restaurant kitchen stations:
          </p>
          <ul className="list-disc list-inside text-sm text-[#736852] space-y-1.5 pl-2">
            <li><strong>Order Confirmation:</strong> An order placed through the table portal constitutes an offer to purchase food and beverage items from the respective restaurant.</li>
            <li><strong>Captain Review:</strong> Restaurant floor captains retain the authority to verify, modify, or approve orders before firing tickets to the kitchen stoves.</li>
            <li><strong>Item Availability:</strong> Menu items, preparation times, and dish customizations are managed by the restaurant and subject to kitchen availability.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#2A2312]">3. Pricing, Discounts &amp; Taxes</h2>
          <p className="text-sm text-[#736852] leading-relaxed">
            All prices displayed in digital menus are set by the restaurant establishment. Prices are subject to applicable goods and services taxes (CGST/SGST) as mandated by local tax regulations. Promotional offers and table discounts apply solely according to the minimum spend conditions set by the venue.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#2A2312]">4. Cancellations &amp; Modifications</h2>
          <p className="text-sm text-[#736852] leading-relaxed">
            Because food items are freshly prepared to order upon kitchen confirmation, cancellation requests must be communicated immediately to table staff or floor captains. Once preparation begins in the kitchen, orders cannot be canceled through the digital interface.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#2A2312]">5. Operator Responsibilities</h2>
          <p className="text-sm text-[#736852] leading-relaxed">
            Restaurant owners and staff accounts are responsible for maintaining the accuracy of menu pricing, allergen warnings, food preparation times, and staff access PINs.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#2A2312]">6. Limitation of Liability</h2>
          <p className="text-sm text-[#736852] leading-relaxed">
            Order Desk provides the software infrastructure. The physical preparation, hygiene, safety, quality, and delivery of food items remain the sole responsibility of the operating restaurant. Order Desk is not liable for food allergens, preparation delays, or payment discrepancies between diners and restaurants.
          </p>
        </section>

        <section className="space-y-3 border-t border-[#E8DECA] pt-6">
          <h2 className="text-lg font-bold text-[#2A2312]">7. Governing Law &amp; Inquiries</h2>
          <p className="text-sm text-[#736852] leading-relaxed">
            These terms are governed by the laws of India. For commercial inquiries, licensing, or legal correspondence, contact:
          </p>
          <div className="p-3.5 bg-[#F4EFE2] rounded-xl text-xs font-mono text-[#2A2312]">
            legal@orderdesk.io
          </div>
        </section>
      </div>
    </div>
  );
}

