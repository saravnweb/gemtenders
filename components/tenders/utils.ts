import { CATEGORIES } from "@/lib/categories";
import { normalizeState, normalizeCity } from "@/lib/locations-client";

export function toTitleCase(str: string): string {
  if (!str) return "";
  return str.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export const isNAValue = (v?: string | null) => !v || /^n\/?a$/i.test(v.trim());

// Pre-compile category keyword regexes once at module level
export const CATEGORY_REGEXES: { cat: (typeof CATEGORIES)[0]; regexes: Array<RegExp | null> }[] =
  CATEGORIES.map((cat) => ({
    cat,
    regexes: cat.keywords.map((k) => {
      try {
        return new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
      } catch {
        return null;
      }
    }),
  }));

export function getCategory(title: string, summary: string) {
  const text = `${title} ${summary || ""}`.toLowerCase();
  return CATEGORY_REGEXES.find(({ regexes, cat }) =>
    regexes.some((re, i) => re ? re.test(text) : text.includes(cat.keywords[i]))
  )?.cat;
}

export function formatDepartmentInfo(ministry?: string, dept?: string, org?: string): string {
  let ministryStr = ministry || "";
  let deptStr = dept || "";
  let orgStr = isNAValue(org) ? "" : (org || "");

  const states = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Puducherry","Chandigarh","Ladakh","Jammu And Kashmir", "Andaman And Nicobar", "Lakshadweep", "Dadra And Nagar Haveli And Daman And Diu"];

  if (!ministryStr && deptStr) {
    const splitRegex = /(Ministry Of .+?)(Department Of.*|Office Of.*|Organisation Of.*|Division Of.*|Central Public Sector Enterprise.*)/i;
    const match = deptStr.match(splitRegex);
    if (match) { ministryStr = match[1].trim(); deptStr = match[2].trim(); }
    else {
      const repeatMatch = deptStr.match(/(Ministry Of ([A-Z][a-z]+))\2/i);
      if (repeatMatch) { ministryStr = repeatMatch[1].trim(); deptStr = deptStr.substring(ministryStr.length).trim(); }
    }
  }

  states.forEach((state) => {
    const stateRegex = new RegExp(`([^\\s,])\\s*(${state})$`, "i");
    if (stateRegex.test(deptStr)) {
      if (!ministryStr) ministryStr = state;
      deptStr = deptStr.replace(stateRegex, "$1").trim();
    }
  });

  if (ministryStr && deptStr.toLowerCase().startsWith(ministryStr.toLowerCase())) {
    deptStr = deptStr.substring(ministryStr.length).trim();
  }

  let cleanDept = deptStr.replace(/([^\s,])(Department Of|Office Of|Organisation Of|Division Of)/gi, "$1, $2");

  if (orgStr) {
    const orgNorm = orgStr.toLowerCase().replace(/\s+/g, " ").trim();
    const mNorm = ministryStr.toLowerCase();
    const dNorm = deptStr.toLowerCase();
    if (
      dNorm.includes(orgNorm) ||
      mNorm.includes(orgNorm) ||
      orgNorm.includes(mNorm) ||
      (mNorm && dNorm && orgNorm.includes(mNorm) && orgNorm.includes(dNorm))
    ) {
      orgStr = "";
    }
  }

  const parts = [ministryStr, cleanDept, orgStr].filter(Boolean).map((s) => toTitleCase(s));
  return parts.join(", ").replace(/, ,/g, ",").replace(/([A-Z][a-z]+)\1/g, "$1");
}

export function buildSearchOrClause(q: string): string {
  const terms = q.split(",").map((s) => s.trim()).filter(Boolean);
  return terms.map((term) =>
    `title.ilike.%${term}%,bid_number.ilike.%${term}%,ra_number.ilike.%${term}%,department.ilike.%${term}%,ministry_name.ilike.%${term}%,organisation_name.ilike.%${term}%,state.ilike.%${term}%,city.ilike.%${term}%,ai_summary.ilike.%${term}%`
  ).join(",");
}
