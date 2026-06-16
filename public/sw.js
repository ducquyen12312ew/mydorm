/**
 * eDorm Service Worker
 *
 * Cache strategy:
 *   Static assets (CSS/JS/fonts/images) → Cache First
 *   HTML pages                           → Network First → Cache fallback → Offline page
 *   API / Socket.IO / auth              → Network Only (never cache)
 */

'use strict';

const SW_VERSION   = 'v1.0.1';
const STATIC_CACHE = `edorm-static-${SW_VERSION}`;
const PAGES_CACHE  = `edorm-pages-${SW_VERSION}`;
const OFFLINE_URL  = '/offline.html';

// ── Static assets precached on install ────────────────────────────────────
const PRECACHE_ASSETS = [
    '/offline.html',
    '/manifest.webmanifest',
    '/css/premium-home.css',
    '/css/auth-forms.css',
    '/css/student.css',
    '/css/student-premium-shell.css',
    '/css/home.css',
    '/css/pwa.css',
    '/js/i18n.js',
    '/js/student-common.js',
    '/favicon.svg',
    '/icons/icon.svg',
];

// ── URL prefixes that must NEVER be cached ─────────────────────────────────
const BYPASS_PREFIXES = [
    '/socket.io',
    '/api/',
    '/auth/',
    '/admin/api',
    '/logout',
    '/login',
    '/signup',
    '/2fa',
];

function isBypass(url) {
    try {
        const { pathname } = new URL(url);
        return BYPASS_PREFIXES.some(p => pathname.startsWith(p));
    } catch {
        return true;
    }
}

function isStaticAsset(url) {
    try {
        const { pathname, hostname } = new URL(url);
        // Local static files
        if (
            pathname.startsWith('/css/')  ||
            pathname.startsWith('/js/')   ||
            pathname.startsWith('/icons/')||
            pathname.startsWith('/image/')||
            pathname === '/favicon.svg'   ||
            pathname === '/manifest.webmanifest'
        ) return true;
        // External CDN fonts / icon libraries
        if (
            hostname.includes('fonts.googleapis.com')  ||
            hostname.includes('fonts.gstatic.com')     ||
            hostname.includes('cdnjs.cloudflare.com')  ||
            hostname.includes('unpkg.com')
        ) return true;
        return false;
    } catch {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTALL — precache static shell
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll(PRECACHE_ASSETS))
            .then(() => {
                // Take control immediately on install
                return self.skipWaiting();
            })
            .catch((err) => {
                // Partial precache failure should not block SW installation
                console.warn('[SW] Precache partial failure:', err.message);
            })
    );
});

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVATE — purge old cache versions
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(
                names
                    .filter(n => n !== STATIC_CACHE && n !== PAGES_CACHE)
                    .map(n => {
                        console.log('[SW] Deleting old cache:', n);
                        return caches.delete(n);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

// ═══════════════════════════════════════════════════════════════════════════
// FETCH — routing strategies
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = request.url;

    // Only handle GET over http(s)
    if (request.method !== 'GET') return;
    if (!url.startsWith('http')) return;

    // ── Network Only: API, Socket.IO, auth ─────────────────────────────
    if (isBypass(url)) {
        // Let the browser handle it — no SW interception
        return;
    }

    // ── Cache First: Static assets ──────────────────────────────────────
    if (isStaticAsset(url)) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }

    // ── Network First: HTML pages ───────────────────────────────────────
    const acceptHeader = request.headers.get('accept') || '';
    if (acceptHeader.includes('text/html')) {
        event.respondWith(networkFirstHtml(request));
        return;
    }

    // ── Network First (generic) for anything else ───────────────────────
    event.respondWith(networkFirst(request, PAGES_CACHE));
});

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════

async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return cached || new Response('', { status: 504 });
    }
}

async function networkFirstHtml(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(PAGES_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Show branded offline page
        const offlinePage = await caches.match(OFFLINE_URL);
        return offlinePage || new Response(
            '<h1>Không có kết nối mạng</h1>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }
}

async function networkFirst(request, cacheName) {
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response || new Response('', { status: 503, statusText: 'Service Unavailable' });
    } catch {
        const cached = await caches.match(request);
        return cached || new Response('', { status: 503, statusText: 'Service Unavailable' });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE — allow pages to skip waiting (for update flow)
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
