// Scheduling algorithm with travel time consideration

/**
 * Get travel time between two venues
 * @param {string} venueA - First venue key
 * @param {string} venueB - Second venue key
 * @param {Object} venueData - Venue data with travel times
 * @returns {number} - Travel time in minutes
 */
function getTravelTime(venueA, venueB, venueData) {
  if (!venueData.travelTimes[venueA] || !venueData.travelTimes[venueA][venueB]) {
    console.warn(`No travel time data for ${venueA} -> ${venueB}, using 30 min default`);
    return 30; // Default fallback
  }
  return venueData.travelTimes[venueA][venueB];
}

/**
 * Convert time string to minutes since midnight
 * @param {string} time - Time in HH:mm format
 * @returns {number} - Minutes since midnight
 */
function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string
 * @param {number} minutes - Minutes since midnight
 * @returns {string} - Time in HH:mm format
 */
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Check if screening time is within available time range for a given day
 * @param {Object} screening - Screening object with date and time
 * @param {number} duration - Film duration in minutes
 * @param {Array} availableDays - Array of available day objects
 * @returns {boolean}
 */
function isWithinAvailableTime(screening, duration, availableDays) {
  const availableDay = availableDays.find(day => day.date === screening.date);

  if (!availableDay) {
    return false;
  }

  if (availableDay.allDay) {
    return true; // All day means 8:00-24:00, which covers most screenings
  }

  if (!availableDay.timeRange) {
    return false;
  }

  const screeningStart = timeToMinutes(screening.time);
  const screeningEnd = screeningStart + duration;
  const availableStart = timeToMinutes(availableDay.timeRange.start);
  const availableEnd = timeToMinutes(availableDay.timeRange.end);

  // Screening must start after available start and end before available end
  return screeningStart >= availableStart && screeningEnd <= availableEnd;
}

/**
 * Check if new screening has time conflict with already scheduled films
 * @param {Array} scheduledFilms - Array of scheduled film objects for the day
 * @param {Object} newScreening - New screening to check
 * @param {number} newDuration - Duration of new film in minutes
 * @param {Object} venueData - Venue data with travel times
 * @param {number} breakTime - Additional buffer time between films in minutes
 * @returns {boolean} - True if there's a conflict
 */
