export interface Tender {
  id: string;
  bid_number: string;
  slug: string;
  title: string;
  department: string;
  start_date: string;
  end_date: string;
  opening_date: string | null;
  quantity: number;
  pdf_url: string | null;
  details_url: string;
  ai_summary: string | null;
  emd_amount: number | null;
  eligibility_msme: boolean;
  eligibility_mii: boolean;
  is_archived: boolean;
  archived_at: string | null;
  notification_sent: boolean;
  ra_number: string | null;
  ra_end_date: string | null;
  ra_notified: boolean;
  is_indexed: boolean;
  indexed_at: string | null;
  created_at: string;
}
