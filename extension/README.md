# Rolearch: Job Fit Check (Chrome / Edge extension)

Click the Rolearch button on any job posting (LinkedIn, Indeed, Glassdoor, Greenhouse, Lever, Workday, Ashby or a
company careers page). The popup reads that one posting and opens it in the free job-fit check at rolearch.com/ats,
already filled in, where the member runs the check against their resume and can save the job to their tracker.

How it works:
- `extract.js`: reads the title, company, link and description of the posting on the current tab. It checks
  schema.org JobPosting data first, then known job-site layouts, then the text the member selected, then the
  page's main text. It runs only on click (`activeTab`), so the extension asks for no "read all sites" permission.
- `popup.js`: shows what was found and opens rolearch.com/ats.
- `bridge.js`: runs only on rolearch.com/ats. It passes the posting to the page with `postMessage`; the page
  (`src/app/ats/free-check.tsx`) accepts it only from the same window and origin.

## Try it locally
1. In Chrome, open `chrome://extensions` and turn on Developer mode.
2. Click "Load unpacked" and choose this `extension` folder.
3. Open a job posting and click the Rolearch icon in the toolbar.

## Publish
1. Zip the folder's contents (manifest.json at the zip's root):
   `Compress-Archive -Path extension\* -DestinationPath rolearch-extension.zip -Force`
2. Chrome Web Store developer dashboard (one-time $5 registration): upload the zip and fill in the listing from
   `store-listing.md`. Edge: Microsoft Partner Center, Edge add-ons, same zip, free.
