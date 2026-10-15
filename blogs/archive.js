/* Shared blog archive: renders a post list from a JSON file and wires the topic filter,
   year filter and search box. Used by /blogs/happy_retirement.html and /blogs/travel.html.
   Markup contract: an element with data-archive-src="/path/archive.json" and
   data-archive-prefix="hr" (ids <prefix>-archive-list, -filter-topic, -filter-year, -search,
   -archive-status, -archive-empty, -archive-reset). Pages ship a static copy of the list for no-JS. */
(function () {
  var TAG = {
    'Tax Strategy': 'bg-emerald-50 text-emerald-800 border-emerald-200',
    'Healthcare': 'bg-amber-50 text-amber-800 border-amber-200',
    'Lifestyle': 'bg-sky-50 text-sky-800 border-sky-200',
    'Social Security': 'bg-indigo-50 text-indigo-800 border-indigo-200',
    'Savings': 'bg-teal-50 text-teal-800 border-teal-200',
    'Income Planning': 'bg-violet-50 text-violet-800 border-violet-200',
    'Airline Status': 'bg-sky-50 text-sky-800 border-sky-200',
    'United': 'bg-blue-50 text-blue-800 border-blue-200',
    'Family Travel': 'bg-rose-50 text-rose-800 border-rose-200',
    'Case Study': 'bg-blue-50 text-blue-800 border-blue-200'
  };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function topicsOf(p) { return p.topics || (p.topic ? [p.topic] : []); }
  function tagsOf(p) { return p.tags || (p.tag ? [p.tag] : []); }
  function item(p) {
    var media = p.image
      ? '<img src="' + esc(p.image) + '" alt="' + esc(p.imageAlt || '') + '" loading="lazy" class="w-full h-full object-cover aspect-video sm:aspect-[4/3]">'
      : '<div class="w-full h-full aspect-video sm:aspect-[4/3] bg-slate-900 text-emerald-300 flex items-center justify-center text-xs font-bold uppercase tracking-widest">' + esc(p.tileLabel || 'Case study') + '</div>';
    return '<article class="archive-item group flex flex-col sm:flex-row gap-6 py-8 border-b border-slate-200 first:pt-0" data-topic="' + esc(topicsOf(p).join(' ')) + '" data-year="' + esc(p.year || '') + '">' +
      '<a href="' + esc(p.url) + '" class="block w-full sm:w-1/3 lg:w-1/4 shrink-0 overflow-hidden bg-slate-100 rounded-sm" tabindex="-1" aria-hidden="true">' + media + '</a>' +
      '<div class="flex flex-col justify-center">' +
      (p.series ? '<div class="text-[11px] font-bold text-emerald-700 uppercase tracking-wide mb-1">' + esc(p.series) + '</div>' : '') +
      (p.date ? '<div class="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">' + esc(p.date) + '</div>' : '') +
      '<a href="' + esc(p.url) + '"><h2 class="text-xl sm:text-2xl font-bold text-slate-900 leading-tight mb-3 group-hover:text-emerald-700">' + esc(p.title) + '</h2></a>' +
      '<p class="text-slate-600 text-sm sm:text-base leading-relaxed line-clamp-3">' + esc(p.desc) + '</p>' +
      '<div class="mt-4 flex flex-wrap items-center gap-2">' + tagsOf(p).map(function (t) { return '<span class="text-xs font-semibold px-2.5 py-1 rounded-full border ' + (TAG[t] || TAG['Case Study']) + '">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '</div></article>';
  }
  function init(data, P) {
    var list = document.getElementById(P + '-archive-list');
    var topicSel = document.getElementById(P + '-filter-topic');
    var yearSel = document.getElementById(P + '-filter-year');
    var search = document.getElementById(P + '-search');
    var status = document.getElementById(P + '-archive-status');
    var empty = document.getElementById(P + '-archive-empty');
    var reset = document.getElementById(P + '-archive-reset');
    if (!list || !topicSel || !yearSel || !search) return;
    var posts = data.posts || [];

    // Build the year options from the data so they only list years that have posts.
    var years = posts.map(function (p) { return p.year; }).filter(function (y, i, a) { return y && a.indexOf(y) === i; }).sort().reverse();
    var topics = ((data.meta && data.meta.topics) || []).filter(function (t) { return posts.some(function (p) { return topicsOf(p).indexOf(t.id) !== -1; }); });
    topicSel.innerHTML = '<option value="">All Topics</option>' + topics.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.label) + '</option>'; }).join('');
    yearSel.innerHTML = '<option value="">All Years</option>' + years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');

    // Restore state from the URL (?topic=&year=&q=) so filtered views can be linked.
    // Do this after rebuilding the options so the selected values stick.
    var qs = new URLSearchParams(location.search);
    if (qs.get('topic')) topicSel.value = qs.get('topic');
    if (qs.get('year')) yearSel.value = qs.get('year');
    if (qs.get('q')) search.value = qs.get('q');

    function apply() {
      var t = topicSel.value, y = yearSel.value, q = search.value.trim().toLowerCase();
      var shown = posts.filter(function (p) {
        if (t && topicsOf(p).indexOf(t) === -1) return false;
        if (y && String(p.year) !== y) return false;
        if (q && (p.title + ' ' + p.desc + ' ' + tagsOf(p).join(' ') + ' ' + (p.series || '') + ' ' + (p.id || '') + ' ' + (p.url || '')).toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
      list.innerHTML = shown.map(item).join('');
      if (empty) empty.hidden = shown.length > 0;
      var noun = posts.length === 1 ? ' article' : ' articles';
      if (status) status.textContent = shown.length === posts.length ? 'Showing all ' + posts.length + noun : 'Showing ' + shown.length + ' of ' + posts.length + noun;
      var p = new URLSearchParams();
      if (t) p.set('topic', t); if (y) p.set('year', y); if (q) p.set('q', search.value.trim());
      var url = location.pathname + (p.toString() ? '?' + p.toString() : '') + location.hash;
      history.replaceState(null, '', url);
    }
    topicSel.addEventListener('change', apply);
    yearSel.addEventListener('change', apply);
    search.addEventListener('input', apply);
    var form = search.closest('form');
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); apply(); });
    if (reset) reset.addEventListener('click', function () { topicSel.value = ''; yearSel.value = ''; search.value = ''; apply(); search.focus(); });
    apply();
  }
  function start() {
    var roots = document.querySelectorAll('[data-archive-src]');
    Array.prototype.forEach.call(roots, function (root) {
      var src = root.getAttribute('data-archive-src'), P = root.getAttribute('data-archive-prefix') || 'hr';
      fetch(src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) { init(data, P); })
        .catch(function (e) { if (window.console) console.warn('Archive: keeping the static list (' + e + ')'); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
