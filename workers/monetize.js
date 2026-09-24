/**
 * WealthLanding Worker: static assets + monetization click / interest tracking.
 *
 * Routes:
 *   GET  /go/:offerId?city=...  → 302 to offer destination (or soft fallback)
 *   POST /api/interest          → log anonymous interest beacon
 *   everything else             → env.ASSETS
 *
 * Analytics Engine binding: INTEREST (dataset wl_interest)
 * Dataset must exist in the Cloudflare dashboard (Workers > Analytics Engine).
 * If the binding is missing, tracking no-ops and redirects still work when a
 * destination URL is present in offers.json.
 */

const OFFERS_PATH = '/components/monetization/offers.json';

function json(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign(
      {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      },
      extraHeaders || {}
    )
  });
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  // Same-origin toolkits only need a permissive echo for sendBeacon edge cases.
  const allow = origin || '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  };
}

async function loadOffers(env, request) {
  try {
    const url = new URL(OFFERS_PATH, request.url);
    const res = await env.ASSETS.fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function findOffer(config, offerId) {
  if (!config || !Array.isArray(config.offers)) return null;
  return config.offers.find((o) => o && o.id === offerId) || null;
}

function writeInterest(env, row) {
  try {
    if (!env.INTEREST || typeof env.INTEREST.writeDataPoint !== 'function') return;
    // Analytics Engine free tier: indexes (strings), blobs (strings), doubles (numbers)
    env.INTEREST.writeDataPoint({
      indexes: [String(row.offer || ''), String(row.city || ''), String(row.action || '')],
      blobs: [
        String(row.interest || ''),
        String(row.topic || ''),
        String(row.referrer || ''),
        String(row.path || ''),
        String(row.destination || '')
      ],
      doubles: [Date.now()]
    });
  } catch {
    /* never fail the request because of telemetry */
  }
}

async function handleGo(request, env, offerId) {
  const url = new URL(request.url);
  const city = url.searchParams.get('city') || '';
  const config = await loadOffers(env, request);
  const offer = findOffer(config, offerId);
  const destination = offer && offer.destination ? String(offer.destination).trim() : '';

  writeInterest(env, {
    offer: offerId,
    city,
    action: 'click',
    interest: (offer && offer.interest) || '',
    referrer: request.headers.get('Referer') || '',
    path: url.pathname,
    destination
  });

  if (destination) {
    return Response.redirect(destination, 302);
  }

  // No partner URL yet — soft landing so bookmarks don't 404.
  const fallback = new URL('/Retirement-simulator/RetiringOverseas.html', request.url);
  fallback.searchParams.set('from', 'go');
  fallback.searchParams.set('offer', offerId);
  if (city) fallback.searchParams.set('city', city);
  return Response.redirect(fallback.toString(), 302);
}

async function handleInterest(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, corsHeaders(request));
  }

  let payload = {};
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      payload = await request.json();
    } else {
      const text = await request.text();
      payload = text ? JSON.parse(text) : {};
    }
  } catch {
    payload = {};
  }

  writeInterest(env, {
    offer: payload.offer || '',
    city: payload.city || '',
    action: payload.action || 'interest',
    interest: payload.interest || '',
    topic: payload.topic || '',
    referrer: request.headers.get('Referer') || '',
    path: payload.path || ''
  });

  return json({ ok: true }, 200, corsHeaders(request));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (pathname === '/api/interest' || pathname === '/api/interest/') {
        return await handleInterest(request, env);
      }

      const goMatch = pathname.match(/^\/go\/([^/]+)\/?$/);
      if (goMatch) {
        return await handleGo(request, env, decodeURIComponent(goMatch[1]));
      }
    } catch (err) {
      // Fall through to assets on unexpected handler errors.
      console.error('[wl-worker]', err);
    }

    if (!env.ASSETS || typeof env.ASSETS.fetch !== 'function') {
      return new Response('Assets binding missing', { status: 500 });
    }
    return env.ASSETS.fetch(request);
  }
};
