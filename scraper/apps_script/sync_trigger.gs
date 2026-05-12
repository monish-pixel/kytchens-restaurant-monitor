/**
 * Google Apps Script: trigger GH Actions scrape workflow on Sheets edits.
 *
 * Setup (one-time):
 *  1. Open the Google Sheet → Extensions → Apps Script
 *  2. Paste this file (replacing default code)
 *  3. Project Settings (gear icon) → Script Properties → Add property:
 *       GITHUB_PAT = ghp_xxxxxxxxxxxxxxxxxxxx
 *       (create at github.com/settings/tokens → repo + workflow scopes)
 *  4. Triggers (clock icon) → Add Trigger:
 *       Function: onSheetEdit
 *       Event source: From spreadsheet
 *       Event type: On edit
 *  5. Optional "Force Sync" button:
 *       Insert → Drawing → draw a button → Save
 *       Click the button's ... menu → Assign script → forceSyncNow
 */

var GITHUB_OWNER = "monish-pixel";
var GITHUB_REPO  = "kytchens-restaurant-monitor";
var WATCHED_SHEETS = ["Restaurant Master", "Items Master"];
var WORKFLOW_FILE = "scrape.yml";
var DEBOUNCE_SECONDS = 30;

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

  if (!pat) {
    Logger.log("ERROR: GITHUB_PAT not set in Script Properties");
    SpreadsheetApp.getUi().alert("Missing GITHUB_PAT in Script Properties. See setup instructions.");
    return;
  }

  var url = "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO +
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
