/* global rolearchExtractJob */
const ROLEARCH = "https://www.rolearch.com";
const MIN = 200; // the free check needs at least this many characters of description

const app = document.getElementById("app");

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) k === "class" ? (e.className = v) : e.setAttribute(k, v);
  for (const k of kids) if (k != null) e.append(k);
  return e;
}

function show(...nodes) {
  app.replaceChildren(...nodes);
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let job;
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: rolearchExtractJob });
    job = res && res.result;
  } catch {
    job = null;
  }
  if (!job) {
    show(
      el("h1", {}, "Open a job posting first"),
      el("p", { class: "note" }, "Go to a job posting on any job site or company careers page, then click the Rolearch button again."),
    );
    return;
  }

  const enough = job.description.length >= MIN && job.title;
  const chars = job.description.length.toLocaleString("en");
  const button = el("button", { type: "button" }, el("span", { class: "dot", "aria-hidden": "true" }), "Check my fit on Rolearch");
  button.disabled = !enough;
  button.addEventListener("click", async () => {
    button.disabled = true;
    await chrome.storage.local.set({ pendingJob: { ...job, at: Date.now() } });
    await chrome.tabs.create({ url: `${ROLEARCH}/ats?utm_source=extension&utm_medium=extension&utm_campaign=jobfit` });
    window.close();
  });

  show(
    el("h1", {}, job.title || "No job title found"),
    job.company ? el("p", { class: "company" }, job.company) : null,
    el("span", { class: enough ? "chip" : "chip warn" }, enough ? `Job description found · ${chars} characters` : "Couldn't find the full description"),
    enough
      ? el("p", { class: "note" }, "Rolearch compares this job with your resume: your match, the skills you're missing, and what to fix. You can save it to your tracker there too.")
      : el("p", { class: "note" }, "Select the job description on the page with your mouse, then click the Rolearch button again."),
    button,
  );
}

main();