function hasTimeConflict(scheduledFilms, newScreening, newDuration, venueData, breakTime = 0) {
  const newStart = timeToMinutes(newScreening.time);
  const newEnd = newStart + newDuration;

  for (const scheduled of scheduledFilms) {
    const scheduledStart = timeToMinutes(scheduled.screening.time);
    const scheduledEnd = scheduledStart + scheduled.duration;

    // Check if screenings overlap
    if (newStart < scheduledEnd && newEnd > scheduledStart) {
      return true; // Direct time overlap
    }

    // Check if there's enough travel time + buffer between consecutive screenings
    if (newStart > scheduledStart) {
      // New screening is after this scheduled screening
      const travelTime = getTravelTime(scheduled.screening.venue, newScreening.venue, venueData);
      const requiredEndTime = scheduledEnd + travelTime + breakTime;

      if (newStart < requiredEndTime) {
        return true; // Not enough time for travel + break
      }
    } else {
      // New screening is before this scheduled screening
      const travelTime = getTravelTime(newScreening.venue, scheduled.screening.venue, venueData);
      const requiredEndTime = newEnd + travelTime + breakTime;

      if (scheduledStart < requiredEndTime) {
        return true; // Not enough time for travel + break
      }
    }
  }

  return false;
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate optimized schedule by trying multiple orderings
 * @param {Array} films - Array of film objects with screenings
 * @param {Object} preferences - User preferences (maxFilmsPerDay, availableDays)
 * @param {Object} venueData - Venue data with travel times
 * @returns {Object} - { schedule: {}, unscheduled: [] }
 */
export function generateSchedule(films, preferences, venueData, pinnedFilms = []) {
  const NUM_ATTEMPTS = 30;
  let bestResult = null;
  let bestScore = Infinity;

  for (let attempt = 0; attempt < NUM_ATTEMPTS; attempt++) {
    const result = runGreedyAttempt(films, preferences, venueData, attempt, pinnedFilms);

    // Score: unscheduled must-see costs 10, interested costs 1
    const score = result.unscheduled.reduce((sum, f) =>
      sum + (f.priority === 'must-see' ? 10 : 1), 0);

    if (score < bestScore) {
      bestScore = score;
      bestResult = result;
    }

    if (score === 0) break; // Perfect schedule
  }

  return bestResult;
}

/**
 * Run one greedy scheduling attempt
 * @param {Array} films - Array of film objects
 * @param {Object} preferences - User preferences
 * @param {Object} venueData - Venue data
 * @param {number} attempt - Attempt number (0 = deterministic, 1+ = shuffled)
 * @returns {Object} - { schedule: {}, unscheduled: [] }
 */
function runGreedyAttempt(films, preferences, venueData, attempt, pinnedFilms = []) {
  const schedule = {};
  const unscheduled = [];

  // Set of pinned film IDs to exclude from scheduling pool
  const pinnedIds = new Set(pinnedFilms.map(p => p.filmId));

  // Filter out pinned films from the scheduling pool
  const schedulableFilms = films.filter(f => !pinnedIds.has(f.id));

  const filmLookup = {};
  films.forEach(film => {
    filmLookup[film.id] = film;
  });

  // Count valid screenings for a film (on available days, within time range)
  const validScreeningCount = (film) => {
    return film.screenings.filter(s =>
      preferences.availableDays.some(d => d.date === s.date) &&
      isWithinAvailableTime(s, film.duration, preferences.availableDays)
    ).length;
  };

  // Split by priority
  const mustSeeFilms = schedulableFilms.filter(f => f.priority === 'must-see');
  const interestedFilms = schedulableFilms.filter(f => f.priority === 'interested');

  let sortedFilms;
  if (attempt === 0) {
    // Attempt 0: deterministic, most-constrained-first within each priority
    const sortedMustSee = [...mustSeeFilms].sort((a, b) =>
      validScreeningCount(a) - validScreeningCount(b));
    const sortedInterested = [...interestedFilms].sort((a, b) =>
      validScreeningCount(a) - validScreeningCount(b));
    sortedFilms = [...sortedMustSee, ...sortedInterested];
  } else {
    // Attempt 1+: shuffle within each priority group
    sortedFilms = [...shuffleArray(mustSeeFilms), ...shuffleArray(interestedFilms)];
  }

  // Initialize schedule for each available day
  preferences.availableDays.forEach(day => {
    schedule[day.date] = [];
  });

  // Pre-place pinned films into their scheduled days
  for (const pinned of pinnedFilms) {
    const date = pinned.screening.date;
    if (schedule[date]) {
      schedule[date].push({ ...pinned });
    } else {
      // Day was unchecked in settings — add to unscheduled
      unscheduled.push({
        filmId: pinned.filmId,
        title: pinned.title,
        priority: pinned.priority,
        reason: 'Pinned film\'s date is no longer in your available days',
        screenings: []
      });
    }
  }

  // Sort pre-placed pinned films by time
  for (const date of Object.keys(schedule)) {
    if (schedule[date].length > 0) {
      schedule[date].sort((a, b) => timeToMinutes(a.screening.time) - timeToMinutes(b.screening.time));
    }
  }

  const favoriteCinemas = preferences.favoriteCinemas || [];
  const hasFavorites = favoriteCinemas.length > 0;
  const prioritizePublikumstag = preferences.prioritizePublikumstag || false;
  const publikumstagDate = '2026-02-22';
  const breakTime = preferences.breakTime ?? 15;

  // Greedy: try to schedule each film
  for (const film of sortedFilms) {
    let scheduled = false;

    // Sort screenings based on preferences (shuffle for attempt > 0)
    let sortedScreenings;
    if (attempt === 0) {
      sortedScreenings = [...film.screenings].sort((a, b) => {
        if (prioritizePublikumstag) {
          const aIsPublikumstag = a.date === publikumstagDate;
          const bIsPublikumstag = b.date === publikumstagDate;
          if (aIsPublikumstag && !bIsPublikumstag) return -1;
          if (!aIsPublikumstag && bIsPublikumstag) return 1;
        }
        if (hasFavorites) {
          const aIsFavorite = favoriteCinemas.includes(a.venue);
          const bIsFavorite = favoriteCinemas.includes(b.venue);
          if (aIsFavorite && !bIsFavorite) return -1;
          if (!aIsFavorite && bIsFavorite) return 1;
        }
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return timeToMinutes(a.time) - timeToMinutes(b.time);
      });
    } else {
      // Shuffle screenings but still respect Publikumstag and favorites with some weight
      sortedScreenings = shuffleArray(film.screenings);
    }

    for (const screening of sortedScreenings) {
      if (!schedule[screening.date]) continue;
      if (!isWithinAvailableTime(screening, film.duration, preferences.availableDays)) continue;
      if (schedule[screening.date].length >= preferences.maxFilmsPerDay) continue;
      if (hasTimeConflict(schedule[screening.date], screening, film.duration, venueData, breakTime)) continue;

      schedule[screening.date].push({
        filmId: film.id,
        screening: {
          date: screening.date,
          time: screening.time,
          venue: screening.venue,
          venueDetails: screening.venueDetails
        },
        duration: film.duration,
        title: film.title,
        priority: film.priority,
        url: film.url
      });

      schedule[screening.date].sort((a, b) => {
        return timeToMinutes(a.screening.time) - timeToMinutes(b.screening.time);
      });

      scheduled = true;
      break;
    }

    if (!scheduled) {
      let reason = 'No available screening fits your schedule';

      if (film.screenings.length === 0) {
        reason = 'No screenings available for this film';
      } else {
        const hasScreeningsOnAvailableDays = film.screenings.some(s =>
          preferences.availableDays.some(d => d.date === s.date)
        );

        if (!hasScreeningsOnAvailableDays) {
          reason = 'All screenings are on days you\'re not available';
        } else {
          const hasScreeningsInTimeRange = film.screenings.some(s =>
            isWithinAvailableTime(s, film.duration, preferences.availableDays)
          );

          if (!hasScreeningsInTimeRange) {
            reason = 'All screenings are outside your available time ranges';
          } else {
            reason = 'Conflicts with other scheduled films or max films/day reached';
          }
        }
      }

      unscheduled.push({
        filmId: film.id,
        title: film.title,
        priority: film.priority,
        reason,
        screenings: film.screenings
      });
    }
  }

  // Post-processing: fit unscheduled must-see films by bumping interested films
  for (let i = unscheduled.length - 1; i >= 0; i--) {
    if (unscheduled[i].priority !== 'must-see') continue;

    const film = filmLookup[unscheduled[i].filmId];
    if (!film) continue;

    let placed = false;

    for (const screening of film.screenings) {
      if (!schedule[screening.date]) continue;
      if (!isWithinAvailableTime(screening, film.duration, preferences.availableDays)) continue;

      const dayFilms = schedule[screening.date];

      // Try fitting without bumping
      if (dayFilms.length < preferences.maxFilmsPerDay &&
          !hasTimeConflict(dayFilms, screening, film.duration, venueData, breakTime)) {
        dayFilms.push({
          filmId: film.id,
          screening: { date: screening.date, time: screening.time, venue: screening.venue, venueDetails: screening.venueDetails },
          duration: film.duration,
          title: film.title,
          priority: film.priority,
          url: film.url
        });
        dayFilms.sort((a, b) => timeToMinutes(a.screening.time) - timeToMinutes(b.screening.time));
        unscheduled.splice(i, 1);
        placed = true;
        break;
      }

      // Try bumping an interested film on this day (never bump pinned films)
      for (let j = dayFilms.length - 1; j >= 0; j--) {
        if (dayFilms[j].priority !== 'interested') continue;
        if (pinnedIds.has(dayFilms[j].filmId)) continue;

        const bumped = dayFilms.splice(j, 1)[0];

        if (dayFilms.length < preferences.maxFilmsPerDay &&
            !hasTimeConflict(dayFilms, screening, film.duration, venueData, breakTime)) {
          dayFilms.push({
            filmId: film.id,
            screening: { date: screening.date, time: screening.time, venue: screening.venue, venueDetails: screening.venueDetails },
            duration: film.duration,
            title: film.title,
            priority: film.priority,
            url: film.url
          });
          dayFilms.sort((a, b) => timeToMinutes(a.screening.time) - timeToMinutes(b.screening.time));
          unscheduled.splice(i, 1);

          const bumpedFilm = filmLookup[bumped.filmId];
          unscheduled.push({
            filmId: bumped.filmId,
            title: bumped.title,
            priority: bumped.priority,
            reason: 'Replaced by a must-see film',
            screenings: bumpedFilm ? bumpedFilm.screenings : []
          });

          placed = true;
          break;
        } else {
          dayFilms.splice(j, 0, bumped);
        }
      }

      if (placed) break;
    }
  }

  // Try to reschedule bumped interested films
  for (let i = unscheduled.length - 1; i >= 0; i--) {
    if (unscheduled[i].priority !== 'interested') continue;

    const film = filmLookup[unscheduled[i].filmId];
    if (!film) continue;

    for (const screening of film.screenings) {
      if (!schedule[screening.date]) continue;
      if (!isWithinAvailableTime(screening, film.duration, preferences.availableDays)) continue;
      if (schedule[screening.date].length >= preferences.maxFilmsPerDay) continue;
      if (hasTimeConflict(schedule[screening.date], screening, film.duration, venueData, breakTime)) continue;

      schedule[screening.date].push({
        filmId: film.id,
        screening: { date: screening.date, time: screening.time, venue: screening.venue, venueDetails: screening.venueDetails },
        duration: film.duration,
        title: film.title,
        priority: film.priority,
        url: film.url
      });
      schedule[screening.date].sort((a, b) => timeToMinutes(a.screening.time) - timeToMinutes(b.screening.time));
      unscheduled.splice(i, 1);
      break;
    }
  }

  return { schedule, unscheduled };
}
