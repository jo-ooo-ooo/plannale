// Content script - Injects "Add to Planner" button on Berlinale film pages

// ===== SCRAPER FUNCTIONS =====

// Venue name normalization map - converts display names to venue keys
// Berlinale 2026 venue name normalization map
const VENUE_NAME_MAP = {
  'akademie der künste': 'akademie_der_kuenste',
  'akademie der kuenste': 'akademie_der_kuenste',
  'bali kino': 'bali_kino',
  'bali': 'bali_kino',
  'berlinale palast': 'berlinale_palast',
  'bluemax theater': 'bluemax_theater',
  'bluemax': 'bluemax_theater',
  'cinemaxx': 'cinemaxx',
  'cinema paris': 'cinema_paris',
  'colosseum': 'colosseum',
  'cubix': 'cubix',
  'delphi filmpalast': 'delphi_filmpalast',
  'delphi': 'delphi_filmpalast',
  'deutsche kinemathek': 'deutsche_kinemathek',
  'kinemathek': 'deutsche_kinemathek',
  'filmtheater am friedrichshain': 'filmtheater_am_friedrichshain',
  'haus der berliner festspiele': 'haus_der_berliner_festspiele',
  'festspiele': 'haus_der_berliner_festspiele',
  'haus der kulturen der welt': 'hkw',
  'hkw': 'hkw',
  'kino casablanca': 'kino_casablanca',
  'casablanca': 'kino_casablanca',
  'radialsystem': 'radialsystem',
  'silent green': 'silent_green',
  'sinema transtopia': 'sinema_transtopia',
  'transtopia': 'sinema_transtopia',
  'uber eats music hall': 'uber_eats_music_hall',
  'verti music hall': 'uber_eats_music_hall',
  'urania': 'urania',
  'xenon kino': 'xenon_kino',
  'xenon': 'xenon_kino',
  'yorck': 'yorck',
  'zoo palast': 'zoo_palast'
};

function normalizeVenueName(venueName) {
  if (!venueName) return 'unknown';
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

function extractFilmId(url) {
  // Extract from URL like: /en/2026/programme/202616575.html or /programme/202616575.html
  const match = url.match(/\/programme\/(\d+)\.html/);
  return match ? match[1] : null;
}

/**
 * Extract JSON object starting at a given position using bracket matching
 */
function extractJsonObject(str, startIndex) {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return str.substring(startIndex, i + 1);
        }
      }
    }
  }

  return null;
}

/**
 * Extract the initial_result JSON data from script tags
 * The data is nested inside window.ifbAppConfig = { ..., initial_result: {...} }
 */
