/* wl:footer-links:start */
const WL_FOOTER_LINKS = "<nav class=\"wl-footer-links\" aria-label=\"Site sections\"><div class=\"wl-fl-col\"><h4>Sections</h4><ul><li><a href=\"/retirement/\">Retirement</a></li><li><a href=\"/investment/\">Investing</a></li><li><a href=\"/money/\">Money &amp; Lifestyle</a></li><li><a href=\"/real-estate/\">Real Estate</a></li><li><a href=\"/tools/\">Tools</a></li></ul></div><div class=\"wl-fl-col\"><h4>Popular tools</h4><ul><li><a href=\"/tools/health-plan-compare/\">Find your lowest-cost health plan</a></li><li><a href=\"/tools/debt_payoff_calculator.html\">Plan a faster debt payoff</a></li><li><a href=\"/tools/compound_interest_calculator.html\">See how savings could grow</a></li><li><a href=\"/tools/credit-card/\">Maximize spending with the right card</a></li><li><a href=\"/Retirement-simulator/OptimizeRoth.html\">Compare Roth conversion strategies</a></li><li><a href=\"/Retirement-simulator/retirement_scenario_lab.html\">Test your retirement plan</a></li></ul></div><div class=\"wl-fl-col\"><h4>Plan by age: 45–65</h4><ul><li><a href=\"/plan-by-age/45-49/\">Ages 45–49: Peak years, full plate</a></li><li><a href=\"/plan-by-age/50-54/\">Ages 50–54: The catch-up years</a></li><li><a href=\"/plan-by-age/55-59/\">Ages 55–59: Early-exit options</a></li><li><a href=\"/plan-by-age/60-62/\">Ages 60–62: Decision years</a></li><li><a href=\"/plan-by-age/63-65/\">Ages 63–65: Medicare countdown</a></li></ul></div><div class=\"wl-fl-col wl-fl-about\"><h4>WealthLanding</h4><ul><li><a href=\"/about/\">About</a></li><li><a href=\"/contact/\">Contact</a></li><li><a href=\"/methodology/\">Editorial standards</a></li><li><a href=\"/privacy/\">Privacy policy</a></li><li><a href=\"/terms/\">Terms of use</a></li><li><a href=\"/blogs/\">All articles</a></li></ul></div><p class=\"wl-fl-disclaimer\">Educational content only, not personalized investment, tax, legal, or insurance advice.</p></nav>";
/* wl:footer-links:end */

