const esc = value =>
      String(value ?? '').replace(
        /[&<>"']/g,
        character => ({
          '&':'&amp;',
          '<':'&lt;',
          '>':'&gt;',
          '"':'&quot;',
          "'":'&#39;'
        }[character])
      );

    const pretty = value =>
      String(value ?? '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, character => character.toUpperCase());

    const formatAction = value => {
      if (!value) return 'No reviews';

      const actionMap = {
        buy_below_attractive_threshold: 'Buy Below Attractive Threshold',
        buy_below_entry_zone: 'Buy Below Entry Zone',
        watch_for_catalyst: 'Watch for Catalyst',
        hold_and_monitor: 'Hold & Monitor',
        await_earnings_results: 'Await Earnings Results',
        fair_value: 'Fair Value Zone'
      };

      return actionMap[value] || pretty(value);
    };

    const dateLabel = value => {
      if (!value) return '—';

      const parsed = new Date(`${value}T00:00:00`);

      if (Number.isNaN(parsed.getTime())) return esc(value);

      return new Intl.DateTimeFormat('en-US', {
        month:'short',
        day:'numeric',
        year:'numeric'
      }).format(parsed);
    };

    const statusColor = status => ({
      strengthening:'bg-emerald-50 text-emerald-700',
      intact:'bg-blue-50 text-blue-700',
      weakening:'bg-amber-50 text-amber-700',
      invalidated:'bg-rose-50 text-rose-700'
    }[status] || 'bg-slate-100 text-slate-700');

    function toAbsoluteUrl(path) {
      if (!path) return path;
      if (path.startsWith('http://') || path.startsWith('https://')) return path;

      const isBlob = window.location.protocol === 'blob:' || window.location.href.startsWith('blob:');
      const base = isBlob ? window.location.origin : window.location.href;

      try {
        return new URL(path, base).href;
      } catch (e) {
        return path;
      }
    }

    function resolveDataPath(path) {
      if (!path) return null;

      if (
        path.startsWith('http://') ||
        path.startsWith('https://') ||
        path.startsWith('/')
      ) {
        return toAbsoluteUrl(path);
      }

      const relativePath = `./data/${path.replace(/^\.?\/?(data\/)?/, '')}`;
      return toAbsoluteUrl(relativePath);
    }

    async function getJSON(path) {
      const url = toAbsoluteUrl(path);
      const response = await fetch(url, { cache:'no-store' });

      if (!response.ok) {
        throw new Error(`${path}: ${response.status}`);
      }

      return response.json();
    }

    function getThemeSlug(theme) {
      return String(theme?.thesis?.slug || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');
    }

    function getRankedReviewEntries(theme) {
      const themeSlug = getThemeSlug(theme);

      if (!themeSlug) return [];

      const explicit = Array.isArray(theme?.ranked_company_reviews)
        ? theme.ranked_company_reviews
        : [];

      if (explicit.length) {
        return explicit
          .filter(item => [1, 2, 3].includes(Number(item?.rank)))
          .sort((a, b) => Number(a.rank) - Number(b.rank))
          .map(item => ({
            ...item,
            theme_slug: themeSlug,
            company_json_path:
              item.company_json_path ||
              `/investment/data/companies/${themeSlug}/top${Number(item.rank)}.json`,
            detail_url:
              item.detail_url ||
              `/investment/company.html?theme=${encodeURIComponent(themeSlug)}&rank=${Number(item.rank)}`
          }));
      }

      return [1, 2, 3].map(rank => ({
        rank,
        slot:`top${rank}`,
        theme_slug:themeSlug,
        company_json_path:
          `/investment/data/companies/${themeSlug}/top${rank}.json`,
        detail_url:
          `/investment/company.html?theme=${encodeURIComponent(themeSlug)}&rank=${rank}`,
        analysis_status:'pending'
      }));
    }

    async function loadRankedCompanies(themes) {
      const requests = themes.flatMap(theme =>
        getRankedReviewEntries(theme).map(review => ({
          theme,
          review
        }))
      );

      const results = await Promise.allSettled(
        requests.map(async ({ theme, review }) => {
          const company = await getJSON(
            resolveDataPath(review.company_json_path)
          );

          return {
            theme,
            review,
            company
          };
        })
      );

      return results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(item => item.company);
    }

    function companyPrice(company) {
      return (
        company?.market_data?.price ??
        company?.market_data?.current_price ??
        company?.valuation?.current_price ??
        null
      );
    }

    function companyFairValue(company) {
      return (
        company?.valuation?.fair?.value_per_share ??
        company?.valuation?.fair_value ??
        company?.valuation?.fair_value_per_share ??
        company?.valuation?.probability_weighted_value ??
        company?.valuation?.scenario_values?.fair ??
        company?.scenario_valuation?.fair_value ??
        null
      );
    }

    function companyCurrency(company) {
      return (
        company?.company?.trading_currency ??
        company?.company?.reporting_currency ??
        company?.company?.currency ??
        company?.market_data?.currency ??
        company?.valuation?.currency ??
        ''
      );
    }

    function companyName(company, review) {
      return (
        company?.company?.name ??
        company?.identity?.name ??
        company?.company_name ??
        review?.company_name ??
        'Company analysis'
      );
    }

    function companyTicker(company, review) {
      return (
        company?.company?.ticker ??
        company?.identity?.ticker ??
        company?.ticker ??
        review?.ticker ??
        ''
      );
    }

    function renderThemes(themes) {
      const grid = document.getElementById('theme-grid');

      if (!themes.length) {
        grid.innerHTML = `
          <div class="card p-7 text-slate-500">
            No theme reviews are currently available.
          </div>
        `;
        return;
      }

      grid.innerHTML = themes.map(theme => {
        const ranked = getRankedReviewEntries(theme);
        const topCompany =
          ranked.find(item => Number(item.rank) === 1);

        const topLabel =
          topCompany?.company_name ||
          topCompany?.selection_reason ||
          'Company analysis pending';

        const health =
          Number(theme?.thesis_health?.current);

        return `
          <article class="card p-7">
            <div class="flex justify-between gap-5">
              <div>
                <div class="text-xs uppercase tracking-wider text-slate-400 font-bold">
                  ${esc(theme?.thesis?.category || 'Investment theme')}
                </div>

                <h3 class="serif text-2xl font-bold mt-2">
                  ${esc(theme?.thesis?.name || 'Unnamed theme')}
                </h3>
              </div>

              <div
                class="ring"
                style="--score:${Number.isFinite(health) ? Math.max(0, Math.min(100, health)) : 0}"
              >
                <span>${Number.isFinite(health) ? esc(health) : '—'}</span>
              </div>
            </div>

            <div class="mt-5">
              <span class="pill ${statusColor(theme?.status)}">
                ${esc(formatAction(theme?.status || 'under review'))}
              </span>

              <span class="text-xs font-bold text-slate-400 ml-2">
                ${esc(pretty(theme?.thesis_health?.trend || ''))}
              </span>
            </div>

            <p class="text-sm text-slate-600 leading-6 mt-5">
              ${esc(
                theme?.decision?.summary ||
                theme?.publication?.summary ||
                'Theme review available.'
              )}
            </p>

            <div class="mt-5 rounded-xl bg-slate-50 border border-slate-100 p-4">
              <div class="text-[11px] uppercase tracking-wider font-extrabold text-slate-400">
                Current Top 1 company
              </div>

              <div class="font-bold mt-1">
                ${esc(topLabel)}
              </div>
            </div>

            <div class="mt-6 flex justify-between gap-4 text-xs">
              <span class="text-slate-400">
                Reviewed ${dateLabel(theme?.review?.date)}
              </span>

              <a
                class="font-extrabold text-emerald-700"
                href="./theme.html?thesis=${encodeURIComponent(getThemeSlug(theme))}"
              >
                Open theme →
              </a>
            </div>
          </article>
        `;
      }).join('');
    }

    function renderCompanies(items) {
      const grid = document.getElementById('company-grid');

      if (!items.length) {
        grid.innerHTML = `
          <div class="card p-7 text-slate-500">
            No completed Top 1–3 company reviews are currently available.
          </div>
        `;
        return;
      }

      const sorted = [...items].sort((a, b) => {
        const dateA =
          a.company?.review?.date ||
          a.company?.publication?.generated_at ||
          '';

        const dateB =
          b.company?.review?.date ||
          b.company?.publication?.generated_at ||
          '';

        return dateB.localeCompare(dateA);
      });

      grid.innerHTML = sorted.map(({ theme, review, company }) => {
        const price = companyPrice(company);
        const fairValue = companyFairValue(company);
        const currency = companyCurrency(company);
        const rank = Number(
          company?.ranking?.rank ??
          review?.rank
        );

        const themeSlug =
          company?.ranking?.theme_slug ||
          review?.theme_slug ||
          getThemeSlug(theme);

        const detailUrl =
          review?.detail_url ||
          `./company.html?theme=${encodeURIComponent(themeSlug)}&rank=${encodeURIComponent(rank)}`;

        const summary =
          company?.decision?.summary ||
          company?.publication?.summary ||
          review?.selection_reason ||
          'Open the full company review for details.';

        const state =
          company?.decision?.current_zone ||
          company?.decision?.state ||
          company?.valuation?.status ||
          'under review';

        const currencyPrefix = currency ? `${esc(currency)} ` : '';

        return `
          <article class="card p-7 flex flex-col">
            <div class="flex justify-between gap-4">
              <div>
                <div class="text-xs uppercase tracking-wider text-slate-400 font-bold">
                  ${esc(companyTicker(company, review))}
                </div>

                <h3 class="serif text-2xl font-bold mt-2">
                  ${esc(companyName(company, review))}
                </h3>

                <div class="text-xs font-semibold text-slate-400 mt-2">
                  ${esc(theme?.thesis?.name || pretty(themeSlug))}
                  · Top ${esc(rank)}
                </div>
              </div>

              <span class="pill bg-slate-100 text-slate-700 h-fit">
                ${esc(formatAction(state))}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-3 mt-6">
              <div class="bg-slate-50 rounded-xl p-4">
                <div class="text-[10px] uppercase text-slate-400 font-bold">
                  Current price
                </div>

                <div class="text-xl font-extrabold mt-1">
                  ${
                    price == null
                      ? 'Pending'
                      : `${currencyPrefix}${esc(price)}`
                  }
                </div>
              </div>

              <div class="bg-slate-50 rounded-xl p-4">
                <div class="text-[10px] uppercase text-slate-400 font-bold">
                  Fair value
                </div>

                <div class="text-xl font-extrabold mt-1">
                  ${
                    fairValue == null
                      ? 'Pending'
                      : `${currencyPrefix}${esc(fairValue)}`
                  }
                </div>
              </div>
            </div>

            <p class="text-sm text-slate-600 leading-6 mt-5">
              ${esc(summary)}
            </p>

            <div class="mt-auto pt-5">
              <a
                class="inline-block font-extrabold text-emerald-700 text-sm"
                href="${esc(detailUrl)}"
              >
                Open company decision →
              </a>
            </div>
          </article>
        `;
      }).join('');
    }

    async function load() {
      const themeGrid = document.getElementById('theme-grid');
      const companyGrid = document.getElementById('company-grid');

      try {
        const manifest = await getJSON('./data/index.json');
        const themeEntries = Array.isArray(manifest?.themes)
          ? manifest.themes
          : [];

        const themeResults = await Promise.allSettled(
          themeEntries.map(entry => {
            const path = entry?.file || `themes/${entry?.slug}.json`;
            return getJSON(resolveDataPath(path));
          })
        );

        const themes = themeResults
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value)
          .filter(Boolean);

        const companies = await loadRankedCompanies(themes);

        document.getElementById('theme-count').textContent =
          themes.length;

        document.getElementById('company-count').textContent =
          companies.length;

        const latestCompany = [...companies].sort((a, b) => {
          const dateA =
            a.company?.review?.date ||
            a.company?.publication?.generated_at ||
            '';

          const dateB =
            b.company?.review?.date ||
            b.company?.publication?.generated_at ||
            '';

          return dateB.localeCompare(dateA);
        })[0];

        const latestTheme = [...themes].sort((a, b) =>
          String(b?.review?.date || '').localeCompare(
            String(a?.review?.date || '')
          )
        )[0];

        const rawAction =
          latestCompany?.company?.decision?.cta ||
          latestCompany?.company?.decision?.state ||
          latestTheme?.decision?.cta ||
          latestTheme?.decision?.state;

        document.getElementById('latest-action').textContent =
          formatAction(rawAction);

        renderThemes(themes);
        renderCompanies(companies);

        const failures = themeResults.filter(
          result => result.status === 'rejected'
        );

        if (failures.length) {
          console.warn(
            `${failures.length} theme file(s) could not be loaded.`,
            failures
          );
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'The investment data could not be loaded.';

        themeGrid.innerHTML = `
          <div class="card p-6 text-amber-800 bg-amber-50">
            ${esc(message)}
          </div>
        `;

        companyGrid.innerHTML = `
          <div class="card p-6 text-slate-500">
            Company reviews could not be loaded.
          </div>
        `;

        document.getElementById('theme-count').textContent = '0';
        document.getElementById('company-count').textContent = '0';
        document.getElementById('latest-action').textContent =
          'Data unavailable';

        console.error(error);
      }
    }

    document
      .querySelector('form[role="search"]')
      ?.addEventListener('submit', event => {
        const query = event.currentTarget.q;

        if (!query.value.trim()) {
          event.preventDefault();
          return;
        }

        query.value =
          `site:wealthlanding.com ${query.value.trim()}`;
      });

    load();
