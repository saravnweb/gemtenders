import { City, State } from 'country-state-city';

// Canonical set of all Indian states and UTs
export const INDIAN_STATES = new Set([
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union Territories
  'Andaman And Nicobar', 'Chandigarh', 'Dadra And Nagar Haveli And Daman And Diu',
  'Delhi', 'Jammu And Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]);

export function normalizeState(state: string | null | undefined): string | null {
  if (!state || state.trim() === "") return null;
  const s = state.trim().toLowerCase().replace(/[\.\,]/g, '').replace(/\s+state$/, '');

  const map: Record<string, string> = {
    'ap': 'Andhra Pradesh', 'andhrapradesh': 'Andhra Pradesh', 'andhra pradesh': 'Andhra Pradesh',
    'arunachal pradesh': 'Arunachal Pradesh', 'arunachalpradesh': 'Arunachal Pradesh',
    'assam': 'Assam',
    'bihar': 'Bihar',
    'chhattisgarh': 'Chhattisgarh', 'cg': 'Chhattisgarh',
    'goa': 'Goa',
    'gujarat': 'Gujarat', 'gj': 'Gujarat',
    'haryana': 'Haryana', 'hr': 'Haryana',
    'himachal pradesh': 'Himachal Pradesh', 'hp': 'Himachal Pradesh', 'shimla': 'Himachal Pradesh',
    'jharkhand': 'Jharkhand',
    'jammu kashmir': 'Jammu And Kashmir', 'jammu & kashmir': 'Jammu And Kashmir', 'jammu and kashmir': 'Jammu And Kashmir', 'j&k': 'Jammu And Kashmir', 'j k': 'Jammu And Kashmir',
    'karnataka': 'Karnataka', 'ka': 'Karnataka',
    'kerala': 'Kerala', 'kl': 'Kerala',
    'madhya pradesh': 'Madhya Pradesh', 'mp': 'Madhya Pradesh',
    'maharashtra': 'Maharashtra', 'mh': 'Maharashtra',
    'manipur': 'Manipur',
    'meghalaya': 'Meghalaya',
    'mizoram': 'Mizoram',
    'nagaland': 'Nagaland',
    'odisha': 'Odisha', 'orissa': 'Odisha', 'or': 'Odisha',
    'punjab': 'Punjab', 'pb': 'Punjab',
    'rajasthan': 'Rajasthan', 'rj': 'Rajasthan',
    'sikkim': 'Sikkim', 'sk': 'Sikkim',
    'tamil nadu': 'Tamil Nadu', 'tamilnadu': 'Tamil Nadu', 'tn': 'Tamil Nadu',
    'telangana': 'Telangana', 'ts': 'Telangana', 'tg': 'Telangana',
    'tripura': 'Tripura', 'tr': 'Tripura',
    'uttar pradesh': 'Uttar Pradesh', 'up': 'Uttar Pradesh',
    'uttarakhand': 'Uttarakhand', 'uk': 'Uttarakhand',
    'west bengal': 'West Bengal', 'wb': 'West Bengal',
    'delhi': 'Delhi', 'new delhi': 'Delhi', 'nct of delhi': 'Delhi',
    'puducherry': 'Puducherry', 'py': 'Puducherry', 'pondicherry': 'Puducherry',
    'chandigarh': 'Chandigarh', 'ch': 'Chandigarh',
    'ladakh': 'Ladakh',
    'andamannicobar': 'Andaman And Nicobar', 'andaman and nicobar': 'Andaman And Nicobar', 'south andaman': 'Andaman And Nicobar',
  };

  const clean = s.replace(/\s+/g, ' ').trim();
  if (map[clean]) return map[clean];

  for (const [key, val] of Object.entries(map)) {
      if (clean === key) {
         return val;
      }

      // Ensure that we only match the abbreviation as a distinct word
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const safeRegex = new RegExp(`\\b${escapedKey}\\b`, 'i');
      if (safeRegex.test(clean) || key.includes(clean.length > 5 ? clean : "----")) {
         return val;
      }
  }

  return state.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim();
}

export function normalizeCity(city: string | null | undefined): string | null {
   if (!city || city.trim() === "N/A" || city.trim() === "") return null;
   // Strip leading/trailing asterisks (e.g. "***Hoshangabad" → "Hoshangabad")
   const c = city.trim().replace(/^\*+/, '').replace(/\*+$/, '').trim();
   if (!c || c === "N/A") return null;
   return c.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim();
}

// Infer Indian state from a city name using country-state-city data.
// Returns a state ONLY when all DB entries for that city name agree on the same state.
// Returns null if the city is unknown OR if it appears in multiple different states (ambiguous).
const _inCities = City.getCitiesOfCountry('IN') || [];
export function cityToState(city: string | null | undefined): string | null {
  if (!city) return null;
  const needle = city.trim().toLowerCase();
  const matches = _inCities.filter(c => c.name.toLowerCase() === needle);
  if (!matches.length) return null;

  const states = new Set<string>();
  for (const m of matches) {
    const s = State.getStateByCodeAndCountry(m.stateCode, 'IN');
    const normalized = s ? normalizeState(s.name) : null;
    if (normalized) states.add(normalized);
  }

  // Only return a state if all matches agree (unambiguous)
  if (states.size === 1) return [...states][0];
  return null; // city exists in multiple states — can't determine definitively
}

// ── Strict City Validation ──
const INDIAN_CITIES = City.getCitiesOfCountry('IN') || [];
// Sort by length so longer names like "Navi Mumbai" match before "Mumbai"
const SORTED_CITIES = [...INDIAN_CITIES].sort((a, b) => b.name.length - a.name.length);

export function extractVerifiedCity(text: string | null | undefined): string | null {
  if (!text || text.trim() === "N/A" || text.trim() === "") return null;
  const t = text.replace(/[\r\n]+/g, ' '); // Strip newlines so regex doesn't break

  for (const c of SORTED_CITIES) {
    // Avoid matching tiny 2-letter tokens falsely
    if (c.name.length <= 2) continue;

    const safeRegex = new RegExp('\\b' + c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (safeRegex.test(t)) {
      return c.name;
    }
  }
  return null;
}

// ── PIN Code → State ──
// Maps first 2 digits (with some 3-digit overrides) of Indian PIN code to state.
const PIN3_MAP: Record<string, string> = {
  '248': 'Uttarakhand', '249': 'Uttarakhand', '246': 'Uttarakhand', '247': 'Uttarakhand',
  '263': 'Uttarakhand', '244': 'Uttarakhand', '243': 'Uttar Pradesh',
  '500': 'Telangana', '501': 'Telangana', '502': 'Telangana', '503': 'Telangana',
  '504': 'Telangana', '505': 'Telangana', '506': 'Telangana', '507': 'Telangana', '508': 'Telangana',
  '515': 'Andhra Pradesh', '516': 'Andhra Pradesh', '517': 'Andhra Pradesh', '518': 'Andhra Pradesh',
  '532': 'Andhra Pradesh', '533': 'Andhra Pradesh', '534': 'Andhra Pradesh', '535': 'Andhra Pradesh',
  '605': 'Puducherry', '607': 'Puducherry', '608': 'Puducherry',
  '682': 'Kerala', '683': 'Kerala', '686': 'Kerala', '688': 'Kerala',
  '689': 'Kerala', '690': 'Kerala', '691': 'Kerala', '695': 'Kerala',
  '751': 'Odisha', '752': 'Odisha', '753': 'Odisha', '754': 'Odisha',
  '755': 'Odisha', '756': 'Odisha', '757': 'Odisha', '758': 'Odisha', '759': 'Odisha',
  '795': 'Manipur', '796': 'Mizoram', '797': 'Nagaland',
  '798': 'Arunachal Pradesh', '790': 'Arunachal Pradesh', '791': 'Arunachal Pradesh', '792': 'Arunachal Pradesh',
  '793': 'Meghalaya', '794': 'Meghalaya',
  '799': 'Tripura',
  '831': 'Jharkhand', '832': 'Jharkhand', '833': 'Jharkhand', '834': 'Jharkhand', '835': 'Jharkhand',
};
const PIN2_MAP: Record<string, string> = {
  '11': 'Delhi',
  '12': 'Haryana', '13': 'Haryana',
  '14': 'Punjab', '15': 'Punjab', '16': 'Chandigarh',
  '17': 'Himachal Pradesh',
  '18': 'Jammu And Kashmir', '19': 'Jammu And Kashmir',
  '20': 'Uttar Pradesh', '21': 'Uttar Pradesh', '22': 'Uttar Pradesh',
  '23': 'Uttar Pradesh', '24': 'Uttar Pradesh', '25': 'Uttar Pradesh',
  '26': 'Uttar Pradesh', '27': 'Uttar Pradesh', '28': 'Uttar Pradesh',
  '30': 'Rajasthan', '31': 'Rajasthan', '32': 'Rajasthan', '33': 'Rajasthan', '34': 'Rajasthan',
  '36': 'Gujarat', '37': 'Gujarat', '38': 'Gujarat', '39': 'Gujarat',
  '40': 'Maharashtra', '41': 'Maharashtra', '42': 'Maharashtra', '43': 'Maharashtra', '44': 'Maharashtra',
  '45': 'Madhya Pradesh', '46': 'Madhya Pradesh', '47': 'Madhya Pradesh', '48': 'Madhya Pradesh',
  '49': 'Chhattisgarh',
  '50': 'Telangana', '51': 'Telangana', '52': 'Andhra Pradesh', '53': 'Andhra Pradesh',
  '56': 'Karnataka', '57': 'Karnataka', '58': 'Karnataka', '59': 'Karnataka',
  '60': 'Tamil Nadu', '61': 'Tamil Nadu', '62': 'Tamil Nadu', '63': 'Tamil Nadu',
  '64': 'Tamil Nadu', '65': 'Tamil Nadu', '66': 'Tamil Nadu',
  '67': 'Kerala', '68': 'Kerala', '69': 'Kerala',
  '70': 'West Bengal', '71': 'West Bengal', '72': 'West Bengal', '73': 'West Bengal', '74': 'West Bengal',
  '75': 'Odisha', '76': 'Odisha', '77': 'Odisha',
  '78': 'Assam', '79': 'Assam',
  '80': 'Bihar', '81': 'Bihar', '82': 'Bihar', '83': 'Bihar', '84': 'Bihar', '85': 'Bihar',
};

export function pinToState(pin: string): string | null {
  if (!pin || pin.length < 6) return null;
  const p3 = pin.substring(0, 3);
  const p2 = pin.substring(0, 2);
  return PIN3_MAP[p3] || PIN2_MAP[p2] || null;
}

// ── Consignee Table City/State Extraction ──
// Finds the "Consignees/Reporting Officer and Quantity" table section in PDF text
// and extracts city and state from the Address column using multiple strategies.
export function extractCityStateFromConsigneeTable(
  fullText: string | null | undefined
): { city: string | null; state: string | null } {
  const empty = { city: null, state: null };
  if (!fullText) return empty;

  // Find consignee section — look for the table header keywords
  const sectionIdx = fullText.search(/consign|reporting\s+officer/i);
  const section = sectionIdx >= 0
    ? fullText.substring(sectionIdx, sectionIdx + 3000)
    : fullText; // fall back to full text if header not found

  let city: string | null = null;
  let state: string | null = null;

  // Strategy A: Masked pattern like "**********MEDAK" or "**********Mumbai"
  // Greedy match stops at tab/pipe/digit/newline (table cell boundaries)
  const maskedMatch = section.match(/\*{3,}([A-Za-z][A-Za-z\s\-]{2,40})(?=\s*[\d\n\r\t|]|\s*$)/m);
  if (maskedMatch) {
    const candidate = maskedMatch[1].trim();
    city = extractVerifiedCity(candidate) || normalizeCity(candidate);
    if (city) state = cityToState(city);
  }

  // Strategy B: "Dist-Navsari" or "District Alwar" or "Ta-Chikhli Dist-Navsari"
  if (!city) {
    const distMatch = section.match(/(?:Dist(?:rict)?|Distt)[-\s]+([A-Za-z][A-Za-z\s\-]{2,30}?)(?=\s*(?:Pin|P\.?O|$|\n|\d))/i);
    if (distMatch) {
      const candidate = distMatch[1].trim().replace(/\s+/g, ' ');
      city = extractVerifiedCity(candidate) || normalizeCity(candidate);
      if (city) state = cityToState(city);
    }
  }

  // Strategy C: PIN code → state, then try to find city in same address text
  if (!state) {
    const pinMatch = section.match(/\b(\d{6})\b/);
    if (pinMatch) {
      state = pinToState(pinMatch[1]);
      if (!city) {
        // Look for city near the PIN code (within ±100 chars)
        const pinIdx = section.indexOf(pinMatch[1]);
        const nearby = section.substring(Math.max(0, pinIdx - 100), pinIdx + 100);
        city = extractVerifiedCity(nearby);
      }
    }
  }

  // Strategy E: PIN code at the very start of an address field (e.g. "400074,RCF Ltd...")
  // Handles cases where Strategy C's \b(\d{6})\b finds a mid-text PIN but misses a leading one
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

  // Strategy D: Last resort — scan the whole section for any known Indian city
  if (!city) {
    city = extractVerifiedCity(section);
    if (city && !state) state = cityToState(city);
  }

  return { city: city || null, state: state || null };
}
