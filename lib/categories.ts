// lib/categories.ts
// Category definitions aligned to GEM portal's official b_category_name taxonomy.
// GeM has 10,900+ product categories and 330+ service categories.
// These top-level groups are used for filtering and display on GeMTenders.org.

export interface Category {
  id: string;           // URL slug  e.g. "computer-hardware"
  label: string;        // Display name e.g. "Computer Hardware & Peripherals"
  icon: string;         // Emoji icon
  description: string;  // Short description shown on category cards
  keywords: string[];   // Keywords used to auto-tag tenders (order = priority)
  gemCatalogRef?: string; // Official GeM portal b_category_name reference
}

export const CATEGORIES: Category[] = [

  // ─── PRODUCTS ───────────────────────────────────────────────────────────────

  {
    id: "computer-hardware",
    label: "Computer Hardware & Peripherals",
    icon: "💻",
    description: "Laptops, Desktops, Servers, Printers, Scanners, Monitors and IT peripherals",
    gemCatalogRef: "Computer Hardware and Peripherals",
    keywords: [
      "laptop", "desktop", "computer", "server", "tablet", "notebook",
      "workstation", "thin client", "all in one",
      "printer", "scanner", "plotter", "copier", "multifunction printer",
      "inkjet printer", "laser printer", "dot matrix",
      "monitor", "display", "keyboard", "mouse",
      "hard disk", "ssd", "pen drive", "usb drive", "webcam",
      "cpu", "processor", "motherboard", "ram", "graphic card",
    ],
  },
  {
    id: "software",
    label: "Software & Licenses",
    icon: "📀",
    description: "OS licenses, ERP, CRM, Antivirus, SaaS subscriptions and Cloud services",
    gemCatalogRef: "Computer Software",
    keywords: [
      "software license", "erp", "crm", "license", "saas", "cloud subscription",
      "antivirus", "cybersecurity software", "database software",
      "operating system", "windows license", "ms office", "microsoft office",
      "accounting software", "billing software", "hrms", "payroll software",
      "gis software", "autocad", "simulation software",
      "data center software",
    ],
  },
  {
    id: "networking",
    label: "Networking & Telecom",
    icon: "🌐",
    description: "Routers, Switches, Firewalls, Structured cabling and Telecom equipment",
    gemCatalogRef: "Networking Equipment",
    keywords: [
      "networking", "router", "switch", "firewall", "wifi", "access point",
      "lan", "wan", "bandwidth", "structured cabling", "patch panel",
      "optical fibre", "fiber cable", "cable modem", "network rack",
      "telecom", "telephone", "pbx", "epabx", "intercom", "voip",
      "mobile phone", "walkie talkie", "radio set", "pager",
      "core switch", "managed switch",
    ],
  },
  {
    id: "audio-visual",
    label: "Audio Visual & Presentation",
    icon: "📽️",
    description: "Projectors, Interactive displays, LED screens, PA systems and VC equipment",
    gemCatalogRef: "Audio Visual and Display Equipment",
    keywords: [
      "projector", "interactive flat panel", "interactive display", "ifp",
      "led screen", "digital signage", "video wall",
      "pa system", "public address system", "speaker system", "amplifier", "microphone",
      "conference system", "video conferencing", "vc equipment",
      "smart board", "smart tv", "commercial tv",
      "visualiser", "document camera",
    ],
  },
  {
    id: "office-supplies",
    label: "Office Supplies & Stationery",
    icon: "🗂️",
    description: "Paper, Pens, Registers, Office appliances, AC and Housekeeping materials",
    gemCatalogRef: "Office Supplies and Stationery",
    keywords: [
      "stationery", "a4 paper", "copier paper", "maplitho", "paper ream",
      "pen", "pencil", "marker", "highlighter",
      "diary", "register", "notepad", "file folder",
      "envelope", "stamp pad", "rubber stamp",
      "toner", "cartridge", "ink ribbon",
      "cleaning material", "housekeeping material",
      "first aid kit",
      "weighing scale", "measuring tape",
      "air conditioner", "split ac", "window ac",
      "refrigerator", "fridge", "microwave", "kettle",
      "water cooler", "ro system", "vending machine",
    ],
  },
  {
    id: "furniture",
    label: "Furniture & Fittings",
    icon: "🪑",
    description: "Chairs, Tables, Almirahs, Modular workstations, Racks and Storage solutions",
    gemCatalogRef: "Furniture and Fittings",
    keywords: [
      "furniture", "chair", "table", "office desk", "modular workstation",
      "almirah", "cupboard", "wardrobe", "locker", "filing cabinet",
      "shelving", "rack", "storage rack", "pallet rack",
      "sofa", "bench", "stool", "reception counter", "podium", "lectern",
      "office partition", "cubicle",
      "school furniture", "classroom desk", "student desk",
      "conference table", "dining table",
      "pedestal", "drawer unit", "credenza",
      "display cabinet", "glass cabinet",
    ],
  },
  {
    id: "electrical",
    label: "Electrical Equipment",
    icon: "⚡",
    description: "Transformers, DG Sets, UPS, Cables, Switchgear and Power distribution",
    gemCatalogRef: "Electrical Equipment and Components",
    keywords: [
      "electrical", "transformer", "dg set", "generator", "diesel generator",
      "genset", "ups", "inverter", "battery bank",
      "cable", "armoured cable", "control cable", "wire",
      "conduit", "wiring",
      "switchgear", "mccb", "mcb", "acb", "vcb",
      "panel board", "distribution board", "control panel", "hv panel", "lv panel",
      "plc", "scada", "vfd", "drive",
      "substation", "metering", "energy meter", "smart meter",
      "amc electrical", "amc ups", "amc dg", "amc solar",
    ],
  },
  {
    id: "lighting",
    label: "LED & Lighting",
    icon: "💡",
    description: "LED lights, Street lights, High mast, Floodlights and Indoor luminaires",
    gemCatalogRef: "LED Lights and Luminaires",
    keywords: [
      "led", "street light", "luminaire", "lighting fixture", "lamp",
      "floodlight", "tube light", "high mast",
      "led bulb", "led panel", "led batten", "downlight", "spotlight",
      "emergency light", "exit sign light",
      "light fitting", "light installation",
    ],
  },
  {
    id: "solar",
    label: "Solar & Renewable Energy",
    icon: "☀️",
    description: "Solar panels, SPV systems, Wind energy and EV charging infrastructure",
    gemCatalogRef: "Solar Products and Systems",
    keywords: [
      "solar panel", "solar power system", "solar system", "spv system",
      "solar street light", "solar pump", "solar inverter", "solar battery",
      "solar rooftop", "solar installation",
      "renewable energy", "wind energy", "wind turbine",
      "ev charging station", "electric vehicle charging",
      "biomass energy",
    ],
  },
  {
    id: "vehicles",
    label: "Vehicles & Transport Equipment",
    icon: "🚗",
    description: "Cars, Trucks, Buses, Electric vehicles, Tractors and Heavy machinery",
    gemCatalogRef: "Automobiles and Vehicles",
    keywords: [
      "vehicle", "car", "sedan", "suv", "jeep", "truck", "lorry",
      "bus", "mini bus", "tempo traveller", "van", "pickup truck",
      "tractor", "jcb", "excavator", "bulldozer", "tipper", "grader",
      "motorbike", "motorcycle", "scooter",
      "electric vehicle", "ev", "electric car", "electric bus",
      "ambulance vehicle", "fire engine", "fire truck",
      "boat", "watercraft",
    ],
  },
  {
    id: "medical-equipment",
    label: "Medical Equipment & Devices",
    icon: "🏥",
    description: "Diagnostic equipment, Surgical instruments, ICU devices and Hospital furniture",
    gemCatalogRef: "Medical Equipment and Devices",
    keywords: [
      "medical equipment", "hospital equipment", "diagnostic equipment",
      "x-ray machine", "mri", "ct scan", "ultrasound machine", "ecg machine",
      "ventilator", "oxygen concentrator", "oxygen cylinder", "pulse oximeter",
      "blood pressure monitor", "glucometer", "thermometer", "nebulizer",
      "infusion pump", "syringe pump", "operation theatre", "ot table",
      "icu equipment", "patient monitor", "defibrillator",
      "surgical instrument", "iv cannula", "catheter",
      "hospital bed", "stretcher", "wheelchair", "walking aid", "crutches",
      "ambulance equipment",
    ],
  },
  {
    id: "pharma",
    label: "Pharmaceuticals & Consumables",
    icon: "💊",
    description: "Medicines, Vaccines, Medical consumables, PPE and Surgical supplies",
    gemCatalogRef: "Pharmaceutical Products",
    keywords: [
      "medicine", "pharmaceutical", "drug", "tablet", "capsule", "injection",
      "vaccine", "insulin", "antibiotic", "syrup",
      "syringe", "needle", "bandage", "gauze", "suture", "dressing",
      "gloves", "ppe", "mask", "n95", "gown", "apron",
      "sanitizer", "disinfectant", "antiseptic",
      "lab reagent", "test kit", "rapid test kit",
    ],
  },
  {
    id: "lab-equipment",
    label: "Laboratory & Scientific Equipment",
    icon: "🔬",
    description: "Microscopes, Centrifuges, Autoclaves, Analytical instruments and Testing tools",
    gemCatalogRef: "Laboratory Equipment and Instruments",
    keywords: [
      "laboratory equipment", "lab instrument", "microscope", "centrifuge",
      "incubator", "autoclave", "biosafety cabinet", "laminar flow cabinet",
      "spectrophotometer", "chromatography", "ph meter",
      "weighing balance", "analytical balance", "electronic balance",
      "muffle furnace", "water bath", "hot air oven",
      "calibration equipment", "testing instrument",
    ],
  },
  {
    id: "safety",
    label: "Safety & Security Equipment",
    icon: "🔒",
    description: "CCTV, Access control, Fire extinguishers, Smoke detectors and PPE gear",
    gemCatalogRef: "Safety and Security Equipment",
    keywords: [
      "cctv", "ip camera", "dvr", "nvr", "surveillance camera", "video analytics",
      "biometric", "access control system", "boom barrier", "turnstile",
      "metal detector", "baggage scanner", "x-ray baggage",
      "fire extinguisher", "fire alarm", "fire panel",
      "fire hydrant", "fire suppression system", "smoke detector",
      "safety equipment", "helmet", "safety shoe", "safety vest",
      "harness", "reflective jacket", "safety harness",
      "security equipment",
    ],
  },
  {
    id: "industrial",
    label: "Industrial Machinery & Equipment",
    icon: "🔩",
    description: "Pumps, Valves, Pipes, Compressors, Boilers, Lifts and Industrial tools",
    gemCatalogRef: "Industrial Machinery and Equipment",
    keywords: [
      "pipe", "fitting", "valve", "pump", "hose",
      "gi pipe", "ms pipe", "hdpe pipe", "pvc pipe", "cpvc pipe", "ss pipe",
      "flange", "elbow", "tee fitting", "reducer",
      "gate valve", "ball valve", "butterfly valve", "check valve",
      "water pump", "submersible pump", "centrifugal pump", "motor pump",
      "compressor", "boiler", "lift", "elevator", "escalator",
      "bolt", "nut", "screw", "fastener", "anchor bolt",
      "steel structure", "ms fabrication", "gi sheet", "ms sheet", "chequered plate",
      "wire rope", "chain pulley", "hoist", "bearing",
      "industrial gas", "welding", "grinding machine", "hand tool", "power tool",
    ],
  },
  {
    id: "construction",
    label: "Construction Materials",
    icon: "🧱",
    description: "Cement, Steel, Tiles, Paint, Plumbing fittings and Structural materials",
    gemCatalogRef: "Construction Materials",
    keywords: [
      "cement", "concrete", "rcc", "tmt bar", "steel bar",
      "brick", "aac block", "fly ash brick",
      "tile", "marble", "granite", "flooring material",
      "paint", "waterproofing material", "plastering", "putty", "primer",
      "sanitary fitting", "bathroom fitting", "cp fitting",
      "aluminium section", "glass pane", "roofing sheet",
      "false ceiling material", "gypsum board",
      "shuttering", "scaffolding material",
    ],
  },
  {
    id: "textiles",
    label: "Textiles & Apparel",
    icon: "👕",
    description: "Uniforms, Fabric, Linen, Bedsheets, Towels and Protective clothing",
    gemCatalogRef: "Textiles Garments and Accessories",
    keywords: [
      "textile", "uniform", "dress", "apparel", "garment", "clothing",
      "cloth", "fabric", "handloom", "khadi",
      "linen", "bed sheet", "pillow cover", "blanket", "quilt",
      "towel", "bath towel", "hand towel",
      "curtain", "drape", "blinds",
      "carpet", "rug", "door mat", "coir mat",
      "raincoat", "jacket",
    ],
  },
  {
    id: "agriculture",
    label: "Agriculture & Food Products",
    icon: "🌾",
    description: "Seeds, Fertilizers, Farm machinery, Food grains and Veterinary supplies",
    gemCatalogRef: "Agriculture Equipment and Products",
    keywords: [
      "agriculture", "farming", "seed", "fertilizer", "pesticide", "herbicide",
      "farm equipment", "plough", "harvester", "combine harvester",
      "irrigation", "drip irrigation", "sprinkler system",
      "food grain", "rice", "wheat", "pulses", "dal", "sugar supply",
      "food supply", "ration supply", "mid-day meal",
      "veterinary", "animal feed", "cattle feed", "poultry",
    ],
  },
  {
    id: "books",
    label: "Books, Printing & Publications",
    icon: "📚",
    description: "Textbooks, Journals, Government publications, Signage and Print materials",
    gemCatalogRef: "Books and Publications",
    keywords: [
      "book", "textbook", "publication", "journal", "magazine", "periodical",
      "printing", "offset printing", "digital printing",
      "banner", "flex printing", "vinyl", "signage", "hoarding", "display board",
      "brochure", "pamphlet", "leaflet", "form printing",
      "calendar printing", "diary printing",
    ],
  },
  {
    id: "defence",
    label: "Defence & Military Stores",
    icon: "🛡️",
    description: "Tactical gear, Ballistic equipment, Ordnance and Specialized defence stores",
    gemCatalogRef: "Defence and Military Stores",
    keywords: [
      "tactical", "ballistic", "armour", "armored",
      "military", "army", "navy", "air force", "defence",
      "ordnance", "ammunition storage",
      "camouflage", "combat gear", "field equipment",
      "night vision", "binoculars",
      "arms", "weapon",
    ],
  },

  // ─── SERVICES ────────────────────────────────────────────────────────────────

  {
    id: "it-services",
    label: "IT & Technology Services",
    icon: "⚙️",
    description: "IT support, AMC, Software development, System integration and Cybersecurity",
    gemCatalogRef: "IT and IT Enabled Services",
    keywords: [
      "it support", "it service", "it infrastructure service",
      "data center service", "cloud service", "managed service", "system integration",
      "website development", "app development", "mobile app development", "portal development",
      "software development", "custom software development",
      "cyber security service", "cyber audit", "vapt",
      "amc laptop", "amc computer", "amc server", "amc network", "it amc",
      "it facility management", "network management",
    ],
  },
  {
    id: "manpower",
    label: "Manpower & Staffing",
    icon: "👷",
    description: "Outsourcing, Data entry operators, Skilled and unskilled contractual staff",
    gemCatalogRef: "Manpower Services",
    keywords: [
      "manpower", "staffing", "outsourcing", "labour supply", "labor supply",
      "worker supply", "operator supply", "helper supply", "attendant",
      "data entry operator", "deo", "typist",
      "clerk supply", "accountant supply",
      "mechanical manpower", "electrical manpower",
      "skilled manpower", "semi-skilled manpower", "unskilled manpower", "contractual staff",
    ],
  },
  {
    id: "security-services",
    label: "Security Services",
    icon: "👮",
    description: "Security guards, Armed guards, Watch & Ward and Patrolling services",
    gemCatalogRef: "Security Services",
    keywords: [
      "security guard", "armed guard", "gunman",
      "security agency", "watch and ward", "patrol service",
      "security personnel", "security service",
      "bouncers",
    ],
  },
  {
    id: "facility",
    label: "Facility Management",
    icon: "🧹",
    description: "Housekeeping, Pest control, Gardening and Facility maintenance services",
    gemCatalogRef: "Facility Management Services",
    keywords: [
      "facility management", "housekeeping service", "cleaning service",
      "pest control", "deep cleaning",
      "toilet maintenance", "washroom maintenance",
      "horticulture service", "gardening service", "landscaping",
      "garbage collection", "waste management",
      "amc facility",
    ],
  },
  {
    id: "catering",
    label: "Catering & Food Services",
    icon: "🍽️",
    description: "Canteen, Mess services, Food supply and Hospitality catering",
    gemCatalogRef: "Catering Services",
    keywords: [
      "catering", "canteen service", "mess service", "food supply service",
      "breakfast supply", "lunch supply", "dinner supply", "tiffin service",
      "refreshment", "hospitality service", "banquet service",
    ],
  },
  {
    id: "transport-services",
    label: "Transportation & Logistics",
    icon: "🚛",
    description: "Vehicle hiring, Cab services, Goods transport and Relocation services",
    gemCatalogRef: "Transportation Services",
    keywords: [
      "vehicle hiring", "cab hiring", "taxi hiring", "bus hiring",
      "fleet management", "chauffeur service", "driver supply",
      "transport service", "logistics service", "goods transport", "freight service", "cargo",
      "courier service", "parcel delivery",
      "packers and movers", "loading unloading", "shifting service", "relocation service",
    ],
  },
  {
    id: "civil-works",
    label: "Civil & Construction Works",
    icon: "🏗️",
    description: "Building construction, Roads, Repairs, Renovation and Infrastructure projects",
    gemCatalogRef: "Civil Works and Construction Services",
    keywords: [
      "civil work", "construction work", "building construction", "repair work",
      "renovation", "road construction", "highway construction", "bridge construction", "flyover",
      "dam", "canal", "drain", "culvert",
      "compound wall", "boundary wall", "retaining wall",
      "painting work", "waterproofing work", "plumbing work",
      "excavation", "earthwork", "foundation work",
      "infrastructure development", "smart city",
      "pmc", "project management consultancy",
    ],
  },
  {
    id: "consultancy",
    label: "Consultancy & Professional Services",
    icon: "📋",
    description: "Surveys, Audits, Inspections, Legal services and DPR preparation",
    gemCatalogRef: "Consultancy and Advisory Services",
    keywords: [
      "survey", "consultancy", "consulting", "advisory", "consultant",
      "audit", "statutory audit", "internal audit", "tax audit",
      "inspection", "quality inspection", "third party inspection",
      "quality testing service", "material testing",
      "feasibility study",
      "detailed project report", "dpr",
      "gis mapping", "remote sensing", "drone survey",
      "valuation", "property valuation",
      "research study", "evaluation study",
      "legal service", "legal consultant",
    ],
  },
  {
    id: "training",
    label: "Training & Education",
    icon: "🎓",
    description: "Training programs, Workshops, Seminars, Skill development and Events",
    gemCatalogRef: "Training and Education Services",
    keywords: [
      "training", "workshop", "seminar", "skill development",
      "capacity building", "coaching", "e-learning", "online training",
      "event management", "exhibition", "conference", "expo",
      "inauguration", "ceremony", "awareness programme",
    ],
  },
  {
    id: "healthcare-services",
    label: "Healthcare Services",
    icon: "⚕️",
    description: "Medical services, Ambulance services, Diagnostics and Healthcare staffing",
    gemCatalogRef: "Healthcare and Allied Services",
    keywords: [
      "healthcare service", "medical service", "health camp",
      "ambulance service", "patient transport service",
      "diagnostic service", "pathology service", "radiology service",
      "telemedicine", "telehealth",
      "nursing staff", "paramedic supply", "doctor service",
      "mortuary service",
    ],
  },
  {
    id: "environmental",
    label: "Environmental & Water Services",
    icon: "💧",
    description: "STP/ETP operation, Water supply, Borewell, Pollution control and Sanitation",
    gemCatalogRef: "Environmental Services",
    keywords: [
      "water supply service", "water treatment service", "water tanker supply",
      "effluent treatment", "etp operation", "sewage treatment", "stp operation",
      "rain water harvesting",
      "borewell", "tube well", "hand pump installation", "overhead tank",
      "pollution control", "environmental monitoring",
      "e-waste", "biomedical waste", "hazardous waste",
      "solid waste management",
    ],
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Detects the best matching category for a tender title.
 * Returns the category id string, or null if no match found.
 *
 * Scoring: earlier keyword in the array = higher priority.
 * First match wins for the same score — put the most specific
 * keywords first inside each category's keywords array.
 */
export function detectCategory(title: string): string | null {
  if (!title) return null;

  const normalized = title.toLowerCase();

  let bestMatch: { id: string; score: number } | null = null;

  for (const category of CATEGORIES) {
    for (let i = 0; i < category.keywords.length; i++) {
        const keyword = category.keywords[i];

        try {
          // Prevent accidental bounds from punctuation
          const regex = new RegExp(`\\b${keyword.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}\\b`, "i");
          if (regex.test(normalized)) {
            const score = category.keywords.length - i;
            if (!bestMatch || score > bestMatch.score) {
              bestMatch = { id: category.id, score };
            }
            break; // Stop checking further keywords for this category if matched
          }
        } catch {
          // Fallback
          if (normalized.includes(keyword)) {
            const score = category.keywords.length - i;
            if (!bestMatch || score > bestMatch.score) {
              bestMatch = { id: category.id, score };
            }
            break;
          }
        }
    }
  }

  return bestMatch ? bestMatch.id : null;
}

/**
 * Returns the full Category object for a given id.
 */
export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/**
 * Returns label + icon string for display, e.g. "💻 Computer Hardware & Peripherals"
 */
export function getCategoryLabel(id: string): string {
  const cat = getCategoryById(id);
  return cat ? `${cat.icon} ${cat.label}` : "";
}
