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
          border-top: 4px solid #22c55e;
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
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        wealthlanding-footer footer.wl-site-footer .wl-brand-row {
          display: flex;
          align-items: center;
          margin-bottom: 1rem;
        }
        wealthlanding-footer footer.wl-site-footer .wl-brand-icon {
          color: #22c55e;
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
          color: #4ade80;
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
          color: #fff;
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
          color: #fff;
          font-size: 0.875rem;
          font-weight: 600;
          padding: 0.5rem 0.75rem;
          border: 0;
          cursor: pointer;
          width: 100%;
        }
        wealthlanding-footer footer.wl-site-footer .wl-kit-submit:hover {
          background: #15803d;
        }
        wealthlanding-footer footer.wl-site-footer .formkit-alert:empty {
          display: none;
        }

      `;
      document.head.appendChild(style);
    }

    this.innerHTML = `
      <footer class="wl-site-footer bg-navy-900 text-slate-300 py-12 border-t-4 border-brand-500">
        <div class="wl-footer-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="wl-footer-grid grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div class="col-span-1">
              <div class="wl-brand-row flex items-center mb-4">
                <i class="fa-solid fa-leaf wl-brand-icon text-brand-500 text-2xl mr-2" aria-hidden="true"></i>
                <span class="wl-brand-name font-bold text-xl text-white tracking-tight">WealthLanding</span>
              </div>
              <p class="wl-muted text-sm text-slate-400">Your trusted guide to financial independence, designed for the modern earner.</p>
            </div>
            <div>
              <h4 class="text-white font-bold mb-4">Learn</h4>
              <ul class="space-y-2 text-sm">
                <li><a href="/learn/early-career/" class="wl-link-accent text-brand-400 font-medium">Early Career (18–25)</a></li>
                <li><a href="/learn/building/" class="hover:text-brand-400 transition-colors">Building (25–40)</a></li>
                <li><a href="/learn/peak/" class="hover:text-brand-400 transition-colors">Peak (40–55)</a></li>
                <li><a href="/learn/pre-retirement/" class="hover:text-brand-400 transition-colors">Pre-Retirement (55+)</a></li>
              </ul>
            </div>
            <div>
              <h4 class="text-white font-bold mb-4">Resources</h4>
              <ul class="space-y-2 text-sm">
                <li><a href="/tools/" class="hover:text-brand-400 transition-colors">Tools & Calculators</a></li>
                <li><a href="/retirement/" class="hover:text-brand-400 transition-colors">Retirement Lab</a></li>
                <li><a href="/blogs/" class="hover:text-brand-400 transition-colors">Blog & Insights</a></li>
                <li><a href="/methodology/" class="hover:text-brand-400 transition-colors">Methodology</a></li>
                <li><a href="/about/" class="hover:text-brand-400 transition-colors">About</a></li>
              </ul>
            </div>
            <div>
              <h4 class="text-white font-bold mb-4">Join Newsletter</h4>
              <p class="wl-muted text-sm text-slate-400 mb-3">Get practical wealth education in your inbox.</p>
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
          <div class="wl-bottom border-t border-slate-700 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500">
            <p>&copy; 2026 WealthLanding. All rights reserved.</p>
            <div class="wl-bottom-links space-x-4 mt-4 md:mt-0">
              <a href="/privacy/" class="hover:text-white transition-colors">Privacy Policy</a>
              <a href="/terms/" class="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    `;

    // Kit JS embed URL currently 404s (wealthlanding.kit.com/.../index.js).
    // Use the HTML form (same form id 9874203 / uid 2b35717445) so the email field always shows.
    if (!document.getElementById('wl-ckjs')) {
      const ck = document.createElement('script');
      ck.id = 'wl-ckjs';
      ck.src = 'https://f.convertkit.com/ckjs/ck.5.js';
      ck.async = true;
      document.head.appendChild(ck);
    }
  }
}

if (!customElements.get('wealthlanding-footer')) {
  customElements.define('wealthlanding-footer', WealthLandingFooter);
}

/* Overseas hub: retarget legacy Topic/cities CTAs to guides/* on the hub page only */
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
