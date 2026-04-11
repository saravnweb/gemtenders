/**
 * Logic for computed/derived fields in the tenders table.
 * These are "zero-cost" fields derived from existing data.
 */

export interface TenderData {
  emd_amount?: number | null;
  eligibility_msme?: boolean;
  eligibility_mii?: boolean;
  estimated_value?: number | null;
  min_turnover_lakhs?: number | null;
  startup_relaxation?: string | null;
  epbg_percentage?: number | null;
}

export function calculateVendorTags(t: TenderData): string[] {
  const tags: string[] = [];

  if (t.eligibility_msme) tags.push('msme-eligible');
  if (t.startup_relaxation && t.startup_relaxation.length > 5) tags.push('startup-eligible');
  if (t.eligibility_mii) tags.push('mii-required');
  if (t.epbg_percentage === 0) tags.push('epbg-free');

  return tags;
}

export function calculateEmdExemption(t: TenderData): boolean {
  return !!(t.eligibility_msme && t.emd_amount && t.emd_amount > 0);
}

export function calculateTurnoverBand(lakhs: number | null | undefined): string | null {
  if (lakhs === null || lakhs === undefined) return null;
  if (lakhs < 25) return '<25L';
  if (lakhs < 100) return '25L-1Cr';
  if (lakhs < 500) return '1Cr-5Cr';
  return '>5Cr';
}

export function calculateValueBand(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value < 1000000) return '<10L';
  if (value < 5000000) return '10L-50L';
  if (value < 10000000) return '50L-1Cr';
  return '>1Cr';
}

const GEM_TITLE_PREFIX = /^Custom Bid for \w+ -\s*/i;

/** True when >70% of letters are uppercase — i.e. the title was typed in ALL CAPS */
function isAllCaps(s: string): boolean {
  const letters = s.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 4) return false;
  return s.replace(/[^A-Z]/g, '').length / letters.length > 0.7;
}

/** Title-case: capitalise the first letter of every word, lowercase the rest */
function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export function normalizeTitle(title: string): string {
  let result = title.replace(GEM_TITLE_PREFIX, '').trim();
  if (isAllCaps(result)) result = toTitleCase(result);
  return result;
}

/**
 * Returns a payload of all computed fields for a given tender.
 */
export function getComputedFields(t: TenderData) {
  return {
    vendor_tags: calculateVendorTags(t),
    emd_exemption_for_msme: calculateEmdExemption(t),
    turnover_band: calculateTurnoverBand(t.min_turnover_lakhs),
    value_band: calculateValueBand(t.estimated_value),
  };
}
