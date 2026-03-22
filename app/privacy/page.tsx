import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for GeMTenders.org. Learn how we handle information responsibly.',
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className="max-w-4xl mx-auto py-16 px-4 sm:px-6 lg:px-8 bg-white dark:bg-zinc-950 mt-10 rounded-xl shadow-sm border border-slate-100 dark:border-zinc-800">
      <h1 className="text-3xl font-bricolage font-black text-slate-900 dark:text-white mb-6 tracking-tight">Privacy Policy</h1>
      
      <div className="prose dark:prose-invert text-slate-600 dark:text-slate-400">
        <p className="mb-4">
          Welcome to GeMTenders.org. This Privacy Policy outlines our practices regarding information collected through our website.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-white">Data Sourcing and Personal Information</h2>
        <p className="mb-4">
          GeMTenders.org aggregates publicly available tender data from India's Government e-Marketplace (gem.gov.in).
          Our site does not require user login to access public tender searches and we do not collect or store personal data 
          related to your general browsing without explicit consent.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-white">Information We Do Not Collect</h2>
        <p className="mb-4">
          For public search and browsing, GeMTenders.org does not track, store, or sell identifiable personal markers, financial 
          credentials, or any sensitive individual profiles.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-white">Third-Party Links</h2>
        <p className="mb-4">
          Our website contains links to external sites (such as gem.gov.in) for viewing official tender documents. 
          Please be aware that we are not responsible for the content or privacy practices of such other sites.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-white">Updates to This Policy</h2>
        <p className="mb-4">
          We may update this Privacy Policy from time to time. We encourage visitors to frequently check this page 
          for any changes. Your continued use of this site after any change in this Privacy Policy will constitute 
          your acceptance of such change.
        </p>
      </div>
    </main>
  );
}
