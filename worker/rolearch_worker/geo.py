"""Location parsing: free-text ATS locations -> country, region, city, coordinates."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

# ISO2 -> (name, region). Regions match the site's filters.
COUNTRIES: dict[str, tuple[str, str]] = {
    # North America
    "US": ("United States", "north-america"), "CA": ("Canada", "north-america"),
    # Latin America
    "MX": ("Mexico", "latin-america"), "BR": ("Brazil", "latin-america"), "AR": ("Argentina", "latin-america"),
    "CO": ("Colombia", "latin-america"), "CL": ("Chile", "latin-america"), "PE": ("Peru", "latin-america"),
    "UY": ("Uruguay", "latin-america"), "CR": ("Costa Rica", "latin-america"), "EC": ("Ecuador", "latin-america"),
    "GT": ("Guatemala", "latin-america"), "DO": ("Dominican Republic", "latin-america"), "PA": ("Panama", "latin-america"),
    "PR": ("Puerto Rico", "latin-america"), "VE": ("Venezuela", "latin-america"), "BO": ("Bolivia", "latin-america"),
    "PY": ("Paraguay", "latin-america"), "SV": ("El Salvador", "latin-america"), "HN": ("Honduras", "latin-america"),
    "NI": ("Nicaragua", "latin-america"), "JM": ("Jamaica", "latin-america"), "TT": ("Trinidad and Tobago", "latin-america"),
    "BS": ("Bahamas", "latin-america"), "BB": ("Barbados", "latin-america"), "CU": ("Cuba", "latin-america"),
    # Europe
    "GB": ("United Kingdom", "europe"), "IE": ("Ireland", "europe"), "DE": ("Germany", "europe"), "FR": ("France", "europe"),
    "NL": ("Netherlands", "europe"), "BE": ("Belgium", "europe"), "LU": ("Luxembourg", "europe"), "ES": ("Spain", "europe"),
    "PT": ("Portugal", "europe"), "IT": ("Italy", "europe"), "CH": ("Switzerland", "europe"), "AT": ("Austria", "europe"),
    "SE": ("Sweden", "europe"), "NO": ("Norway", "europe"), "DK": ("Denmark", "europe"), "FI": ("Finland", "europe"),
    "IS": ("Iceland", "europe"), "PL": ("Poland", "europe"), "CZ": ("Czechia", "europe"), "SK": ("Slovakia", "europe"),
    "HU": ("Hungary", "europe"), "RO": ("Romania", "europe"), "BG": ("Bulgaria", "europe"), "GR": ("Greece", "europe"),
    "HR": ("Croatia", "europe"), "SI": ("Slovenia", "europe"), "RS": ("Serbia", "europe"), "EE": ("Estonia", "europe"),
    "LV": ("Latvia", "europe"), "LT": ("Lithuania", "europe"), "UA": ("Ukraine", "europe"), "CY": ("Cyprus", "europe"),
    "MT": ("Malta", "europe"), "TR": ("Turkey", "europe"), "BA": ("Bosnia and Herzegovina", "europe"),
    "MK": ("North Macedonia", "europe"), "AL": ("Albania", "europe"), "MD": ("Moldova", "europe"), "GE": ("Georgia", "europe"),
    "AM": ("Armenia", "europe"), "ME": ("Montenegro", "europe"), "XK": ("Kosovo", "europe"), "BY": ("Belarus", "europe"),
    "RU": ("Russia", "europe"), "LI": ("Liechtenstein", "europe"), "MC": ("Monaco", "europe"), "AD": ("Andorra", "europe"),
    "AZ": ("Azerbaijan", "europe"),
    # India
    "IN": ("India", "india"),
    # Asia-Pacific
    "SG": ("Singapore", "asia-pacific"), "JP": ("Japan", "asia-pacific"), "KR": ("South Korea", "asia-pacific"),
    "CN": ("China", "asia-pacific"), "HK": ("Hong Kong", "asia-pacific"), "TW": ("Taiwan", "asia-pacific"),
    "AU": ("Australia", "asia-pacific"), "NZ": ("New Zealand", "asia-pacific"), "ID": ("Indonesia", "asia-pacific"),
    "MY": ("Malaysia", "asia-pacific"), "TH": ("Thailand", "asia-pacific"), "VN": ("Vietnam", "asia-pacific"),
    "PH": ("Philippines", "asia-pacific"), "PK": ("Pakistan", "asia-pacific"), "BD": ("Bangladesh", "asia-pacific"),
    "LK": ("Sri Lanka", "asia-pacific"), "NP": ("Nepal", "asia-pacific"), "KZ": ("Kazakhstan", "asia-pacific"),
    "KH": ("Cambodia", "asia-pacific"), "MM": ("Myanmar", "asia-pacific"), "LA": ("Laos", "asia-pacific"),
    "MN": ("Mongolia", "asia-pacific"), "BN": ("Brunei", "asia-pacific"), "MO": ("Macau", "asia-pacific"),
    "UZ": ("Uzbekistan", "asia-pacific"), "FJ": ("Fiji", "asia-pacific"),
    # Middle East & Africa
    "AE": ("United Arab Emirates", "middle-east-africa"), "SA": ("Saudi Arabia", "middle-east-africa"),
    "QA": ("Qatar", "middle-east-africa"), "BH": ("Bahrain", "middle-east-africa"), "KW": ("Kuwait", "middle-east-africa"),
    "OM": ("Oman", "middle-east-africa"), "JO": ("Jordan", "middle-east-africa"), "LB": ("Lebanon", "middle-east-africa"),
    "IL": ("Israel", "middle-east-africa"), "EG": ("Egypt", "middle-east-africa"), "MA": ("Morocco", "middle-east-africa"),
    "TN": ("Tunisia", "middle-east-africa"), "NG": ("Nigeria", "middle-east-africa"), "GH": ("Ghana", "middle-east-africa"),
    "KE": ("Kenya", "middle-east-africa"), "ZA": ("South Africa", "middle-east-africa"), "RW": ("Rwanda", "middle-east-africa"),
    "UG": ("Uganda", "middle-east-africa"), "TZ": ("Tanzania", "middle-east-africa"), "ET": ("Ethiopia", "middle-east-africa"),
    "SN": ("Senegal", "middle-east-africa"), "CI": ("Côte d'Ivoire", "middle-east-africa"),
    "DZ": ("Algeria", "middle-east-africa"), "AO": ("Angola", "middle-east-africa"), "CM": ("Cameroon", "middle-east-africa"),
    "ZM": ("Zambia", "middle-east-africa"), "ZW": ("Zimbabwe", "middle-east-africa"), "BW": ("Botswana", "middle-east-africa"),
    "NA": ("Namibia", "middle-east-africa"), "MZ": ("Mozambique", "middle-east-africa"), "MU": ("Mauritius", "middle-east-africa"),
    "IQ": ("Iraq", "middle-east-africa"), "PS": ("Palestine", "middle-east-africa"), "LY": ("Libya", "middle-east-africa"),
}

ISO3 = {
    "USA": "US", "CAN": "CA", "MEX": "MX", "BRA": "BR", "ARG": "AR", "COL": "CO", "CHL": "CL", "GBR": "GB", "IRL": "IE",
    "DEU": "DE", "FRA": "FR", "NLD": "NL", "ESP": "ES", "PRT": "PT", "ITA": "IT", "CHE": "CH", "SWE": "SE", "NOR": "NO",
    "DNK": "DK", "FIN": "FI", "POL": "PL", "IND": "IN", "SGP": "SG", "JPN": "JP", "KOR": "KR", "AUS": "AU", "NZL": "NZ",
    "ARE": "AE", "ISR": "IL", "ZAF": "ZA", "NGA": "NG", "KEN": "KE", "EGY": "EG", "CHN": "CN", "HKG": "HK", "IDN": "ID",
    "PHL": "PH", "MYS": "MY", "THA": "TH", "VNM": "VN", "TUR": "TR", "AUT": "AT", "BEL": "BE", "CZE": "CZ", "ROU": "RO",
}

ALIASES = {
    "usa": "US", "u.s.": "US", "u.s.a.": "US", "united states of america": "US", "america": "US", "us": "US",
    "uk": "GB", "u.k.": "GB", "england": "GB", "scotland": "GB", "wales": "GB", "great britain": "GB", "britain": "GB",
    "northern ireland": "GB", "deutschland": "DE", "the netherlands": "NL", "holland": "NL", "uae": "AE",
    "korea": "KR", "republic of korea": "KR", "czech republic": "CZ", "türkiye": "TR", "turkiye": "TR",
    "brasil": "BR", "méxico": "MX", "españa": "ES", "espana": "ES", "italia": "IT", "schweiz": "CH", "suisse": "CH",
    "österreich": "AT", "polska": "PL", "ksa": "SA", "mainland china": "CN", "prc": "CN",
}

US_STATES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
    "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
    "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
}
US_STATE_NAMES = {
    "california", "new york", "texas", "washington", "massachusetts", "illinois", "colorado", "georgia", "florida",
    "north carolina", "virginia", "pennsylvania", "oregon", "utah", "arizona", "new jersey", "michigan", "minnesota",
    "ohio", "tennessee", "maryland", "wisconsin", "missouri", "indiana", "connecticut", "district of columbia",
}
CA_PROVINCES = {"ON", "QC", "BC", "AB", "MB", "NS", "SK", "NB", "NL", "PE", "ontario", "quebec", "british columbia", "alberta"}

# Major tech cities: name -> (ISO2, lat, lon). Used for country inference and the site's map.
CITIES: dict[str, tuple[str, float, float]] = {
    "new york": ("US", 40.71, -74.0), "new york city": ("US", 40.71, -74.0), "nyc": ("US", 40.71, -74.0),
    "san francisco": ("US", 37.77, -122.42), "sf": ("US", 37.77, -122.42), "seattle": ("US", 47.61, -122.33),
    "austin": ("US", 30.27, -97.74), "boston": ("US", 42.36, -71.06), "chicago": ("US", 41.88, -87.63),
    "los angeles": ("US", 34.05, -118.24), "denver": ("US", 39.74, -104.99), "atlanta": ("US", 33.75, -84.39),
    "washington dc": ("US", 38.91, -77.04), "san jose": ("US", 37.34, -121.89), "palo alto": ("US", 37.44, -122.14),
    "mountain view": ("US", 37.39, -122.08), "menlo park": ("US", 37.45, -122.18), "sunnyvale": ("US", 37.37, -122.04),
    "san mateo": ("US", 37.56, -122.32), "san diego": ("US", 32.72, -117.16), "miami": ("US", 25.76, -80.19),
    "dallas": ("US", 32.78, -96.8), "houston": ("US", 29.76, -95.37), "philadelphia": ("US", 39.95, -75.17),
    "pittsburgh": ("US", 40.44, -80.0), "salt lake city": ("US", 40.76, -111.89), "portland": ("US", 45.52, -122.68),
    "raleigh": ("US", 35.78, -78.64), "minneapolis": ("US", 44.98, -93.27), "nashville": ("US", 36.16, -86.78),
    "toronto": ("CA", 43.65, -79.38), "vancouver": ("CA", 49.28, -123.12), "montreal": ("CA", 45.5, -73.57),
    "ottawa": ("CA", 45.42, -75.7), "waterloo": ("CA", 43.46, -80.52), "calgary": ("CA", 51.05, -114.07),
    "mexico city": ("MX", 19.43, -99.13), "ciudad de méxico": ("MX", 19.43, -99.13), "guadalajara": ("MX", 20.66, -103.35),
    "monterrey": ("MX", 25.69, -100.32), "são paulo": ("BR", -23.55, -46.63), "sao paulo": ("BR", -23.55, -46.63),
    "rio de janeiro": ("BR", -22.91, -43.17), "belo horizonte": ("BR", -19.92, -43.94), "florianópolis": ("BR", -27.6, -48.55),
    "buenos aires": ("AR", -34.6, -58.38), "bogotá": ("CO", 4.71, -74.07), "bogota": ("CO", 4.71, -74.07),
    "medellín": ("CO", 6.24, -75.58), "medellin": ("CO", 6.24, -75.58), "santiago": ("CL", -33.45, -70.67),
    "lima": ("PE", -12.05, -77.04), "montevideo": ("UY", -34.9, -56.16), "san josé": ("CR", 9.93, -84.08),
    "london": ("GB", 51.51, -0.13), "manchester": ("GB", 53.48, -2.24), "edinburgh": ("GB", 55.95, -3.19),
    "cambridge": ("GB", 52.2, 0.12), "bristol": ("GB", 51.45, -2.59), "dublin": ("IE", 53.35, -6.26),
    "berlin": ("DE", 52.52, 13.4), "munich": ("DE", 48.14, 11.58), "münchen": ("DE", 48.14, 11.58),
    "hamburg": ("DE", 53.55, 9.99), "frankfurt": ("DE", 50.11, 8.68), "cologne": ("DE", 50.94, 6.96),
    "paris": ("FR", 48.86, 2.35), "lyon": ("FR", 45.76, 4.84), "amsterdam": ("NL", 52.37, 4.9), "rotterdam": ("NL", 51.92, 4.48),
    "utrecht": ("NL", 52.09, 5.12), "brussels": ("BE", 50.85, 4.35), "madrid": ("ES", 40.42, -3.7), "barcelona": ("ES", 41.39, 2.17),
    "lisbon": ("PT", 38.72, -9.14), "lisboa": ("PT", 38.72, -9.14), "porto": ("PT", 41.15, -8.61), "milan": ("IT", 45.46, 9.19),
    "rome": ("IT", 41.9, 12.5), "zurich": ("CH", 47.38, 8.54), "zürich": ("CH", 47.38, 8.54), "geneva": ("CH", 46.2, 6.14),
    "vienna": ("AT", 48.21, 16.37), "stockholm": ("SE", 59.33, 18.07), "gothenburg": ("SE", 57.71, 11.97),
    "oslo": ("NO", 59.91, 10.75), "copenhagen": ("DK", 55.68, 12.57), "helsinki": ("FI", 60.17, 24.94),
    "warsaw": ("PL", 52.23, 21.01), "kraków": ("PL", 50.06, 19.94), "krakow": ("PL", 50.06, 19.94), "wroclaw": ("PL", 51.11, 17.03),
    "prague": ("CZ", 50.08, 14.44), "budapest": ("HU", 47.5, 19.04), "bucharest": ("RO", 44.43, 26.1), "sofia": ("BG", 42.7, 23.32),
    "athens": ("GR", 37.98, 23.73), "tallinn": ("EE", 59.44, 24.75), "riga": ("LV", 56.95, 24.11), "vilnius": ("LT", 54.69, 25.28),
    "kyiv": ("UA", 50.45, 30.52), "istanbul": ("TR", 41.01, 28.98), "belgrade": ("RS", 44.79, 20.45),
    "bengaluru": ("IN", 12.97, 77.59), "bangalore": ("IN", 12.97, 77.59), "mumbai": ("IN", 19.08, 72.88),
    "pune": ("IN", 18.52, 73.86), "hyderabad": ("IN", 17.39, 78.49), "chennai": ("IN", 13.08, 80.27),
    "new delhi": ("IN", 28.61, 77.21), "delhi": ("IN", 28.61, 77.21), "gurgaon": ("IN", 28.46, 77.03), "gurugram": ("IN", 28.46, 77.03),
    "noida": ("IN", 28.54, 77.39), "kolkata": ("IN", 22.57, 88.36), "ahmedabad": ("IN", 23.02, 72.57),
    "singapore": ("SG", 1.35, 103.82), "tokyo": ("JP", 35.68, 139.69), "osaka": ("JP", 34.69, 135.5), "seoul": ("KR", 37.57, 126.98),
    "beijing": ("CN", 39.9, 116.4), "shanghai": ("CN", 31.23, 121.47), "shenzhen": ("CN", 22.54, 114.06),
    "hong kong": ("HK", 22.32, 114.17), "taipei": ("TW", 25.03, 121.57), "sydney": ("AU", -33.87, 151.21),
    "melbourne": ("AU", -37.81, 144.96), "brisbane": ("AU", -27.47, 153.03), "perth": ("AU", -31.95, 115.86),
    "auckland": ("NZ", -36.85, 174.76), "wellington": ("NZ", -41.29, 174.78), "jakarta": ("ID", -6.2, 106.85),
    "kuala lumpur": ("MY", 3.14, 101.69), "bangkok": ("TH", 13.76, 100.5), "ho chi minh city": ("VN", 10.82, 106.63),
    "hanoi": ("VN", 21.03, 105.85), "manila": ("PH", 14.6, 120.98), "karachi": ("PK", 24.86, 67.0), "lahore": ("PK", 31.55, 74.34),
    "dubai": ("AE", 25.2, 55.27), "abu dhabi": ("AE", 24.45, 54.38), "riyadh": ("SA", 24.71, 46.68), "doha": ("QA", 25.29, 51.53),
    "tel aviv": ("IL", 32.09, 34.78), "cairo": ("EG", 30.04, 31.24), "lagos": ("NG", 6.52, 3.38), "nairobi": ("KE", -1.29, 36.82),
    "cape town": ("ZA", -33.92, 18.42), "johannesburg": ("ZA", -26.2, 28.05), "accra": ("GH", 5.6, -0.19), "kigali": ("RW", -1.95, 30.06),
    "casablanca": ("MA", 33.57, -7.59), "santiago de chile": ("CL", -33.45, -70.67), "san salvador": ("SV", 13.69, -89.22),
    "curitiba": ("BR", -25.43, -49.27), "porto alegre": ("BR", -30.03, -51.23), "campinas": ("BR", -22.91, -47.06),
    "oakland": ("US", 37.8, -122.27), "bellevue": ("US", 47.61, -122.2), "redwood city": ("US", 37.49, -122.24),
    "irvine": ("US", 33.68, -117.83), "columbus": ("US", 39.96, -83.0), "detroit": ("US", 42.33, -83.05),
    "phoenix": ("US", 33.45, -112.07), "reston": ("US", 38.96, -77.36), "boulder": ("US", 40.01, -105.27),
    "kitchener": ("CA", 43.45, -80.49), "edmonton": ("CA", 53.55, -113.49), "penang": ("MY", 5.41, 100.33),
    "cebu": ("PH", 10.32, 123.89), "taguig": ("PH", 14.52, 121.05), "makati": ("PH", 14.55, 121.02),
    "ho chi minh": ("VN", 10.82, 106.63), "seville": ("ES", 37.39, -5.98), "valencia": ("ES", 39.47, -0.38),
    "malaga": ("ES", 36.72, -4.42), "belfast": ("GB", 54.6, -5.93), "leeds": ("GB", 53.8, -1.55), "cork": ("IE", 51.9, -8.47),
    "gdansk": ("PL", 54.35, 18.65), "poznan": ("PL", 52.41, 16.93), "cluj-napoca": ("RO", 46.77, 23.6), "iasi": ("RO", 47.16, 27.59),
    "brno": ("CZ", 49.2, 16.61), "thessaloniki": ("GR", 40.64, 22.94), "ljubljana": ("SI", 46.06, 14.51), "zagreb": ("HR", 45.81, 15.98),
    "luxembourg": ("LU", 49.61, 6.13), "tbilisi": ("GE", 41.72, 44.79), "yerevan": ("AM", 40.18, 44.51), "almaty": ("KZ", 43.24, 76.89),
    "colombo": ("LK", 6.93, 79.86), "dhaka": ("BD", 23.81, 90.41), "islamabad": ("PK", 33.68, 73.05), "jeddah": ("SA", 21.49, 39.19),
    "amman": ("JO", 31.95, 35.93), "kampala": ("UG", 0.35, 32.58), "dar es salaam": ("TZ", -6.79, 39.21), "addis ababa": ("ET", 9.03, 38.74),
    "abuja": ("NG", 9.08, 7.4), "durban": ("ZA", -29.86, 31.02), "pretoria": ("ZA", -25.75, 28.19), "tunis": ("TN", 36.81, 10.18),
    "san juan": ("PR", 18.47, -66.11), "panama city": ("PA", 8.98, -79.52), "quito": ("EC", -0.18, -78.47),
    "asunción": ("PY", -25.26, -57.58), "la paz": ("BO", -16.5, -68.15), "guatemala city": ("GT", 14.63, -90.51),
    "córdoba": ("AR", -31.42, -64.18), "rosario": ("AR", -32.94, -60.65), "fukuoka": ("JP", 33.59, 130.4), "kyoto": ("JP", 35.01, 135.77),
    "busan": ("KR", 35.18, 129.08), "hangzhou": ("CN", 30.27, 120.16), "guangzhou": ("CN", 23.13, 113.26), "chengdu": ("CN", 30.57, 104.07),
    "adelaide": ("AU", -34.93, 138.6), "canberra": ("AU", -35.28, 149.13), "christchurch": ("NZ", -43.53, 172.64),
    "chandigarh": ("IN", 30.73, 76.78), "jaipur": ("IN", 26.91, 75.79), "kochi": ("IN", 9.93, 76.27), "coimbatore": ("IN", 11.02, 76.96),
    "indore": ("IN", 22.72, 75.86), "trivandrum": ("IN", 8.52, 76.94), "mysore": ("IN", 12.3, 76.64),
}

_by_name = {name.lower(): iso for iso, (name, _) in COUNTRIES.items()}


@dataclass
class Place:
    city: str | None
    country: str | None  # ISO2
    lat: float | None = None
    lon: float | None = None
    remote: bool = False

    @property
    def region(self) -> str:
        return COUNTRIES[self.country][1] if self.country in COUNTRIES else "global"

    @property
    def country_name(self) -> str | None:
        return COUNTRIES[self.country][0] if self.country in COUNTRIES else None


def _fold(s: str) -> str:
    return unicodedata.normalize("NFKC", s).strip().lower()


def country_code(token: str) -> str | None:
    """'Germany' / 'DE' / 'DEU' / 'U.K.' -> ISO2, or None."""
    t = _fold(token).strip(". ")
    if not t:
        return None
    if t in ALIASES:
        return ALIASES[t]
    if t in _by_name:
        return _by_name[t]
    up = t.upper()
    # In job locations "Austin, TX" or "San Francisco, CA" are US states, so two-letter
    # codes that are also state codes (CA, IN, DE...) are left to the state check.
    if len(up) == 2 and up in COUNTRIES and up not in US_STATES:
        return up
    if len(up) == 3 and up in ISO3:
        return ISO3[up]
    return None


_split = re.compile(r"\s*(?:,|;|/|\||\(|\)|\s-\s|–|—|\bor\b)\s*", re.I)
_remote = re.compile(r"\b(remote|anywhere|distributed|work from home|wfh|home[- ]based)\b", re.I)
_not_city = re.compile(
    r"^(hybrid|on-?site|in[- ]office|office|flexible|multiple locations|various|hq|headquarters|tbd|global|worldwide|international)$", re.I
)


def parse_location(text: str | None, default_country: str | None = None) -> Place:
    """Best-effort parse of an ATS location string."""
    if not text:
        return Place(None, default_country)
    remote = bool(_remote.search(text))
    tokens = [t for t in _split.split(text) if t and t.strip() and not _not_city.match(t.strip())]
    country: str | None = None
    city: str | None = None
    lat = lon = None

    for tok in reversed(tokens):
        cc = country_code(tok)
        if cc:
            country = cc
            break
    if not country:
        for tok in tokens:
            t = tok.strip()
            if t.upper() in US_STATES and len(t) == 2 and t.isupper():
                country = "US"
                break
            if _fold(t) in US_STATE_NAMES:
                country = "US"
                break
            if t in CA_PROVINCES or _fold(t) in CA_PROVINCES:
                country = "CA"
                break
    for tok in tokens:
        key = _fold(re.sub(r"\b(hq|office|area|metro|greater)\b", "", tok, flags=re.I)).strip()
        if key in CITIES:
            cc, lat, lon = CITIES[key]
            city = tok.strip()
            # A city name like "Cambridge" or "Santiago" exists in several countries; trust an explicit country.
            if country and country != cc:
                lat = lon = None
            else:
                country = cc
            break
    if not city and not remote and tokens:
        first = tokens[0].strip()
        if not country_code(first) and len(first) <= 40:
            city = first
    if not country and not remote:
        country = default_country
    return Place(city, country, lat, lon, remote)
