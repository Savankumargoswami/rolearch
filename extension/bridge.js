// Runs on rolearch.com/ats only. Hands the posting the member picked in the popup to the free check on this page,
// then forgets it. The page accepts it only from this same window and origin.
(async () => {
  const { pendingJob } = await chrome.storage.local.get("pendingJob");
  if (!pendingJob || Date.now() - pendingJob.at > 10 * 60 * 1000) return;
  const job = { title: pendingJob.title, company: pendingJob.company, url: pendingJob.url, description: pendingJob.description };
  const send = () => window.postMessage({ type: "rolearch-extension-job", job }, location.origin);
  const forget = () => chrome.storage.local.remove("pendingJob");
  // The page says "ready" once its form is listening; if it already was, the first send lands.
  window.addEventListener("message", (e) => {
    if (e.source === window && e.data && e.data.type === "rolearch-extension-ready") {
      send();
      forget();
    }
  });
  send();
  setTimeout(forget, 30000);
})();
