// Talks to Supabase through two database functions — nothing else is reachable.
// ?demo=1 (a picked wish) or ?demo=empty fakes the server so the page can be tried
// before the database exists. Local only — on the live site it would be fake "proof".
(function () {
  'use strict';
  const cfg = window.WISH_CONFIG || {};
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
  const demo = isLocal ? new URLSearchParams(location.search).get('demo') : null;

  async function rpc(name, body) {
    if (!cfg.url || !cfg.key) throw new Error('setup');
    const res = await fetch(cfg.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.key,
        Authorization: 'Bearer ' + cfg.key,
      },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.message) || 'http_' + res.status);
    return data;
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const demoState = {
    made: demo === 'empty' ? 0 : 127,
    granted: 0,
    current: demo === 'empty' ? null : {
      id: 7, name: 'Ahmed', cost: 2400, raised: 1512, granted: false, tx_url: null,
      wish: 'Pay for my mother’s eye surgery so she can see her grandchildren again.',
    },
  };

  window.WishAPI = {
    configured: () => !!demo || !!(cfg.url && cfg.key),
    // Which database a saved "my wish" belongs to ('' in demo = never saved).
    source: () => (demo ? '' : cfg.url || ''),

    makeWish: async (v, lang) => {
      if (demo) {
        await wait(700);
        if (v.handle.toLowerCase() === 'taken') throw new Error('already_wished');
        return ++demoState.made;
      }
      return rpc('make_wish', {
        p_name: v.name, p_wish: v.wish, p_cost: v.cost,
        p_platform: v.platform, p_handle: v.handle, p_lang: lang,
      });
    },

    stats: async () => {
      if (demo) { await wait(300); return JSON.parse(JSON.stringify(demoState)); }
      return rpc('wish_stats');
    },
  };
})();
