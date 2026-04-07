import { City, State } from 'country-state-city';
export * from './locations-client';
import { normalizeState, normalizeCity, pinToState } from './locations-client';

// NOTE: These functions use 'country-state-city' which is a large data library.
// Do NOT import these functions in client-side components to keep the bundle size small.

let _inCitiesCache: any[] | null = null;
function getInCities() {
    if (!_inCitiesCache) {
        _inCitiesCache = City.getCitiesOfCountry('IN') || [];
    }
    return _inCitiesCache;
}

let _sortedCitiesCache: any[] | null = null;
function getSortedCities() {
    if (!_sortedCitiesCache) {
        _sortedCitiesCache = [...getInCities()].sort((a, b) => b.name.length - a.name.length);
    }
    return _sortedCitiesCache;
}

export function cityToState(city: string | null | undefined): string | null {
  if (!city) return null;
  const needle = city.trim().toLowerCase();
  const matches = getInCities().filter(c => c.name.toLowerCase() === needle);
  if (!matches.length) return null;

  const states = new Set<string>();
  for (const m of matches) {
    const s = State.getStateByCodeAndCountry(m.stateCode, 'IN');
    const normalized = s ? normalizeState(s.name) : null;
    if (normalized) states.add(normalized);
  }

  if (states.size === 1) return [...states][0];
  return null;
}

export function extractVerifiedCity(text: string | null | undefined): string | null {
  if (!text || text.trim() === "N/A" || text.trim() === "") return null;
  const t = text.replace(/[\r\n]+/g, ' ');

  for (const c of getSortedCities()) {
    if (c.name.length <= 2) continue;
    const safeRegex = new RegExp('\\b' + c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (safeRegex.test(t)) {
      return c.name;
    }
  }
  return null;
}

export function extractCityStateFromConsigneeTable(
  fullText: string | null | undefined
): { city: string | null; state: string | null } {
  const empty = { city: null, state: null };
  if (!fullText) return empty;

  const preciseIdx = fullText.search(/Consignees\s*\/\s*Reporting\s+Officer\s+and\s+Quantity/i);
  const looseIdx   = fullText.search(/Consignees\s*[\/|]\s*Reporting\s+Officer/i);
  const sectionIdx = preciseIdx >= 0 ? preciseIdx : looseIdx;
  const section = sectionIdx >= 0
    ? fullText.substring(sectionIdx, sectionIdx + 3000)
    : fullText;

  let city: string | null = null;
  let state: string | null = null;

  const maskedMatch = section.match(/\*{3,}([A-Za-z][A-Za-z\s\-]{2,40})(?=\s*[\d\n\r\t|]|\s*$)/m);
  if (maskedMatch) {
    const candidate = maskedMatch[1].trim();
    city = extractVerifiedCity(candidate) || normalizeCity(candidate);
    if (city) state = cityToState(city);
  }

  if (!city) {
    const distMatch = section.match(/(?:Dist(?:rict)?|Distt)[-\s]+([A-Za-z][A-Za-z\s\-]{2,30}?)(?=\s*(?:Pin|P\.?O|$|\n|\d))/i);
    if (distMatch) {
      const candidate = distMatch[1].trim().replace(/\s+/g, ' ');
      city = extractVerifiedCity(candidate) || normalizeCity(candidate);
      if (city) state = cityToState(city);
    }
  }

  if (!state) {
    const pinMatch = section.match(/\b(\d{6})\b/);
    if (pinMatch) {
      state = pinToState(pinMatch[1]);
      if (!city) {
        const pinIdx = section.indexOf(pinMatch[1]);
        const nearby = section.substring(Math.max(0, pinIdx - 100), pinIdx + 100);
        city = extractVerifiedCity(nearby);
      }
    }
  }

  if (!state) {
    const leadingPinMatch = section.match(/(?:^|\n)\s*(\d{6})\s*[,\s]/m);
    if (leadingPinMatch) {
      state = pinToState(leadingPinMatch[1]);
      if (!city) {
        const pinPos = section.indexOf(leadingPinMatch[1]);
        const afterPin = section.substring(pinPos + 6, pinPos + 200);
        city = extractVerifiedCity(afterPin);
      }
    }
  }

  if (!city) {
    city = extractVerifiedCity(section);
    if (city && !state) state = cityToState(city);
  }

  return { city: city || null, state: state || null };
}