function extractInitialResult(doc) {
  const scripts = doc.querySelectorAll('script');
  console.log(`Searching ${scripts.length} scripts for initial_result...`);

  for (const script of scripts) {
    const content = script.textContent || '';

    // Look for initial_result in any script (don't require ifbAppConfig)
    if (content.includes('initial_result')) {
      console.log('Found script containing initial_result, length:', content.length);

      // Find initial_result: followed by { (with or without quotes)
      const patterns = [
        /initial_result\s*:\s*\{/,
        /"initial_result"\s*:\s*\{/
      ];

      for (const pattern of patterns) {
        const startMatch = content.match(pattern);
        if (startMatch) {
          console.log(`Pattern ${pattern} matched at index ${startMatch.index}`);
          console.log(`Context: "${content.substring(Math.max(0, startMatch.index - 20), startMatch.index + 50)}"`);

          // Find the opening brace after "initial_result":
          const braceIndex = content.indexOf('{', startMatch.index);
          if (braceIndex !== -1) {
            console.log(`Found opening brace at index ${braceIndex}`);
            const jsonStr = extractJsonObject(content, braceIndex);

            if (jsonStr) {
              console.log(`Extracted JSON string of length ${jsonStr.length}`);
              console.log(`JSON preview: ${jsonStr.substring(0, 200)}...`);
              try {
                const data = JSON.parse(jsonStr);
                console.log('Successfully parsed initial_result, keys:', Object.keys(data));
                if (data.events) {
                  console.log(`Found ${data.events.length} events:`, data.events.slice(0, 2));
                }
                return data;
              } catch (e) {
                console.warn('Failed to parse initial_result JSON:', e.message);
                console.warn('JSON string starts with:', jsonStr.substring(0, 200));
                console.warn('JSON string ends with:', jsonStr.substring(jsonStr.length - 100));
              }
            } else {
              console.warn('extractJsonObject returned null - bracket matching failed');
            }
          }
        }
      }
    }

    // Alternative: look for JSON embedded in script with type="application/json"
    if (script.type === 'application/json' || script.type === 'application/ld+json') {
      try {
        const data = JSON.parse(content);
        if (data.events || data.title) {
          return data;
        }
      } catch (e) {
        // Not valid JSON, continue
      }
    }
  }

  // Fallback: try to find events array directly
  console.log('Trying fallback: looking for events array directly...');
  for (const script of scripts) {
    const content = script.textContent || '';

    // Look for "events":[ pattern
    const eventsMatch = content.match(/"events"\s*:\s*\[/);
    if (eventsMatch) {
      console.log('Found "events" array at index', eventsMatch.index);

      // Find the opening bracket
      const bracketIndex = content.indexOf('[', eventsMatch.index);
      if (bracketIndex !== -1) {
        // Extract the array using bracket matching
        let depth = 0;
        let inStr = false;
        let escape = false;

        for (let i = bracketIndex; i < content.length; i++) {
          const c = content[i];

          if (escape) {
            escape = false;
            continue;
          }

          if (c === '\\' && inStr) {
            escape = true;
            continue;
          }

          if (c === '"') {
            inStr = !inStr;
            continue;
          }

          if (!inStr) {
            if (c === '[') depth++;
            else if (c === ']') {
              depth--;
              if (depth === 0) {
                const eventsStr = content.substring(bracketIndex, i + 1);
                try {
                  const events = JSON.parse(eventsStr);
                  console.log(`Fallback: found ${events.length} events`);

                  // Try to find title nearby
                  const titleMatch = content.match(/"title"\s*:\s*"([^"]+)"/);
                  const title = titleMatch ? titleMatch[1] : null;

                  return { events, title };
                } catch (e) {
                  console.warn('Fallback: failed to parse events array:', e.message);
                }
                break;
              }
            }
          }
        }
      }
    }
  }

  console.warn('No initial_result or events array found in any script');
  return null;
}

/**
 * Parse date from displayDate object or string
 * displayDate can be:
 * - Object: { dayAndMonth: "Feb 15", weekday: "Sun" }
 * - String: "Sun, Feb 15" or "Feb 15"
 */
function parseDisplayDate(displayDate, year = 2026) {
  if (!displayDate) return null;

  const monthMap = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };

  // If displayDate is an object with dayAndMonth
  let dateStr = displayDate;
  if (typeof displayDate === 'object') {
    dateStr = displayDate.dayAndMonth || displayDate.date || '';
  }

  if (!dateStr) return null;

  // Match patterns like "Feb 15" or "15 Feb"
  let match = dateStr.match(/([A-Za-z]{3})\s+(\d{1,2})/i);
  if (match) {
    const month = monthMap[match[1].toLowerCase()];
    const day = match[2].padStart(2, '0');
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Try "15 Feb" format
  match = dateStr.match(/(\d{1,2})\s+([A-Za-z]{3})/i);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = monthMap[match[2].toLowerCase()];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

/**
 * Extract screenings from the events array in initial_result
 * Event structure:
 * {
 *   displayDate: { dayAndMonth: "Feb 15", weekday: "Sun" },
 *   time: { text: "12:30", durationInMinutes: 120, unixtime: 1771155000 },
 *   venueHall: "Zoo Palast 1"
 * }
 */
function parseScreeningsFromData(events) {
  if (!events || !Array.isArray(events)) {
    return [];
  }

  return events.map(event => {
    const date = parseDisplayDate(event.displayDate);

    // Time can be an object with 'text' or a string
    let time = null;
    let eventDuration = null;
    if (event.time) {
      if (typeof event.time === 'object') {
        time = event.time.text || null;
        eventDuration = event.time.durationInMinutes || null;
      } else {
        time = event.time;
      }
    }

    const venueHall = event.venueHall || event.venue || '';
    // Extract venue name (remove hall numbers like "Zoo Palast 1" -> "Zoo Palast")
    const venueName = venueHall.replace(/\s*\d+\s*(-\s*.*)?$/, '').trim();
    const venue = normalizeVenueName(venueName);

    return {
      date,
      time,
      venue,
      venueDetails: venueHall,
      duration: eventDuration || event.durationInMinutes || null
    };
  }).filter(s => s.date && s.time);
}

/**
 * Extract initial_result from raw HTML string (more reliable than DOM parsing)
 */
function extractInitialResultFromHtml(html) {
  // Look for initial_result: { in the raw HTML
  const patterns = [
    /initial_result\s*:\s*\{/g,
    /"initial_result"\s*:\s*\{/g
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) {
      console.log(`Found initial_result in raw HTML at index ${match.index}`);

      // Find the opening brace
      const braceIndex = html.indexOf('{', match.index);
      if (braceIndex !== -1) {
        const jsonStr = extractJsonObject(html, braceIndex);
        if (jsonStr) {
          try {
            const data = JSON.parse(jsonStr);
            console.log('Successfully parsed initial_result from raw HTML, keys:', Object.keys(data));
            if (data.events) {
              console.log(`Found ${data.events.length} events`);
            }
            return data;
          } catch (e) {
            console.warn('Failed to parse JSON from raw HTML:', e.message);
          }
        }
      }
    }
  }

  // Fallback: try to find events array directly
  const eventsMatch = html.match(/"events"\s*:\s*\[/);
  if (eventsMatch) {
    console.log('Trying to extract events array directly from raw HTML');
    const bracketIndex = html.indexOf('[', eventsMatch.index);
    if (bracketIndex !== -1) {
      // Use bracket matching for array
      let depth = 0;
      let inStr = false;
      let escape = false;

      for (let i = bracketIndex; i < html.length && i < bracketIndex + 50000; i++) {
        const c = html[i];

        if (escape) {
          escape = false;
          continue;
        }
        if (c === '\\' && inStr) {
          escape = true;
          continue;
        }
        if (c === '"') {
          inStr = !inStr;
          continue;
        }
        if (!inStr) {
          if (c === '[') depth++;
          else if (c === ']') {
            depth--;
            if (depth === 0) {
              const eventsStr = html.substring(bracketIndex, i + 1);
              try {
                const events = JSON.parse(eventsStr);
                console.log(`Extracted ${events.length} events directly from raw HTML`);

                // Try to find title
                const titleMatch = html.match(/"title"\s*:\s*"([^"]+)"/);
                return {
                  events,
                  title: titleMatch ? titleMatch[1] : null
                };
              } catch (e) {
                console.warn('Failed to parse events array:', e.message);
              }
              break;
            }
          }
        }
      }
    }
  }

  return null;
}

/**
 * Scrape film page - extracts data from initial_result JSON
 */
function scrapeFilmPage(doc = document, url = window.location.href, rawHtml = null) {
  try {
    // Extract film ID
    const id = extractFilmId(url);
    if (!id) {
      console.error('Could not extract film ID from URL');
      return null;
    }

    // If raw HTML is provided, try to extract from it first (more reliable)
    let initialData = null;
    if (rawHtml) {
      console.log('Attempting extraction from raw HTML...');
      initialData = extractInitialResultFromHtml(rawHtml);
    }

    // Fall back to DOM-based extraction
    if (!initialData) {
      console.log('Attempting extraction from DOM...');
      initialData = extractInitialResult(doc);
    }

    if (initialData) {
      console.log('Found initial_result data:', JSON.stringify(initialData).substring(0, 500));

      // Title could be in various places
      const title = initialData.title || initialData.name || initialData.filmTitle;
      if (!title) {
        // Fallback to HTML title
        const titleElement = doc.querySelector('h1');
        if (!titleElement) {
          console.error('Could not find film title');
          return null;
        }
      }

      const finalTitle = title || doc.querySelector('h1')?.textContent?.trim();

      // Extract screenings from events array
      const screenings = parseScreeningsFromData(initialData.events);

      // Extract duration - try multiple sources
      let duration = null;

      // 1. Try initialData top level
      if (initialData.duration) {
        if (typeof initialData.duration === 'number') {
          duration = initialData.duration;
        } else if (typeof initialData.duration === 'string') {
          const match = initialData.duration.match(/(\d+)/);
          duration = match ? parseInt(match[1], 10) : null;
        }
      }
      if (!duration && initialData.durationInMinutes) {
        duration = parseInt(initialData.durationInMinutes, 10);
      }
      if (!duration && initialData.runtime) {
        const match = String(initialData.runtime).match(/(\d+)/);
        duration = match ? parseInt(match[1], 10) : null;
      }

      // 2. Try to get from first event's time object
      if (!duration && screenings.length > 0 && screenings[0].duration) {
        duration = screenings[0].duration;
      }

      // 3. Look in raw HTML for the DISPLAYED duration (not event durations which include Q&A etc)
      if (!duration && rawHtml) {
        // Priority 1: Look for the film info display format like "110'" or "110 min"
        // This is the actual film duration shown on the page, not screening event durations
        const displayPatterns = [
          />(\d{2,3})['′]</,           // HTML tag content like >110'<
          /(\d{2,3})['′]\s*[,|<]/,     // 110' followed by comma, pipe or tag
          /["'](\d{2,3})['′]["']/,     // Quoted like "110'"
        ];

        for (const pattern of displayPatterns) {
          const match = rawHtml.match(pattern);
          if (match) {
            const val = parseInt(match[1], 10);
            if (val >= 30 && val <= 240) { // Reasonable film duration (not event with Q&A)
              duration = val;
              console.log(`Found display duration ${val} via pattern: ${pattern}`);
              break;
            }
          }
        }

        // Priority 2: Look for duration in film metadata (not event durationInMinutes)
        if (!duration) {
          // Look for "duration":"110" or similar at top level of film data
          const metaMatch = rawHtml.match(/"duration"\s*:\s*"?(\d{2,3})"?[,}]/);
          if (metaMatch) {
            const val = parseInt(metaMatch[1], 10);
            if (val >= 30 && val <= 240) {
              duration = val;
              console.log(`Found metadata duration ${val}`);
            }
          }
        }
      }

      // 4. Look in page text as last resort
      if (!duration) {
        const bodyText = doc.body?.textContent || '';
        const patterns = [
          /(\d{2,3})\s*[′']/,
          /(\d{2,3})\s*min/i
        ];
        for (const pattern of patterns) {
          const match = bodyText.match(pattern);
          if (match) {
            const val = parseInt(match[1], 10);
            if (val >= 30 && val <= 300) {
              duration = val;
              break;
            }
          }
        }
      }

      duration = duration || 120; // Default to 120 minutes
      console.log(`Final duration for "${finalTitle}": ${duration} min`);

      console.log(`Scraped film "${finalTitle}" with ${screenings.length} screenings, duration: ${duration}min`);

      return {
        id,
        title: finalTitle,
        duration,
        url,
        priority: 'interested',
        screenings
      };
    }

    // Fallback: try to extract from HTML
    console.log('initial_result not found, falling back to HTML parsing');

    const titleElement = doc.querySelector('h1');
    const title = titleElement ? titleElement.textContent.trim() : null;

    if (!title) {
      console.error('Could not find film title');
      return null;
    }

    // Try to find duration in page text or raw HTML
    let duration = null;

    // Try raw HTML first
    if (rawHtml) {
      const patterns = [
        /"duration"\s*:\s*(\d+)/i,
        /"durationInMinutes"\s*:\s*(\d+)/i,
        /(\d{2,3})\s*[′']/,
        /(\d{2,3})\s*min/i
      ];
      for (const pattern of patterns) {
        const match = rawHtml.match(pattern);
        if (match) {
          const val = parseInt(match[1], 10);
          if (val >= 30 && val <= 300) {
            duration = val;
            break;
          }
        }
      }
    }

    // Try page text
    if (!duration) {
      const bodyText = doc.body?.textContent || '';
      const patterns = [
        /(\d{2,3})\s*[′']/,
        /(\d{2,3})\s*min/i
      ];
      for (const pattern of patterns) {
        const match = bodyText.match(pattern);
        if (match) {
          const val = parseInt(match[1], 10);
          if (val >= 30 && val <= 300) {
            duration = val;
            break;
          }
        }
      }
    }

    duration = duration || 120;

    console.warn('No screenings found via HTML fallback');

    return {
      id,
      title,
      duration,
      url,
      priority: 'interested',
      screenings: []
    };
  } catch (error) {
    console.error('Error scraping film page:', error);
    return null;
  }
}

function isFilmPage(url = window.location.href) {
  return /\/programme\/\d+\.html/.test(url);
}

function isListingPage(url = window.location.href) {
  return /\/programme\/berlinale-programme\.html/.test(url);
}

function isFavoritesPage(url = window.location.href) {
  return /\/programme\/film-favorites\.html/.test(url);
}

// ===== CONTENT SCRIPT LOGIC =====

// Track current URL to detect changes
let currentUrl = window.location.href;
let initializationId = 0; // Track which initialization is current
let listingButtonsTimeout = null;

// Initialize based on page type
function initialize() {
  // Increment initialization ID to cancel any pending initializations
  const thisInitId = ++initializationId;
  const targetUrl = window.location.href;

  console.log(`Initialize called for: ${targetUrl} (init #${thisInitId})`);

  // Clean up ALL injected buttons (in case we navigated away from favorites)
  document.querySelectorAll('#plannale-add-button, #planner-add-button, .planner-button-container, .planner-button-small-container, .planner-import-favorites-container, .planner-sync-container').forEach(el => el.remove());

  setTimeout(() => {
    // Check if this initialization is still current
    if (thisInitId !== initializationId) {
      console.log(`Init #${thisInitId} cancelled (current is #${initializationId})`);
      return;
    }

    // Also verify URL hasn't changed
    if (window.location.href !== targetUrl) {
      console.log(`Init #${thisInitId} cancelled - URL changed`);
      return;
    }

    // ONLY inject buttons on favorites page
    if (isFavoritesPage()) {
      console.log('On favorites page - injecting import button...');
      injectFavoritesImportButton();
    } else {
      console.log('Not on favorites page - no buttons to inject');
    }
  }, 200);
}

// Run initial setup
initialize();

// Intercept pushState and replaceState to detect SPA navigation
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(this, args);
  setTimeout(() => {
    if (currentUrl !== window.location.href) {
      currentUrl = window.location.href;
      console.log('URL changed via pushState to:', currentUrl);
      initialize();
    }
  }, 100);
};

history.replaceState = function(...args) {
  originalReplaceState.apply(this, args);
  setTimeout(() => {
    if (currentUrl !== window.location.href) {
      currentUrl = window.location.href;
      console.log('URL changed via replaceState to:', currentUrl);
      initialize();
    }
  }, 100);
};

// Watch for URL changes via title element (fallback)
const titleElement = document.querySelector('title');
if (titleElement) {
  const urlObserver = new MutationObserver(() => {
    if (currentUrl !== window.location.href) {
      currentUrl = window.location.href;
      console.log('URL changed (detected via title) to:', currentUrl);
      setTimeout(() => {
        initialize();
      }, 300);
    }
  });

  urlObserver.observe(titleElement, {
    childList: true,
    subtree: true
  });
}

// Also listen to popstate events (browser back/forward)
window.addEventListener('popstate', () => {
  setTimeout(() => {
    currentUrl = window.location.href;
    console.log('URL changed via popstate to:', currentUrl);
    initialize();
  }, 300);
});

// Watch for DOM changes on favorites page only (with throttling)
let mutationTimeout = null;
const contentObserver = new MutationObserver((mutations) => {
  // Only process if we're on the favorites page
  if (!isFavoritesPage()) return;

  // Throttle the observer - only run after mutations stop for 500ms
  if (mutationTimeout) {
    clearTimeout(mutationTimeout);
  }

  mutationTimeout = setTimeout(() => {
    console.log('DOM changed on favorites page, re-injecting import button...');
    injectFavoritesImportButton();
  }, 500);
});

// Start observing the main content area for changes
const observeContent = () => {
  const mainContent = document.querySelector('main, #content, .content, [role="main"]');
  if (mainContent) {
    contentObserver.observe(mainContent, {
      childList: true,
      subtree: false // Only watch direct children, not entire subtree
    });
    console.log('Started observing content changes');
  }
};

// Start observing after a short delay
setTimeout(observeContent, 1000);

/**
 * Initialize the "Add to Planner" button
 */
async function initializeButton(initId, targetUrl) {
  // Wait for page to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => injectButton(initId, targetUrl), 100);
    });
  } else {
    // Add a small delay to ensure DOM is ready
    setTimeout(() => injectButton(initId, targetUrl), 100);
  }
}

/**
 * Inject the "Add to Planner" button
 */
async function injectButton(initId, targetUrl) {
  // Verify this initialization is still current
  if (initId !== undefined && initId !== initializationId) {
    console.log(`injectButton cancelled - init #${initId} is stale`);
    return;
  }

  // Verify URL hasn't changed
  if (targetUrl && window.location.href !== targetUrl) {
    console.log('injectButton cancelled - URL changed');
    return;
  }

  // Find the title element - be more specific to avoid matching wrong elements
  const titleElement = document.querySelector('h1');

  if (!titleElement) {
    console.warn('Could not find title element to inject button');
    return;
  }

  // Check if button already exists
  const existingButton = document.querySelector('#planner-add-button');
  if (existingButton) {
    console.log('Button already exists, skipping injection');
    return;
  }

  // Check if film is already added
  const filmId = extractFilmId(window.location.href);
  if (!filmId) {
    console.warn('Could not extract film ID');
    return;
  }

  // Final check before async operation
  if (initId !== undefined && initId !== initializationId) {
    return;
  }

  const response = await chrome.runtime.sendMessage({
    action: 'checkFilmExists',
    filmId
  });

  // Check again after async operation
  if (initId !== undefined && initId !== initializationId) {
    console.log(`injectButton cancelled after async - init #${initId} is stale`);
    return;
  }

  if (targetUrl && window.location.href !== targetUrl) {
    console.log('injectButton cancelled after async - URL changed');
    return;
  }

  const isAdded = response?.exists || false;

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'planner-button-container';

  // Create button
  const button = document.createElement('button');
  button.className = 'planner-add-button';
  button.id = 'planner-add-button';

  if (isAdded) {
    button.textContent = 'Added ✓';
    button.classList.add('added');
    button.disabled = true;
  } else {
    button.textContent = '+ Add to Plannale';
  }

  button.addEventListener('click', handleAddClick);

  buttonContainer.appendChild(button);

  // Insert after title
  titleElement.parentNode.insertBefore(buttonContainer, titleElement.nextSibling);

  // If already added, show priority selector
  if (isAdded) {
    showPrioritySelector(buttonContainer, response.priority);
  }
}

/**
 * Handle click on "Add to Planner" button
 */
async function handleAddClick(event) {
  const button = event.target;

  // Disable button during processing
  button.disabled = true;
  button.textContent = 'Adding...';

  try {
    // Scrape film data
    const filmData = scrapeFilmPage(document, window.location.href);

    if (!filmData) {
      throw new Error('Could not scrape film data');
    }

    // Send to background script to save
    const response = await chrome.runtime.sendMessage({
      action: 'addFilm',
      film: filmData
    });

    if (response.success) {
      // Update button state
      button.textContent = 'Added ✓';
      button.classList.add('added');

      // Show priority selector
      showPrioritySelector(button.parentElement, filmData.priority);

      // Show success notification
      showNotification('Film added to Plannale!', 'success');
    } else {
      throw new Error(response.error || 'Failed to add film');
    }
  } catch (error) {
    console.error('Error adding film:', error);
    button.textContent = '+ Add to Plannale';
    button.disabled = false;
    showNotification('Failed to add film. Please try again.', 'error');
  }
}

/**
 * Show priority selector
 */
function showPrioritySelector(container, currentPriority = 'interested') {
  // Check if selector already exists
  if (container.querySelector('.priority-selector')) {
    return;
  }

  const selector = document.createElement('div');
  selector.className = 'priority-selector';

  const label = document.createElement('span');
  label.textContent = 'Priority: ';
  label.className = 'priority-label';

  const select = document.createElement('select');
  select.className = 'priority-select';

  const mustSeeOption = document.createElement('option');
  mustSeeOption.value = 'must-see';
  mustSeeOption.textContent = 'Must-see';

  const interestedOption = document.createElement('option');
  interestedOption.value = 'interested';
  interestedOption.textContent = 'Interested';

  select.appendChild(mustSeeOption);
  select.appendChild(interestedOption);
  select.value = currentPriority;

  select.addEventListener('change', async (e) => {
    const newPriority = e.target.value;
    const filmId = extractFilmId(window.location.href);

    try {
      await chrome.runtime.sendMessage({
        action: 'updateFilmPriority',
        filmId,
        priority: newPriority
      });

      showNotification('Priority updated!', 'success');
    } catch (error) {
      console.error('Error updating priority:', error);
      showNotification('Failed to update priority', 'error');
    }
  });

  selector.appendChild(label);
  selector.appendChild(select);
  container.appendChild(selector);
}

/**
 * Show notification toast
 */
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existing = document.querySelectorAll('.planner-notification');
  existing.forEach(n => n.remove());

  const notification = document.createElement('div');
  notification.className = `planner-notification planner-notification-${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Fade in
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Initialize buttons on listing page (with debouncing)
 */
async function initializeListingButtons() {
  // Clear any pending timeout
  if (listingButtonsTimeout) {
    clearTimeout(listingButtonsTimeout);
  }

  // Debounce the injection
  listingButtonsTimeout = setTimeout(() => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectListingButtons);
    } else {
      injectListingButtons();
    }
  }, 300);
}

/**
 * Inject buttons on listing page
 */
async function injectListingButtons() {
  // Find all film links on the page
  // The exact selector will depend on Berlinale's HTML structure
  // Common patterns: a[href*="/programme/"], links containing film IDs
  const filmLinks = document.querySelectorAll('a[href*="/programme/"][href$=".html"]');

  for (const link of filmLinks) {
    const href = link.getAttribute('href');

    // Skip if not a film page link (must have numeric ID)
    const filmId = extractFilmId(href);
    if (!filmId) continue;

    // Find the container for this film
    const container = link.closest('.film-card, .film-item, li, article') || link.parentElement;

    // Check if container already has our button marker
    if (container.dataset.plannerButtonAdded === filmId) {
      continue; // Already processed this container
    }

    // Remove any existing buttons in this container (cleanup duplicates)
    const existingButtons = container.querySelectorAll('.planner-button-small-container');
    existingButtons.forEach(btn => btn.remove());

    // Check if film is already added to planner
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'checkFilmExists',
        filmId
      });

      const isAdded = response?.exists || false;

      // Create small button
      const button = document.createElement('button');
      button.className = 'planner-add-button-small';
      button.dataset.filmUrl = href.startsWith('http') ? href : `https://www.berlinale.de${href}`;
      button.dataset.filmId = filmId;

      if (isAdded) {
        button.textContent = '✓';
        button.classList.add('added');
        button.title = 'Already in Plannale';
      } else {
        button.textContent = '+';
        button.title = 'Add to Plannale';
      }

      button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await handleListingButtonClick(button);
      });

      // Create a small button container
      const buttonContainer = document.createElement('span');
      buttonContainer.className = 'planner-button-small-container';
      buttonContainer.appendChild(button);

      // Insert at the beginning of the container or after the link
      if (container === link.parentElement) {
        link.parentNode.insertBefore(buttonContainer, link.nextSibling);
      } else {
        container.insertBefore(buttonContainer, container.firstChild);
      }

      // Mark container as processed
      container.dataset.plannerButtonAdded = filmId;
    } catch (error) {
      console.error('Error checking film status:', error);
    }
  }
}

