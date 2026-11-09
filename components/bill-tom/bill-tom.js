/*
 * Bill and Tom: one shared, illustrative calculation used by
 *   - /Retirement-simulator/Retirement_Gateway.html
 *   - /blogs/Happy_retirement/how-to-avoid-RMD-taxes.html
 * so both pages tell the same story with the same numbers.
 *
 * Every input below is a WealthLanding illustrative assumption, not a forecast.
 * Tests: node components/bill-tom/bill-tom.test.js
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WLBillTom = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ASSUMPTIONS = {
    startAge: 60,
    endAge: 85,
    traditional: 2800000,     // pretax IRA / 401(k)
    brokerage: 700000,
    brokerageBasisPct: 0.5,   // half of the brokerage balance is cost basis
    roth: 300000,
    returnPct: 0.06,          // nominal, every account, every year
    inflationPct: 0.025,
    spending: 140000,         // after-tax household spending in today's dollars
    socialSecurity: 60000,    // combined, today's dollars, from age 67
    ssStartAge: 67,
    ssTaxablePct: 0.85,
    ltcgRate: 0.15,           // flat rate on realized brokerage gains
    heirTaxRate: 0.32,        // tax heirs pay on inherited pretax money
    conversionEndAge: 72,     // Bill converts from 60 through 72
    conversionBracketTop: 211400, // Bill fills up to the top of the 22% bracket (2026, married filing jointly)
    // 2026 federal brackets, married filing jointly (IRS Rev. Proc. 2025-32), indexed with inflation.
    brackets: [[24800, 0.10], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [Infinity, 0.37]],
    standardDeduction: 32200,
    // IRS Uniform Lifetime Table divisors (ages 73 to 85).
    rmdDivisor: { 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0 }
  };

  function ordinaryTax(income, idx, a) {
    var taxable = Math.max(0, income - a.standardDeduction * idx), tax = 0, lo = 0;
    for (var k = 0; k < a.brackets.length; k++) {
      var hi = a.brackets[k][0] * idx;
      if (taxable <= lo) break;
      tax += (Math.min(taxable, hi) - lo) * a.brackets[k][1];
      lo = hi;
    }
    return tax;
  }

  // One household. convert=true is Bill (converts in the low-income years); false is Tom.
  function simulate(convert, overrides) {
    var a = Object.assign({}, ASSUMPTIONS, overrides || {});
    var trad = a.traditional, brok = a.brokerage, basis = a.brokerage * a.brokerageBasisPct, roth = a.roth;
    var rows = [], lifetimeTax = 0, totalRmd = 0, totalConverted = 0;
    for (var age = a.startAge; age < a.endAge; age++) {
      var idx = Math.pow(1 + a.inflationPct, age - a.startAge);
      var spend = a.spending * idx;
      var ss = age >= a.ssStartAge ? a.socialSecurity * idx : 0;
      var rmd = a.rmdDivisor[age] ? trad / a.rmdDivisor[age] : 0;
      var baseIncome = ss * a.ssTaxablePct + rmd;
      // Cash needed: spending plus tax, less Social Security and the RMD.
      // Fund it from brokerage first, then extra pretax withdrawals, then Roth.
      var fund = function (conv) {
        var ord = baseIncome + conv;
        var tax = ordinaryTax(ord, idx, a);
        var need = spend + tax - ss - rmd;
        var r = { conv: conv, tax: tax, fromBrok: 0, gains: 0, extra: 0, fromRoth: 0, surplus: 0 };
        if (need <= 0) { r.surplus = -need; return r; }   // RMD cash not needed is reinvested
        var gainPct = brok > 0 ? 1 - basis / brok : 0;
        r.fromBrok = Math.min(brok, need / (1 - gainPct * a.ltcgRate));
        r.gains = r.fromBrok * gainPct;
        r.tax += r.gains * a.ltcgRate;
        var left = need - (r.fromBrok - r.gains * a.ltcgRate);
        var pretaxLeft = Math.max(0, trad - rmd - conv);
        if (left > 0.5 && pretaxLeft > 0) {
          // Smallest extra pretax withdrawal whose after-tax amount covers what is left.
          var net = function (e) { return e - (ordinaryTax(ord + e, idx, a) - ordinaryTax(ord, idx, a)); };
          var lo = 0, hi = pretaxLeft;
          if (net(hi) <= left) lo = hi;
          else for (var it = 0; it < 60; it++) { var mid = (lo + hi) / 2; if (net(mid) < left) lo = mid; else hi = mid; }
          r.extra = lo;
          r.tax += ordinaryTax(ord + lo, idx, a) - ordinaryTax(ord, idx, a);
          left -= net(lo);
        }
        if (left > 0.5) r.fromRoth = Math.min(roth, left);
        return r;
      };
      var f = fund(0);
      if (convert && age <= a.conversionEndAge) {
        // Bill converts just enough that all ordinary income, including what he
        // withdraws to live on, stays inside the target bracket.
        var top = (a.conversionBracketTop + a.standardDeduction) * idx;
        var c = Math.max(0, Math.min(trad - rmd, top - baseIncome - f.extra));
        for (var k = 0; k < 40 && c > 0; k++) {
          f = fund(c);
          var over = baseIncome + c + f.extra - top;
          if (over <= 1) break;
          c = Math.max(0, c - over);
        }
        f = fund(c);
      }
      var conv = f.conv, tax = f.tax, fromBrok = f.fromBrok, extra = f.extra, fromRoth = f.fromRoth, surplus = f.surplus;
      if (fromBrok > 0) { basis -= basis * (fromBrok / brok); brok -= fromBrok; }
      if (surplus > 0) { brok += surplus; basis += surplus; }
      trad -= rmd + conv + extra;
      roth += conv - fromRoth;
      trad *= 1 + a.returnPct; brok *= 1 + a.returnPct; roth *= 1 + a.returnPct;
      lifetimeTax += tax; totalRmd += rmd; totalConverted += conv;
      rows.push({ age: age, conv: conv, rmd: rmd, extra: extra, tax: tax, trad: trad, brok: brok, roth: roth });
    }
    var heirs = brok + roth + trad * (1 - a.heirTaxRate);
    return {
      heirs: heirs, gross: brok + roth + trad, traditional: trad, brokerage: brok, roth: roth,
      heirTax: trad * a.heirTaxRate, lifetimeTax: lifetimeTax, totalRmd: totalRmd, totalConverted: totalConverted, rows: rows
    };
  }

  function millions(x) { return '$' + (Math.round(x / 100000) / 10).toFixed(1) + ' million'; }
  function dollars(x) { return '$' + (Math.round(x / 10000) * 10000).toLocaleString('en-US'); }
  function shortM(x) { return '$' + (Math.round(x / 100000) / 10).toFixed(1) + 'M'; }

  function story(overrides) {
    var bill = simulate(true, overrides), tom = simulate(false, overrides);
    var a = Object.assign({}, ASSUMPTIONS, overrides || {});
    return {
      assumptions: a, bill: bill, tom: tom,
      text: {
        start: millions(a.traditional + a.brokerage + a.roth),
        startShort: shortM(a.traditional + a.brokerage + a.roth),
        billHeirs: millions(bill.heirs), tomHeirs: millions(tom.heirs),
        billShort: shortM(bill.heirs), tomShort: shortM(tom.heirs),
        gap: dollars(bill.heirs - tom.heirs),
        billTax: dollars(bill.lifetimeTax), tomTax: dollars(tom.lifetimeTax),
        tomHeirTax: dollars(tom.heirTax), billHeirTax: dollars(bill.heirTax),
        billConverted: millions(bill.totalConverted), tomRmd: millions(tom.totalRmd)
      }
    };
  }

  // Fill any element with data-bt="<key>" from story().text.
  function render(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    var t = story().text;
    Array.prototype.forEach.call(doc.querySelectorAll('[data-bt]'), function (el) {
      var k = el.getAttribute('data-bt');
      if (t[k]) el.textContent = t[k];
    });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { render(); });
    else render();
  }

  return { ASSUMPTIONS: ASSUMPTIONS, simulate: simulate, story: story, render: render, ordinaryTax: ordinaryTax };
});
