class WealthLandingFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer class="bg-navy-900 text-slate-300 py-12 border-t-4 border-brand-500">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div class="col-span-1">
              <div class="flex items-center mb-4">
                <i class="fa-solid fa-leaf text-brand-500 text-2xl mr-2"></i>
                <span class="font-bold text-xl text-white tracking-tight">WealthLanding</span>
              </div>
              <p class="text-sm text-slate-400">Your trusted guide to financial independence, designed for the modern earner.</p>
            </div>
            <div>
              <h4 class="text-white font-bold mb-4">Learn</h4>
              <ul class="space-y-2 text-sm">
                <li><a href="/learn/early-career/" class="text-brand-400 font-medium">Early Career (18–25)</a></li>
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
              <p class="text-sm text-slate-400 mb-3">Get practical wealth education in your inbox.</p>
              <script async data-uid="2b35717445" src="https://wealthlanding.kit.com/2b35717445/index.js"></script>
              <noscript>
                <form action="https://app.kit.com/forms/9874203/subscriptions" method="post" class="flex flex-col gap-2">
                  <input type="email" name="email_address" required placeholder="Email Address" class="rounded px-3 py-2 text-slate-900 text-sm" />
                  <button type="submit" class="rounded bg-brand-600 text-white text-sm font-semibold py-2">Subscribe</button>
                </form>
              </noscript>
            </div>
          </div>
          <div class="border-t border-slate-700 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500">
            <p>&copy; 2026 WealthLanding. All rights reserved.</p>
            <div class="space-x-4 mt-4 md:mt-0">
              <a href="/privacy/" class="hover:text-white transition-colors">Privacy Policy</a>
              <a href="/terms/" class="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    `;
  }
}

if (!customElements.get('wealthlanding-footer')) {
  customElements.define('wealthlanding-footer', WealthLandingFooter);
}
