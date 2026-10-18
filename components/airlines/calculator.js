/**
 * WealthLanding airline status-value calculator.
 *
 * Data: /components/airlines/airlines.json (programs[].calculator + tiers[].calc).
 * The page holds the form; this file holds the math. `compute` is pure so it
 * can be tested outside the browser: compute(program, tier, inputs).
 *
 * Model (all values annual, USD):
 *   The card you hold is the baseline: it already gives you free bags and
 *   lounge visits with fewer restrictions than status. Status is only
 *   credited with what it ADDS on top of the card (union of the two
 *   coverages, minus the card-only coverage), computed per traveller so
 *   overlapping companion rules come out right.
 *   bags    = (union bag-units - card-only bag-units) x round-trip bag fee
 *             (union: per traveller, max(status allowance, card allowance))
 *   seats   = trips x (you + seat companions) x E+/MCE value per round trip
 *             (cards give no extra-legroom selection, so this is all status)
 *   lounge  = (union lounge visits - card-only lounge visits) x day-pass price
 *             (status lounge access only counts on international itineraries)
 *   upgrades= PlusPoints x $/point (United) or SWUs x $/SWU (American)
 *   bonus   = optional: trips x miles per round trip x bonus % x $/mile
 *   value   = incremental bags + seats + incremental lounge + upgrades + bonus
 *   cost    = card spend x (top cash-back % - miles value %)
 *             (+ card annual fees ONLY if you would not hold the card anyway)
 *   net     = value - cost
 */
