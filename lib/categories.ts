// lib/categories.ts
// Improved category definitions based on gem.gov.in portal structure
// GeM has 10,900+ product categories and 330+ service categories
// These are the top-level groups used for filtering and display on GeMTenders.org

export interface Category {
  id: string;           // URL slug  e.g. "it"
  label: string;        // Display name e.g. "IT & Tech"
  icon: string;         // Emoji icon
  description: string;  // Short description shown on category cards
  keywords: string[];   // Keywords used to auto-tag tenders (order = priority)
  gemCatalogRef?: string; // Official GeM portal category name for reference
}

export const CATEGORIES: Category[] = [
  // ─── IT & ELECTRONICS ────────────────────────────────────────────────────
  {
    id: "it",
    label: "IT & Tech",
    icon: "💻",
    description: "Computers, laptops, servers, networking, software, CCTV, printers and IT services",
    gemCatalogRef: "Electronic Equipments / Computers / Software",
    keywords: [
      // Hardware
      "laptop", "desktop", "computer", "server", "tablet", "notebook",
      "workstation", "thin client", "all in one",
      // Peripherals
      "printer", "scanner", "projector", "monitor", "display", "keyboard",
      "mouse", "ups", "hard disk", "ssd", "pen drive", "webcam",
      // Networking
      "networking", "router", "switch", "firewall", "wifi", "access point",
      "network", "lan", "wan", "bandwidth", "structured cabling",
      // Security tech
      "cctv", "ip camera", "dvr", "nvr", "biometric", "access control",
      "surveillance", "video analytics",
      // Software & services
      "software", "erp", "crm", "license", "saas", "cloud", "cyber",
      "cybersecurity", "antivirus", "data center", "website", "app development",
      "mobile app", "portal development", "it support", "amc laptop",
      "amc desktop", "amc server", "it infrastructure",
      // Telecom
      "telecom", "telephone", "pbx", "epabx", "intercom", "voip",
      "mobile phone", "walkie talkie",
    ],
  },

  // ─── CIVIL & CONSTRUCTION ────────────────────────────────────────────────
  {
    id: "civil",
    label: "Civil Works",
    icon: "🏗️",
    description: "Construction, repair, roads, buildings, flooring, plumbing and infrastructure works",
    gemCatalogRef: "Construction / Civil Engineering Services",
    keywords: [
      "civil", "construction", "building", "repair", "renovation", "road",
      "highway", "bridge", "flyover", "dam", "canal", "drain", "culvert",
      "compound wall", "boundary wall", "retaining wall",
      "flooring", "tile", "marble", "granite", "epoxy flooring",
      "painting", "waterproofing", "plastering", "whitewash", "distemper",
      "plumbing", "sanitary", "bathroom fittings", "earthwork", "grading",
      "excavation", "backfilling", "foundation",
      "fabrication", "structural steel", "ms structure", "rcc", "concrete",
      "shuttering", "scaffolding", "false ceiling", "partition", "glazing",
      "aluminium work", "glass work", "roofing", "shed construction",
      "infrastructure", "township", "smart city", "pmc", "project management",
    ],
  },

  // ─── ELECTRICAL ──────────────────────────────────────────────────────────
  {
    id: "electrical",
    label: "Electrical",
    icon: "⚡",
    description: "Wiring, transformers, cables, UPS, batteries, LED, solar, switchgear and generators",
    gemCatalogRef: "Electrical Appliances / LED Luminaires / Power Equipment",
    keywords: [
      // Power equipment
      "electrical", "transformer", "dg set", "generator", "diesel generator",
      "genset", "ups", "inverter", "battery", "solar", "solar panel",
      "solar power", "renewable energy", "wind energy",
      // Wiring & cables
      "cable", "wire", "wiring", "conduit", "armoured cable", "control cable",
      "optical fibre", "earth pit",
      // Switchgear & panels
      "switchgear", "mccb", "mcb", "acb", "vcb", "panel board", "db",
      "distribution board", "hv panel", "lv panel", "control panel",
      "plc", "scada", "vfd", "drive",
      // Lighting
      "led", "street light", "luminaire", "light", "lighting", "lamp",
      "floodlight", "tube light", "high mast", "solar street light",
      // Substation
      "substation", "transmission line", "hv", "lv", "ht", "lt",
      "metering", "energy meter", "smart meter",
      // AMC
      "amc electrical", "amc ups", "amc dg", "amc solar",
    ],
  },

  // ─── MEDICAL & HEALTHCARE ────────────────────────────────────────────────
  {
    id: "medical",
    label: "Medical",
    icon: "🏥",
    description: "Medical equipment, hospital furniture, medicines, surgical supplies and diagnostic tools",
    gemCatalogRef: "Medical Products / Hospital Equipment / Pharmaceuticals",
    keywords: [
      // Equipment
      "medical", "hospital", "healthcare", "diagnostic", "x-ray", "mri",
      "ct scan", "ultrasound", "ecg", "eeg", "ventilator", "oxygen",
      "oxygen concentrator", "oxygen cylinder", "pulse oximeter",
      "blood pressure", "glucometer", "thermometer", "nebulizer",
      "infusion pump", "syringe pump", "operation theatre", "ot table",
      "ot light", "icu", "patient monitor",
      // Disposables & consumables
      "surgical", "gloves", "syringe", "needle", "iv cannula", "catheter",
      "bandage", "gauze", "suture", "ppe", "mask", "n95", "gown",
      "sanitizer", "disinfectant",
      // Medicines & pharma
      "medicine", "pharmaceutical", "drug", "tablet", "injection",
      "vaccine", "insulin", "antibiotic",
      // Hospital furniture
      "hospital bed", "stretcher", "wheelchair", "walking aid", "crutches",
      "ambulance", "mortuary",
      // Lab
      "laboratory", "lab equipment", "microscope", "centrifuge", "incubator",
      "autoclave", "biosafety cabinet", "lab reagent", "test kit",
    ],
  },

  // ─── FURNITURE & FURNISHINGS ─────────────────────────────────────────────
  {
    id: "furniture",
    label: "Furniture",
    icon: "🪑",
    description: "Office chairs, tables, almirahs, modular workstations, shelving and furnishings",
    gemCatalogRef: "Furniture / Class Room Desking / Office Furniture",
    keywords: [
      "furniture", "chair", "table", "desk", "workstation", "modular",
      "almirah", "cupboard", "wardrobe", "locker", "filing cabinet",
      "shelving", "rack", "storage rack", "pallet rack",
      "sofa", "bench", "stool", "reception counter", "podium", "lectern",
      "partition", "cubicle", "cabin", "office partition",
      "classroom desking", "student desk", "school furniture",
      "meeting table", "conference table", "dining table",
      "pedestal", "drawer unit", "credenza",
      "display cabinet", "glass cabinet",
    ],
  },

  // ─── VEHICLES & AUTOMOTIVE ───────────────────────────────────────────────
  {
    id: "vehicles",
    label: "Vehicles",
    icon: "🚗",
    description: "Cars, trucks, buses, tractors, electric vehicles and vehicle hiring services",
    gemCatalogRef: "Utility Vehicles / Automotive / Vehicle Hiring Services",
    keywords: [
      // Products
      "vehicle", "car", "sedan", "suv", "jeep", "truck", "lorry",
      "bus", "mini bus", "tempo traveller", "van", "pickup",
      "tractor", "jcb", "excavator", "bulldozer", "tipper",
      "motorbike", "motorcycle", "scooter", "e-bike",
      "electric vehicle", "ev", "electric car", "electric bus",
      "ambulance vehicle", "fire engine", "fire truck",
      "boat", "watercraft",
      // Services
      "vehicle hiring", "cab hiring", "taxi hiring", "bus hiring",
      "fleet management", "chauffeur", "driver", "cab service",
      "short term cab", "long term cab",
      // Parts
      "auto parts", "spare parts", "tyre", "battery vehicle",
    ],
  },

  // ─── MANPOWER SERVICES ───────────────────────────────────────────────────
  {
    id: "manpower",
    label: "Manpower",
    icon: "👷",
    description: "Staffing, outsourcing, skilled and unskilled labour, data entry and contractual workers",
    gemCatalogRef: "Manpower Outsourcing Services / Professional Outsourcing",
    keywords: [
      "manpower", "staffing", "outsourcing", "labour", "labor",
      "worker", "operator", "helper", "attendant", "peon",
      "data entry", "data entry operator", "deo", "typist",
      "driver", "electrician manpower", "plumber manpower",
      "contractual", "contract staff", "skilled", "semi-skilled", "unskilled",
      "minimum wage", "fixed remuneration",
      // Professional outsourcing
      "consultant", "it professional", "software developer",
      "project manager", "engineer outsourcing",
      // Clerical
      "clerk", "accountant", "finance staff", "hr staff",
    ],
  },

  // ─── SECURITY SERVICES ───────────────────────────────────────────────────
  {
    id: "security",
    label: "Security",
    icon: "🔒",
    description: "Security guards, surveillance, access control, fire safety and patrol services",
    gemCatalogRef: "Security Services / Fire Safety Equipment",
    keywords: [
      "security", "guard", "security guard", "armed guard", "gunman",
      "security agency", "watch", "patrol",
      "surveillance", "monitoring",
      "fire safety", "fire fighting", "fire extinguisher", "fire alarm",
      "fire hydrant", "fire suppression", "smoke detector",
      "access control", "barrier gate", "boom barrier",
      "metal detector", "baggage scanner", "x-ray baggage",
    ],
  },

  // ─── TRANSPORT & LOGISTICS ───────────────────────────────────────────────
  {
    id: "transport",
    label: "Transport & Logistics",
    icon: "🚚",
    description: "Goods transport, freight, courier, cargo shifting and logistics services",
    gemCatalogRef: "Transport / Logistics / Goods Shifting Services",
    keywords: [
      "transport", "logistics", "goods transport", "freight", "cargo",
      "courier", "delivery", "parcel", "last mile",
      "shifting", "relocation", "packers", "movers", "loading", "unloading",
      "handling", "material handling", "storage", "warehouse",
      "cold chain", "refrigerated transport",
      "mining transport", "coal transport",
    ],
  },

  // ─── PRINTING & PUBLISHING ───────────────────────────────────────────────
  {
    id: "printing",
    label: "Printing",
    icon: "🖨️",
    description: "Printing, publications, flex, banners, signage, brochures and stationery printing",
    gemCatalogRef: "Paper-based Printing Services / Signage",
    keywords: [
      "printing", "printed", "print", "publication",
      "flex", "banner", "hoarding", "signage", "display board", "glow sign",
      "letterhead", "visiting card", "business card",
      "brochure", "booklet", "pamphlet", "leaflet", "flyer",
      "offset printing", "digital printing", "screen printing",
      "calendar", "diary printing", "register printing",
      "security printing", "cheque printing",
      "label", "sticker", "barcode label",
    ],
  },

  // ─── CATERING & FOOD ─────────────────────────────────────────────────────
  {
    id: "catering",
    label: "Catering & Food",
    icon: "🍽️",
    description: "Catering, canteen management, vending machines, food supply and mess services",
    gemCatalogRef: "Catering Services / Food Supply",
    keywords: [
      "catering", "canteen", "food", "meal", "lunch", "dinner", "breakfast",
      "snack", "refreshment", "tiffin", "mess", "kitchen",
      "vending", "vending machine", "tea", "coffee", "beverage",
      "ration", "grocery", "provisions", "food supply",
      // Specific food items (fixes the groundnut oil / mustard oil misclassification)
      "oil", "edible oil", "groundnut oil", "mustard oil", "sunflower oil",
      "refined oil", "cooking oil", "ghee", "vanaspati",
      "rice", "wheat", "flour", "dal", "pulses", "sugar", "salt",
      "spices", "masala", "condiment",
      "biscuit", "bread", "milk", "dairy",
      "mineral water", "drinking water",
      "fish", "meat", "poultry", "egg",
      "fruits", "vegetables", "fresh produce",
    ],
  },

  // ─── TEXTILE & UNIFORM ───────────────────────────────────────────────────
  {
    id: "textile",
    label: "Textile & Uniform",
    icon: "👕",
    description: "Uniforms, fabric, linen, bedsheets, towels, blankets and textile products",
    gemCatalogRef: "Textile Products / Handloom / Uniform",
    keywords: [
      "textile", "uniform", "dress", "apparel", "garment", "clothing",
      "cloth", "fabric", "handloom", "khadi",
      "linen", "bedsheet", "bed sheet", "pillow cover", "blanket",
      "towel", "bath towel", "hand towel",
      "curtain", "drape", "blinds",
      "mat", "carpet", "rug", "door mat", "coir mat",
      "hosiery", "woolen", "wool", "jute",
      "raincoat", "jacket", "vest", "gloves textile",
      "flag", "bunting",
      "tarpaulin", "tent",
    ],
  },

  // ─── MAINTENANCE & AMC ───────────────────────────────────────────────────
  {
    id: "maintenance",
    label: "Maintenance / AMC",
    icon: "🔧",
    description: "Annual maintenance contracts, overhauling, facility management and repair services",
    gemCatalogRef: "AMC / CMC Services / Facility Management",
    keywords: [
      "maintenance", "amc", "cmc", "annual maintenance", "comprehensive maintenance",
      "overhauling", "servicing", "breakdown", "preventive maintenance",
      "corrective maintenance", "predictive maintenance",
      "facility management", "housekeeping amc", "pest control amc",
      "calibration", "testing and calibration",
      "repair of", "repair and maintenance",
      "operation and maintenance", "o&m",
      "lift maintenance", "elevator amc",
      "hvac maintenance", "air conditioner amc", "ac amc",
      "generator amc", "ups amc",
      "water purifier amc", "ro maintenance",
      "fire alarm amc", "fire equipment maintenance",
    ],
  },

  // ─── PIPES, VALVES & HARDWARE ────────────────────────────────────────────
  {
    id: "pipes-hardware",
    label: "Pipes & Hardware",
    icon: "🔩",
    description: "Pipes, fittings, valves, pumps, steel structures, nuts, bolts and hardware",
    gemCatalogRef: "Pipes and Fittings / Steel Tubes / Hardware",
    keywords: [
      "pipe", "fitting", "valve", "pump", "hose",
      "gi pipe", "ms pipe", "hdpe pipe", "pvc pipe", "cpvc pipe",
      "stainless steel pipe", "ss pipe",
      "flange", "elbow", "tee", "reducer", "coupling",
      "gate valve", "ball valve", "butterfly valve", "check valve",
      "water pump", "submersible pump", "centrifugal pump", "motor pump",
      "hardware", "bolt", "nut", "screw", "fastener", "anchor",
      "steel structure", "ms fabrication", "iron", "cast iron",
      "galvanized", "gi sheet", "ms sheet", "chequered plate",
      "wire rope", "chain", "pulley",
    ],
  },

  // ─── CLEANING & SANITATION ───────────────────────────────────────────────
  {
    id: "cleaning",
    label: "Cleaning",
    icon: "🧹",
    description: "Housekeeping, sanitation, pest control, waste management and horticulture",
    gemCatalogRef: "Housekeeping / Cleaning Services / Pest Control",
    keywords: [
      "cleaning", "housekeeping", "sanitation", "sweeping", "mopping",
      "disinfection", "sanitization", "fumigation",
      "pest control", "termite", "rodent control",
      "garbage", "waste management", "solid waste", "liquid waste",
      "sewage", "effluent treatment", "sewage treatment",
      "horticulture", "gardening", "landscaping", "lawn",
      "tree trimming", "grass cutting",
      "deep cleaning", "facade cleaning", "glass cleaning",
      "toilet cleaning", "washroom maintenance",
    ],
  },

  // ─── EVENTS & TRAINING ───────────────────────────────────────────────────
  {
    id: "events-training",
    label: "Events & Training",
    icon: "🎪",
    description: "Events, seminars, workshops, exhibitions, training programs and conferences",
    gemCatalogRef: "Event Management / Training Services",
    keywords: [
      "event", "seminar", "workshop", "exhibition", "conference",
      "training", "expo", "fair", "meeting", "inauguration",
      "ceremony", "awareness programme", "awareness campaign",
      "coaching", "skill development", "capacity building",
      "webinar", "virtual event",
      "audio visual", "av equipment", "sound system", "pa system",
      "stage", "podium", "backdrop",
      "tent", "pandal", "shamiana",
      "hospitality", "banquet",
    ],
  },

  // ─── OFFICE SUPPLIES & STATIONERY ────────────────────────────────────────
  {
    id: "supplies",
    label: "Supplies & Stationery",
    icon: "📦",
    description: "Stationery, office supplies, consumables, toners, tools and general items",
    gemCatalogRef: "Stationery Items / Office Supplies / Consumables",
    keywords: [
      "stationery", "paper", "a4 paper", "maplitho", "copier paper",
      "pen", "pencil", "marker", "highlighter",
      "diary", "register", "notebook", "notepad", "file", "folder",
      "envelope", "stamp pad",
      "toner", "cartridge", "ink", "ribbon",
      "consumable", "kit", "tool kit", "spares", "spare parts",
      "cleaning material", "housekeeping material",
      "safety equipment", "helmet", "safety shoe", "safety vest",
      "first aid", "first aid kit",
      "rubber stamp", "seal",
      "weighing scale", "measuring tape",
    ],
  },

  // ─── SURVEY, CONSULTING & RESEARCH ──────────────────────────────────────
  {
    id: "survey-consulting",
    label: "Survey & Consulting",
    icon: "📋",
    description: "Surveys, consultancy, audits, inspections, DPRs, GIS mapping and assessments",
    gemCatalogRef: "Consultancy / Professional Services / Survey",
    keywords: [
      "survey", "consultancy", "consulting", "advisory", "consultant",
      "audit", "statutory audit", "internal audit", "tax audit",
      "inspection", "quality inspection", "third party inspection",
      "testing", "quality testing", "material testing", "ndt",
      "assessment", "feasibility", "feasibility study",
      "detailed project report", "dpr",
      "gis", "mapping", "remote sensing", "drone survey",
      "valuation", "property valuation",
      "research", "study", "evaluation",
      "legal services", "legal consultant", "law",
    ],
  },

  // ─── WATER & ENVIRONMENT ─────────────────────────────────────────────────
  {
    id: "water-environment",
    label: "Water & Environment",
    icon: "💧",
    description: "Water supply, sewage treatment, water purifiers, ETP, STP and environmental services",
    gemCatalogRef: "Water Supply / STP / ETP / Water Treatment",
    keywords: [
      "water supply", "water treatment", "water purifier", "ro plant",
      "effluent treatment", "etp", "sewage treatment", "stp",
      "rain water harvesting", "water harvesting",
      "borewell", "tube well", "hand pump", "overhead tank",
      "water tanker", "water supply tanker",
      "solid waste", "e-waste", "biomedical waste",
      "pollution control", "environment", "environmental",
      "green", "solar", "renewable",
    ],
  },

  // ─── DEFENCE & SPECIALIZED ───────────────────────────────────────────────
  {
    id: "defence",
    label: "Defence & Specialized",
    icon: "🛡️",
    description: "Defence equipment, army stores, specialized military items and tactical gear",
    gemCatalogRef: "Defence / Ministry of Defence Procurement",
    keywords: [
      "assault", "tactical", "ballistic", "armour", "armored",
      "military", "army", "navy", "air force", "defence",
      "ordnance", "ammunition storage",
      "camouflage", "combat", "patrol", "field equipment",
      "night vision", "binoculars", "telescope",
      "rifle", "arms", "weapon",
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
          const regex = new RegExp(`\\b${keyword.replace(/[.*+?^$()|[\\]\\\\]/g, '\\$&')}\\b`, "i");
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
 * Returns label + icon string for display, e.g. "💻 IT & Tech"
 */
export function getCategoryLabel(id: string): string {
  const cat = getCategoryById(id);
  return cat ? `${cat.icon} ${cat.label}` : "";
}
