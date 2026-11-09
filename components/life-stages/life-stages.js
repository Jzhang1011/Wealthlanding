/* Plan by age (45-65): age picker on the hub and checklist ticks saved in this browser. Pages work without it. */
(function () {
  var KEY = 'wl-ls-checks';
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }

  var state = load();
  var boxes = document.querySelectorAll('input[data-ls-check]');
  for (var i = 0; i < boxes.length; i++) {
    var b = boxes[i];
    if (state[b.getAttribute('data-ls-check')]) b.checked = true;
    b.addEventListener('change', function (e) {
      var k = e.target.getAttribute('data-ls-check');
      if (e.target.checked) state[k] = 1; else delete state[k];
      save(state);
    });
  }

  var cur = document.querySelector('.wl-ls-timeline a[aria-current]');
  if (cur) { var strip = cur.closest('.wl-ls-timeline'); if (strip && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = cur.parentNode.offsetLeft - 16; }

  var form = document.querySelector('form[data-ls-picker]');
  if (!form) return;
  var ranges = [];
  try { ranges = JSON.parse(form.getAttribute('data-ls-picker')); } catch (e) { return; }
  var input = form.querySelector('input');
  var msg = form.querySelector('.wl-ls-pick-msg');
  function stageFor(age) {
    for (var j = 0; j < ranges.length; j++) if (age >= ranges[j].min && age <= ranges[j].max) return ranges[j];
    return null;
  }
  function say(html) { msg.innerHTML = html; }
  function handle(age, go) {
    if (!isFinite(age)) { say('Enter your age as a number.'); return; }
    var s = stageFor(age);
    if (s) {
      if (go) { window.location.href = s.url; return; }
      var el = document.getElementById('stage-' + s.url.split('/')[2]);
      if (el) el.classList.add('is-picked');
      return;
    }
    if (age < ranges[0].min) {
      say('These pages start at 45. A head start helps: <a href="' + ranges[0].url + '">see what ages ' + ranges[0].ages + ' bring</a>.');
    } else {
      say('Past 65? Jump to <a href="#wl-ls-after-title">what comes after 65</a>.');
    }
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    handle(parseInt(input.value, 10), true);
  });
  var q = /[?&]age=(\d+)/.exec(window.location.search);
  if (q) { input.value = q[1]; handle(parseInt(q[1], 10), true); }
})();
