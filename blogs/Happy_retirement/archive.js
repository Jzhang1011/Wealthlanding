/* Happy Retirement archive: renders the post list from /blogs/Happy_retirement/archive.json
   and wires the topic filter, year filter and search box on /blogs/happy_retirement.html.
   The page ships a static copy of the same list, so it still works without JavaScript. */
(function () {
  var DATA_URL = '/blogs/Happy_retirement/archive.json';
  var TAG = {
    'Tax Strategy': 'bg-emerald-50 text-emerald-800 border-emerald-200',
    'Healthcare': 'bg-amber-50 text-amber-800 border-amber-200',
    'Lifestyle': 'bg-sky-50 text-sky-800 border-sky-200',
    'Case Study': 'bg-blue-50 text-blue-800 border-blue-200'
  };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function item(p) {
    var media = p.image
      ? '<img src="' + esc(p.image) + '" alt="' + esc(p.imageAlt || '') + '" loading="lazy" class="w-full h-full object-cover aspect-video sm:aspect-[4/3]">'
      : '<div class="w-full h-full aspect-video sm:aspect-[4/3] bg-slate-900 text-emerald-300 flex items-center justify-center text-xs font-bold uppercase tracking-widest">Case study</div>';
    return '<article class="archive-item group flex flex-col sm:flex-row gap-6 py-8 border-b border-slate-200 first:pt-0" data-topic="' + esc(p.topic) + '" data-year="' + esc(p.year || '') + '">' +
      '<a href="' + esc(p.url) + '" class="block w-full sm:w-1/3 lg:w-1/4 shrink-0 overflow-hidden bg-slate-100 rounded-sm" tabindex="-1" aria-hidden="true">' + media + '</a>' +
      '<div class="flex flex-col justify-center">' +
      (p.date ? '<div class="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">' + esc(p.date) + '</div>' : '') +
      '<a href="' + esc(p.url) + '"><h2 class="text-xl sm:text-2xl font-bold text-slate-900 leading-tight mb-3 group-hover:text-emerald-700">' + esc(p.title) + '</h2></a>' +
      '<p class="text-slate-600 text-sm sm:text-base leading-relaxed line-clamp-3">' + esc(p.desc) + '</p>' +
      '<div class="mt-4 flex items-center gap-2"><span class="text-xs font-semibold px-2.5 py-1 rounded-full border ' + (TAG[p.tag] || TAG['Case Study']) + '">' + esc(p.tag) + '</span></div>' +
      '</div></article>';
  }
  function init(data) {
    var list = document.getElementById('hr-archive-list');
    var topicSel = document.getElementById('hr-filter-topic');
    var yearSel = document.getElementById('hr-filter-year');
    var search = document.getElementById('hr-search');
    var status = document.getElementById('hr-archive-status');
    var empty = document.getElementById('hr-archive-empty');
    var reset = document.getElementById('hr-archive-reset');
    if (!list || !topicSel || !yearSel || !search) return;
    var posts = data.posts || [];

    // Build the year options from the data so they only list years that have posts.
    var years = posts.map(function (p) { return p.year; }).filter(function (y, i, a) { return y && a.indexOf(y) === i; }).sort().reverse();
    var topics = ((data.meta && data.meta.topics) || []).filter(function (t) { return posts.some(function (p) { return p.topic === t.id; }); });
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
        if (t && p.topic !== t) return false;
        if (y && String(p.year) !== y) return false;
        if (q && (p.title + ' ' + p.desc + ' ' + p.tag + ' ' + (p.id || '') + ' ' + (p.url || '')).toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
      list.innerHTML = shown.map(item).join('');
      if (empty) empty.hidden = shown.length > 0;
      if (status) status.textContent = shown.length === posts.length ? 'Showing all ' + posts.length + ' articles' : 'Showing ' + shown.length + ' of ' + posts.length + ' articles';
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
    fetch(DATA_URL).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(init).catch(function () {
      var s = document.getElementById('hr-archive-status'); if (s) s.textContent = '';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
