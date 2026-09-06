// Copy this file to data-source-config.js and replace every <PLACEHOLDER>.
// This adapter maps your auction-value CSV headers into the app's canonical fields.
// Values marked CSV MATCH must exactly match your CSV filename or header names.
// Values marked APP CHOICE can be named however you want, as long as keys stay consistent.
window.DataSourceConfig = {
  // CSV MATCH: exact CSV filename in this folder.
  csvUrl: "<CSV_FILE_NAME>.csv",

  // APP CHOICE: display text shown after the file loads.
  sourceLabel: "<SHORT_SOURCE_LABEL_SHOWN_IN_THE_APP>",

  fields: {
    // CSV MATCH: stable unique player identifier. Used for saved draft state.
    playerId: "<UNIQUE_PLAYER_ID_HEADER>",

    // CSV MATCH: name headers. If your CSV only has one full-name column, use fallbackName.
    firstName: "<FIRST_NAME_HEADER>",
    lastName: "<LAST_NAME_HEADER>",
    fallbackName: "<FULL_NAME_OR_FALLBACK_NAME_HEADER>",

    // CSV MATCH: team and position headers. Values should identify NFL team and fantasy position.
    team: "<TEAM_HEADER>",
    position: "<POSITION_HEADER>",
  },
  scoringModes: [
    {
      // APP CHOICE: internal mode id. Keep stable because it is used in saved browser settings.
      key: "<MODE_KEY>",

      // APP CHOICE: label shown in the scoring menu and table header.
      label: "<MODE_LABEL>",

      // CSV MATCH: auction-value column for this scoring mode. This is required.
      auctionValue: "<AUCTION_VALUE_HEADER_FOR_THIS_MODE>",

      // CSV MATCH: rank/order column for sorting this scoring mode.
      rank: "<RANK_HEADER_FOR_THIS_MODE>",

      // CSV MATCH, OPTIONAL: backup rank column if rank is blank for a row.
      fallbackRank: "<OPTIONAL_FALLBACK_RANK_HEADER>",
    },
  ],
};
