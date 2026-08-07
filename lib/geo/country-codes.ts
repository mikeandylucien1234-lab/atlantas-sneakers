// Converts a free-text country (as typed at checkout) into the ISO 3166-1
// alpha-2 code that the CJ Dropshipping API requires (shippingCountryCode).
// Accepts already-valid 2-letter codes and a range of common spellings.
const NAME_TO_ISO: Record<string, string> = {
  haiti: "HT", "haïti": "HT",
  "united states": "US", "united states of america": "US", usa: "US", "u.s.a.": "US", us: "US", america: "US",
  canada: "CA",
  "dominican republic": "DO", "république dominicaine": "DO", "republica dominicana": "DO",
  france: "FR", "united kingdom": "GB", uk: "GB", "great britain": "GB", england: "GB",
  germany: "DE", allemagne: "DE", spain: "ES", espagne: "ES", "españa": "ES", italy: "IT", italie: "IT",
  mexico: "MX", mexique: "MX", brazil: "BR", "brésil": "BR", jamaica: "JM", jamaïque: "JM",
  "the bahamas": "BS", bahamas: "BS", cuba: "CU", "puerto rico": "PR",
  belgium: "BE", belgique: "BE", netherlands: "NL", "pays-bas": "NL", switzerland: "CH", suisse: "CH",
  portugal: "PT", ireland: "IE", australia: "AU", "new zealand": "NZ",
  china: "CN", chine: "CN", japan: "JP", japon: "JP", "south korea": "KR", india: "IN",
  chile: "CL", chili: "CL", argentina: "AR", colombia: "CO", colombie: "CO", panama: "PA",
  "trinidad and tobago": "TT", guadeloupe: "GP", martinique: "MQ", "french guiana": "GF", "guyane": "GF",
};

// Returns an ISO alpha-2 code (uppercased) or null when it can't be resolved.
export function toCountryCode(input?: string | null): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  // Already a 2-letter code.
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const key = raw.toLowerCase().replace(/\s+/g, " ").trim();
  return NAME_TO_ISO[key] || null;
}
