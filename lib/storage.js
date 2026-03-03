// Storage API wrapper for Chrome Storage
// All storage operations go through this module

const STORAGE_KEYS = {
  FILMS: 'films',
  PREFERENCES: 'preferences',
  SCHEDULE: 'schedule'
};

// Default preferences
const DEFAULT_PREFERENCES = {
  maxFilmsPerDay: 3,
  breakTime: 15, // 15 minutes buffer between films
  prioritizePublikumstag: false, // Prioritize Feb 22 (cheaper tickets)
  favoriteCinemas: [], // No favorite cinemas by default (all treated equally)
  availableDays: []
};

// Films operations
export async function getFilms() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.FILMS);
  return result[STORAGE_KEYS.FILMS] || [];
}

export async function addFilm(film) {
  const films = await getFilms();

  // Check if film already exists (by ID)
  const existingIndex = films.findIndex(f => f.id === film.id);
  if (existingIndex !== -1) {
    // Update existing film
    films[existingIndex] = film;
  } else {
    // Add new film
    films.push(film);
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.FILMS]: films });
  return film;
}

export async function updateFilm(id, updates) {
  const films = await getFilms();
  const filmIndex = films.findIndex(f => f.id === id);

  if (filmIndex === -1) {
    throw new Error(`Film with ID ${id} not found`);
  }

  films[filmIndex] = { ...films[filmIndex], ...updates };
  await chrome.storage.local.set({ [STORAGE_KEYS.FILMS]: films });
  return films[filmIndex];
}

export async function removeFilm(id) {
  const films = await getFilms();
  const filteredFilms = films.filter(f => f.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.FILMS]: filteredFilms });
}

export async function getFilmById(id) {
  const films = await getFilms();
  return films.find(f => f.id === id);
}

// Preferences operations
export async function getPreferences() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PREFERENCES);
  return result[STORAGE_KEYS.PREFERENCES] || DEFAULT_PREFERENCES;
}

export async function updatePreferences(prefs) {
  const currentPrefs = await getPreferences();
  const updatedPrefs = { ...currentPrefs, ...prefs };
  await chrome.storage.local.set({ [STORAGE_KEYS.PREFERENCES]: updatedPrefs });
  return updatedPrefs;
}

// Schedule operations
export async function getSchedule() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SCHEDULE);
  const data = result[STORAGE_KEYS.SCHEDULE] || {};
  return {
    schedule: data.schedule || {},
    unscheduled: data.unscheduled || [],
    pinnedFilms: data.pinnedFilms || []
  };
}

export async function saveSchedule(schedule) {
  await chrome.storage.local.set({ [STORAGE_KEYS.SCHEDULE]: schedule });
}

export async function clearSchedule() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.SCHEDULE]: { schedule: {}, unscheduled: [], pinnedFilms: [] }
  });
}

export async function pinFilmInSchedule(filmId, date) {
  const data = await getSchedule();
  const dayFilms = data.schedule[date] || [];
  const film = dayFilms.find(f => f.filmId === filmId);

  if (!film) return data;

  // Don't add duplicates
  if (!data.pinnedFilms.some(p => p.filmId === filmId)) {
    data.pinnedFilms.push({ ...film });
  }

  await saveSchedule(data);
  return data;
}

export async function unpinFilmInSchedule(filmId) {
  const data = await getSchedule();
  data.pinnedFilms = data.pinnedFilms.filter(p => p.filmId !== filmId);
  await saveSchedule(data);
  return data;
}

export async function removeFilmFromSchedule(filmId, date) {
  const data = await getSchedule();

  // Remove from scheduled day
  if (data.schedule[date]) {
    data.schedule[date] = data.schedule[date].filter(f => f.filmId !== filmId);
  }

  // Also remove from pinnedFilms
  data.pinnedFilms = data.pinnedFilms.filter(p => p.filmId !== filmId);

  await saveSchedule(data);
  return data;
}

// Clear all data (for testing/debugging)
export async function clearAllData() {
  await chrome.storage.local.clear();
}
