import { renderForm } from './form.js';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateSlug() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => CHARS[b % 36]).join('');
}

async function makeSlug(env) {
  for (let i = 0; i < 10; i++) {
    const slug = generateSlug();
    if (await env.COOLOFF.get(slug) !== null) continue;
    if (await env.LINKS.get(slug) === null) return slug;
  }
  return null;
}

const BASE_HEADERS = {
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (request.method === 'GET' && pathname.startsWith('/go/')) {
      const token = pathname.slice('/go/'.length).replace(/\/$/, '');
      if (token !== env.FORM_TOKEN) {
        return new Response('Not found', { status: 404, headers: BASE_HEADERS });
      }
      return new Response(renderForm(token), {
        status: 200,
        headers: {
          ...BASE_HEADERS,
          'Content-Type': 'text/html;charset=utf-8',
          'X-Frame-Options': 'DENY',
        },
      });
    }

    if (request.method === 'GET' && pathname.length > 1) {
      const slug = pathname.slice(1).toUpperCase();
      const dest = await env.LINKS.get(slug);
      if (!dest) {
        return new Response('Not found', { status: 404, headers: BASE_HEADERS });
      }
      return new Response(null, {
        status: 302,
        headers: { ...BASE_HEADERS, Location: dest },
      });
    }

    if (request.method === 'POST' && pathname === '/create') {
      const auth = request.headers.get('Authorization') ?? '';
      if (auth !== `Bearer ${env.ADMIN_SECRET}`) {
        return new Response('Unauthorized', { status: 401, headers: BASE_HEADERS });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return new Response('Bad request', { status: 400, headers: BASE_HEADERS });
      }

      const { url, ttl = 86400 } = body;
      if (!url || (!url.startsWith('https://') && !url.startsWith('http://'))) {
        return new Response('URL must start with http:// or https://', { status: 400, headers: BASE_HEADERS });
      }

      const slug = await makeSlug(env);
      if (!slug) {
        return new Response('Could not generate slug', { status: 503, headers: BASE_HEADERS });
      }

      await env.LINKS.put(slug, url, { expirationTtl: Number(ttl) });
      await env.COOLOFF.put(slug, '1', { expirationTtl: 7776000 });

      const short = `HTTPS://PRVT.PW/${slug}`;
      const expires = new Date(Date.now() + Number(ttl) * 1000).toISOString();

      return new Response(JSON.stringify({ slug, short, expires }), {
        status: 201,
        headers: { ...BASE_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'POST' && pathname === '/shorten') {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response('Bad request', { status: 400, headers: BASE_HEADERS });
      }

      const { url, ttl, token } = body;
      if (token !== env.FORM_TOKEN) {
        return new Response('Unauthorized', { status: 401, headers: BASE_HEADERS });
      }

      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const { success } = await env.SHORTEN_LIMITER.limit({ key: ip });
      if (!success) {
        return new Response('Too many requests', { status: 429, headers: BASE_HEADERS });
      }

      if (!url || (!url.startsWith('https://') && !url.startsWith('http://'))) {
        return new Response('URL must start with http:// or https://', { status: 400, headers: BASE_HEADERS });
      }

      const slug = await makeSlug(env);
      if (!slug) {
        return new Response('Could not generate slug', { status: 503, headers: BASE_HEADERS });
      }

      const ttlSecs = Number(ttl) || 604800;
      await env.LINKS.put(slug, url, { expirationTtl: ttlSecs });
      await env.COOLOFF.put(slug, '1', { expirationTtl: 7776000 });

      const short = `HTTPS://PRVT.PW/${slug}`;
      const expires = new Date(Date.now() + ttlSecs * 1000).toISOString();

      return new Response(JSON.stringify({ slug, short, expires }), {
        status: 201,
        headers: { ...BASE_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404, headers: BASE_HEADERS });
  },
};
