# GeMTenders.org

GeMTenders.org is an AI-powered portal designed to simplify finding and tracking bids on India's Government e-Marketplace (GeM) portal. By leveraging AI to summarize large tender documents and a powerful search engine, GeMTenders.org allows businesses to effortlessly find the right tenders without downloading and reading through massive PDF attachments.

## Features
- **Smart Filtering:** Find tenders by keyword, city, state, or ministry instantly.
- **AI Summaries:** Every tender is summarized natively using AI for easy scanning.
- **Automated Alerts:** Get notified when a tender matching your criteria goes live.

## Tech Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS / Custom Tokens
- **Database Backend:** Supabase (PostgreSQL)
- **Deployment:** Vercel

## How to Run Locally

1. **Clone the repository:**
   ```bash
   git clone <repo_url>
   cd Tenders
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env.local` file in the root directory and add the following required environment variables:
   ```env
   # Supabase Setup
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # AI Integration
   GEMINI_API_KEY=your_gemini_api_key

   # Google Authentication
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_auth_client_id
   
   # External Integrations (Optional for pure viewing)
   NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_secret
   SMTP_HOST=your_smtp_host
   SMTP_PORT=your_smtp_port
   SMTP_USER=your_smtp_user
   SMTP_PASS=your_smtp_pass
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open locally:** 
   Visit `http://localhost:3000` to view the application.

## Scraping & Enrichment
To test the scraping and enrichment pipeline:
- Scrape: `npm run crawl`
- Process PDFs & Summarize: `npm run enrich`

*Data is sourced from the official Government e-Marketplace (gem.gov.in).*
