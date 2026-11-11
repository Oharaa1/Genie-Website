// Talks to Supabase through database functions only — the tables themselves are never reachable.
// ?demo=1 (a picked wish + a full Wall) or ?demo=empty fakes the server so the pages can be tried
// before the database exists. Local only — on the live site it would be fake "proof".
(function () {
  'use strict';
  const cfg = window.WISH_CONFIG || {};
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
  const demo = isLocal ? new URLSearchParams(location.search).get('demo') : null;
  const WALL_PAGE = 12; // keep in sync with wish_wall() in supabase/migrations

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
  const copy = (o) => JSON.parse(JSON.stringify(o));
  const ago = (hours) => new Date(Date.now() - hours * 3600e3).toISOString();

  // Demo handles end in _demo so they can never be a real person's account.
  const demoWall = demo === 'empty' ? [] : [
    { id: 127, name: 'Sara', platform: 'x', handle: 'sara_demo', hours: 0.4, hearts: 3,
      wish: 'A laptop so I can finish my design course and stop borrowing my cousin’s.' },
    { id: 126, name: 'محمد', platform: 'telegram', handle: 'mohammed_demo', hours: 2, hearts: 9,
      wish: 'أدفع إيجار البيت لثلاثة أشهر حتى أركّز على امتحاناتي.' },
    { id: 125, name: 'Lina', platform: 'x', handle: 'lina_demo', hours: 5, hearts: 21,
      wish: 'Hearing aids for my grandfather so he can hear us at dinner again.' },
    { id: 124, name: 'Omar', platform: 'telegram', handle: 'omar_demo', hours: 9, hearts: 4,
      wish: 'A food truck. I already have the recipes — I just need the truck.' },
    { id: 123, name: 'زينب', platform: 'x', handle: 'zainab_demo', hours: 14, hearts: 17,
      wish: 'ماكينة خياطة لأمي حتى ترجع تشتغل من البيت.' },
    { id: 121, name: 'Kofi', platform: 'x', handle: 'kofi_demo', hours: 26, hearts: 33,
      wish: 'Solar lamps for our village school so the kids can study after dark.' },
    { id: 120, name: 'علي', platform: 'telegram', handle: 'ali_demo', hours: 31, hearts: 6,
      wish: 'دراجة نارية للتوصيل حتى أشتغل وأعيل أهلي.' },
    { id: 118, name: 'Maya', platform: 'x', handle: 'maya_demo', hours: 40, hearts: 12,
      wish: 'Plane tickets to see my sister for the first time in six years.' },
    { id: 117, name: 'حسين', platform: 'x', handle: 'hussein_demo', hours: 52, hearts: 28,
      wish: 'أسنان جديدة لأبوي، صارله سنين ما يگدر ياكل زين.' },
    { id: 115, name: 'Leo', platform: 'telegram', handle: 'leo_demo', hours: 60, hearts: 8,
      wish: 'A wheelchair that actually fits through my apartment door.' },
    { id: 114, name: 'نور', platform: 'x', handle: 'noor_demo', hours: 75, hearts: 14,
      wish: 'رسوم الجامعة للفصل الأخير. باقي لي فصل واحد بس.' },
    { id: 112, name: 'Dan', platform: 'x', handle: 'dan_demo', hours: 90, hearts: 2,
      wish: 'Fix my car’s gearbox so I can keep my delivery job.' },
    { id: 110, name: 'Fatima', platform: 'telegram', handle: 'fatima_demo', hours: 110, hearts: 19,
      wish: 'Glasses for my three kids — they keep squinting at the board.' },
    { id: 104, name: 'رامي', platform: 'telegram', handle: 'rami_demo', hours: 150, hearts: 5,
      wish: 'عدة حلاقة كاملة حتى أفتح محلي الصغير.' },
    { id: 98, name: 'Ana', platform: 'x', handle: 'ana_demo', hours: 200, hearts: 7,
      wish: 'A month of physiotherapy so I can walk without the cane.' },
    { id: 7, name: 'Ahmed', platform: 'telegram', handle: 'ahmed_demo', hours: 400, hearts: 64,
      status: 'picked', cost: 2400, raised: 1512,
      wish: 'Pay for my mother’s eye surgery so she can see her grandchildren again.' },
    { id: 5, name: 'Sam', platform: 'telegram', handle: 'sam_demo', hours: 500, hearts: 41,
      status: 'granted', cost: 480, tx_url: 'https://example.com/demo-transfer',
      wish: 'New tyres before winter — the old ones are bald.' },
    { id: 3, name: 'هبة', platform: 'x', handle: 'hiba_demo', hours: 560, hearts: 52,
      status: 'granted', cost: 600, tx_url: 'https://example.com/demo-transfer',
      wish: 'دواء السكري لجدتي لسنة كاملة.' },
    { id: 2, name: 'يوسف', platform: 'x', handle: 'yusuf_demo', hours: 600, hearts: 36,
      status: 'granted', cost: 150, tx_url: 'https://example.com/demo-transfer',
      wish: 'حقيبة مدرسية وكتب لإخوتي الصغار.' },
  ].map((w) => Object.assign({ status: 'new', cost: null, raised: null, tx_url: null }, w, { created_at: ago(w.hours) }));

  const demoState = {
    made: demo === 'empty' ? 0 : 127,
    granted: demoWall.filter((w) => w.status === 'granted').length,
    current: demo === 'empty' ? null : {
      id: 7, name: 'Ahmed', cost: 2400, raised: 1512, granted: false, tx_url: null,
      wish: 'Pay for my mother’s eye surgery so she can see her grandchildren again.',
      reason: 'One surgery gives a whole family back their mother’s eyes.',
    },
  };

  // Demo wishes made on this page keep their key here, like the server does (the Wall never shows it).
  let demoSeq = demoWall.reduce((m, w) => Math.max(m, w.id), 0);
  const demoKey = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const demoTaken = (platform, handle) => handle.toLowerCase() === 'taken' || demoWall.some((w) =>
    w.platform === platform && w.handle.toLowerCase() === handle.toLowerCase());

  function demoWallPage(q) {
    const strip = (w) => { const o = copy(w); delete o.hours; delete o.key; return o; };
    const base = {
      made: demoState.made, granted: demoState.granted,
      current: (demoWall.find((w) => w.status === 'picked') && strip(demoWall.find((w) => w.status === 'picked'))) || null,
    };
    if (q.id) {
      const w = demoWall.find((x) => x.id === q.id);
      return Object.assign(base, { items: w ? [strip(w)] : [], more: false });
    }
    let list = demoWall.slice();
    if (q.sort === 'true') list = list.filter((w) => w.status === 'granted');
    if (q.sort === 'loved') list = list.filter((w) => w.status !== 'granted'); // the ones still waiting; granted have their own tab
    list.sort(q.sort === 'loved' ? (a, b) => b.hearts - a.hearts || b.id - a.id : (a, b) => b.id - a.id);
    const off = q.offset || 0;
    return Object.assign(base, { items: list.slice(off, off + WALL_PAGE).map(strip), more: off + WALL_PAGE < list.length });
  }

  window.WishAPI = {
    configured: () => !!demo || !!(cfg.url && cfg.key),
    // Which database a saved "my wish" belongs to ('' in demo = never saved).
    source: () => (demo ? '' : cfg.url || ''),
    WALL_PAGE,

    // Every wish is public. → { id, key }: the key is the wisher's secret for deleting it.
    makeWish: async (v, lang) => {
      if (demo) {
        await wait(700);
        if (demoTaken(v.platform, v.handle)) throw new Error('already_wished');
        demoState.made += 1;
        const w = { id: ++demoSeq, status: 'new', hearts: 0, cost: null, raised: null, tx_url: null,
          created_at: new Date().toISOString(), key: demoKey(),
          name: v.name, wish: v.wish, platform: v.platform, handle: v.handle };
        demoWall.unshift(w);
        return { id: w.id, key: w.key };
      }
      return rpc('make_wish', {
        p_name: v.name, p_wish: v.wish, p_cost: v.cost,
        p_platform: v.platform, p_handle: v.handle, p_lang: lang,
      });
    },

    // Only while the wish waits: once the Genie picks it, the server answers wish_locked.
    deleteWish: async (id, key) => {
      if (demo) {
        await wait(500);
        const w = demoWall.find((x) => x.id === id && x.key && x.key === key);
        if (!w) throw new Error('invalid_key');
        if (w.status !== 'new') throw new Error('wish_locked');
        demoWall.splice(demoWall.indexOf(w), 1);
        demoState.made -= 1;
        return true;
      }
      return rpc('delete_wish', { p_id: id, p_key: key });
    },

    stats: async () => {
      if (demo) { await wait(300); return copy(demoState); }
      return rpc('wish_stats');
    },

    // One page of the Wish Wall. q = { sort: 'new' | 'loved' | 'true', offset } or { id } for one shared wish.
    // → { made, granted, current, items: [{ id, name, wish, platform, handle, created_at, status, hearts,
    //      cost, raised, tx_url }], more }   (cost/raised/tx_url only for the picked or granted wish)
    wall: async (q) => {
      if (demo) { await wait(350); return demoWallPage(q || {}); }
      return rpc('wish_wall', { p_sort: (q && q.sort) || 'new', p_offset: (q && q.offset) || 0, p_id: (q && q.id) || null });
    },

    // ❤ "I hope it comes true" — once per wish per visitor; returns the new count.
    heart: async (id) => {
      if (demo) {
        await wait(250);
        const w = demoWall.find((x) => x.id === id);
        if (w) w.hearts += 1;
        return w ? w.hearts : 0;
      }
      return rpc('heart_wish', { p_id: id });
    },
  };
})();
