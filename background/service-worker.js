// Background service worker - Message handling and coordination

import {
  getFilms,
  addFilm,
  updateFilm,
  removeFilm,
  getFilmById,
  getPreferences,
  updatePreferences,
  getSchedule,
  saveSchedule,
  clearSchedule,
  pinFilmInSchedule,
  unpinFilmInSchedule,
  removeFilmFromSchedule
} from '../lib/storage.js';

import { generateSchedule } from '../lib/scheduler.js';

// Load venue data
let venueData = null;

// Load venue data on startup
async function loadVenueData() {
  try {
    const response = await fetch(chrome.runtime.getURL('data/venues/berlinale.json'));
    venueData = await response.json();
    console.log('Venue data loaded successfully');
  } catch (error) {
    console.error('Failed to load venue data:', error);
  }
}

loadVenueData();

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle async operations
  handleMessage(request, sender)
    .then(sendResponse)
    .catch(error => {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    });

  // Return true to indicate we'll send a response asynchronously
  return true;
});

/**
 * Handle incoming messages
 */
async function handleMessage(request, sender) {
  const { action } = request;

  switch (action) {
    case 'addFilm':
      return await handleAddFilm(request.film);

    case 'updateFilmPriority':
      return await handleUpdateFilmPriority(request.filmId, request.priority);

    case 'removeFilm':
      await removeFilm(request.filmId);
      return { success: true };

    case 'getFilms':
      const films = await getFilms();
      return { success: true, films };

    case 'checkFilmExists':
      const film = await getFilmById(request.filmId);
      return {
        success: true,
        exists: !!film,
        priority: film?.priority
      };

    case 'updatePreferences':
      const updatedPrefs = await updatePreferences(request.preferences);
      return { success: true, preferences: updatedPrefs };

    case 'getPreferences':
      const prefs = await getPreferences();
      return { success: true, preferences: prefs };

    case 'generateSchedule':
      return await handleGenerateSchedule();

    case 'getSchedule':
      const schedule = await getSchedule();
      return { success: true, schedule };

    case 'clearSchedule':
      await clearSchedule();
      return { success: true };

    case 'clearScheduleKeepPinned': {
      const currentData = await getSchedule();
      const pinned = currentData.pinnedFilms || [];
      if (pinned.length === 0) {
        await clearSchedule();
      } else {
        // Rebuild schedule with only pinned films
        const newSchedule = {};
        for (const pinnedFilm of pinned) {
          const date = pinnedFilm.screening.date;
          if (!newSchedule[date]) newSchedule[date] = [];
          newSchedule[date].push(pinnedFilm);
        }
        await saveSchedule({ schedule: newSchedule, unscheduled: [], pinnedFilms: pinned });
      }
      return { success: true };
    }

    case 'pinFilm': {
      const pinResult = await pinFilmInSchedule(request.filmId, request.date);
      return { success: true, schedule: pinResult };
    }

    case 'unpinFilm': {
      const unpinResult = await unpinFilmInSchedule(request.filmId);
      return { success: true, schedule: unpinResult };
    }

    case 'removeFromSchedule': {
      const removeResult = await removeFilmFromSchedule(request.filmId, request.date);
      return { success: true, schedule: removeResult };
    }

    case 'resyncFilmDetails':
      return await handleResyncFilmDetails();

    default:
      return { success: false, error: 'Unknown action' };
  }
}

/**
 * Handle adding a film
 */
