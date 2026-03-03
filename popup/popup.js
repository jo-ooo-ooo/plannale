// Popup UI logic

// Berlinale 2026 dates (February 13-23)
const FESTIVAL_DATES = [
  '2026-02-13', '2026-02-14', '2026-02-15', '2026-02-16',
  '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20',
  '2026-02-21', '2026-02-22', '2026-02-23'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Berlinale 2026 venues (from official venue list)
const VENUES = [
  { id: 'akademie_der_kuenste', name: 'Akademie der Künste', district: 'Mitte' },
  { id: 'bali_kino', name: 'Bali Kino', district: 'Zehlendorf' },
  { id: 'berlinale_palast', name: 'Berlinale Palast', district: 'Mitte' },
  { id: 'bluemax_theater', name: 'Bluemax Theater', district: 'Mitte' },
  { id: 'cinemaxx', name: 'CinemaxX', district: 'Mitte' },
  { id: 'cinema_paris', name: 'Cinema Paris', district: 'Charlottenburg' },
  { id: 'colosseum', name: 'Colosseum', district: 'Prenzlauer Berg' },
  { id: 'cubix', name: 'Cubix', district: 'Mitte' },
  { id: 'delphi_filmpalast', name: 'Delphi Filmpalast', district: 'Charlottenburg' },
  { id: 'deutsche_kinemathek', name: 'Deutsche Kinemathek', district: 'Mitte' },
  { id: 'filmtheater_am_friedrichshain', name: 'Filmtheater am Friedrichshain', district: 'Friedrichshain' },
  { id: 'haus_der_berliner_festspiele', name: 'Haus der Berliner Festspiele', district: 'Wilmersdorf' },
  { id: 'hkw', name: 'Haus der Kulturen der Welt', district: 'Mitte' },
  { id: 'kino_casablanca', name: 'Kino Casablanca', district: 'Friedrichshain' },
  { id: 'radialsystem', name: 'Radialsystem', district: 'Friedrichshain' },
  { id: 'silent_green', name: 'Silent Green', district: 'Wedding' },
  { id: 'sinema_transtopia', name: 'Sinema Transtopia', district: 'Moabit' },
  { id: 'uber_eats_music_hall', name: 'Uber Eats Music Hall', district: 'Friedrichshain' },
  { id: 'urania', name: 'Urania', district: 'Schöneberg' },
  { id: 'xenon_kino', name: 'Xenon Kino', district: 'Schöneberg' },
  { id: 'yorck', name: 'Yorck', district: 'Kreuzberg' },
  { id: 'zoo_palast', name: 'Zoo Palast', district: 'Charlottenburg' }
];

// State
let currentFilms = [];
let currentPreferences = null;
let currentSchedule = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupEventListeners();
  await loadData();
});

/**
 * Setup tab navigation
 */
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      // Remove active class from all
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      // Add active class to clicked tab
      button.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');

      // Reload data for the tab
      if (tabName === 'schedule') {
        loadScheduleTab();
      } else if (tabName === 'settings') {
        loadSettingsTab();
      }
    });
  });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Films tab
  document.getElementById('clear-all-btn').addEventListener('click', clearAllFilms);
  document.getElementById('generate-schedule-btn').addEventListener('click', generateSchedule);

  // Schedule tab
  document.getElementById('regenerate-schedule-btn').addEventListener('click', generateSchedule);

  // Settings tab
  document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
  document.getElementById('max-films-per-day').addEventListener('change', () => {
    // Auto-save on change
    saveSettings();
  });
  document.getElementById('break-time').addEventListener('change', () => {
    // Auto-save on change
    saveSettings();
  });
  document.getElementById('prioritize-publikumstag').addEventListener('change', () => {
    // Auto-save on change
    saveSettings();
  });
}

/**
 * Load all data
 */
async function loadData() {
  await loadFilmsTab();
  await loadSettingsTab();
}

/**
 * Load films tab
 */
