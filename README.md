# Draft Tracker

A browser-based fantasy draft tracker built around auction value. It loads a local CSV, tracks drafted players in browser storage, highlights handcuffs, and graphs remaining auction-value cliffs by position.

## Local Setup

Run the folder through a local static server so the browser can fetch the CSV:

```sh
python3 -m http.server 8001
```

Then open:

```text
http://127.0.0.1:8001/index.html
```

## Data Source Config

This app expects a local `data-source-config.js` file, but that file is intentionally source-specific. If your CSV comes from a third party or contains licensed/proprietary headers, do not publish that config or the CSV.

To configure your own data source:

1. Copy `data-source-config.template.js` to `data-source-config.js`.
2. Put your CSV file in this folder.
3. Set `csvUrl` to that CSV filename.
4. Map each canonical app field to the matching CSV header.
5. Add one or more scoring modes with an auction-value header and rank header.

Some config values are a contract with the CSV. Others are app-facing names you choose:

| Value | Must match CSV? | Notes |
| --- | --- | --- |
| `csvUrl` | Yes | Exact local CSV filename. |
| `fields.playerId` | Yes | Exact header for a stable unique player id. This powers saved draft state. |
| `fields.firstName`, `fields.lastName`, `fields.fallbackName` | Yes | Exact name headers. Use `fallbackName` if the CSV has a full-name column. |
| `fields.team`, `fields.position` | Yes | Exact headers for team and position. |
| `scoringModes[].auctionValue` | Yes | Exact auction-value header. Required for this app to be useful. |
| `scoringModes[].rank` | Yes | Exact rank/order header for sorting within that scoring mode. |
| `scoringModes[].fallbackRank` | Yes, if used | Exact backup rank header. Remove it if you do not need one. |
| `sourceLabel` | No | Display text shown after the CSV loads. |
| `scoringModes[].key` | No | Internal id you choose, but keep it stable because browser settings use it. |
| `scoringModes[].label` | No | Display text shown in the scoring menu and value column. |

The app's core concept is auction value. Rankings say who comes next, but auction value shows the size of the gap between players. The position sparklines use those values to make cliffs, flat spots, and replacement-level drops easier to spot during a draft.

Example shape:

```js
window.DataSourceConfig = {
  csvUrl: "my-values.csv",
  sourceLabel: "My 2026 auction values",
  fields: {
    playerId: "id",
    firstName: "first",
    lastName: "last",
    fallbackName: "name",
    team: "team",
    position: "position",
  },
  scoringModes: [
    {
      key: "standard",
      label: "Standard",
      auctionValue: "standard_value",
      rank: "standard_rank",
    },
  ],
};
```

If a value can come from multiple possible headers, use an array. The app will use the first non-empty value:

```js
team: ["team_abbreviation", "team_name"]
```

## Publish Notes

For a public GitHub repo, include:

- `index.html`
- `app.js`
- `styles.css`
- `draft-plan-config.js`
- `draft-helpers.js`
- `data-source-config.template.js`
- `README.md`

Do not include:

- `data-source-config.js`
- third-party CSV exports
- lock/temp files created by spreadsheet editors
