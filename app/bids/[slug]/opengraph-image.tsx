import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Image metadata
export const alt = 'GeMTenders.org — Tender Details';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image({ params }: { params: { slug: string } }) {
  const { slug } = await params;

  // Fetch tender data from Supabase
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenders?slug=eq.${slug}&select=title,ministry_name,department_name,end_date,emd_amount,bid_number&limit=1`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    }
  );

  const data = await res.json();
  const tender = data && data.length > 0 ? data[0] : null;

  if (!tender) {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
            fontSize: 32,
            fontWeight: 600,
          }}
        >
          Tender Not Found
        </div>
      ),
      { ...size }
    );
  }

  const formattedDate = new Date(tender.end_date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedEMD = tender.emd_amount === 0
    ? "No EMD"
    : tender.emd_amount
      ? `₹${new Intl.NumberFormat('en-IN').format(tender.emd_amount)}`
      : "See Document";

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a', // slate-900
          backgroundImage: 'radial-gradient(circle at 25% 25%, #1e293b 0%, #0f172a 100%)',
          padding: '40px 60px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Decorative elements */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'rgba(79, 70, 229, 0.1)',
            filter: 'blur(60px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -50,
            left: -50,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(124, 58, 237, 0.1)',
            filter: 'blur(50px)',
          }}
        />

        {/* Header Branding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginBottom: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              GeMTenders<span style={{ color: '#818cf8' }}>.org</span>
            </div>
          </div>
          <div
            style={{
              padding: '8px 16px',
              borderRadius: 30,
              backgroundColor: 'rgba(79, 70, 229, 0.2)',
              border: '1px solid rgba(79, 70, 229, 0.3)',
              color: '#a5b4fc',
              fontSize: 16,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Live Tender Tracking
          </div>
        </div>

        {/* Main Title Section */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#818cf8',
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
             Bid No: {tender.bid_number}
          </div>
          <div
            style={{
              fontSize: 60,
              fontWeight: 800,
              color: '#fff',
              lineHeight: 1.1,
              marginBottom: 20,
              display: 'flex',
            }}
          >
            {tender.title.length > 95 ? tender.title.substring(0, 95) + '...' : tender.title}
          </div>
        </div>

        {/* Footer Info Section */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingTop: 20,
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 16, color: '#94a3b8', marginBottom: 4 }}>Department / Ministry</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#fff', maxWidth: 600 }}>
              {tender.ministry_name || tender.department_name || 'Government of India'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 40 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ fontSize: 16, color: '#94a3b8', marginBottom: 4 }}>EMD Amount</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#6366f1' }}>{formattedEMD}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ fontSize: 16, color: '#94a3b8', marginBottom: 4 }}>Last Date</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#f87171' }}>{formattedDate}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