/**
 * Handle click on listing page button
 */
async function handleListingButtonClick(button) {
  if (button.classList.contains('added')) {
    return; // Already added
  }

  button.disabled = true;
  button.textContent = '...';

  try {
    const filmUrl = button.dataset.filmUrl;
    const filmId = button.dataset.filmId;

    // Fetch the film page HTML
    const response = await fetch(filmUrl);
    const html = await response.text();

    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Scrape film data - pass raw HTML for more reliable extraction
    const filmData = scrapeFilmPage(doc, filmUrl, html);

    if (!filmData) {
      throw new Error('Could not scrape film data');
    }

    // Send to background script
    const saveResponse = await chrome.runtime.sendMessage({
      action: 'addFilm',
      film: filmData
    });

    if (saveResponse.success) {
      button.textContent = '✓';
      button.classList.add('added');
      button.title = 'Already in Plannale';
      showNotification('Film added to Plannale!', 'success');
    } else {
      throw new Error(saveResponse.error || 'Failed to add film');
    }
  } catch (error) {
    console.error('Error adding film from listing:', error);
    button.textContent = '+';
    button.disabled = false;
    showNotification('Failed to add film. Please try again.', 'error');
  }
}

/**
 * Inject "Import All Favorites" button on the favorites page
 */
function injectFavoritesImportButton() {
  const currentUrl = window.location.href;
  const isFavorites = isFavoritesPage();

  console.log(`injectFavoritesImportButton called - URL: ${currentUrl}, isFavorites: ${isFavorites}`);

  // STRICT CHECK: Only inject on favorites page
  if (!isFavorites) {
    console.log('Not on favorites page, skipping sync button injection');

    // Also remove any existing sync button if we're not on favorites page
    const existingButton = document.querySelector('#planner-sync-button');
    if (existingButton) {
      console.log('Removing stale sync button from non-favorites page');
      existingButton.closest('.planner-sync-container')?.remove();
    }
    return;
  }

  // Check if button already exists
  if (document.querySelector('#planner-sync-button')) {
    return;
  }

  // Find a good place to inject - look for the page header or filter area
  const headerArea = document.querySelector('h1, .page-title, [class*="header"], [class*="title"]');

  if (!headerArea) {
    console.warn('Could not find header area for import button');
    return;
  }

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'planner-sync-container';
  buttonContainer.style.cssText = 'margin: 15px 0; display: flex; gap: 10px; align-items: center;';

  // Create sync button
  const syncButton = document.createElement('button');
  syncButton.id = 'planner-sync-button';
  syncButton.className = 'planner-add-button';
  syncButton.textContent = '🔄 Sync with Plannale';
  syncButton.style.cssText = 'font-size: 14px; padding: 10px 20px;';

  // Create progress indicator
  const progressSpan = document.createElement('span');
  progressSpan.id = 'planner-sync-progress';
  progressSpan.style.cssText = 'font-size: 14px; color: #666; display: none;';

  syncButton.addEventListener('click', handleSyncWithPlanner);

  buttonContainer.appendChild(syncButton);
  buttonContainer.appendChild(progressSpan);

  // Insert after header
  headerArea.parentNode.insertBefore(buttonContainer, headerArea.nextSibling);
}

