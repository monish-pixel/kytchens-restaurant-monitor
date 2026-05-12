/**
 * Google Apps Script: trigger GH Actions scrape workflow on Sheets edits.
 *
 * Setup:
 *  1. Open your Google Sheet → Extensions → Apps Script
 *  2. Paste this file content
 *  3. Project Settings → Script Properties → add:
 *       GITHUB_PAT   = ghp_xxxxxxxxxxxxxxxxxxxx  (repo + workflow scope)
 *       GITHUB_OWNER = your-github-org-or-username
 *       GITHUB_REPO  = restaurant-monitor
 *  4. Triggers → Add Trigger:
 *       Function: onSheetEdit
 *       Event: From spreadsheet → On edit
 *  5. (Optional) add a "Force Sync" button:
 *       Insert → Drawing → create a button shape
 *       Assign script: forceSyncNow
 */

var WATCHED_SHEETS = ["Restaurant Master", "Items Master"];
var WORKFLOW_FILE = "scrape.yml";
var DEBOUNCE_SECONDS = 30; // ignore repeated edits within this window

/**
 * onEdit trigger: fires on any cell change in the spreadsheet.
 * Filters to watched sheets only, debounces rapid edits.
 */
function onSheetEdit(e) {
  var sheetName = e.range.getSheet().getName();
  if (WATCHED_SHEETS.indexOf(sheetName) === -1) return;

  var cache = CacheService.getScriptCache();
  var lockKey = "sync_debounce";
  if (cache.get(lockKey)) {
    Logger.log("onSheetEdit: debounce active, skipping dispatch");
    return;
  }

  cache.put(lockKey, "1", DEBOUNCE_SECONDS);
  Logger.log("onSheetEdit: dispatching workflow for sheet: " + sheetName);
  _dispatchWorkflow({ trigger_source: "sheets_edit", sheet: sheetName });
}

/**
 * Manually callable from a "Force Sync" button in the Sheet.
 */
function forceSyncNow() {
  Logger.log("forceSyncNow: dispatching workflow");
  _dispatchWorkflow({ trigger_source: "force_sync" });
  SpreadsheetApp.getUi().alert("Sync triggered! Check GitHub Actions for progress.");
}

/**
 * Calls the GitHub REST API to dispatch the workflow_dispatch event.
 */
function _dispatchWorkflow(inputs) {
  var props = PropertiesService.getScriptProperties();
  var pat = props.getProperty("GITHUB_PAT");
  var owner = props.getProperty("GITHUB_OWNER");
  var repo = props.getProperty("GITHUB_REPO");

  if (!pat || !owner || !repo) {
    Logger.log("ERROR: GITHUB_PAT, GITHUB_OWNER, or GITHUB_REPO not set in Script Properties");
    return;
  }

  var url = "https://api.github.com/repos/" + owner + "/" + repo +
            "/actions/workflows/" + WORKFLOW_FILE + "/dispatches";

  var payload = JSON.stringify({
    ref: "main",
    inputs: inputs || {}
  });

  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + pat,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    payload: payload,
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code === 204) {
    Logger.log("Workflow dispatched successfully");
  } else {
    Logger.log("Dispatch failed: HTTP " + code + " — " + response.getContentText());
  }
}