async function handleAddFilm(film) {
  try {
    const addedFilm = await addFilm(film);
    return { success: true, film: addedFilm };
  } catch (error) {
    console.error('Error adding film:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle updating film priority
 */
async function handleUpdateFilmPriority(filmId, priority) {
  try {
    const updatedFilm = await updateFilm(filmId, { priority });
    return { success: true, film: updatedFilm };
  } catch (error) {
    console.error('Error updating film priority:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle re-syncing film details (duration, screenings)
 */
async function handleResyncFilmDetails() {
  try {
    const films = await getFilms();
    let updated = 0;

    for (const film of films) {
      try {
        // Fetch the film page
        const response = await fetch(film.url);
        if (!response.ok) continue;

        const html = await response.text();

        // Extract duration from HTML
        const newDuration = extractDurationFromHtml(html);

        // Extract screenings from HTML
        const newScreenings = extractScreeningsFromHtml(html);

        // Update film if we found new data
        let hasChanges = false;

        if (newDuration && newDuration !== film.duration) {
          film.duration = newDuration;
          hasChanges = true;
        }

        if (newScreenings && newScreenings.length > 0) {
          film.screenings = newScreenings;
          hasChanges = true;
        }

        if (hasChanges) {
          await updateFilm(film.id, {
            duration: film.duration,
            screenings: film.screenings
          });
          updated++;
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`Error re-syncing film ${film.id}:`, error);
      }
    }

    const updatedFilms = await getFilms();
    return { success: true, films: updatedFilms, updated };

  } catch (error) {
    console.error('Error in resync:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Extract duration from raw HTML
 * Prioritizes the displayed film duration (like "110'") over event durations
 * (which may include Q&A, intermissions, etc.)
 */
function extractDurationFromHtml(html) {
  // Priority 1: Look for displayed duration format like "110'" in the page
  const displayPatterns = [
    />(\d{2,3})['′]</,           // HTML tag content like >110'<
    /(\d{2,3})['′]\s*[,|<]/,     // 110' followed by comma, pipe or tag
    /["'](\d{2,3})['′]["']/,     // Quoted like "110'"
  ];

  for (const pattern of displayPatterns) {
    const match = html.match(pattern);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val >= 30 && val <= 240) { // Reasonable film duration
        return val;
      }
    }
  }

  // Priority 2: Look for duration in film metadata
  const metaMatch = html.match(/"duration"\s*:\s*"?(\d{2,3})"?[,}]/);
  if (metaMatch) {
    const val = parseInt(metaMatch[1], 10);
    if (val >= 30 && val <= 240) {
      return val;
    }
  }

  return null;
}

/**
 * Extract screenings from raw HTML (from initial_result JSON)
 */
function extractScreeningsFromHtml(html) {
  // Find the events array in the HTML
  const eventsMatch = html.match(/"events"\s*:\s*\[/);
  if (!eventsMatch) return null;

  // Extract the array using bracket matching
  const startIndex = html.indexOf('[', eventsMatch.index);
  if (startIndex === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < html.length && i < startIndex + 50000; i++) {
    const c = html[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\' && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (c === '[') depth++;
      else if (c === ']') {
        depth--;
        if (depth === 0) {
          const eventsStr = html.substring(startIndex, i + 1);
          try {
            const events = JSON.parse(eventsStr);
            return parseEvents(events);
          } catch (e) {
            console.warn('Failed to parse events:', e);
            return null;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Parse events array into screenings
 */
function parseEvents(events) {
  if (!Array.isArray(events)) return [];

  const monthMap = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };

  return events.map(event => {
    // Parse date
    let date = null;
    const displayDate = event.displayDate;
    if (displayDate) {
      const dateStr = typeof displayDate === 'object' ? displayDate.dayAndMonth : displayDate;
      if (dateStr) {
        const match = dateStr.match(/([A-Za-z]{3})\s+(\d{1,2})/i);
        if (match) {
          const month = monthMap[match[1].toLowerCase()];
          const day = match[2].padStart(2, '0');
          if (month) {
            date = `2026-${month}-${day}`;
          }
        }
      }
    }

    // Parse time
    let time = null;
    if (event.time) {
      time = typeof event.time === 'object' ? event.time.text : event.time;
    }

    // Parse venue
    const venueHall = event.venueHall || event.venue || '';
    const venueName = venueHall.replace(/\s*\d+\s*(-\s*.*)?$/, '').trim();
    const venue = normalizeVenue(venueName);

    return {
      date,
      time,
      venue,
      venueDetails: venueHall
    };
  }).filter(s => s.date && s.time);
}

/**
 * Normalize venue name to key
 */
function normalizeVenue(name) {
  if (!name) return 'unknown';
  const normalized = name.toLowerCase().trim();

  const venueMap = {
    'zoo palast': 'zoo_palast',
    'berlinale palast': 'berlinale_palast',
    'haus der berliner festspiele': 'haus_der_berliner_festspiele',
    'festspiele': 'haus_der_berliner_festspiele',
    'haus der kulturen der welt': 'hkw',
    'hkw': 'hkw',
    'cinemaxx': 'cinemaxx',
    'cinema paris': 'cinema_paris',
    'colosseum': 'colosseum',
    'cubix': 'cubix',
    'delphi filmpalast': 'delphi_filmpalast',
    'delphi': 'delphi_filmpalast',
    'filmtheater am friedrichshain': 'filmtheater_am_friedrichshain',
    'silent green': 'silent_green',
    'urania': 'urania',
    'uber eats music hall': 'uber_eats_music_hall',
    'yorck': 'yorck',
    'akademie der künste': 'akademie_der_kuenste'
  };

  for (const [key, value] of Object.entries(venueMap)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  return normalized.replace(/\s+/g, '_');
}

/**
 * Handle generating schedule
 */
async function handleGenerateSchedule() {
  try {
    if (!venueData) {
      await loadVenueData();
      if (!venueData) {
        throw new Error('Venue data not available');
      }
    }

    const films = await getFilms();
    const preferences = await getPreferences();
    const existingSchedule = await getSchedule();
    const pinnedFilms = existingSchedule.pinnedFilms || [];

    if (films.length === 0 && pinnedFilms.length === 0) {
      throw new Error('No films added');
    }

    if (!preferences.availableDays || preferences.availableDays.length === 0) {
      throw new Error('No available days set');
    }

    const schedule = generateSchedule(films, preferences, venueData, pinnedFilms);
    schedule.pinnedFilms = pinnedFilms;
    await saveSchedule(schedule);

    return { success: true, schedule };
  } catch (error) {
    console.error('Error generating schedule:', error);
    return { success: false, error: error.message };
  }
}