/**
 * Get all favorite film links from the current page
 */
function getFavoriteFilmLinks() {
  const filmLinks = [];
  const links = document.querySelectorAll('a[href*="/programme/"][href$=".html"]');

  for (const link of links) {
    const href = link.getAttribute('href');
    const filmId = extractFilmId(href);

    if (filmId) {
      const fullUrl = href.startsWith('http') ? href : `https://www.berlinale.de${href}`;
      // Avoid duplicates
      if (!filmLinks.some(f => f.id === filmId)) {
        filmLinks.push({
          id: filmId,
          url: fullUrl
        });
      }
    }
  }

  return filmLinks;
}

/**
 * Handle syncing favorites with planner
 * - Adds films that are in favorites but not in planner
 * - Removes films that are in planner but not in favorites
 */
async function handleSyncWithPlanner() {
  const syncButton = document.querySelector('#planner-sync-button');
  const progressSpan = document.querySelector('#planner-sync-progress');

  if (!syncButton) return;

  // Get all film links on the favorites page
  const favoriteFilmLinks = getFavoriteFilmLinks();
  console.log('Found favorite film links:', favoriteFilmLinks);

  const favoriteIds = new Set(favoriteFilmLinks.map(f => f.id));

  // Disable button and show progress
  syncButton.disabled = true;
  syncButton.textContent = 'Syncing...';
  progressSpan.style.display = 'inline';
  progressSpan.textContent = 'Getting current films...';

  let added = 0;
  let removed = 0;
  let unchanged = 0;
  let failed = 0;

  try {
    // Get all films currently in the planner
    const plannerResponse = await chrome.runtime.sendMessage({ action: 'getFilms' });
    const plannerFilms = plannerResponse.success ? plannerResponse.films : [];
    const plannerIds = new Set(plannerFilms.map(f => f.id));

    console.log(`Planner has ${plannerFilms.length} films, Favorites has ${favoriteFilmLinks.length} films`);

    // Find films to remove (in planner but not in favorites)
    const filmsToRemove = plannerFilms.filter(f => !favoriteIds.has(f.id));
    console.log(`Films to remove: ${filmsToRemove.length}`, filmsToRemove.map(f => f.title));

    // Find films to add (in favorites but not in planner)
    const filmsToAdd = favoriteFilmLinks.filter(f => !plannerIds.has(f.id));
    console.log(`Films to add: ${filmsToAdd.length}`, filmsToAdd.map(f => f.id));

    // Count unchanged
    unchanged = favoriteFilmLinks.filter(f => plannerIds.has(f.id)).length;

    // Remove films no longer in favorites
    for (const film of filmsToRemove) {
      progressSpan.textContent = `Removing "${film.title}"...`;
      try {
        await chrome.runtime.sendMessage({
          action: 'removeFilm',
          filmId: film.id
        });
        console.log(`Removed film: ${film.title}`);
        removed++;
      } catch (error) {
        console.error(`Failed to remove film ${film.id}:`, error);
        failed++;
      }
    }

    // Add new films from favorites
    for (let i = 0; i < filmsToAdd.length; i++) {
      const film = filmsToAdd[i];
      progressSpan.textContent = `Adding ${i + 1}/${filmsToAdd.length}...`;

      try {
        // Fetch and parse film page
        console.log(`[${film.id}] Fetching from ${film.url}`);
        const response = await fetch(film.url);

        if (!response.ok) {
          console.error(`[${film.id}] Fetch failed with status ${response.status}`);
          failed++;
          continue;
        }

        const html = await response.text();
        console.log(`[${film.id}] Fetched HTML length: ${html.length}`);

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Scrape film data
        const filmData = scrapeFilmPage(doc, film.url, html);
        console.log(`[${film.id}] Scraped:`, filmData ? {
          title: filmData.title,
          screenings: filmData.screenings?.length || 0
        } : 'null');

        if (!filmData) {
          console.warn(`[${film.id}] Failed to scrape film data`);
          failed++;
          continue;
        }

        // Save to storage
        const saveResponse = await chrome.runtime.sendMessage({
          action: 'addFilm',
          film: filmData
        });

        if (saveResponse.success) {
          console.log(`[${film.id}] Successfully added "${filmData.title}"`);
          added++;
        } else {
          console.error(`[${film.id}] Save failed:`, saveResponse.error);
          failed++;
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`[${film.id}] Error adding film:`, error);
        failed++;
      }
    }

  } catch (error) {
    console.error('Sync error:', error);
    showNotification('Sync failed. Please refresh and try again.', 'error');
    syncButton.disabled = false;
    syncButton.textContent = '🔄 Sync with Plannale';
    progressSpan.style.display = 'none';
    return;
  }

  // Reset button and show results
  syncButton.disabled = false;
  syncButton.textContent = '🔄 Sync with Plannale';
  progressSpan.style.display = 'none';

  // Show summary
  const parts = [];
  if (added > 0) parts.push(`${added} added`);
  if (removed > 0) parts.push(`${removed} removed`);
  if (unchanged > 0) parts.push(`${unchanged} unchanged`);
  if (failed > 0) parts.push(`${failed} failed`);

  const message = parts.join(', ') || 'No changes';
  showNotification(message, failed > 0 ? 'warning' : 'success');
}
