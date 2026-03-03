# Film Festival Planner - Chrome Extension

## Project Overview
Chrome extension (Manifest v3) for optimizing film festival schedules. MVP targets Berlinale 2026, extensible to other festivals.

## Technology Stack
- Chrome Extension Manifest v3
- Vanilla JavaScript (ES modules, no framework for MVP)
- Chrome Storage API for data persistence
- CSS for styling

## Code Style
- Use ES modules (import/export) syntax, not CommonJS
- Use modern JavaScript (ES2020+): async/await, optional chaining, nullish coalescing
- Use const by default, let when reassignment needed, never var
- Prefer functional patterns over imperative when appropriate
- Use descriptive variable names (no single letters except for common iterators)

## File Organization
- Keep scrapers modular in lib/scrapers/ - one file per festival
- Storage operations only in lib/storage.js - no direct chrome.storage calls elsewhere
- Scheduler logic isolated in lib/scheduler.js
- No mixing UI logic with business logic

## Chrome Extension Guidelines
- ALWAYS use Manifest v3 syntax (not v2)
- Service workers, not background pages
- Use chrome.storage.local (not sync) for this project
- Message passing: chrome.runtime.sendMessage / chrome.runtime.onMessage
- Content scripts: inject via manifest, not programmatically for MVP

## Testing Requirements
- Manually test scraper on 5+ different Berlinale film pages
- Verify travel time estimates against Google Maps (3-4 venue pairs)
- Test with realistic datasets (10+ films with overlapping times)
- Test edge cases: no films, no preferences, no available days

## Naming Conventions
- Files: kebab-case (e.g., berlinale.js, service-worker.js)
- Functions: camelCase (e.g., generateSchedule, getTravelTime)
- Constants: UPPER_SNAKE_CASE (e.g., DEFAULT_BUFFER_TIME)
- CSS classes: kebab-case (e.g., film-card, schedule-item)

## Data Format Standards
- Dates: ISO 8601 (YYYY-MM-DD)
- Times: 24-hour format (HH:mm)
- Durations: minutes as integers
- IDs: extracted from URLs (e.g., "202616575")

## Common Patterns
- Storage operations are async - always use await
- Error handling: graceful degradation, show user-friendly messages
- Loading states for async operations (Import Favorites, Generate Schedule)
- Venue lookup by key, not hardcoded names

## Anti-Patterns
- DON'T use jQuery or other libraries (keep it lightweight)
- DON'T make API calls (festivals don't have APIs)
- DON'T use localStorage (use chrome.storage API)
- DON'T parse HTML with regex (use DOM methods)
- DON'T add unnecessary abstractions in MVP

## Performance Guidelines
- Pre-calculate travel time matrix (don't compute on-demand)
- Use efficient DOM queries in content scripts
- Batch storage operations when possible
- Keep popup UI responsive (no blocking operations)

## MVP Scope Boundaries
✅ Include:
- Berlinale support only
- Basic preferences (max films/day, available times)
- Greedy scheduling algorithm
- Import favorites functionality

❌ Exclude from v1:
- Natural language preferences (Phase 2)
- Drag-drop schedule editing (Phase 2)
- Google Maps API integration (Phase 2)
- Multi-festival support (Phase 3)
- Calendar export (Phase 2)

## Development Workflow
1. Test in Chrome with "Load unpacked" extension
2. Check Chrome DevTools console for errors
3. Use chrome://extensions for debugging
4. Clear storage between major changes
5. Test on actual berlinale.de pages, not mocks
