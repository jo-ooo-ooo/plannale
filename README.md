# Film Festival Planner - Chrome Extension

A Chrome extension for optimizing film festival schedules with smart scheduling and travel time consideration. MVP targets Berlinale 2026.

## Features

- **Add Films**: Browse Berlinale website and add films to your planner with one click
- **Priority Management**: Mark films as "Must-see" or "Interested"
- **Smart Scheduling**: Automatically generates optimized schedule considering:
  - Your available days and time ranges
  - Maximum films per day preference
  - Travel time between venues
  - Film durations and screening times
- **Schedule View**: See your personalized festival schedule organized by day
- **Conflict Detection**: Get notified about films that couldn't be scheduled with reasons

## Installation

### Prerequisites
- Google Chrome browser
- Berlinale 2026 film festival dates: February 13-23, 2026

### Steps

1. **Clone or download this repository**
   ```bash
   cd ~/Desktop
   # Your film-planner folder should be here
   ```

2. **Add placeholder icons** (temporary - you can replace with actual icons later)
   Create three PNG files in the `icons/` directory:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)

   For testing, you can use simple solid color squares or download free film-related icons.

3. **Load the extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `film-planner` folder
   - The extension should now appear in your extensions list

4. **Pin the extension** (optional but recommended)
   - Click the puzzle piece icon in Chrome toolbar
   - Find "Film Festival Planner"
   - Click the pin icon to keep it visible

## Usage

### 1. Add Films to Your Planner

**Method 1: While browsing (recommended)**
- Visit any Berlinale film page (e.g., `https://www.berlinale.de/en/programme/202616575.html`)
- Look for the "Add to Planner" button near the film title
- Click to add the film
- Set priority (Must-see or Interested)

**Method 2: Import favorites**
- Click the extension icon
- Go to Films tab
- Click "Import Favorites" (coming soon)

### 2. Set Your Preferences

- Click the extension icon
- Go to Settings tab
- Configure:
  - **Maximum films per day**: How many films you want to watch per day (1-4)
  - **Available days**: Check the days you'll be at the festival
  - **Time ranges**: For each day, choose "All day" or set specific hours
- Click "Save Preferences"

### 3. Generate Your Schedule

- Go to Films tab
- Click "Generate Schedule"
- View your optimized schedule in the Schedule tab
- Each scheduled film shows:
  - Screening time (start-end)
  - Film title (clickable)
  - Venue location
  - Priority badge
  - "Buy Ticket" link

### 4. Review and Adjust

- If some films couldn't be scheduled, they'll appear in the "Unscheduled" section
- Tips for fitting more films:
  - Adjust priorities (fewer must-sees)
  - Remove some films
  - Expand available time ranges
  - Increase max films per day
- Make changes and click "Regenerate" to create a new schedule

## Project Structure

```
film-planner/
├── manifest.json              # Chrome extension configuration
├── popup/
│   ├── popup.html            # Extension popup UI
│   ├── popup.js              # Popup logic and interactions
│   └── popup.css             # Popup styling
├── content/
│   ├── content.js            # Inject "Add to Planner" button
│   └── content.css           # Content script styling
├── background/
│   └── service-worker.js     # Background message handling
├── lib/
│   ├── scrapers/
│   │   └── berlinale.js      # Berlinale DOM parsing
│   ├── scheduler.js          # Scheduling algorithm
│   └── storage.js            # Chrome Storage API wrapper
├── data/
│   └── venues/
│       └── berlinale.json    # Venue data and travel times
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── CLAUDE.md                  # Development context
└── README.md                  # This file
```

## How It Works

### Scheduling Algorithm

The extension uses a greedy scheduling algorithm that:

1. **Prioritizes films**: Must-see films are scheduled first
2. **Considers constraints**:
   - Only schedules on your available days
   - Respects your time ranges for each day
   - Limits films per day based on your preference
3. **Accounts for travel time**:
   - Uses pre-calculated travel times between venues
   - Ensures sufficient time to travel between screenings
4. **Detects conflicts**: Films with overlapping times or insufficient travel time are marked as conflicts
5. **Provides feedback**: Unscheduled films show specific reasons why they couldn't fit

### Travel Times

Travel times between venues are conservative estimates based on:
- Same venue: 0 minutes
- Same district: 15 minutes
- Adjacent districts: 30 minutes
- Far districts: 45 minutes

These include public transit and walking time.

## Troubleshooting

### Extension doesn't load
- Make sure Developer mode is enabled in `chrome://extensions/`
- Check that all required files are present
- Check browser console for errors (F12 → Console)

### "Add to Planner" button doesn't appear
- Verify you're on a Berlinale film page (`/programme/*.html`)
- Refresh the page
- Check if content script is injected (right-click → Inspect → Console)

### Films not being scraped correctly
- Berlinale website structure may have changed
- Open browser console to see scraper errors
- May need to update scraper in `lib/scrapers/berlinale.js`

### Schedule generation fails
- Ensure you have films added
- Ensure you have available days configured
- Check that venue data loaded correctly
- See browser console for specific errors

### Accessing browser consoles

- **Popup**: Right-click the extension icon → Inspect
- **Content script**: Open a Berlinale film page → F12 → Console
- **Service worker**: `chrome://extensions/` → click "service worker" link

```javascript
// Check stored data (run in popup console)
chrome.storage.local.get(null, (data) => console.log(data));

// Clear all data
chrome.storage.local.clear(() => console.log('Cleared'));
```

## Development

See `CLAUDE.md` for development guidelines, code style, and architectural decisions.

### Testing Checklist

- [ ] Scraper works on 5+ different Berlinale film pages
- [ ] Films can be added, removed, and priority updated
- [ ] Preferences save correctly
- [ ] Schedule generation respects all constraints
- [ ] Travel times are reasonable (verify 3-4 venue pairs)
- [ ] UI is responsive and intuitive
- [ ] Error messages are clear

## Known Limitations

- Only supports Berlinale (other festivals planned for Phase 2)
- Import favorites feature not yet implemented
- Manual scraping required (no API available)
- Travel times are estimates (Phase 2 will use Google Maps API)
- No drag-drop schedule editing (Phase 2)
- No calendar export (Phase 2)

## Future Enhancements (Phase 2+)

- Natural language preferences ("prefer morning screenings")
- Drag-drop schedule editing
- Google Maps API integration for precise travel times
- Calendar export (iCal, Google Calendar)
- Multi-festival support
- Film notes and ratings
- Social features (share schedules with friends)

## License

MIT License - feel free to use and modify for your own festival planning needs.

## Credits

Built for film lovers who want to maximize their festival experience without the scheduling headache.
