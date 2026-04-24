// IATA code → City name mapping
// Usage: AIRPORTS['FRA'] → 'Frankfurt am Main'
export const AIRPORTS = {
  // Europe
  FRA: 'Frankfurt am Main',
  MUC: 'München',
  BER: 'Berlin Brandenburg',
  HAM: 'Hamburg',
  DUS: 'Düsseldorf',
  STR: 'Stuttgart',
  CGN: 'Köln/Bonn',
  NUE: 'Nürnberg',
  HAJ: 'Hannover',
  LEJ: 'Leipzig/Halle',
  LHR: 'London Heathrow',
  LGW: 'London Gatwick',
  STN: 'London Stansted',
  LTN: 'London Luton',
  CDG: 'Paris Charles de Gaulle',
  ORY: 'Paris Orly',
  AMS: 'Amsterdam',
  VIE: 'Wien',
  ZRH: 'Zürich',
  GVA: 'Genf',
  BSL: 'Basel',
  BCN: 'Barcelona',
  MAD: 'Madrid',
  LIS: 'Lissabon',
  FCO: 'Rom Fiumicino',
  MXP: 'Mailand Malpensa',
  LIN: 'Mailand Linate',
  VCE: 'Venedig',
  NAP: 'Neapel',
  ATH: 'Athen',
  IST: 'Istanbul',
  SAW: 'Istanbul Sabiha Gökçen',
  BRU: 'Brüssel',
  CPH: 'Kopenhagen',
  ARN: 'Stockholm Arlanda',
  OSL: 'Oslo',
  HEL: 'Helsinki',
  WAW: 'Warschau',
  PRG: 'Prag',
  BUD: 'Budapest',
  OTP: 'Bukarest',
  SOF: 'Sofia',
  LJU: 'Ljubljana',
  ZAG: 'Zagreb',
  DBV: 'Dubrovnik',
  SPU: 'Split',
  SKG: 'Thessaloniki',
  RHO: 'Rhodos',
  HER: 'Heraklion/Kreta',
  CFU: 'Korfu',
  PMI: 'Palma de Mallorca',
  IBZ: 'Ibiza',
  TFS: 'Teneriffa Süd',
  LPA: 'Las Palmas/Gran Canaria',
  AGP: 'Málaga',
  ALC: 'Alicante',
  VLC: 'Valencia',
  SVQ: 'Sevilla',
  FAO: 'Faro',
  OPO: 'Porto',
  NCE: 'Nizza',
  MRS: 'Marseille',
  TLS: 'Toulouse',
  BOD: 'Bordeaux',
  LYS: 'Lyon',
  BIO: 'Bilbao',
  EDI: 'Edinburgh',
  MAN: 'Manchester',
  BHX: 'Birmingham',
  BRS: 'Bristol',
  DUB: 'Dublin',
  SNN: 'Shannon',
  RVN: 'Rovaniemi',

  // North America
  JFK: 'New York JFK',
  EWR: 'New York Newark',
  LGA: 'New York LaGuardia',
  LAX: 'Los Angeles',
  SFO: 'San Francisco',
  ORD: "Chicago O'Hare",
  MDW: 'Chicago Midway',
  MIA: 'Miami',
  FLL: 'Fort Lauderdale',
  MCO: 'Orlando',
  ATL: 'Atlanta',
  BOS: 'Boston',
  IAD: 'Washington Dulles',
  DCA: 'Washington National',
  SEA: 'Seattle',
  DEN: 'Denver',
  PHX: 'Phoenix',
  LAS: 'Las Vegas',
  DFW: 'Dallas/Fort Worth',
  IAH: 'Houston',
  MSP: 'Minneapolis',
  DTW: 'Detroit',
  CLT: 'Charlotte',
  PHL: 'Philadelphia',
  YYZ: 'Toronto',
  YVR: 'Vancouver',
  YUL: 'Montréal',
  MEX: 'Mexiko-Stadt',
  CUN: 'Cancún',
  GDL: 'Guadalajara',

  // South America
  GRU: 'São Paulo',
  GIG: 'Rio de Janeiro',
  BSB: 'Brasília',
  EZE: 'Buenos Aires',
  SCL: 'Santiago de Chile',
  BOG: 'Bogotá',
  LIM: 'Lima',
  UIO: 'Quito',

  // Middle East
  DXB: 'Dubai',
  AUH: 'Abu Dhabi',
  DOH: 'Doha',
  KWI: 'Kuwait City',
  BAH: 'Bahrain',
  RUH: 'Riad',
  JED: 'Dschidda',
  AMM: 'Amman',
  BEY: 'Beirut',
  TLV: 'Tel Aviv',

  // Asia
  NRT: 'Tokyo Narita',
  HND: 'Tokyo Haneda',
  KIX: 'Osaka',
  ICN: 'Seoul Incheon',
  PEK: 'Peking',
  PVG: 'Shanghai Pudong',
  CAN: 'Guangzhou',
  HKG: 'Hongkong',
  SIN: 'Singapur',
  BKK: 'Bangkok Suvarnabhumi',
  DMK: 'Bangkok Don Mueang',
  HAN: 'Hanoi',
  SGN: 'Ho-Chi-Minh-Stadt',
  KUL: 'Kuala Lumpur',
  CGK: 'Jakarta',
  DPS: 'Bali/Denpasar',
  MNL: 'Manila',
  BOM: 'Mumbai',
  DEL: 'Neu-Delhi',
  BLR: 'Bangalore',
  MAA: 'Chennai',
  CCU: 'Kalkutta',
  CMB: 'Colombo',
  DAC: 'Dhaka',

  // Africa
  CAI: 'Kairo',
  CMN: 'Casablanca',
  TUN: 'Tunis',
  ALG: 'Algier',
  JNB: 'Johannesburg',
  CPT: 'Kapstadt',
  NBO: 'Nairobi',
  ADD: 'Addis Abeba',
  LOS: 'Lagos',
  ACC: 'Accra',

  // Australia & Pacific
  SYD: 'Sydney',
  MEL: 'Melbourne',
  BNE: 'Brisbane',
  PER: 'Perth',
  ADL: 'Adelaide',
  AKL: 'Auckland',
  CHC: 'Christchurch',
}

/**
 * Returns "FRA – Frankfurt am Main" or just "FRA" if unknown
 */
export function airportLabel(code) {
  if (!code) return ''
  const city = AIRPORTS[code.toUpperCase()]
  return city ? `${code.toUpperCase()} – ${city}` : code.toUpperCase()
}

/**
 * Given user input like "FRA – Frankfurt am Main" or "FRA" or "Frankfurt",
 * returns the 3-letter IATA code (uppercase) or null.
 */
export function parseIata(input) {
  if (!input) return null
  const s = input.trim()
  // format "FRA – ..."
  const dashMatch = s.match(/^([A-Z]{3})\s*[–-]/i)
  if (dashMatch) return dashMatch[1].toUpperCase()
  // plain 3-letter code
  if (/^[A-Z]{3}$/i.test(s)) return s.toUpperCase()
  // search by city name
  const lower = s.toLowerCase()
  const found = Object.entries(AIRPORTS).find(([, city]) => city.toLowerCase().includes(lower))
  return found ? found[0] : null
}

/**
 * Filter airports list by query (code or city)
 */
export function filterAirports(query) {
  if (!query) return []
  const q = query.toLowerCase()
  return Object.entries(AIRPORTS)
    .filter(([code, city]) => code.toLowerCase().startsWith(q) || city.toLowerCase().includes(q))
    .map(([code, city]) => ({ code, label: `${code} – ${city}` }))
    .slice(0, 8)
}
