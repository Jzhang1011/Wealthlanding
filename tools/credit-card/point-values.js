/* Single source of truth for point and mile values used by the Card Rewards Router.
   Every calculation on /tools/credit-card/ reads these numbers: the Quick Check,
   the category rankings, the wallet planner (UNLOCK_CARDS) and the value guide.

   Values are in US cents per point.
   - value:   default assumed value when points are used for travel or transferred to
              partners. ASSUMPTION: WealthLanding's rounded, deliberately conservative
              estimate of a typical redemption. Programs do not publish these numbers,
              and real value depends on how and when you redeem. Readers can override
              them in "Customize Point Values"; overrides are saved in the browser only.
   - cashOut: the floor the tool will not go below, for a fixed-value redemption such
              as cash back or a statement credit where the program offers one
              (null = the tool assumes no fixed cash-out option).
   Edit here; node tools/credit-card/point-values.test.js checks the page stays in sync. */
(function (root) {
  var WL_POINT_VALUES = {
    basis: 'Default values are WealthLanding assumptions: rounded, conservative estimates of a typical travel or transfer redemption, not rates published by the programs. Your own value depends on how and when you redeem, so adjust them to match how you use points.',
    currencies: {
      ur:       { name: 'Chase Ultimate Rewards',   value: 2.0, cashOut: 1.00 },
      mr:       { name: 'Amex Membership Rewards',  value: 2.0, cashOut: 0.60 },
      ty:       { name: 'Citi ThankYou Points',     value: 1.9, cashOut: 1.00 },
      c1:       { name: 'Capital One Miles',        value: 1.5, cashOut: 1.00 },
      marriott: { name: 'Marriott Bonvoy Points',   value: 0.8, cashOut: 0.30 },
      hilton:   { name: 'Hilton Honors Points',     value: 0.5, cashOut: 0.30 },
      hyatt:    { name: 'World of Hyatt Points',    value: 1.8, cashOut: 0.50 },
      ihg:      { name: 'IHG One Rewards Points',   value: 0.5, cashOut: null },
      united:   { name: 'United MileagePlus Miles', value: 1.3, cashOut: 1.00 },
      delta:    { name: 'Delta SkyMiles',           value: 1.2, cashOut: 1.00 },
      aa:       { name: 'American AAdvantage Miles', value: 1.4, cashOut: null },
      aeroplan: { name: 'Aeroplan Points',          value: 1.3, cashOut: null }
    },
    /* currency label used by the wallet planner cards -> key above */
    plannerCurrency: {
      'Hilton Honors': 'hilton', 'Marriott Bonvoy': 'marriott', 'World of Hyatt': 'hyatt',
      'IHG One': 'ihg', 'Chase UR': 'ur', 'CapOne miles': 'c1', 'Amex MR': 'mr',
      'Delta SkyMiles': 'delta', 'United miles': 'united', 'AA miles': 'aa', 'Aeroplan': 'aeroplan'
    }
  };
  root.WL_POINT_VALUES = WL_POINT_VALUES;
  if (typeof module !== 'undefined' && module.exports) module.exports = WL_POINT_VALUES;
})(typeof window !== 'undefined' ? window : globalThis);