(function () {
  'use strict';

  function num(v, fallback) {
    var n = parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  function money(n) {
    var sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
  }

  function thou(n) {
    return Math.round(n).toLocaleString('en-US');
  }

  /* Exact card spend to earn a tier on card spend alone — mirrors the ladder
     in airlines.js: yearly bonus and milestones included, card caps make a
     tier unreachable (null). Assumes status earned entirely by card spend. */
  function cardSpendNeeded(card, threshold) {
    var pd = card.perDollar;
    if (card.milestones && card.milestones.length) {
      var ms = card.milestones.slice().sort(function (a, b) { return a.at - b.at; });
      var total = function (s) {
        var t = s * pd, b = 0;
        for (var i = 0; i < ms.length; i++) { if (t + b >= ms[i].at) b += ms[i].bonus; }
        return t + b;
      };
      var lo = 0, hi = 5000000;
      if (total(hi) < threshold) return null;
      while (hi - lo > 1) {
        var mid = Math.floor((lo + hi) / 2);
        if (total(mid) >= threshold) hi = mid; else lo = mid;
      }
      return Math.ceil(hi / 100) * 100;
    }
    var needSpendUnits = threshold - (card.bonus || 0);
    if (needSpendUnits <= 0) return 0;
    if (card.cap && needSpendUnits > card.cap) return null;
    return Math.ceil(needSpendUnits / pd / 100) * 100;
  }

  function compute(prog, tier, card, inp) {
    var c = tier.calc;
    var seatName = prog.id === 'dl' ? 'Comfort+' : (tier.seatLabel || 'Economy Plus');
    var shortName = tier.name.replace(/^(Premier|AAdvantage) /, '');
    var trips = Math.max(0, num(inp.trips, 0));
    var intl = clamp(num(inp.intlTrips, 0), 0, trips);
    var dom = trips - intl;
    var companions = clamp(num(inp.companions, 0), 0, 9);
    var bags = Math.max(0, num(inp.bags, 0));
    var bagFee = num(inp.bagFee, 0);

    /* ---- bags: union of status + card coverage, minus card-only ----
       Per traveller (holder + each companion slot), the union allowance is
       the max of the two allowances; the card-only allowance is the card's.
       This handles overlaps honestly, e.g. an AA card covers companions'
       first bag domestically while status covers only the holder's. */
    var cardBags = card.cardBags || 0;
    var cardBagComp = card.cardBagCompanions || 0;
    var cardBagsIntl = !!card.cardBagsIntl;
    var unionBagUnits = 0, cardBagUnits = 0;
    var bagCapUnion = Math.max(c.bagCompanions || 0, cardBagComp);
    for (var slot = 0; slot <= companions; slot++) {
      var stDom = (slot === 0 || slot <= (c.bagCompanions || 0)) ? c.bagsDomestic : 0;
      var stIntl = (slot === 0 || slot <= (c.bagCompanions || 0)) ? c.bagsIntl : 0;
      var cdDom = (slot === 0 || slot <= cardBagComp) ? cardBags : 0;
      var cdIntl = ((slot === 0 || slot <= cardBagComp) && cardBagsIntl) ? cardBags : 0;
      unionBagUnits += dom * Math.min(bags, Math.max(stDom, cdDom)) +
        intl * Math.min(bags, Math.max(stIntl, cdIntl));
      cardBagUnits += dom * Math.min(bags, cdDom) + intl * Math.min(bags, cdIntl);
    }
    var cardBagValue = cardBagUnits * bagFee;
    var bagValue = Math.max(0, (unionBagUnits - cardBagUnits)) * bagFee;
    var bagCapNote = companions > bagCapUnion ?
      ' — bags cover you + ' + bagCapUnion + ' between status and card' : '';

    var seatPax = 1 + Math.min(companions, c.seatCompanions || 0);
    var seatValue = trips * seatPax * num(inp.seatValue, 0);
    var seatCapNote = companions > (c.seatCompanions || 0) ?
      ' — ' + seatName + ' covers you + ' + (c.seatCompanions || 0) + ' at ' + shortName : '';

    /* ---- lounge: same union-minus-card logic, per traveller ----
       Card lounge: membership (unlimited visits), N visits, or N passes. */
    var cardLoungeKind = card.cardLoungeKind || 'none';
    var cardLoungeCap = card.cardLoungeVisits; // null = unlimited
    var cardLoungeGuests = card.cardLoungeGuests || 0;
    var unionLoungeVisits = 0, cardLoungeVisits = 0;
    var loungeCapUnion = Math.max(c.lounge ? (c.loungeGuests || 0) : 0, cardLoungeGuests);
    for (slot = 0; slot <= companions; slot++) {
      var stVis = (c.lounge && (slot === 0 || slot <= (c.loungeGuests || 0))) ? intl : 0;
      var cdVis = 0;
      if (cardLoungeKind !== 'none' && (slot === 0 || slot <= cardLoungeGuests)) {
        cdVis = cardLoungeCap == null ? intl : Math.min(intl, cardLoungeCap);
      }
      unionLoungeVisits += Math.max(stVis, cdVis);
      cardLoungeVisits += cdVis;
    }
    var cardLoungeValue = cardLoungeVisits * num(inp.loungeValue, 0);
    var loungeValue = Math.max(0, (unionLoungeVisits - cardLoungeVisits)) * num(inp.loungeValue, 0);
    var loungeCapNote = (c.lounge && companions > loungeCapUnion) ?
      ' — lounge covers you + ' + loungeCapUnion + ' guest' : '';

    var upgradeValue = 0;
    var upgradeDetail = '';
    if (prog.id === 'ua') {
      var pp = Math.max(0, num(inp.plusPoints, 0));
      upgradeValue = pp * num(inp.plusPointValue, 0);
      upgradeDetail = pp + ' PlusPoints × ' + money(num(inp.plusPointValue, 0));
    } else if (prog.id === 'dl') {
      var ruc = Math.max(0, num(inp.rucCount, 0));
      var guc = Math.max(0, num(inp.gucCount, 0));
      upgradeValue = ruc * num(inp.rucValue, 0) + guc * num(inp.gucValue, 0);
      upgradeDetail = ruc + ' Regional × ' + money(num(inp.rucValue, 0)) + ' + ' +
        guc + ' Global × ' + money(num(inp.gucValue, 0));
    } else {
      var swu = Math.max(0, num(inp.swuCount, 0));
      upgradeValue = swu * num(inp.swuValue, 0);
      upgradeDetail = swu + ' systemwide upgrades × ' + money(num(inp.swuValue, 0));
    }

    var bonusValue = 0;
    var bonusDetail = '';
    if (inp.bonusMilesOn) {
      bonusValue = trips * Math.max(0, num(inp.milesPerTrip, 0)) *
        (c.bonusPct / 100) * (num(inp.mileValueCents, 0) / 100);
      bonusDetail = trips + ' trips × ' + num(inp.milesPerTrip, 0).toLocaleString('en-US') +
        ' mi × ' + c.bonusPct + '% × ' + num(inp.mileValueCents, 0) + '¢';
    }

    var value = bagValue + seatValue + loungeValue + upgradeValue + bonusValue + Math.max(0, num(inp.giftValue, 0));
    var cardCovers = cardBagValue + cardLoungeValue;

    var cardSpend = cardSpendNeeded(card, tier.threshold);
    var spread = (num(inp.cashbackTop, 0) - num(inp.milesRate, 0)) / 100;
    var missed = cardSpend == null ? null : cardSpend * spread;
    var feesInput = Math.max(0, num(inp.cardFees, 0));
    var fees = inp.feeSunk ? 0 : feesInput;
    var cost = missed == null ? null : missed + fees;
    var net = cost == null ? null : value - cost;

    return {
      lines: [
        { label: '🧳 Free checked bags — what status adds', detail: unionBagUnits.toFixed(1) + ' bag-units with status − ' + cardBagUnits.toFixed(1) + ' already covered by your card' + bagCapNote, value: bagValue },
        { label: '💺 ' + seatName, detail: trips + ' trips × ' + seatPax + ' traveler' + (seatPax === 1 ? '' : 's') + ' × ' + money(num(inp.seatValue, 0)) + seatCapNote, value: seatValue },
        { label: '🥂 Lounge visits — what status adds', detail: c.lounge ? (unionLoungeVisits + ' visits with status − ' + cardLoungeVisits + ' already covered by your card' + loungeCapNote) : 'No lounge access from ' + tier.name + ' status alone' + (cardLoungeVisits ? ' — your card covers ' + cardLoungeVisits + ' visit' + (cardLoungeVisits === 1 ? '' : 's') : ''), value: loungeValue },
        { label: '✈️ Upgrades', detail: upgradeDetail, value: upgradeValue },
        { label: '⭐ Bonus miles', detail: inp.bonusMilesOn ? bonusDetail : 'Not counted (tick the box to include)', value: bonusValue },
        { label: '🎁 Status gifted to others', detail: 'Your estimate for the gifted status’ value to the recipient', value: Math.max(0, num(inp.giftValue, 0)) }
      ],
      value: value,
      cardCovers: cardCovers,
      cardBagValue: cardBagValue,
      cardLoungeValue: cardLoungeValue,
      cardBagUnits: cardBagUnits,
      cardLoungeVisits: cardLoungeVisits,
      cardSpend: cardSpend,
      missed: missed,
      fees: fees,
      feesInput: feesInput,
      feeSunk: !!inp.feeSunk,
      cost: cost,
      net: net,
      perTrip: trips ? value / trips : 0,
      perTripNet: trips && net != null ? net / trips : null,
      perK: cardSpend ? value / (cardSpend / 1000) : null,
      trips: trips
    };
  }

  /* ---------- page wiring ---------- */

  var state = { progId: 'ua', tierIdx: 1, cardIdx: 1 };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function field(labelText, input, hint) {
    var w = el('label', 'wla-calc-field');
    w.appendChild(el('span', 'wla-calc-label', labelText));
    w.appendChild(input);
    if (hint) w.appendChild(el('span', 'wla-calc-hint', hint));
    return w;
  }

  function numInput(id, value, step, min) {
    var i = el('input', 'wla-calc-input');
    i.type = 'number'; i.id = id; i.value = value;
    if (step) i.step = step;
    if (min != null) i.min = min;
    return i;
  }

  function init(root, data) {
    var progs = data.programs;

    var form = el('div', 'wla-calc-form');
    var results = el('div', 'wla-calc-results');
    root.appendChild(form);
    root.appendChild(results);

    var airlineSel = el('select', 'wla-calc-input');
    var tierSel = el('select', 'wla-calc-input');
    var cardSel = el('select', 'wla-calc-input');
    var tripsI = numInput('calc-trips', 12, 1, 0);
    var compI = numInput('calc-comp', 1, 1, 0);
    var intlI = numInput('calc-intl', 2, 1, 0);
    var bagsI = numInput('calc-bags', 1, 0.5, 0);
    var bagFeeI = numInput('calc-bagfee', 90, 1, 0);
    var seatI = numInput('calc-seat', 100, 1, 0);
    var loungeI = numInput('calc-lounge', 59, 1, 0);
    var ppCountI = numInput('calc-ppcount', 0, 1, 0);
    var ppValI = numInput('calc-ppval', 16, 1, 0);
    var swuCountI = numInput('calc-swu', 0, 1, 0);
    var swuValI = numInput('calc-swuval', 500, 1, 0);
    var rucCountI = numInput('calc-ruc', 0, 1, 0);
    var rucValI = numInput('calc-rucval', 300, 1, 0);
    var gucCountI = numInput('calc-guc', 0, 1, 0);
    var gucValI = numInput('calc-gucval', 800, 1, 0);
    var bonusChk = el('input', 'wla-calc-check');
    bonusChk.type = 'checkbox'; bonusChk.id = 'calc-bonus';
    var milesI = numInput('calc-miles', 2000, 100, 0);
    var mileValI = numInput('calc-mileval', 1, 0.1, 0);
    var spendDisplay = el('div', 'wla-calc-spendvalue');
    var spendHint = el('p', 'wla-calc-hint');
    var giftI = numInput('calc-gift', 0, 50, 0);
    var cbI = numInput('calc-cb', 2, 0.1, 0);
    var milesRateI = numInput('calc-milesrate', 1, 0.1, 0);
    var feesI = numInput('calc-fees', 350, 1, 0);
    var feeSunkChk = el('input', 'wla-calc-check');
    feeSunkChk.type = 'checkbox'; feeSunkChk.id = 'calc-feesunk'; feeSunkChk.checked = true;
    var cardCoversBox = el('div', 'wla-calc-cardcovers');

    function prog() { return progs[state.progId]; }
    function tier() { return prog().tiers[state.tierIdx]; }

    function rebuildSelects() {
      var p = prog();
      airlineSel.textContent = '';
      [['ua', 'United MileagePlus'], ['aa', 'American AAdvantage'], ['dl', 'Delta SkyMiles']].forEach(function (o) {
        var opt = el('option', null, o[1]); opt.value = o[0];
        if (o[0] === state.progId) opt.selected = true;
        airlineSel.appendChild(opt);
      });

      tierSel.textContent = '';
      p.tiers.forEach(function (t, i) {
        var opt = el('option', null, t.name.replace(/^(Premier|AAdvantage) /, ''));
        opt.value = i;
        if (i === state.tierIdx) opt.selected = true;
        tierSel.appendChild(opt);
      });

      cardSel.textContent = '';
      p.cards.forEach(function (c, i) {
        var opt = el('option', null, c.name + (c.fee != null ? ' ($' + c.fee + '/yr)' : ''));
        opt.value = i;
        if (i === state.cardIdx) opt.selected = true;
        cardSel.appendChild(opt);
      });
    }

    function syncDefaults() {
      var p = prog(), calc = p.calculator, t = tier();
      bagFeeI.value = calc.bagFeeRoundTrip;
      seatI.value = calc.seatValueRoundTrip;
      loungeI.value = calc.loungeDayPass;
      cbI.value = calc.cashbackTop;
      milesRateI.value = calc.milesValue;
      if (p.id === 'ua') {
        ppCountI.value = t.calc.plusPoints;
        ppValI.value = calc.plusPointValue;
      } else if (p.id === 'dl') {
        rucValI.value = calc.rucValue;
        gucValI.value = calc.gucValue;
      } else {
        swuValI.value = calc.swuValue;
      }
      var card = p.cards[state.cardIdx];
      if (card && card.fee != null) feesI.value = card.fee;
    }

    function gather() {
      return {
        trips: tripsI.value, companions: compI.value, intlTrips: intlI.value,
        bags: bagsI.value, bagFee: bagFeeI.value, seatValue: seatI.value,
        loungeValue: loungeI.value, plusPoints: ppCountI.value,
        plusPointValue: ppValI.value, swuCount: swuCountI.value,
        swuValue: swuValI.value, rucCount: rucCountI.value,
        rucValue: rucValI.value, gucCount: gucCountI.value,
        gucValue: gucValI.value, bonusMilesOn: bonusChk.checked,
        milesPerTrip: milesI.value, mileValueCents: mileValI.value,
        cashbackTop: cbI.value,
        milesRate: milesRateI.value, cardFees: feesI.value,
        feeSunk: feeSunkChk.checked,
        giftValue: giftI.value
      };
    }

    function render() {
      var card = prog().cards[state.cardIdx];
      var tierShort = tier().name.replace(/^(Premier|AAdvantage) /, '');
      var r = compute(prog(), tier(), card, gather());
      results.textContent = '';

      // Spend display: exact card spend to earn this tier on this card alone.
      if (r.cardSpend == null) {
        spendDisplay.textContent = 'Not reachable on this card alone';
        spendHint.textContent = thou(tier().threshold) + ' ' + card.unit + ' needed, but this card caps at ' +
          (card.capLabel || 'its spend cap') + '. Pick a card that can reach it, or earn part of it by flying.';
      } else {
        spendDisplay.textContent = money(r.cardSpend);
        var bonusWord = prog().id === 'dl' ? 'headstart' : 'yearly bonus';
        if (card.milestones && card.milestones.length) {
          spendHint.textContent = thou(tier().threshold) + ' ' + card.unit + ' via spend + milestone bonuses = ' +
            money(r.cardSpend) + '. Status earned entirely by card spend.';
        } else if (card.bonus) {
          spendHint.textContent = thou(tier().threshold) + ' ' + card.unit + ' − ' + thou(card.bonus) + ' ' + bonusWord +
            ' = ' + thou(tier().threshold - card.bonus) + ' ' + card.unit + ' ÷ (' + card.perDollarLabel + ') = ' +
            money(r.cardSpend) + '. Status earned entirely by card spend.';
        } else {
          spendHint.textContent = thou(tier().threshold) + ' ' + card.unit + ' ÷ (' + card.perDollarLabel + ') = ' +
            money(r.cardSpend) + '. Status earned entirely by card spend.';
        }
      }

      var stats = el('div', 'wla-calc-stats');
      var mkStat = function (label, val, cls) {
        var d = el('div', 'wla-calc-stat ' + (cls || ''));
        d.appendChild(el('div', 'wla-calc-stat-label', label));
        d.appendChild(el('div', 'wla-calc-stat-value', val));
        return d;
      };
      stats.appendChild(mkStat('What status adds / year', money(r.value)));
      stats.appendChild(mkStat('Extra cost / year', r.cost == null ? '—' : money(r.cost)));
      if (r.net == null) {
        stats.appendChild(mkStat('Can this card get you there?', 'No — cap', 'wla-calc-bad'));
      } else {
        stats.appendChild(mkStat(r.net >= 0 ? 'Status pays for itself by' : 'Status costs you', money(Math.abs(r.net)), r.net >= 0 ? 'wla-calc-good' : 'wla-calc-bad'));
      }
      results.appendChild(stats);

      // Card-covers box: what the card already gives you (the baseline).
      var cardCoversText = (function () {
        var bits = [];
        var bagTxt = (card.cardBags || 0) + ' free checked bag' + ((card.cardBags || 0) === 1 ? '' : 's') +
          ' for you + ' + (card.cardBagCompanions || 0) + ' companion' + ((card.cardBagCompanions || 0) === 1 ? '' : 's') +
          (card.cardBagsIntl ? '' : ' (domestic itineraries only)');
        bits.push('🧳 ' + bagTxt);
        var ln = prog().calculator.loungeName || 'lounge';
        if (card.cardLoungeKind === 'membership') {
          bits.push('🥂 ' + ln + ' membership for you' +
            ((card.cardLoungeGuests || 0) ? ' + ' + card.cardLoungeGuests + ' guest' + (card.cardLoungeGuests === 1 ? '' : 's') : ''));
        } else if (card.cardLoungeKind === 'visits') {
          bits.push('🥂 ' + card.cardLoungeVisits + ' ' + ln + ' visits a year for you (Reserve guest passes not counted)');
        } else if (card.cardLoungeKind === 'passes') {
          bits.push('🥂 ' + card.cardLoungeVisits + ' ' + ln + ' passes a year for you');
        }
        bits.push('💺 Priority boarding (not valued here). No complimentary upgrades or extra-legroom selection — those only come from status.');
        return bits;
      })();
      cardCoversBox.textContent = '';
      cardCoversBox.appendChild(el('p', null, 'Your ' + card.name + ' already gives you:'));
      var cul = el('ul');
      cardCoversText.forEach(function (t) { cul.appendChild(el('li', null, t)); });
      cardCoversBox.appendChild(cul);
      cardCoversBox.appendChild(el('p', 'wla-calc-hint',
        'At these inputs that baseline is worth ' + money(r.cardCovers) +
        ' (' + money(r.cardBagValue) + ' bags + ' + money(r.cardLoungeValue) + ' lounge). ' +
        'Status is only credited with what it adds on top of this.'));

      var table = el('table', 'wla-table wla-calc-breakdown');
      var tb = el('tbody');
      r.lines.forEach(function (ln) {
        var tr = el('tr');
        var td1 = el('td'); td1.appendChild(el('strong', null, ln.label));
        td1.appendChild(el('span', 'wla-calc-detail', ln.detail));
        tr.appendChild(td1);
        tr.appendChild(el('td', 'wla-calc-amount', money(ln.value)));
        tb.appendChild(tr);
      });
      var coverTr = el('tr', 'wla-calc-inforow');
      var covTd = el('td'); covTd.appendChild(el('strong', null, '💳 Your card already covers'));
      covTd.appendChild(el('span', 'wla-calc-detail',
        money(r.cardBagValue) + ' bags + ' + money(r.cardLoungeValue) +
        ' lounge from your ' + card.name + ' — not counted as status value.'));
      coverTr.appendChild(covTd);
      coverTr.appendChild(el('td', 'wla-calc-amount', money(r.cardCovers)));
      tb.appendChild(coverTr);
      var costTr = el('tr', 'wla-calc-costrow');
      var ctd = el('td'); ctd.appendChild(el('strong', null, '💳 Cost of status'));
      if (r.cardSpend == null) {
        ctd.appendChild(el('span', 'wla-calc-detail',
          'This card can’t reach ' + tierShort + ' on spend alone (cap: ' + (card.capLabel || 'applies') + ').'));
        costTr.appendChild(ctd);
        costTr.appendChild(el('td', 'wla-calc-amount', '—'));
      } else {
        ctd.appendChild(el('span', 'wla-calc-detail',
          money(r.cardSpend) + ' on airline cards × ' +
          (num(cbI.value, 0) - num(milesRateI.value, 0)).toFixed(1) +
          '% missed cash back' +
          (r.feeSunk ? ' (card fees ' + money(r.feesInput) + ' not counted — you pay them whether or not you chase status)' :
            ' + ' + money(r.feesInput) + ' card fees')));
        costTr.appendChild(ctd);
        costTr.appendChild(el('td', 'wla-calc-amount', '−' + money(r.cost)));
      }
      tb.appendChild(costTr);
      var netTr = el('tr', 'wla-calc-netrow');
      netTr.appendChild(el('td', null, 'Net value'));
      netTr.appendChild(el('td', 'wla-calc-amount', r.net == null ? '—' : money(r.net)));
      tb.appendChild(netTr);
      table.appendChild(tb);
      results.appendChild(table);

      var norm = el('p', 'wla-calc-norm');
      var parts = ['Status adds per trip: ' + money(r.perTrip)];
      if (r.perTripNet != null) parts.push('Net per trip: ' + money(r.perTripNet));
      if (r.perK != null) parts.push('Status adds per $1,000 of card spend: ' + money(r.perK));
      norm.textContent = parts.join(' · ');
      results.appendChild(norm);

      var verdict = el('p', 'wla-calc-verdict');
      if (r.net == null) {
        var alt = null;
        prog().cards.forEach(function (cc) {
          if (!alt && cc !== card && cardSpendNeeded(cc, tier().threshold) != null) alt = cc;
        });
        verdict.textContent = tierShort + ' isn’t reachable on the ' + card.name +
          ' alone — it caps at ' + (card.capLabel || 'its spend cap') + '. ' +
          (alt ? 'The ' + alt.name + ' can reach it on spend alone.' : 'No card reaches it on spend alone.') +
          ' Or earn part of it by flying.';
      } else if (r.net >= 0) {
        verdict.textContent = 'At these inputs, your ' + card.name + ' already covers about ' +
          money(r.cardCovers) + ' of bags and lounge. ' + tierShort +
          ' status adds about ' + money(r.value) + ' on top of that and costs about ' +
          money(r.cost) + ' — a net gain of ' + money(r.net) + '.';
      } else {
        verdict.textContent = 'At these inputs, your ' + card.name + ' already covers about ' +
          money(r.cardCovers) + ' of bags and lounge. ' + tierShort +
          ' status adds about ' + money(r.value) + ' on top of that but costs about ' +
          money(r.cost) + ' — a net loss of ' + money(Math.abs(r.net)) +
          '. You would come out ahead putting that spend on a ' + num(cbI.value, 0) + '% cash-back card instead.';
      }
      results.appendChild(verdict);
    }

    function section(title, rows, open) {
      var s = el('details', 'wla-calc-section');
      if (open) s.open = true;
      var sum = el('summary', 'wla-calc-section-title', title);
      s.appendChild(sum);
      rows.forEach(function (r) { if (r) s.appendChild(r); });
      return s;
    }

    var upgradeRows = [];
    if (state.progId === 'ua') {
      upgradeRows = [field('PlusPoints earned per year', ppCountI, prog().calculator.plusPointNote),
        field('Value per PlusPoint ($)', ppValI, 'Your call — $16 is the default.')];
    } else if (state.progId === 'dl') {
      upgradeRows = [field('Regional Upgrade Certificates picked (count)', rucCountI, prog().calculator.rucNote),
        field('Value per Regional certificate ($)', rucValI, 'Editable estimate.'),
        field('Global Upgrade Certificates picked (count)', gucCountI, prog().calculator.gucNote),
        field('Value per Global certificate ($)', gucValI, 'Editable estimate.')];
    } else {
      upgradeRows = [field('Systemwide upgrades picked (count)', swuCountI, prog().calculator.swuNote),
        field('Value per systemwide upgrade ($)', swuValI, 'Editable estimate.')];
    }
    var bonusRow = el('label', 'wla-calc-field wla-calc-checkrow');
    bonusRow.appendChild(bonusChk);
    bonusRow.appendChild(el('span', null, 'Count bonus miles (elite mileage bonus on your flights)'));
    var feeSunkRow = el('label', 'wla-calc-field wla-calc-checkrow');
    feeSunkRow.appendChild(feeSunkChk);
    feeSunkRow.appendChild(el('span', null, 'I already hold this card — its annual fee is sunk (don’t count it). Untick if you would only get the card to chase status.'));

    form.appendChild(section('Your desired status', [
      field('Airline', airlineSel),
      field('Status tier', tierSel),
      field('Primary card used for status spend', cardSel)
    ], false));
    form.appendChild(section('Your travel', [
      field('Round trips per year with the status holder', tripsI, 'A round trip is one out-and-back journey.'),
      field('Average companions per trip', compI, 'People on the same itinerary who share the benefits. At ' + tier().name.replace(/^(Premier|AAdvantage) /, '') + ': free bags cover +' + (tier().calc.bagCompanions || 0) + ', ' + (state.progId === 'dl' ? 'Comfort+' : (tier().seatLabel || 'Economy Plus')) + ' covers +' + (tier().calc.seatCompanions || 0) + (tier().calc.lounge ? ', lounge covers +' + (tier().calc.loungeGuests || 0) + ' guest(s).' : ', no lounge access from status.')),
      field('Of those, international round trips', intlI, 'Lounge access from status counts on international itineraries only.'),
      field('Checked bags per passenger per round trip', bagsI, 'Use decimals: 0.5 = you check a bag on about half your round trips. 1 = one bag each way.')
    ], true));
    form.appendChild(section('What each benefit is worth to you', [
      field('Checked-bag fee per round trip ($)', bagFeeI, prog().calculator.bagFeeNote),
      field((state.progId === 'dl' ? 'Comfort+' : (tier().seatLabel || 'Economy Plus')) + ' value per round trip ($)', seatI, prog().calculator.seatValueNote),
      field('Lounge visit value ($)', loungeI, prog().calculator.loungeNote),
      el('h4', 'wla-calc-subhead', 'Upgrades'),
      upgradeRows[0], upgradeRows[1],
      upgradeRows[2], upgradeRows[3],
      bonusRow,
      field('Miles flown per round trip', milesI, 'Only used if bonus miles are counted.'),
      field('Value per mile (¢)', mileValI, 'Only used if bonus miles are counted.')
    ], false));
    function giftInfo() {
      var g = prog().gifting;
      var d = el('div', 'wla-calc-giftinfo');
      d.appendChild(el('p', null, g.mechanism));
      var ul = el('ul');
      g.options.forEach(function (o) {
        ul.appendChild(el('li', null, o.gift + ' — ' + o.cost + (o.choices ? ' (' + o.choices + ')' : '')));
      });
      d.appendChild(ul);
      if (g.cap) d.appendChild(el('p', 'wla-calc-hint', g.cap));
      d.appendChild(el('p', 'wla-calc-hint', g.note));
      return d;
    }

    function cardStatusInfo() {
      var cs = prog().cardStatus;
      var d = el('div', 'wla-calc-giftinfo');
      d.appendChild(el('p', null, cs.headline));
      d.appendChild(el('p', 'wla-calc-hint', cs.detail));
      return d;
    }

    form.appendChild(section('What your card already covers', [
      cardCoversBox
    ], false));
    form.appendChild(section('Status you gift to others (optional)', [
      giftInfo(),
      field('Estimated value of status you gift ($)', giftI, 'What the gifted status is worth to the person receiving it — your call. 0 = don’t count it.')
    ], false));
    var spendRow = el('div', 'wla-calc-field');
    spendRow.appendChild(el('span', 'wla-calc-label', 'Annual spend on airline cards to earn this status'));
    spendRow.appendChild(spendDisplay);
    spendRow.appendChild(spendHint);
    form.appendChild(section('What status costs', [
      spendRow,
      field('Top cash-back card rate (%)', cbI, 'What a top cash-back card would have paid on the same spend.'),
      field('Miles value rate (%)', milesRateI, 'What the airline card’s miles are worth as a % of spend. The gap is the cash back you gave up.'),
      field('Annual card fees ($)', feesI, 'Fees for the cards you hold for status.'),
      feeSunkRow
    ], false));
    form.appendChild(section('Cards and status', [
      cardStatusInfo()
    ], false));

    form.addEventListener('input', render);
    form.addEventListener('change', function (e) {
      if (e.target === airlineSel) {
        state.progId = airlineSel.value;
        state.tierIdx = 1; state.cardIdx = 1;
        root.textContent = ''; init(root, data);
        return;
      }
      if (e.target === tierSel) { state.tierIdx = parseInt(tierSel.value, 10); syncDefaults(); }
      if (e.target === cardSel) { state.cardIdx = parseInt(cardSel.value, 10); syncDefaults(); }
      render();
    });

    rebuildSelects();
    syncDefaults();
    render();
  }

  if (typeof window !== 'undefined') {
    window.__wlCalc = { compute: compute, init: init, cardSpendNeeded: cardSpendNeeded };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { compute: compute };
  }
})();
