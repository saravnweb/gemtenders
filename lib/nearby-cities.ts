/**
 * Nearby cities map for India.
 * Keys are lowercase city names. Values are arrays of lowercase nearby city names.
 * Used to expand "For You" city filtering so local vendors see tenders from surrounding areas.
 */
export const NEARBY_CITIES: Record<string, string[]> = {
  // Tamil Nadu
  "chennai": ["kanchipuram", "chengalpattu", "tiruvallur", "vellore", "pondicherry", "puducherry", "mahabalipuram", "tambaram"],
  "coimbatore": ["tirupur", "erode", "salem", "pollachi", "palakkad", "ooty", "tiruppur"],
  "madurai": ["dindigul", "theni", "virudhunagar", "sivaganga", "tirunelveli"],
  "tirunelveli": ["thoothukudi", "tuticorin", "nagercoil", "madurai", "kanyakumari"],
  "trichy": ["tiruchirappalli", "thanjavur", "ariyalur", "perambalur", "karur", "pudukkottai"],
  "tiruchirappalli": ["thanjavur", "ariyalur", "perambalur", "karur", "pudukkottai", "trichy"],
  "salem": ["namakkal", "dharmapuri", "erode", "coimbatore", "yercaud"],
  "vellore": ["chennai", "kanchipuram", "tirupattur", "ranipet", "tirupati"],

  // Karnataka
  "bangalore": ["mysore", "tumkur", "hosur", "hubli", "kolar", "chikkaballapura", "ramanagara", "mandya"],
  "bengaluru": ["mysore", "tumkur", "hosur", "hubli", "kolar", "chikkaballapura", "ramanagara", "mandya"],
  "mysore": ["bangalore", "mandya", "chamarajanagar", "kodagu", "hassan"],
  "hubli": ["dharwad", "gadag", "haveri", "belgaum", "belagavi"],
  "belagavi": ["hubli", "dharwad", "belgaum", "bagalkot", "bijapur", "vijayapura"],
  "mangalore": ["udupi", "kasaragod", "kannur", "karwar"],
  "gulbarga": ["kalaburagi", "bidar", "yadgir", "raichur"],

  // Maharashtra
  "mumbai": ["thane", "navi mumbai", "kalyan", "dombivli", "pune", "nashik", "vasai", "virar", "mira road"],
  "pune": ["pimpri", "chinchwad", "nashik", "satara", "kolhapur", "ahmednagar", "solapur", "lonavala"],
  "nashik": ["pune", "ahmednagar", "dhule", "jalgaon", "trimbak"],
  "nagpur": ["wardha", "amravati", "yavatmal", "chandrapur", "bhandara", "gondia"],
  "aurangabad": ["jalna", "beed", "osmanabad", "latur", "ahmednagar", "solapur"],
  "solapur": ["pune", "kolhapur", "latur", "osmanabad", "bijapur"],
  "kolhapur": ["sangli", "satara", "solapur", "belgaum", "belagavi"],
  "amravati": ["nagpur", "yavatmal", "akola", "buldhana", "washim"],

  // Delhi / NCR
  "delhi": ["noida", "gurgaon", "gurugram", "faridabad", "ghaziabad", "greater noida", "bahadurgarh", "sonipat"],
  "noida": ["delhi", "greater noida", "ghaziabad", "faridabad"],
  "gurgaon": ["delhi", "faridabad", "manesar", "gurugram"],
  "gurugram": ["delhi", "faridabad", "gurgaon", "manesar"],
  "faridabad": ["delhi", "gurgaon", "noida", "ballabhgarh"],
  "ghaziabad": ["delhi", "noida", "hapur", "meerut"],

  // Uttar Pradesh
  "lucknow": ["kanpur", "unnao", "barabanki", "hardoi", "sitapur", "raebareli"],
  "kanpur": ["lucknow", "unnao", "fatehpur", "etawah", "jalaun"],
  "agra": ["mathura", "firozabad", "etah", "aligarh", "bharatpur"],
  "varanasi": ["allahabad", "prayagraj", "jaunpur", "mirzapur", "chandauli"],
  "prayagraj": ["varanasi", "allahabad", "kaushambi", "fatehpur", "mirzapur"],
  "allahabad": ["prayagraj", "kaushambi", "fatehpur", "mirzapur", "varanasi"],
  "meerut": ["ghaziabad", "hapur", "bulandshahr", "baghpat", "muzaffarnagar"],
  "mathura": ["agra", "bharatpur", "hathras", "aligarh", "vrindavan"],

  // Rajasthan
  "jaipur": ["ajmer", "tonk", "dausa", "alwar", "sikar", "jhunjhunu"],
  "jodhpur": ["barmer", "jaisalmer", "pali", "nagaur", "bikaner"],
  "udaipur": ["chittorgarh", "rajsamand", "bhilwara", "dungarpur", "banswara"],
  "kota": ["bundi", "jhalawar", "baran", "sawai madhopur"],
  "bikaner": ["sri ganganagar", "hanumangarh", "churu", "nagaur", "jodhpur"],
  "ajmer": ["jaipur", "bhilwara", "beawar", "nagaur", "kishangarh"],

  // Gujarat
  "ahmedabad": ["gandhinagar", "mehsana", "surat", "vadodara", "anand", "kheda", "nadiad"],
  "surat": ["navsari", "valsad", "bharuch", "tapi", "ahmedabad"],
  "vadodara": ["anand", "kheda", "bharuch", "ahmedabad", "godhra"],
  "rajkot": ["jamnagar", "morbi", "surendranagar", "junagadh", "porbandar"],
  "gandhinagar": ["ahmedabad", "mehsana", "kalol"],

  // Andhra Pradesh
  "visakhapatnam": ["vizag", "kakinada", "eluru", "rajahmundry", "srikakulam"],
  "vizag": ["visakhapatnam", "kakinada", "srikakulam", "vizianagaram"],
  "vijayawada": ["guntur", "krishna", "eluru", "tenali", "machilipatnam"],
  "guntur": ["vijayawada", "narasaraopet", "tenali", "palnadu", "prakasam"],
  "tirupati": ["nellore", "chittoor", "vellore", "kurnool", "kadapa"],
  "kurnool": ["nandyal", "kadapa", "anantapur", "bellary"],

  // Telangana
  "hyderabad": ["secunderabad", "rangareddy", "medak", "sangareddy", "nalgonda", "mahbubnagar", "vikarabad", "cyberabad"],
  "secunderabad": ["hyderabad", "medchal", "rangareddy", "ameerpet"],
  "warangal": ["hanamkonda", "khammam", "karimnagar", "nalgonda"],
  "karimnagar": ["warangal", "nizamabad", "jagtial", "peddapalli"],

  // West Bengal
  "kolkata": ["howrah", "durgapur", "asansol", "siliguri", "north 24 parganas", "south 24 parganas", "hooghly", "burdwan"],
  "howrah": ["kolkata", "hooghly", "uluberia"],
  "durgapur": ["asansol", "bankura", "bardhaman", "burdwan"],
  "siliguri": ["jalpaiguri", "darjeeling", "alipurduar", "cooch behar"],

  // Punjab
  "ludhiana": ["jalandhar", "amritsar", "moga", "firozpur", "sangrur", "barnala"],
  "amritsar": ["ludhiana", "gurdaspur", "tarn taran", "pathankot"],
  "jalandhar": ["ludhiana", "kapurthala", "hoshiarpur", "nawanshahr"],
  "chandigarh": ["mohali", "panchkula", "ambala", "ludhiana", "ropar"],

  // Haryana
  "chandigarh": ["mohali", "panchkula", "ambala", "ludhiana"],
  "panchkula": ["chandigarh", "mohali", "ambala", "yamunanagar"],
  "ambala": ["panchkula", "yamunanagar", "kurukshetra", "chandigarh"],
  "rohtak": ["jhajjar", "sonipat", "hisar", "bhiwani", "delhi"],
  "hisar": ["rohtak", "bhiwani", "fatehabad", "sirsa"],
  "faridabad": ["delhi", "gurgaon", "ballabhgarh", "palwal"],

  // Madhya Pradesh
  "bhopal": ["indore", "raisen", "sehore", "vidisha", "hoshangabad"],
  "indore": ["ujjain", "dewas", "khandwa", "dhar", "mhow"],
  "jabalpur": ["katni", "mandla", "narsinghpur", "sagar", "damoh"],
  "gwalior": ["shivpuri", "morena", "bhind", "datia", "agra"],
  "ujjain": ["indore", "dewas", "ratlam", "shajapur"],

  // Bihar
  "patna": ["gaya", "nalanda", "muzaffarpur", "vaishali", "saran", "bhojpur"],
  "gaya": ["patna", "nalanda", "aurangabad", "nawada", "jehanabad"],
  "muzaffarpur": ["patna", "vaishali", "sitamarhi", "sheohar", "east champaran"],
  "bhagalpur": ["banka", "sahibganj", "munger", "khagaria"],

  // Odisha
  "bhubaneswar": ["cuttack", "puri", "khordha", "nayagarh", "jagatsinghpur"],
  "cuttack": ["bhubaneswar", "jajpur", "kendrapara", "jagatsinghpur"],
  "rourkela": ["sundargarh", "jharsuguda", "sambalpur", "keonjhar"],

  // Jharkhand
  "ranchi": ["ramgarh", "hazaribagh", "khunti", "lohardaga", "bokaro"],
  "jamshedpur": ["east singhbhum", "west singhbhum", "seraikela", "kharsawan"],
  "dhanbad": ["bokaro", "giridih", "hazaribagh", "koderma"],

  // Chhattisgarh
  "raipur": ["durg", "bhilai", "baloda bazar", "mahasamund", "gariaband"],
  "bilaspur": ["korba", "raigarh", "janjgir", "mungeli"],
  "durg": ["raipur", "bhilai", "rajnandgaon", "balod"],

  // Kerala
  "kochi": ["thrissur", "ernakulam", "alappuzha", "idukki", "kothamangalam"],
  "thiruvananthapuram": ["kollam", "pathanamthitta", "kochi", "nagercoil"],
  "thrissur": ["palakkad", "malappuram", "kochi", "ernakulam"],
  "kozhikode": ["malappuram", "wayanad", "kannur", "calicut"],
  "kannur": ["kasaragod", "kozhikode", "wayanad"],

  // Assam
  "guwahati": ["kamrup", "nalbari", "barpeta", "morigaon", "goalpara"],
  "dibrugarh": ["tinsukia", "sibsagar", "jorhat", "lakhimpur"],
  "silchar": ["cachar", "hailakandi", "karimganj", "dima hasao"],

  // Himachal Pradesh
  "shimla": ["solan", "mandi", "kullu", "kangra"],
  "dharamsala": ["kangra", "mandi", "chamba", "una"],

  // Uttarakhand
  "dehradun": ["haridwar", "rishikesh", "mussoorie", "pauri garhwal"],
  "haridwar": ["dehradun", "rishikesh", "roorkee", "muzaffarnagar"],
  "haldwani": ["nainital", "udham singh nagar", "almora", "champawat"],

  // Jammu & Kashmir
  "jammu": ["samba", "kathua", "udhampur", "reasi"],
  "srinagar": ["budgam", "ganderbal", "pulwama", "shopian"],
};

/**
 * Returns the given city list expanded with nearby cities.
 * The original cities are always included; nearby cities are appended.
 */
export function expandWithNearbyCities(cities: string[]): string[] {
  const expanded = new Set(cities.map(c => c.toLowerCase().trim()));
  cities.forEach(city => {
    const nearby = NEARBY_CITIES[city.toLowerCase().trim()] || [];
    nearby.forEach(n => expanded.add(n));
  });
  return Array.from(expanded);
}

/**
 * Returns the nearby cities for a given city name (empty array if not found).
 */
export function getNearbyCities(city: string): string[] {
  return NEARBY_CITIES[city.toLowerCase().trim()] || [];
}
