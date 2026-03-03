# Festival Schedule Planner — Project Brief

## What We're Building

A Chrome extension that helps film festival attendees plan their schedules. Users add films they want to see, set preferences (max films/day, preferred venues, time constraints), and the tool generates an optimized schedule avoiding conflicts.

## Why a Chrome Extension

- No API available from festivals
- Can leverage user's existing login session to access favorites
- Direct DOM access to inject "Add to Planner" buttons on film pages
- All processing happens locally, zero hosting costs
- Can extend to multiple festivals with festival-specific scrapers

## Target Festivals

| Festival | Dates | Feasibility |
|----------|-------|-------------|
| Berlinale | Feb | ✅ Confirmed — clean HTML structure |
| IFFR (Rotterdam) | Jan-Feb | ✅ Confirmed — similar structure |
| TIFF (Toronto) | Sept | Likely feasible (not yet analyzed) |
| Sundance | Jan | Likely feasible (not yet analyzed) |

## Data Available (Berlinale Example)

From a film detail page like `berlinale.de/en/2026/programme/202616575.html`:

- **Title**: In `<h1>` tag
- **Duration**: In body text as `89'` or `120 min` format
- **Screenings**: Listed in Dates section with format like:
  ```
  Sun Feb 15 12:30
  Zoo Palast 1
  
  Mon Feb 16 16:00
  HKW 1 - Miriam Makeba Auditorium
  ```
- **Venues**: ~20 venues across Berlin districts (Charlottenburg, Potsdamer Platz, Mitte, Friedrichshain, etc.)
- **Favorites list**: Requires login, accessible at `/en/programme/film-favorites.html`

## User Preferences to Support

- Max films per day (1-4)
- Preferred areas/venues (e.g., "only Charlottenburg")
- Earliest start time
- Latest start time (e.g., "nothing starting after 21:00")
- Minimum break between films
- Film priority (must-see vs. interested)

## MVP Features (Phase 1)

- [ ] One-click "Add to Planner" button injected on film pages
- [ ] Import all favorites at once
- [ ] Set film priority (must-see / interested)
- [ ] Basic preferences: max films/day, time constraints
- [ ] Auto-generate schedule avoiding conflicts
- [ ] View schedule in popup
- [ ] Direct links to film pages for ticket purchase

## Phase 2 Features

- [ ] Venue/area preferences
- [ ] Travel time estimates between venues
- [ ] Manual schedule editing
- [ ] Export to Google Calendar / iCal
- [ ] Alternative screening suggestions when conflicts exist

## Phase 3 Features

- [ ] Support for additional festivals (modular scraper architecture)
- [ ] Ticket availability indicators
- [ ] Share schedule with friends
- [ ] Film notes and personal ratings

## Proposed Architecture

```
festival-planner/
├── manifest.json              # Chrome extension manifest v3
├── popup/
│   ├── popup.html             # Main UI
│   ├── popup.js               # UI logic (film list, schedule view, preferences)
│   └── popup.css
├── content/
│   └── content.js             # Injected into festival pages, adds "Add" button
├── background/
│   └── service-worker.js      # Handles messages, coordinates data
├── lib/
│   ├── scrapers/
│   │   ├── berlinale.js       # Berlinale-specific DOM parsing
│   │   └── iffr.js            # Rotterdam-specific DOM parsing
│   ├── scheduler.js           # Scheduling algorithm
│   └── storage.js             # Chrome storage API wrapper
└── data/
    └── venues/
        ├── berlinale.json     # Venue metadata (coordinates, district)
        └── iffr.json
```

## Scheduling Algorithm (Greedy Approach)

```javascript
function generateSchedule(films, preferences) {
  const schedule = {};
  
  // Sort by priority (must-see first)
  const sorted = [...films].sort((a, b) => 
    a.priority === 'must-see' ? -1 : 1
  );
  
  for (const film of sorted) {
    for (const screening of film.screenings) {
      if (!meetsTimeConstraints(screening, preferences)) continue;
      if (exceedsMaxFilms(schedule[screening.date], preferences)) continue;
      if (hasTimeConflict(schedule[screening.date], screening, film.duration)) continue;
      
      // Add to schedule
      if (!schedule[screening.date]) schedule[screening.date] = [];
      schedule[screening.date].push({ film, screening });
      break; // Move to next film
    }
  }
  
  return schedule;
}
```

## Sample Scraper (Berlinale)

```javascript
function scrapeFilmPage() {
  const title = document.querySelector('h1')?.textContent?.trim();
  
  // Duration in format "89'"
  const durationMatch = document.body.innerText.match(/(\d+)[′']/);
  const duration = durationMatch ? parseInt(durationMatch[1]) : null;
  
  // Parse screenings from Dates section
  const screenings = [];
  // ... DOM parsing logic
  
  return {
    id: window.location.pathname.split('/').pop().replace('.html', ''),
    title,
    duration,
    screenings,
    url: window.location.href
  };
}
```

## Estimated User Base

~500-2,000 users covering top 4-5 festivals, potential to grow to 5,000-10,000 with good word-of-mouth in film communities (Letterboxd, film Twitter/Reddit, festival forums).

## Development Estimate

~20-30 hours for MVP (for someone familiar with Chrome extensions).

---

*Brief generated from feasibility discussion. Ready to start building!*
