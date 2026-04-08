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
  const s = state.trim().toLowerCase()
    .replace(/[\.\,]/g, '')
    .replace(/\s+islands?$/i, '')
    .replace(/\s+state$/i, '')
    .trim();

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

// Canonical city name aliases — maps any variant (lowercased) → canonical form.
// ONLY confirmed duplicates from the live DB are listed here.
// Empty string = junk value → returned as null.
//
// PROOF: Duplicates identified by querying all active tenders grouped by lowercase city name.
// Each group below shows: DB variants → canonical
const CITY_ALIASES: Record<string, string> = {

  // ── Junk / non-city values ────────────────────────────────────────────────
  'null': '',
  'n/a': '',
  'na': '',
  'not specified in the document': '',
  'not specified': '',
  'not available': '',
  'not explicitly mentioned': '',
  'court complex': '',
  'block development office tejwapur': '',
  'bihar state office': '',
  'manendragarh-chirmiri-bharatpur': '',
  'west': '',        // raw "West" stored as city in some tenders
  'gujarat': '',     // state stored as city
  'assam': '',       // state stored as city
  'ladakh': '',      // UT stored as city
  'lakshadweep': '', // UT stored as city

  // ── CONFIRMED DUPLICATES FROM DB ─────────────────────────────────────────

  // Bengaluru | "Bangalore"(495) + "BANGALORE" + "Bengaluru" + "Bangalore City"(38)
  'bangalore': 'Bengaluru',
  'bengaluru': 'Bengaluru',
  'bangalore city': 'Bengaluru',

  // Dehradun
  'dehradun': 'Dehradun',

  // Narmadapuram | "Hoshangabad" + "HOSHANGABAD" + "Narmadapuram"
  'hoshangabad': 'Narmadapuram',
  'narmadapuram': 'Narmadapuram',

  // Jamnagar
  'jamnagar': 'Jamnagar',

  // Lucknow
  'lucknow': 'Lucknow',

  // Mumbai
  'mumbai': 'Mumbai',

  // Pune | "Pune" + "PUNE" + "Pune City"(1)
  'pune': 'Pune',
  'pune city': 'Pune',

  // Rajouri | "Rajouri"(16) + "Rajauri"(29) + "RAJAURI" — official spelling is Rajouri (J&K govt)
  'rajauri': 'Rajouri',
  'rajouri': 'Rajouri',

  // Tiruchirappalli | "Tiruchirappalli" + "TIRUCHIRAPPALLI" + "Trichy"(11) + "Tiruchirapalli"(4) + "Thiruchirapalli"(1)
  'tiruchirappalli': 'Tiruchirappalli',
  'tiruchirapalli': 'Tiruchirappalli',
  'thiruchirapalli': 'Tiruchirappalli',
  'trichy': 'Tiruchirappalli',

  // Tiruvallur | "Tiruvallur" + "Thiruvallur"
  'thiruvallur': 'Tiruvallur',
  'tiruvallur': 'Tiruvallur',

  // Visakhapatnam | "Visakhapatnam" + "Vishakhapatnam"
  'vishakhapatnam': 'Visakhapatnam',
  'visakhapatnam': 'Visakhapatnam',

  // Ernakulam | "Ernakulam" + "Eranakulam" + "Ernakulam City"(7) + "Cochin"(10)
  'eranakulam': 'Ernakulam',
  'ernakulam': 'Ernakulam',
  'ernakulam city': 'Ernakulam',
  'cochin': 'Ernakulam',  // Cochin = Ernakulam city area

  // Kochi | Kochi is the preferred modern name for the Cochin metro
  'kochi': 'Kochi',

  // Khurda | "Khurda" + "Khordha" + "Khurda (khordha)"
  'khordha': 'Khurda',
  'khurda': 'Khurda',
  'khurda (khordha)': 'Khurda',

  // Sundargarh
  'sundargarh': 'Sundargarh',
  'sundergarh': 'Sundargarh',

  // Bokaro | "Bokaro" + "Bokaro Steel City"
  'bokaro steel city': 'Bokaro',
  'bokaro': 'Bokaro',

  // Bardhaman | "Bardhaman" + "Burdwan"
  'burdwan': 'Bardhaman',
  'bardhaman': 'Bardhaman',

  // Paschim Bardhaman | "Paschim Burdwan"(7) + "Paschim Bardhaman"(1)
  'paschim burdwan': 'Paschim Bardhaman',
  'paschim bardhaman': 'Paschim Bardhaman',

  // Ferozepur | "Ferozepur" + "Firozpur"
  'ferozepur': 'Ferozepur',
  'firozpur': 'Ferozepur',

  // Bulandshahr | "Bulandshahr" + "Bulandshahar"
  'bulandshahar': 'Bulandshahr',
  'bulandshahr': 'Bulandshahr',

  // Chittorgarh | "Chittorgarh" + "Chittaurgarh"
  'chittaurgarh': 'Chittorgarh',
  'chittorgarh': 'Chittorgarh',

  // Thiruvananthapuram | + "Trivandrum"(12) + typo variants
  'thiruvananthapuram city': 'Thiruvananthapuram',
  'thiruvananthapuram': 'Thiruvananthapuram',
  'thiruvanathapuram': 'Thiruvananthapuram',
  'thiruvananthapura m': 'Thiruvananthapuram',
  'trivandrum': 'Thiruvananthapuram',

  // Vadodara | "Vadodara" + "Vadodara Rural" + "Baroda"(1) + "Vadodra"(1)
  'vadodara rural': 'Vadodara',
  'vadodara': 'Vadodara',
  'baroda': 'Vadodara',
  'vadodra': 'Vadodara',

  // Nagpur | "Nagpur" + "Nagpur City" + "Nagpur Rural"
  'nagpur city': 'Nagpur',
  'nagpur rural': 'Nagpur',

  // Ahmedabad | "Ahmedabad" + "Ahmedabad City" + "Ahmadabad"(1)
  'ahmedabad city': 'Ahmedabad',
  'ahmedabad': 'Ahmedabad',
  'ahmadabad': 'Ahmedabad',

  // Aurangabad | "Aurangabad" + "Aurangabad Rural"
  'aurangabad rural': 'Aurangabad',
  'aurangabad': 'Aurangabad',

  // Jodhpur | "Jodhpur" + "Jodhpur City"
  'jodhpur city': 'Jodhpur',
  'jodhpur': 'Jodhpur',

  // Jalandhar | "Jalandhar" + "Jalandhar City" + "Jallandhar"(1)
  'jalandhar city': 'Jalandhar',
  'jalandhar': 'Jalandhar',
  'jallandhar': 'Jalandhar',

  // Prayagraj | "Prayagraj" + "Allahabad" + compound forms
  'allahabad': 'Prayagraj',
  'prayagraj': 'Prayagraj',
  'allahabad (prayagraj)': 'Prayagraj',
  'prayagraj (allahabad)': 'Prayagraj',

  // Mysuru | "Mysuru" + "Mysore"
  'mysore': 'Mysuru',
  'mysuru': 'Mysuru',

  // Gurugram | "Gurgaon"
  'gurgaon': 'Gurugram',
  'gurugram': 'Gurugram',

  // Khargone | "Khargone (west Nimar)"
  'khargone (west nimar)': 'Khargone',

  // Delhi | "New Delhi" + "Central Delhi" + "South Delhi" + "South West Delhi"(13) + "North Delhi"(1) + "Delhi Cantt"(3)
  'new delhi': 'Delhi',
  'central delhi': 'Delhi',
  'south delhi': 'Delhi',
  'south west delhi': 'Delhi',
  'north delhi': 'Delhi',
  'delhi cantt': 'Delhi',

  // Rajamahendravaram | "Rajahmundry" — old name
  'rajahmundry': 'Rajamahendravaram',
  'rajamahendravaram': 'Rajamahendravaram',

  // Kadapa | "Ysr Kadapa"
  'ysr kadapa': 'Kadapa',
  'kadapa': 'Kadapa',

  // Rangareddy | "Rangareddi"
  'rangareddi': 'Rangareddy',
  'rangareddy': 'Rangareddy',

  // Mangaluru | "Mangalore"
  'mangalore': 'Mangaluru',
  'mangaluru': 'Mangaluru',

  // Belagavi | "Belgaum"
  'belgaum': 'Belagavi',
  'belagavi': 'Belagavi',

  // ── NEW FIXES FROM FULL DB SCAN ───────────────────────────────────────────

  // Kolkata | "Calcutta"(6)
  'calcutta': 'Kolkata',

  // Puducherry | "Pondicherry"(6)
  'pondicherry': 'Puducherry',
  'puducherry': 'Puducherry',

  // Kozhikode | "Calicut"(5)
  'calicut': 'Kozhikode',
  'kozhikode': 'Kozhikode',

  // Nashik | "Nasik"(3)
  'nasik': 'Nashik',

  // Kalaburagi | "Gulbarga"(2) + "Kalaburgi"(1)
  'gulbarga': 'Kalaburagi',
  'kalaburgi': 'Kalaburagi',
  'kalaburagi': 'Kalaburagi',

  // Sonipat | "Sonepat"(3)
  'sonepat': 'Sonipat',

  // Ballari | "Bellary"(8) — official Kannada name
  'bellary': 'Ballari',
  'ballari': 'Ballari',

  // Ayodhya | "Faizabad"(12) — renamed Faizabad district → Ayodhya in 2018
  'faizabad': 'Ayodhya',

  // Thoothukudi | "Tuticorin"(17) — official Tamil name
  'tuticorin': 'Thoothukudi',
  'thoothukudi': 'Thoothukudi',

  // Tiruppur | "Tirupur"(1)
  'tirupur': 'Tiruppur',
  'tiruppur': 'Tiruppur',

  // Tirupati | "Tirupathi"(1)
  'tirupathi': 'Tirupati',
  'tirupati': 'Tirupati',

  // Anantnag | "Ananthnag"(9)
  'ananthnag': 'Anantnag',
  'anantnag': 'Anantnag',

  // Hazaribagh | "Hazaribag"(11)
  'hazaribag': 'Hazaribagh',
  'hazaribagh': 'Hazaribagh',

  // Hubballi | "Hubli"(9) + "Hubbali"(2)
  'hubli': 'Hubballi',
  'hubbali': 'Hubballi',
  'hubballi': 'Hubballi',

  // Bathinda | "Bhatinda"(11)
  'bhatinda': 'Bathinda',
  'bathinda': 'Bathinda',

  // Vasco Da Gama | "Vasco-da-gama"(4)
  'vasco-da-gama': 'Vasco Da Gama',
  'vasco da gama': 'Vasco Da Gama',

  // Mughalsarai | "Mugalsarai"(1)
  'mugalsarai': 'Mughalsarai',
  'mughalsarai': 'Mughalsarai',

  // Baramulla | "Baramula"(1)
  'baramula': 'Baramulla',

  // Sri Vijayapuram | "Sri Vijaya Puram"(4) + "Vijayapuram"(1) (Andaman)
  'sri vijaya puram': 'Sri Vijayapuram',
  'vijayapuram': 'Sri Vijayapuram',
  'sri vijayapuram': 'Sri Vijayapuram',

  // Vijayawada | "Vijyawada"(1)
  'vijyawada': 'Vijayawada',

  // Mohali | "Sas Nagar"(2) + "Sas Nagar Mohali"(1) + "Sahibzada Ajit Singh Nagar"(1)
  'sas nagar': 'Mohali',
  'sas nagar mohali': 'Mohali',
  'sahibzada ajit singh nagar': 'Mohali',

  // Kanpur | "Kanpur Nagar"(3) + "Kanpur City"(1)
  'kanpur nagar': 'Kanpur',
  'kanpur city': 'Kanpur',

  // Gandhinagar | "Gandhi Nagar"(12) + "Ganadhinagar"(1) + "Gandhinagar/ahmedabad"(1)
  'gandhi nagar': 'Gandhinagar',
  'ganadhinagar': 'Gandhinagar',
  'gandhinagar/ahmedabad': 'Gandhinagar',

  // Sri Ganganagar | "Sriganganagar"(1) + "Shri Ganganagar"(1)
  'sriganganagar': 'Sri Ganganagar',
  'shri ganganagar': 'Sri Ganganagar',
  'sri ganganagar': 'Sri Ganganagar',

  // Kanchipuram | "Kancheepuram"(1)
  'kancheepuram': 'Kanchipuram',

  // Sahibganj | "Sahebganj"(1)
  'sahebganj': 'Sahibganj',
  'sahibganj': 'Sahibganj',

  // Jorhat | "Jorahat"(2)
  'jorahat': 'Jorhat',

  // Himatnagar | "Himmatnagar"(2)
  'himmatnagar': 'Himatnagar',
  'himatnagar': 'Himatnagar',

  // Muzaffarnagar | "Muzaffanagar"(1) — typo
  'muzaffanagar': 'Muzaffarnagar',

  // Gautam Buddha Nagar | "Gautam Budh Nagar"(6) + "Gautam Buddh Nagar"(1) + "Gautam Budh"(1)
  'gautam budh nagar': 'Gautam Buddha Nagar',
  'gautam buddh nagar': 'Gautam Buddha Nagar',
  'gautam budh': 'Gautam Buddha Nagar',
  'gautam buddha nagar': 'Gautam Buddha Nagar',

  // Chikkamagaluru | "Chickmagalur"(2) — official Kannada name
  'chickmagalur': 'Chikkamagaluru',
  'chikkamagaluru': 'Chikkamagaluru',

  // Kota | "Kota City"(1)
  'kota city': 'Kota',

  // Naya Raipur | "Nava Raipur"(3)
  'nava raipur': 'Naya Raipur',
  'naya raipur': 'Naya Raipur',

  // East Singhbhum | "East-singhbhum"(5)
  'east-singhbhum': 'East Singhbhum',

  // Paradip | "Paradeep"(1)
  'paradeep': 'Paradip',

  // Silvassa | "Silvass"(1)
  'silvass': 'Silvassa',

  // Panaji | "Panjim"(2)
  'panjim': 'Panaji',
  'panaji': 'Panaji',

  // Dakshina Kannada | "Dakshin Kannada"(1)
  'dakshin kannada': 'Dakshina Kannada',
  'dakshina kannada': 'Dakshina Kannada',

  // North 24 Parganas | "North 24 Paraganas"(26)
  'north 24 paraganas': 'North 24 Parganas',
  'north 24 parganas': 'North 24 Parganas',

  // Rae Bareli | "Rae Bareli"(2) + "Raibareli"(1)
  'rae bareli': 'Raebareli',
  'raibareli': 'Raebareli',
  'raebareli': 'Raebareli',

  // Ludhiana | "Ludhiana City"(1)
  'ludhiana city': 'Ludhiana',

  // Amritsar | "Amritsar City"(1)
  'amritsar city': 'Amritsar',

  // Etawah | "Etawa"(1) — typo
  'etawa': 'Etawah',

  // Davanagere | "Davangere"(1)
  'davangere': 'Davanagere',
  'davanagere': 'Davanagere',

  // Jagatsinghpur | "Jagatsinghapur"(5)
  'jagatsinghapur': 'Jagatsinghpur',
  'jagatsinghpur': 'Jagatsinghpur',
};

export function normalizeCity(city: string | null | undefined): string | null {
  if (!city || city.trim() === '') return null;
  // Strip leading/trailing asterisks, ALLCAPS, junk
  const raw = city.trim().replace(/^\*+/, '').replace(/\*+$/, '').trim();
  if (!raw) return null;

  const key = raw.toLowerCase().replace(/\s+/g, ' ');

  // Check alias map first
  if (key in CITY_ALIASES) {
    const canonical = CITY_ALIASES[key];
    return canonical || null; // empty string in map = junk, return null
  }

  // Title-case fallback
  return raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim();
}

export function pinToState(pin: string): string | null {
  if (!pin || pin.length < 6) return null;
  const p3 = pin.substring(0, 3);
  const p2 = pin.substring(0, 2);
  
  // Minimal mapping to avoid huge objects if possible, but keep these for common ones
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

  return PIN3_MAP[p3] || PIN2_MAP[p2] || null;
}
