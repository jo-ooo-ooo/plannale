# Setup Guide - Film Festival Planner

## Quick Start (5 minutes)

### Step 1: Load Extension in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Toggle "Developer mode" ON (top-right corner)
4. Click "Load unpacked"
5. Navigate to and select the `film-planner` folder
6. Extension should appear with a red film icon

### Step 2: Pin Extension (Optional)

1. Click the puzzle piece icon in Chrome toolbar
2. Find "Film Festival Planner"
3. Click the pin icon to keep it visible in toolbar

### Step 3: Configure Preferences

1. Click the extension icon
2. Go to "Settings" tab
3. Set your preferences:
   - **Max films per day**: Choose 1-4 (recommended: 3)
   - **Available days**: Check the days you'll attend Berlinale
   - **Time ranges**: For each day, choose "All day" or set custom hours
4. Click "Save Preferences"

### Step 4: Test with a Sample Film

1. Visit the Berlinale website: https://www.berlinale.de/en/programme.html
2. Click on any film
3. Look for "Add to Planner" button near the title
4. Click to add the film
5. Set priority (Must-see or Interested)

### Step 5: Generate Your First Schedule

1. Click the extension icon
2. Add a few more films (at least 3-5 for testing)
3. Go to "Films" tab
4. Click "Generate Schedule"
5. View your schedule in the "Schedule" tab

## Testing the Extension

### Test Scenario 1: Basic Film Management

1. Add 5 films from Berlinale website
2. Verify all appear in Films tab
3. Change priorities for 2 films
4. Remove 1 film
5. Verify changes persist after closing/reopening popup

### Test Scenario 2: Schedule Generation

1. Configure settings:
   - Max 2 films per day
   - Available only on Feb 14-15
   - All day availability
2. Add 6 films with various screening times
3. Generate schedule
4. Verify:
   - Only 2 films per day scheduled
   - Only Feb 14-15 used
   - No time conflicts
   - Unscheduled films shown with reasons

### Test Scenario 3: Time Range Constraints

1. Configure settings:
   - Max 3 films per day
   - Feb 16: Available 14:00-20:00 only
2. Add films with screenings at various times
3. Generate schedule
4. Verify only screenings within 14:00-20:00 are scheduled

### Test Scenario 4: Travel Time

1. Add films at different venues
2. Look for films scheduled on same day
3. Verify sufficient time gap between films (based on venue travel time)
4. Check that films at far venues have ~30-45 min gaps
5. Check that films at same venue have 0 min gap (back-to-back possible)

## Troubleshooting

### Issue: Extension doesn't load

**Check:**
- Developer mode is enabled in chrome://extensions/
- All files are present in the folder
- No syntax errors in browser console (F12)

**Solution:**
```bash
cd /Users/yuntzuchen/Desktop/film-planner
# Verify all files exist
ls manifest.json
ls popup/popup.html
ls background/service-worker.js
ls content/content.js
```

### Issue: "Add to Planner" button doesn't appear

**Check:**
- You're on a Berlinale film page (URL contains `/programme/*.html`)
- Content script is loaded (check console for errors)

**Solution:**
1. Refresh the page (Cmd+R / Ctrl+R)
2. Check if URL matches: `*://www.berlinale.de/programme/*.html`
3. Open console (F12) and look for errors

### Issue: Films not scraping correctly

**Check:**
- Berlinale website structure may have changed
- Scraper expects specific HTML structure

**Solution:**
1. Open browser console on film page
2. Look for scraper errors
3. May need to update `lib/scrapers/berlinale.js`

### Issue: Schedule generation fails

**Error: "No films added"**
- Add at least 1 film from Berlinale website

**Error: "No available days set"**
- Go to Settings tab
- Check at least 1 day
- Save preferences

**Error: "Venue data not available"**
- Check `data/venues/berlinale.json` exists
- Check browser console for loading errors

### Issue: All films go to "Unscheduled"

**Possible causes:**
1. Time ranges too restrictive
2. Max films per day too low
3. No screenings on available days

**Solution:**
- Expand available time ranges (use "All day")
- Increase max films per day
- Check more available days
- Verify films have screenings on your selected dates

## Debugging Tips

### View Console Logs

**For popup:**
1. Right-click extension icon
2. Select "Inspect"
3. Console tab shows popup logs

**For content script:**
1. Navigate to Berlinale film page
2. Press F12
3. Console tab shows content script logs

**For service worker:**
1. Go to chrome://extensions/
2. Click "service worker" link under extension
3. Console shows background logs

### Check Storage

```javascript
// In popup console:
chrome.storage.local.get(null, (data) => console.log(data));
```

### Clear All Data

```javascript
// In popup console:
chrome.storage.local.clear(() => console.log('Cleared'));
```

## Known Limitations

1. **Berlinale website structure**: Scraper assumes specific HTML structure. If Berlinale changes their website, scraping may fail.

2. **Travel times**: Currently uses pre-calculated estimates. Phase 2 will use Google Maps API for precise times.

3. **No API**: Extension scrapes HTML since Berlinale doesn't provide an API.

4. **Import favorites**: Feature not yet implemented in v1.

## Next Steps

After confirming the extension works:

1. **Test with real data**: Add 10+ actual films you want to see
2. **Refine preferences**: Adjust settings based on schedule results
3. **Iterate**: Regenerate schedule after changes
4. **Book tickets**: Use "Buy Ticket" links to purchase tickets

## Need Help?

- Check README.md for feature documentation
- Check CLAUDE.md for development guidelines
- Look at browser console for error messages
- Verify all files are present and unchanged

## Success Checklist

- [ ] Extension loads in Chrome
- [ ] Can add films from Berlinale website
- [ ] Films appear in popup
- [ ] Can change priorities
- [ ] Can remove films
- [ ] Settings save correctly
- [ ] Schedule generates without errors
- [ ] Scheduled films show in Schedule tab
- [ ] Unscheduled films show reasons
- [ ] "Buy Ticket" links work
- [ ] Travel times are reasonable

Once all items are checked, you're ready to plan your Berlinale 2026 schedule!
