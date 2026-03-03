// Berlinale-specific DOM parsing
// Extracts film data from Berlinale website pages

// Venue name normalization map - converts display names to venue keys
const VENUE_NAME_MAP = {
  'zoo palast': 'zoo_palast',
  'hkw': 'hkw',
  'cinestar': 'cinestar_potsdamer_platz',
  'cubix': 'cubix',
  'international': 'international',
  'arsenal': 'arsenal',
  'friedrichstadt-palast': 'friedrichstadt_palast',
  'delphi lux': 'delphi_lux',
  'colosseum': 'colosseum',
  'kulturbrauerei': 'kulturbrauerei',
  'filmtheater am friedrichshain': 'filmtheater_am_friedrichshain',
  'babylon': 'kino_babylon',
  'zeughaus': 'zeughaus_kino',
  'silent green': 'silent_green',
  'urania': 'urania',
  'tilsiter': 'tilsiter_lichtspiele'
};

/**
 * Normalize venue name to venue key
 * @param {string} venueName - Display name from website
 * @returns {string} - Venue key for lookup
 */
function normalizeVenueName(venueName) {
  const normalized = venueName.toLowerCase().trim();

  // Try exact match first
  if (VENUE_NAME_MAP[normalized]) {
    return VENUE_NAME_MAP[normalized];
  }

  // Try partial match
  for (const [key, value] of Object.entries(VENUE_NAME_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Return as-is if no match (will need manual mapping)
  console.warn(`Unknown venue: ${venueName}`);
  return venueName.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Extract film ID from URL
 * @param {string} url - Film page URL
 * @returns {string} - Film ID
 */
export function extractFilmId(url) {
  // Extract from URL like: /programme/202616575.html
  const match = url.match(/\/programme\/(\d+)\.html/);
  return match ? match[1] : null;
}

/**
 * Parse duration from text
 * @param {string} text - Text containing duration
 * @returns {number|null} - Duration in minutes
 */
function parseDuration(text) {
  // Match patterns like: "120′", "120'", "120 min", "2h 30min"

  // Try minutes with prime or apostrophe
  let match = text.match(/(\d+)[′']/);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Try "X min" format
  match = text.match(/(\d+)\s*min/i);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Try "Xh Ymin" format
  match = text.match(/(\d+)h\s*(\d+)?\s*min/i);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    return hours * 60 + minutes;
  }

  return null;
}

/**
 * Parse date from German format
 * @param {string} dateStr - Date string like "Sun Feb 15"
 * @param {number} year - Year (e.g., 2026)
 * @returns {string} - ISO date string (YYYY-MM-DD)
 */
function parseDate(dateStr, year = 2026) {
  // Map German/English month names to numbers
  const monthMap = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
    'januar': '01', 'februar': '02', 'märz': '03', 'april': '04',
    'mai': '05', 'juni': '06', 'juli': '07', 'august': '08',
    'september': '09', 'oktober': '10', 'november': '11', 'dezember': '12'
  };

  // Extract month and day from string like "Sun Feb 15" or "So 15. Feb"
  const match = dateStr.match(/(\d{1,2})[\.\s]+(\w+)|(\w+)\s+(\d{1,2})/i);
  if (!match) return null;

  let day, month;
  if (match[1] && match[2]) {
    // Format: "15. Feb" or "15 Feb"
    day = match[1].padStart(2, '0');
    month = monthMap[match[2].toLowerCase().substring(0, 3)];
  } else if (match[3] && match[4]) {
    // Format: "Feb 15"
    month = monthMap[match[3].toLowerCase().substring(0, 3)];
    day = match[4].padStart(2, '0');
  }

  if (!month) return null;

  return `${year}-${month}-${day}`;
}

/**
 * Parse screening information
 * @param {Element} element - DOM element containing screening info
 * @returns {Array} - Array of screening objects
 */
function parseScreenings(element) {
  const screenings = [];

  // Look for screening sections (this will need to be adapted to actual Berlinale HTML)
  // Example structure: <div class="screening">Date Time\nVenue Details</div>
  const screeningElements = element.querySelectorAll('.screening, .date-item, [class*="screening"]');

  if (screeningElements.length === 0) {
    // Fallback: try to find text patterns directly
    const bodyText = element.textContent || '';
    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for time pattern (HH:mm)
      const timeMatch = line.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        // Look backwards for date
        let dateStr = null;
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
          const dateLine = lines[j];
          if (dateLine.match(/\d{1,2}[\.\s]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i)) {
            dateStr = dateLine;
            break;
          }
        }

        // Look forwards for venue
        let venueStr = null;
        for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
          const venueLine = lines[j];
          // Check if line contains common venue keywords
          if (venueLine.match(/palast|kino|cinestar|cubix|arsenal|hkw|lux/i)) {
            venueStr = venueLine;
            break;
          }
        }

        if (dateStr && venueStr) {
          const date = parseDate(dateStr);
          const time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
          const venue = normalizeVenueName(venueStr.split(/[\d,\(\)]/)[0].trim());

          screenings.push({
            date,
            time,
            venue,
            venueDetails: venueStr.trim()
          });
        }
      }
    }
  } else {
    // Parse structured screening elements
    screeningElements.forEach(el => {
      const text = el.textContent || '';

      // Extract date, time, venue
      const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
      const dateMatch = text.match(/\d{1,2}[\.\s]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);

      if (timeMatch && dateMatch) {
        const date = parseDate(dateMatch[0]);
        const time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;

        // Extract venue - usually after time or on next line
        const venuePart = text.split(timeMatch[0])[1] || '';
        const venueMatch = venuePart.match(/([A-Za-zäöüß\s\-]+?)(?:\d|$)/);
        const venueStr = venueMatch ? venueMatch[1].trim() : venuePart.trim();

        if (venueStr) {
          screenings.push({
            date,
            time,
            venue: normalizeVenueName(venueStr),
            venueDetails: venueStr
          });
        }
      }
    });
  }

  return screenings;
}

/**
 * Scrape film data from Berlinale page
 * @param {Document} doc - DOM document object
 * @param {string} url - Page URL
 * @returns {Object|null} - Film object or null if parsing failed
 */
export function scrapeFilmPage(doc = document, url = window.location.href) {
  try {
    // Extract film ID
    const id = extractFilmId(url);
    if (!id) {
      console.error('Could not extract film ID from URL');
      return null;
    }

    // Extract title
    const titleElement = doc.querySelector('h1, .film-title, [class*="title"]');
    const title = titleElement ? titleElement.textContent.trim() : null;

    if (!title) {
      console.error('Could not find film title');
      return null;
    }

    // Extract duration
    const bodyText = doc.body.textContent || '';
    const duration = parseDuration(bodyText);

    if (!duration) {
      console.warn('Could not parse film duration, using default 120 minutes');
    }

    // Extract screenings
    const screenings = parseScreenings(doc.body);

    if (screenings.length === 0) {
      console.warn('No screenings found for film');
    }

    return {
      id,
      title,
      duration: duration || 120, // Default to 120 minutes if not found
      url,
      priority: 'interested', // Default priority
      screenings
    };
  } catch (error) {
    console.error('Error scraping film page:', error);
    return null;
  }
}

/**
 * Check if current page is a Berlinale film page
 * @param {string} url - Page URL
 * @returns {boolean}
 */
export function isFilmPage(url = window.location.href) {
  return /\/programme\/\d+\.html/.test(url);
}
