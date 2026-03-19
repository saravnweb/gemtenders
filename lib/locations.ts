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
      if (clean === key || clean.includes(key) || key.includes(clean.length > 5 ? clean : "----")) {
         return val;
      }
  }

  return state.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim();
}

export function normalizeCity(city: string | null | undefined): string | null {
   if (!city || city.trim() === "N/A" || city.trim() === "") return null;
   const c = city.trim();
   return c.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim();
}
