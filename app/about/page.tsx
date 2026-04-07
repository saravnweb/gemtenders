import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About | GeMTenders.org',
  description: 'Learn more about how GeMTenders.org uses AI to help you track Government e-Marketplace (GeM) tenders in India easily.',
};

export default function AboutPage() {
  return (
    <main id="main-content" className="max-w-4xl mx-auto py-16 px-4 sm:px-6 lg:px-8 bg-white dark:bg-background mt-10 rounded-xl shadow-sm border border-slate-100 dark:border-border">
      <h1 className="text-3xl font-bricolage font-black text-slate-900 dark:text-foreground mb-6 tracking-tight">About GeMTenders.org</h1>
      
      <div className="prose dark:prose-invert text-slate-600 dark:text-muted-foreground">
        <p className="mb-6 text-lg">
          GeMTenders.org is an innovative AI-powered tool specifically built to help businesses discover and track Government e-Marketplace (GeM) portal tenders in India effortlessly.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-foreground">Our Mission</h2>
        <p className="mb-4">
          Navigating public procurement portals can be overwhelming due to the sheer volume of bids. 
          Our mission is to democratize access to GeM tenders by organizing scattered bid information. 
          We use artificial intelligence to extract summaries, structure requirements, and filter tenders so 
          you only see the bidding opportunities relevant to your business.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-foreground">AI-Powered Features</h2>
        <ul className="list-disc leading-relaxed mt-2 pl-5 space-y-2 mb-6">
          <li><strong>Keyword Tracking:</strong> Instantly filter bids containing the exact phrases central to your organization.</li>
          <li><strong>AI Summaries:</strong> Instead of downloading huge PDFs, quickly read a 1-sentence AI-generated breakdown of the actual tender requirement.</li>
          <li><strong>Real-time Notifications:</strong> Get email and WhatsApp alerts the moment a bid matching your profile is published on GeM.</li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-foreground">Who Built This</h2>
        <p className="mb-4">
          GeMTenders.org is built and maintained by a solo founder based in India. The goal is simple: make India&apos;s public procurement data more accessible to the businesses and vendors who need it most, without the noise of navigating the official portal directly.
        </p>

        <h2 className="text-xl font-bold mt-8 mb-4 text-slate-800 dark:text-foreground">Contact Us</h2>
        <p className="mb-4">
          For inquiries about our tracking platform, reporting issues, or feature requests, contact us below:
        </p>
        <p className="mb-4">
          <strong>Email: </strong> <a href="mailto:contact@gemtenders.org" className="text-blue-600 hover:underline">contact@gemtenders.org</a>
        </p>

        <hr className="my-8 border-slate-200 dark:border-border" />
        
        <p className="text-sm">
          <strong>Disclaimer: </strong>GeMTenders.org aggregates publicly available data from India's Government e-Marketplace (gem.gov.in).
          We are an independent SaaS platform and are <strong>not affiliated with the Government of India</strong>. We strive to provide the most accurate details, but you should always refer back to the official gem.gov.in site for bidding.
        </p>
      </div>
    </main>
  );
}
