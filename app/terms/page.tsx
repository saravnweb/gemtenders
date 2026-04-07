import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | GeMTenders.org',
  description: 'Terms of Service for GeMTenders.org. Read our usage terms, subscription policy, and governing law.',
};

export default function TermsPage() {
  return (
    <main id="main-content" className="max-w-4xl mx-auto py-16 px-4 sm:px-6 lg:px-8 bg-white dark:bg-background mt-10 rounded-xl shadow-sm border border-slate-100 dark:border-border">
      <h1 className="text-3xl font-bricolage font-black text-slate-900 dark:text-foreground mb-6 tracking-tight">Terms of Service</h1>

      <div className="prose dark:prose-invert text-slate-600 dark:text-muted-foreground">
        <p className="mb-4">
          Last updated: April 2025. By accessing or using GeMTenders.org you agree to be bound by these Terms of Service.
          If you do not agree, please discontinue use of this site immediately.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-foreground">1. Acceptance of Terms</h2>
        <p className="mb-4">
          These Terms constitute a legally binding agreement between you and MW Content Studio, the operator of GeMTenders.org.
          We reserve the right to update these Terms at any time. Continued use of the service after any update constitutes
          acceptance of the revised Terms.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-foreground">2. Use of Service</h2>
        <p className="mb-4">
          GeMTenders.org aggregates publicly available tender data from India's Government e-Marketplace (GeM) for informational
          purposes. You may use this service for lawful, personal or professional research. You may not reproduce, redistribute,
          or resell the aggregated data in bulk without prior written consent.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-foreground">3. Subscription &amp; Payments</h2>
        <p className="mb-4">
          Paid plans are billed in Indian Rupees (INR) through Razorpay, a PCI-DSS compliant payment gateway. By subscribing
          you authorise Razorpay to charge your selected payment method on the agreed billing cycle.
        </p>
        <p className="mb-4">
          <strong>No refunds.</strong> All subscription fees are non-refundable once a billing period has commenced. If you cancel
          your subscription, access continues until the end of the current paid period and will not renew thereafter. In the event
          of a demonstrable billing error on our part, please contact us within 7 days and we will investigate.
        </p>
        <p className="mb-4">
          We reserve the right to change pricing with 30 days' notice. Continued use after a price change takes effect constitutes
          acceptance of the new pricing.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-foreground">4. Data Usage</h2>
        <p className="mb-4">
          Tender data displayed on GeMTenders.org is sourced from gem.gov.in and is subject to GeM's own terms. We make no
          warranties as to the accuracy, completeness, or timeliness of the data. You should always verify critical information
          directly on the official GeM portal before acting on it.
        </p>
        <p className="mb-4">
          Account information (email, subscription status) is stored securely in Supabase and is never sold to third parties.
          Please refer to our <a href="/privacy" className="underline hover:text-slate-900 dark:hover:text-white">Privacy Policy</a> for
          full details.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-foreground">5. Prohibited Uses</h2>
        <p className="mb-4">You agree not to:</p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          <li>Scrape, crawl, or bulk-download data from GeMTenders.org in a manner that places excessive load on our servers</li>
          <li>Use the service to build a competing product without written permission</li>
          <li>Attempt to circumvent authentication, rate limits, or payment gates</li>
          <li>Use the service for any purpose that violates applicable Indian law</li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-foreground">6. Limitation of Liability</h2>
        <p className="mb-4">
          GeMTenders.org is provided &ldquo;as is&rdquo; without warranties of any kind, express or implied. To the fullest extent
          permitted by law, MW Content Studio shall not be liable for any indirect, incidental, special, or consequential damages
          arising out of your use of, or inability to use, this service — including but not limited to missed tender deadlines,
          loss of business opportunity, or data inaccuracies.
        </p>
        <p className="mb-4">
          Our total aggregate liability for any claim related to this service shall not exceed the amount you paid us in the
          three months preceding the claim.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-foreground">7. Governing Law &amp; Jurisdiction</h2>
        <p className="mb-4">
          These Terms are governed by the laws of India. Any disputes arising out of or in connection with these Terms shall be
          subject to the exclusive jurisdiction of the courts located in Tamil Nadu, India.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-foreground">8. Contact</h2>
        <p className="mb-4">
          For questions about these Terms, billing disputes, or account issues, please contact us at{' '}
          <a href="mailto:support@gemtenders.org" className="underline hover:text-slate-900 dark:hover:text-white">
            support@gemtenders.org
          </a>.
        </p>
      </div>
    </main>
  );
}
