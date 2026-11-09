/* Neutral, educational display labels for thesis and company status codes.
   Codes come from /investment/data/*.json. Older buy/sell-style codes are mapped too,
   so the pages never show trading instructions even if an older data file is loaded. */
(function () {
  var MAP = {
    criteria_met: 'Thesis criteria met',
    active_buy: 'Thesis criteria met',
    active: 'Thesis active',
    watchlist: 'On the watch list',
    monitor: 'Monitoring',
    pending: 'Pending review',
    developing: 'Developing',
    confirming: 'Confirming signals',
    confirming_with_risk: 'Confirming, with risks',
    valuation_review: 'Valuation under review',
    deep_dive: 'In-depth review',
    unresolved: 'Unresolved',
    unestablished: 'Not yet established',
    watch_attractive_value_level: 'What to watch: the attractive-value level',
    buy_below_attractive_threshold: 'What to watch: the attractive-value level',
    hold_or_buy_below_attractive_threshold: 'What to watch: the attractive-value level',
    watch_below_fair_value: 'What to watch: price vs. modeled fair value',
    buy_below_fair_value: 'What to watch: price vs. modeled fair value',
    buy_below_entry_zone: 'What to watch: the modeled value range',
    fair_value_monitor: 'Near modeled fair value',
    fair_value_hold: 'Near modeled fair value',
    watch_for_lower_valuation: 'What to watch: valuation',
    wait_for_lower_entry_price: 'What to watch: valuation',
    watch_valuation_and_earnings_evidence: 'What to watch: valuation and earnings evidence',
    wait_for_better_entry_or_higher_earnings_evidence: 'What to watch: valuation and earnings evidence',
    monitor_margin_recovery: 'What to watch: margin recovery',
    monitor_margin_recovery_before_buying: 'What to watch: margin recovery',
    watch_for_catalyst: 'What to watch: catalysts',
    hold_and_monitor: 'Monitoring',
    await_earnings_results: 'What to watch: earnings results',
    fair_value: 'Near modeled fair value',
    fair: 'Near modeled fair value',
    attractive: 'Below the attractive-value level',
    expensive: 'Above modeled fair value'
  };
  function pretty(value) {
    return String(value == null ? '' : value).replace(/[_-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function label(value) {
    if (value == null || value === '') return '';
    var key = String(value).trim().toLowerCase();
    if (MAP[key]) return MAP[key];
    var text = pretty(value);
    // Never surface trading instructions from an unmapped code.
    if (/\b(buy|sell|accumulate|short|trim)\b/i.test(text)) return 'What to watch: valuation and signals';
    return text;
  }
  window.WLInvestLabels = { label: label, pretty: pretty };
})();
