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