async function loadFilmsTab() {
  showLoading('Loading films...');

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getFilms' });

    if (response.success) {
      currentFilms = response.films;
      renderFilmsList();
    }
  } catch (error) {
    console.error('Error loading films:', error);
    showNotification('Failed to load films', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Render films list
 */
function renderFilmsList() {
  const filmsList = document.getElementById('films-list');
  const emptyState = document.getElementById('films-empty');

  if (currentFilms.length === 0) {
    filmsList.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  filmsList.style.display = 'flex';
  emptyState.style.display = 'none';

  filmsList.innerHTML = currentFilms.map(film => `
    <div class="film-card" data-film-id="${film.id}">
      <div class="film-card-header">
        <div class="film-title">
          <a href="${film.url}" target="_blank">${escapeHtml(film.title)}</a>
        </div>
        <div class="film-card-actions">
          <button class="btn btn-danger remove-film-btn" data-film-id="${film.id}">Remove</button>
        </div>
      </div>
      <div class="film-info">
        <span>${film.duration} min</span>
        <span>${film.screenings.length} screening${film.screenings.length !== 1 ? 's' : ''}</span>
        <span class="priority-badge ${film.priority}">${film.priority === 'must-see' ? 'Must-see' : 'Interested'}</span>
      </div>
      <div class="priority-selector-inline">
        <select class="priority-select" data-film-id="${film.id}">
          <option value="must-see" ${film.priority === 'must-see' ? 'selected' : ''}>Must-see</option>
          <option value="interested" ${film.priority === 'interested' ? 'selected' : ''}>Interested</option>
        </select>
      </div>
    </div>
  `).join('');

  // Add event listeners
  filmsList.querySelectorAll('.remove-film-btn').forEach(btn => {
    btn.addEventListener('click', () => removeFilm(btn.dataset.filmId));
  });

  filmsList.querySelectorAll('.priority-select').forEach(select => {
    select.addEventListener('change', (e) => {
      updateFilmPriority(e.target.dataset.filmId, e.target.value);
    });
  });
}

/**
 * Remove film
 */
async function removeFilm(filmId) {
  if (!confirm('Remove this film from Plannale?')) {
    return;
  }

  showLoading('Removing film...');

  try {
    await chrome.runtime.sendMessage({
      action: 'removeFilm',
      filmId
    });

    currentFilms = currentFilms.filter(f => f.id !== filmId);
    renderFilmsList();
    showNotification('Film removed', 'success');
  } catch (error) {
    console.error('Error removing film:', error);
    showNotification('Failed to remove film', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Update film priority
 */
async function updateFilmPriority(filmId, priority) {
  try {
    await chrome.runtime.sendMessage({
      action: 'updateFilmPriority',
      filmId,
      priority
    });

    // Update local state
    const film = currentFilms.find(f => f.id === filmId);
    if (film) {
      film.priority = priority;
    }

    showNotification('Priority updated', 'success');
  } catch (error) {
    console.error('Error updating priority:', error);
    showNotification('Failed to update priority', 'error');
  }
}

/**
 * Clear all films
 */
async function clearAllFilms() {
  if (!confirm('Remove all films from Plannale? Pinned films will be kept in your schedule.')) {
    return;
  }

  showLoading('Clearing all films...');

  try {
    // Remove each film one by one
    for (const film of currentFilms) {
      await chrome.runtime.sendMessage({
        action: 'removeFilm',
        filmId: film.id
      });
    }

    // Preserve pinned films: clear schedule but rebuild with only pinned entries
    await chrome.runtime.sendMessage({ action: 'clearScheduleKeepPinned' });

    currentFilms = [];

    // Reload schedule to reflect pinned-only state
    const response = await chrome.runtime.sendMessage({ action: 'getSchedule' });
    currentSchedule = response.success ? response.schedule : null;

    renderFilmsList();
    showNotification('All films cleared', 'success');
  } catch (error) {
    console.error('Error clearing films:', error);
    showNotification('Failed to clear films', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Generate schedule
 */
async function generateSchedule() {
  showLoading('Generating schedule...');

  try {
    const response = await chrome.runtime.sendMessage({ action: 'generateSchedule' });

    if (response.success) {
      currentSchedule = response.schedule;
      showNotification('Schedule generated!', 'success');

      // Switch to schedule tab
      document.querySelector('[data-tab="schedule"]').click();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('Error generating schedule:', error);
    showNotification(`Failed to generate schedule: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Load schedule tab
 */
async function loadScheduleTab() {
  showLoading('Loading schedule...');

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getSchedule' });

    if (response.success) {
      currentSchedule = response.schedule;
      renderSchedule();
    }
  } catch (error) {
    console.error('Error loading schedule:', error);
    showNotification('Failed to load schedule', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Render schedule
 */
function renderSchedule() {
  const scheduleContent = document.getElementById('schedule-content');
  const emptyState = document.getElementById('schedule-empty');

  const pinnedFilms = currentSchedule?.pinnedFilms || [];
  const pinnedIds = new Set(pinnedFilms.map(p => p.filmId));
  const hasScheduledFilms = currentSchedule &&
    Object.values(currentSchedule.schedule).some(day => day.length > 0);

  if (!currentSchedule || (!hasScheduledFilms && pinnedFilms.length === 0)) {
    scheduleContent.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  scheduleContent.style.display = 'block';
  emptyState.style.display = 'none';

  let html = '';

  // Render unscheduled films at the TOP
  if (currentSchedule.unscheduled && currentSchedule.unscheduled.length > 0) {
    html += `
      <div class="unscheduled-section-inline">
        <h3>Couldn't schedule ${currentSchedule.unscheduled.length} film(s)</h3>
        <div class="unscheduled-list">
          ${currentSchedule.unscheduled.map(film => `
            <div class="unscheduled-film">
              <div class="unscheduled-film-title">${escapeHtml(film.title)}</div>
              <div class="unscheduled-film-reason">${escapeHtml(film.reason)}</div>
              <div class="unscheduled-film-screenings">
                Available screenings: ${film.screenings.map(s => `${formatDate(s.date)} ${s.time}`).join(', ')}
              </div>
            </div>
          `).join('')}
        </div>
        <p class="hint">Try adjusting your must-see list, removing some films, or expanding your available times in Settings.</p>
      </div>
    `;
  }

  // Render scheduled films by day
  const sortedDates = Object.keys(currentSchedule.schedule).sort();
  html += sortedDates.map(date => {
    const films = currentSchedule.schedule[date];

    if (films.length === 0) {
      return '';
    }

    const dateObj = new Date(date + 'T12:00:00');
    const dayName = DAY_NAMES[dateObj.getDay()];
    const dateFormatted = formatDate(date);

    return `
      <div class="schedule-day">
        <div class="schedule-day-header">${dayName}, ${dateFormatted}</div>
        ${films.map(film => {
          const endTime = calculateEndTime(film.screening.time, film.duration);
          const isPinned = pinnedIds.has(film.filmId);
          return `
            <div class="schedule-film${isPinned ? ' pinned' : ''}" data-film-id="${film.filmId}" data-date="${date}">
              <div class="schedule-film-header">
                <div class="schedule-film-time">${film.screening.time} - ${endTime}</div>
                <div class="schedule-film-actions">
                  <button class="btn-icon pin-toggle${isPinned ? ' pin-icon pinned' : ' pin-icon'}" data-film-id="${film.filmId}" data-date="${date}" title="${isPinned ? 'Unpin film' : 'Pin film'}">
                    ${isPinned ? '📌' : '📌'}
                  </button>
                  <button class="btn-icon remove-icon remove-from-schedule" data-film-id="${film.filmId}" data-date="${date}" title="Remove from schedule">
                    ✕
                  </button>
                </div>
              </div>
              <div class="schedule-film-title">${escapeHtml(film.title)}</div>
              <div class="schedule-film-venue">${escapeHtml(film.screening.venueDetails)}</div>
              <div class="schedule-film-footer">
                <span class="priority-badge ${film.priority}">${film.priority === 'must-see' ? 'Must-see' : 'Interested'}</span>
                <a href="${film.url}" target="_blank" class="buy-ticket-link">Buy Ticket →</a>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }).join('');

  scheduleContent.innerHTML = html;

  // Wire up pin/unpin handlers
  scheduleContent.querySelectorAll('.pin-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const filmId = btn.dataset.filmId;
      const date = btn.dataset.date;
      const isPinned = btn.classList.contains('pinned');
      if (isPinned) {
        unpinFilm(filmId);
      } else {
        pinFilm(filmId, date);
      }
    });
  });

  // Wire up remove handlers
  scheduleContent.querySelectorAll('.remove-from-schedule').forEach(btn => {
    btn.addEventListener('click', () => {
      removeFromSchedule(btn.dataset.filmId, btn.dataset.date);
    });
  });
}

/**
 * Pin a film in the schedule
 */
async function pinFilm(filmId, date) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'pinFilm',
      filmId,
      date
    });

    if (response.success) {
      currentSchedule = response.schedule;
      renderSchedule();
      showNotification('Film pinned — it will survive regeneration', 'success');
    }
  } catch (error) {
    console.error('Error pinning film:', error);
    showNotification('Failed to pin film', 'error');
  }
}

/**
 * Unpin a film in the schedule
 */
async function unpinFilm(filmId) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'unpinFilm',
      filmId
    });

    if (response.success) {
      currentSchedule = response.schedule;
      renderSchedule();
      showNotification('Film unpinned', 'success');
    }
  } catch (error) {
    console.error('Error unpinning film:', error);
    showNotification('Failed to unpin film', 'error');
  }
}

/**
 * Remove a film from the schedule
 */
async function removeFromSchedule(filmId, date) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'removeFromSchedule',
      filmId,
      date
    });

    if (response.success) {
      currentSchedule = response.schedule;
      renderSchedule();
      showNotification('Film removed from schedule', 'success');
    }
  } catch (error) {
    console.error('Error removing film from schedule:', error);
    showNotification('Failed to remove film from schedule', 'error');
  }
}

/**
 * Load settings tab
 */
async function loadSettingsTab() {
  showLoading('Loading preferences...');

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getPreferences' });

    if (response.success) {
      currentPreferences = response.preferences;
      renderSettings();
    }
  } catch (error) {
    console.error('Error loading preferences:', error);
    showNotification('Failed to load preferences', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Render settings
 */
function renderSettings() {
  // Set max films per day
  document.getElementById('max-films-per-day').value = currentPreferences.maxFilmsPerDay || 3;

  // Set break time between films
  document.getElementById('break-time').value = currentPreferences.breakTime ?? 15;

  // Set Publikumstag preference
  document.getElementById('prioritize-publikumstag').checked = currentPreferences.prioritizePublikumstag || false;

  // Render favorite cinemas
  const favoriteCinemas = currentPreferences.favoriteCinemas || [];
  const cinemasList = document.getElementById('favorite-cinemas-list');
  const cinemasCount = document.getElementById('favorite-cinemas-count');

  // Update count display
  const updateCinemasCount = () => {
    const count = cinemasList.querySelectorAll('input:checked').length;
    cinemasCount.textContent = count === 0 ? 'None selected' : `${count} selected`;
  };

  cinemasList.innerHTML = VENUES.map(venue => {
    const isChecked = favoriteCinemas.includes(venue.id);
    return `
      <div class="cinema-item ${isChecked ? 'selected' : ''}" data-venue-id="${venue.id}">
        <input type="checkbox" id="cinema-${venue.id}" ${isChecked ? 'checked' : ''}>
        <label for="cinema-${venue.id}">${venue.name}</label>
      </div>
    `;
  }).join('');

  // Set initial count
  updateCinemasCount();

  // Add event listeners for cinema checkboxes
  cinemasList.querySelectorAll('.cinema-item').forEach(item => {
    const checkbox = item.querySelector('input[type="checkbox"]');

    item.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
      }
      item.classList.toggle('selected', checkbox.checked);
      updateCinemasCount();
      saveSettings();
    });
  });

  // Render available days
  const availableDaysList = document.getElementById('available-days-list');

  // Initialize available days if empty
  if (!currentPreferences.availableDays || currentPreferences.availableDays.length === 0) {
    currentPreferences.availableDays = FESTIVAL_DATES.map(date => ({
      date,
      allDay: true
    }));
  }

  availableDaysList.innerHTML = FESTIVAL_DATES.map(date => {
    const dateObj = new Date(date + 'T12:00:00');
    const dayName = DAY_NAMES[dateObj.getDay()];
    const dateFormatted = formatDate(date);

    const dayPrefs = currentPreferences.availableDays.find(d => d.date === date) || {
      date,
      allDay: true
    };

    const isChecked = currentPreferences.availableDays.some(d => d.date === date);

    return `
      <div class="day-item">
        <div class="day-header">
          <div class="day-checkbox">
            <input type="checkbox" id="day-${date}" data-date="${date}" ${isChecked ? 'checked' : ''}>
            <label for="day-${date}">${dayName}, ${dateFormatted}</label>
          </div>
          <div class="all-day-toggle">
            <input type="checkbox" id="allday-${date}" data-date="${date}" ${dayPrefs.allDay ? 'checked' : ''} ${!isChecked ? 'disabled' : ''}>
            <label for="allday-${date}">All day (8:00-24:00)</label>
          </div>
        </div>
        <div class="time-range" style="display: ${dayPrefs.allDay || !isChecked ? 'none' : 'flex'};" data-date="${date}">
          <input type="time" id="start-${date}" value="${dayPrefs.timeRange?.start || '09:00'}" ${!isChecked ? 'disabled' : ''}>
          <span>to</span>
          <input type="time" id="end-${date}" value="${dayPrefs.timeRange?.end || '22:00'}" ${!isChecked ? 'disabled' : ''}>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners
  FESTIVAL_DATES.forEach(date => {
    const dayCheckbox = document.getElementById(`day-${date}`);
    const allDayCheckbox = document.getElementById(`allday-${date}`);
    const timeRange = document.querySelector(`.time-range[data-date="${date}"]`);
    const startTime = document.getElementById(`start-${date}`);
    const endTime = document.getElementById(`end-${date}`);

    dayCheckbox.addEventListener('change', () => {
      const isChecked = dayCheckbox.checked;
      allDayCheckbox.disabled = !isChecked;
      startTime.disabled = !isChecked;
      endTime.disabled = !isChecked;

      if (!isChecked) {
        timeRange.style.display = 'none';
      } else if (!allDayCheckbox.checked) {
        timeRange.style.display = 'flex';
      }
    });

    allDayCheckbox.addEventListener('change', () => {
      if (allDayCheckbox.checked) {
        timeRange.style.display = 'none';
      } else {
        timeRange.style.display = 'flex';
      }
    });
  });
}

/**
 * Save settings
 */
async function saveSettings() {
  showLoading('Saving preferences...');

  try {
    const maxFilmsPerDay = parseInt(document.getElementById('max-films-per-day').value, 10);
    const breakTime = parseInt(document.getElementById('break-time').value, 10);
    const prioritizePublikumstag = document.getElementById('prioritize-publikumstag').checked;

    // Get favorite cinemas
    const favoriteCinemas = [];
    document.querySelectorAll('#favorite-cinemas-list .cinema-item input:checked').forEach(checkbox => {
      const venueId = checkbox.closest('.cinema-item').dataset.venueId;
      favoriteCinemas.push(venueId);
    });

    const availableDays = FESTIVAL_DATES
      .filter(date => document.getElementById(`day-${date}`).checked)
      .map(date => {
        const allDay = document.getElementById(`allday-${date}`).checked;

        if (allDay) {
          return { date, allDay: true };
        }

        return {
          date,
          allDay: false,
          timeRange: {
            start: document.getElementById(`start-${date}`).value,
            end: document.getElementById(`end-${date}`).value
          }
        };
      });

    await chrome.runtime.sendMessage({
      action: 'updatePreferences',
      preferences: {
        maxFilmsPerDay,
        breakTime,
        prioritizePublikumstag,
        favoriteCinemas,
        availableDays
      }
    });

    showNotification('Preferences saved!', 'success');
  } catch (error) {
    console.error('Error saving preferences:', error);
    showNotification('Failed to save preferences', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Show loading overlay
 */
function showLoading(text = 'Loading...') {
  const overlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');
  loadingText.textContent = text;
  overlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  overlay.style.display = 'none';
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    opacity: 0;
    transform: translateY(-10px);
    transition: all 0.3s ease;
    background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
    color: white;
  `;

  document.body.appendChild(notification);

  // Fade in
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
  }, 10);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(-10px)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Format date
 */
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Calculate end time
 */
function calculateEndTime(startTime, duration) {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + duration;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