class WealthLandingFooter extends HTMLElement {
  connectedCallback() {
    // Ensure dark navy footer even when a page's Tailwind CDN lacks navy.900 / safelist
    // (common on Retirement-simulator tools that use custom CSS).
    if (!document.getElementById('wl-footer-styles')) {
      const style = document.createElement('style');
      style.id = 'wl-footer-styles';
      style.textContent = `
        wealthlanding-footer footer.wl-site-footer {
          background-color: #0f172a !important;
          color: #cbd5e1;
          padding: 3rem 0;
          border-top: 4px solid #4ade80;
          display: block;
        }
        wealthlanding-footer footer.wl-site-footer .wl-footer-inner {
          max-width: 80rem;
          margin: 0 auto;
          padding: 0 1rem;
        }
        @media (min-width: 640px) {
          wealthlanding-footer footer.wl-site-footer .wl-footer-inner { padding: 0 1.5rem; }
        }
        @media (min-width: 1024px) {
          wealthlanding-footer footer.wl-site-footer .wl-footer-inner { padding: 0 2rem; }
        }
        wealthlanding-footer footer.wl-site-footer .wl-footer-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }
        @media (min-width: 768px) {
          wealthlanding-footer footer.wl-site-footer .wl-footer-grid {
            grid-template-columns: minmax(0, 1.1fr) minmax(0, 3fr);
          }
        }
        wealthlanding-footer footer.wl-site-footer .wl-footer-links {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.5rem;
        }
        @media (min-width: 768px) {
          wealthlanding-footer footer.wl-site-footer .wl-footer-links {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        wealthlanding-footer footer.wl-site-footer .wl-fl-about,
        wealthlanding-footer footer.wl-site-footer .wl-fl-disclaimer {
          display: none;
        }
        wealthlanding-footer footer.wl-site-footer .wl-news {
          margin-top: 1.5rem;
        }
        wealthlanding-footer footer.wl-site-footer .wl-brand-row {
          display: flex;
          align-items: center;
          margin-bottom: 1rem;
        }
        wealthlanding-footer footer.wl-site-footer .wl-brand-icon {
          color: #4ade80;
          font-size: 1.5rem;
          margin-right: 0.5rem;
        }
        wealthlanding-footer footer.wl-site-footer .wl-brand-name {
          font-weight: 700;
          font-size: 1.25rem;
          color: #fff;
          letter-spacing: -0.025em;
        }
        wealthlanding-footer footer.wl-site-footer .wl-muted {
          font-size: 0.875rem;
          color: #94a3b8;
        }
        wealthlanding-footer footer.wl-site-footer h4 {
          color: #fff;
          font-weight: 700;
          margin: 0 0 1rem 0;
        }
        wealthlanding-footer footer.wl-site-footer ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        wealthlanding-footer footer.wl-site-footer li {
          margin: 0 0 0.5rem 0;
          font-size: 0.875rem;
        }
        wealthlanding-footer footer.wl-site-footer a {
          color: #cbd5e1;
          text-decoration: none;
          transition: color 0.15s ease;
        }
        wealthlanding-footer footer.wl-site-footer a:hover {
          color: #4ade80;
        }
        wealthlanding-footer footer.wl-site-footer a.wl-link-accent {
          color: #fcd34d;
          font-weight: 500;
        }
        wealthlanding-footer footer.wl-site-footer .wl-kit-slot {
          margin-top: 0.25rem;
        }
        wealthlanding-footer footer.wl-site-footer .wl-bottom {
          border-top: 1px solid #334155;
          padding-top: 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          font-size: 0.75rem;
          color: #64748b;
        }
        @media (min-width: 768px) {
          wealthlanding-footer footer.wl-site-footer .wl-bottom {
            flex-direction: row;
          }
        }
        wealthlanding-footer footer.wl-site-footer .wl-bottom-links a {
          margin-left: 1rem;
          color: #64748b;
        }
        wealthlanding-footer footer.wl-site-footer .wl-disclaimer {
          margin: 1.25rem 0 0 0;
          font-size: 0.75rem;
          line-height: 1.5;
          color: #94a3b8;
          max-width: 60rem;
        }
        wealthlanding-footer footer.wl-site-footer .wl-bottom-links a:hover {
          color: #fff;
        }
        wealthlanding-footer footer.wl-site-footer .wl-noscript-form {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        wealthlanding-footer footer.wl-site-footer .wl-noscript-form input {
          border-radius: 0.25rem;
          padding: 0.5rem 0.75rem;
          color: #0f172a;
          font-size: 0.875rem;
          border: 1px solid #cbd5e1;
        }
        wealthlanding-footer footer.wl-site-footer .wl-noscript-form button {
          border-radius: 0.25rem;
          background: #16a34a;
          color: #0f172a;
          font-size: 0.875rem;
          font-weight: 600;
          padding: 0.5rem;
          border: 0;
          cursor: pointer;
        }
        wealthlanding-footer footer.wl-site-footer .wl-kit-fields {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        wealthlanding-footer footer.wl-site-footer .wl-kit-input {
          width: 100%;
          border-radius: 0.25rem;
          padding: 0.5rem 0.75rem;
          color: #0f172a;
          font-size: 0.875rem;
          border: 1px solid #cbd5e1;
          box-sizing: border-box;
        }
        wealthlanding-footer footer.wl-site-footer .wl-kit-submit {
          border-radius: 0.25rem;
          background: #16a34a;
          color: #0f172a;
          font-size: 0.875rem;
          font-weight: 600;
          padding: 0.5rem 0.75rem;
          border: 0;
          cursor: pointer;
          width: 100%;
        }
        wealthlanding-footer footer.wl-site-footer .wl-kit-submit:hover {
          background: #4ade80;
        }
        wealthlanding-footer footer.wl-site-footer .formkit-alert:empty {
          display: none;
        }

      `;
      document.head.appendChild(style);
    }

    // Plain-HTML section links are rendered into each page by tools/build_site_blocks.py
    // so they work without JavaScript; reuse them, or fall back to the same generated list.
    const staticLinks = this.querySelector('nav.wl-footer-links');
    const linksHtml = staticLinks ? staticLinks.outerHTML : WL_FOOTER_LINKS;

    this.innerHTML = `
      <footer class="wl-site-footer bg-navy-900 text-slate-300 py-12 border-t-4">
        <div class="wl-footer-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="wl-footer-grid">
            <div class="col-span-1">
              <div class="wl-brand-row flex items-center mb-4">
                <img src="/favicon.svg" alt="" width="32" height="32" style="width:2rem;height:2rem;border-radius:0.5rem;margin-right:0.5rem">
                <span class="wl-brand-name font-bold text-xl text-white tracking-tight">WealthLanding</span>
              </div>
              <p class="wl-muted text-sm text-slate-400">Plain-English financial education for every stage of life, with a focus on the decade before and after retirement.</p>
              <div class="wl-news">
              <h4 class="text-white font-bold mb-4">Join the newsletter</h4>
              <p class="wl-muted text-sm text-slate-400 mb-3">Practical money education in your inbox.</p>
              <div class="wl-kit-slot" data-kit-slot>
                <form action="https://app.kit.com/forms/9874203/subscriptions" method="post" class="seva-form formkit-form wl-kit-form" data-sv-form="9874203" data-uid="2b35717445" data-format="inline" data-version="5">
                  <div data-style="clean">
                    <ul class="formkit-alert formkit-alert-error" data-element="errors" data-group="alert"></ul>
                    <div data-element="fields" class="seva-fields formkit-fields wl-kit-fields">
                      <div class="formkit-field">
                        <input class="formkit-input wl-kit-input" name="email_address" aria-label="Email Address" placeholder="Email Address" required type="email" />
                      </div>
                      <button data-element="submit" class="formkit-submit wl-kit-submit" type="submit">
                        <span>Subscribe</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
              </div>
            </div>
            ${linksHtml}
          </div>
          <div class="wl-bottom border-t border-slate-700 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500">
            <p>&copy; 2026 WealthLanding. All rights reserved.</p>
            <div class="wl-bottom-links space-x-4 mt-4 md:mt-0">
              <a href="/about/" class="hover:text-white transition-colors">About</a>
              <a href="/contact/" class="hover:text-white transition-colors">Contact</a>
              <a href="/methodology/" class="hover:text-white transition-colors">Editorial Standards</a>
              <a href="/privacy/" class="hover:text-white transition-colors">Privacy Policy</a>
              <a href="/terms/" class="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
          <p class="wl-disclaimer">Educational content only. WealthLanding does not provide personalized investment, tax, legal, or insurance advice, and nothing on this site creates an advisor–client relationship. Examples and calculator results are illustrative and depend on the assumptions shown. Verify rules with official sources and consider a licensed professional before acting.</p>
        </div>
      </footer>
    `;

    // Route the footer newsletter form through our own worker relay
    // (POST https://api.wealthlanding.com/api/subscribe) instead of letting it
    // POST directly to app.kit.com, which ad/tracker blockers silently kill.
    // We deliberately do NOT load Kit's ck.5.js embed script anymore.
    (function () {
      var slot = this.querySelector('[data-kit-slot]');
      var form = slot && slot.querySelector('.wl-kit-form');
      if (!form || form.dataset.wlRelay) return;
      form.dataset.wlRelay = '1';
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var input = form.querySelector('input[name="email_address"]');
        var email = input && input.value ? input.value.trim() : '';
        var btn = form.querySelector('[data-element="submit"]');
        var note = slot.querySelector('.wl-kit-note');
        if (!note) {
          note = document.createElement('p');
          note.className = 'wl-kit-note text-xs mt-2';
          slot.appendChild(note);
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          note.style.color = '#f87171';
          note.textContent = 'Please enter a valid email address.';
          return;
        }
        if (btn) btn.disabled = true;
        note.style.color = '#94a3b8';
        note.textContent = 'Subscribing…';
        fetch('https://api.wealthlanding.com/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ email: email, source: 'footer-newsletter' })
        })
          .then(function (res) { return res.json().catch(function () { return {}; }); })
          .then(function (data) {
            if (data && data.ok) {
              slot.innerHTML = '<p class="text-sm" style="color:#fcd34d">✓ You\'re on the list!</p>';
            } else {
              throw new Error((data && data.error) || 'subscribe_failed');
            }
          })
          .catch(function () {
            note.style.color = '#f87171';
            note.textContent = 'Something went wrong — please try again.';
            if (btn) btn.disabled = false;
          });
      }, true);
    }).call(this);
  }
}

if (!customElements.get('wealthlanding-footer')) {
  customElements.define('wealthlanding-footer', WealthLandingFooter);
}

/* Overseas hub: retarget legacy Topic/guides CTAs to canonical pages (cities/* deep dives; guides/* for London/LA/Vancouver) on the hub page only */
(function () {
  try {
    var path = (location && location.pathname) || '';
    if (path.indexOf('overseas_retirement_hub') === -1) return;
    var s = document.createElement('script');
    s.src = '/Retirement-simulator/guides/retarget-hub-links.js';
    s.async = true;
    document.head.appendChild(s);
  } catch (e) {}
})();
