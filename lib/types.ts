export interface Tender {
  id: string;
  bid_number: string;
  slug: string;
  title: string;
  department: string;
  start_date: string;
  end_date: string;
  quantity: number;
  pdf_url: string | null;
  details_url: string;
  ai_summary: string | null;
  emd_amount: number | null;
  eligibility_msme: boolean;
  eligibility_mii: boolean;
  is_archived: boolean;
  created_at: string;
}
