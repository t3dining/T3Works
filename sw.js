/* ============================================================
 *  読み込みの世話係（サービスワーカー）
 *
 *  なぜ必要か
 *    ホーム画面に追加したアプリは、iPhone が index.html を
 *    かなり長いあいだ端末に持ち続けます。そのため、GitHub に
 *    新しいファイルを上げても、アプリを開き直すと古い画面が
 *    出てくる、ということが起きます。
 *
 *  ここで何をしているか
 *    ページそのもの（index.html）は、開くたびに通信して新しいものを
 *    取りに行きます。ただし**待つ上限があります**（下の 待つ上限）。
 *    間に合わなければ、控えてあるものを先に出します。
 *
 *    css / js / img は ?v=… という印が付いていて、中身が変われば
 *    印も変わります。つまり古い控えが混ざる心配がないので、
 *    控えがあればそれをそのまま使います（起動が速くなります）。
 *
 *  ★このファイルは 公開用を作る.py が「版の印」と「残すファイルの一覧」を
 *    書きこんでから公開されます。
 *    ★置きかえの目印（下線を2本はさんだ名前）は、**この説明の中に書かないこと。**
 *      置きかえは1回ではなく全部に当たるので、説明の中の分まで置きかわり、
 *      一覧まるごとがコメントに刺さります（2026-09-13 に実際にそうなりました）。
 * ============================================================ */

const VERSION = '6e037c03';

/* ★控えの名前に版の印を入れません。**2026-09-13 まで入れていました。**
 *
 *   名前が `t3works-<版>` だと、公開するたびに名前が変わります。名前が変われば
 *   下の activate が**前の控えを丸ごと捨てる**ので、**誰かが1回公開しただけで、
 *   次に開いた端末はアプリを全部引き直していました**（gzipで約300KB・10本）。
 *
 *   ★`?v=` は**ファイルごとの中身の印**で、変わったものだけ引き直すための
 *     仕組みです。**控えを捨てる処理が、それを台なしにしていました。**
 *     GitHub Pages が言うのは「10分は使い回してよい」だけなので、
 *     10分過ぎたら逃げ場がありません。
 *
 *   9月3日に部署を8つに分けてから、公開は1日20〜50回になりました
 *   （9/7は52回）。**それまでは1日1〜2回でした。**同じ作りのまま
 *   回数だけが増えたので、「最近アプリが重い」になりました。
 *
 *   名前を固定にしたので、**捨てるものは名前ではなく中身で選びます**（下の KEEP）。
 */
const CACHE = 't3works';

/* いまの版が使うファイルの一覧（`?v=` 付き）。公開用を作る.py が入れます。
 * ★ここにない控えだけを捨てます。**あるものは残します。** */
const KEEP_LIST = ["css/style.css?v=0220ee6b", "drive/js/drive.js?v=2c2de0e7", "help/css/help.css?v=4011d0ad", "help/js/help.js?v=0619d3be", "img/chacoru.png?v=3406529b", "img/drive-icon-180.png?v=cf8bda78", "img/drive-icon-512.png?v=7c78116c", "img/drive-icon-64.png?v=7088d4ae", "img/kojare.png?v=c5b494db", "img/manage-icon-180.png?v=ac18efea", "img/manage-icon-64.png?v=2b8a9145", "img/mine-icon-180.png?v=cbafcd5d", "img/mine-icon-512.png?v=2dbb903e", "img/mine-icon-64.png?v=ea09f133", "img/owner-icon-180.png?v=cbb1087e", "img/owner-icon-512.png?v=7972b6a3", "img/owner-icon-64.png?v=ce05c3fc", "img/shift-icon-180.png?v=ab0bd671", "img/shift-icon-64.png?v=0254ff8c", "img/shift-qr.png?v=3509f79d", "img/t3dining-mark.png?v=c9163364", "img/works-icon-180.png?v=a0ee5b78", "img/works-icon-512.png?v=dddd764f", "img/works-icon-64.png?v=0f9cbed2", "img/works-qr.png?v=facd8cdc", "js/app.js?v=d2519aac", "js/config.js?v=61e2a87a", "js/interview.js?v=9c08c637", "js/notify.js?v=b93e0b1f", "js/share.js?v=88023092", "js/shift-sheet.js?v=202d99f9", "js/storage.js?v=6696158c", "js/sync.js?v=33c12037", "js/update.js?v=b2294857", "js/voice.js?v=3aa252ba", "manage/css/admin.css?v=eae657ea", "manage/js/admin.js?v=06c6f530", "shift/css/submit.css?v=e8a6d2b3", "shift/js/submit.js?v=45f4a638", "story/css/story.css?v=55f08ac0", "story/js/story.js?v=0f730e6d"];

/**
 * この控えを捨てるか
 *
 * ★**いま使っている道の、古い印**だけを捨てます。
 *     ・印（?v=）がないもの        … 触りません（ページ本体がこれです。
 *                                    捨てると電波がないときの逃げ場を失います）
 *     ・一覧にない道              … 触りません（よその画面のものかもしれません）
 *     ・一覧にある道で、印がちがう … 捨てます（要らなくなった古い版）
 *
 * ★ここを関数にしてあるのは、**検算から呼べるようにする**ためです
 *   （`.claude/skills/t3works-zentai/test_sw.js`）。
 *   世話係の中に埋めこむと、決め方が合っているかを確かめられません。
 */
function 捨てるか(url, のこす, 今の道) {
  const u = new URL(url);
  if (!u.searchParams.has('v')) return false;
  if (!今の道.has(u.pathname)) return false;
  return !のこす.has(u.href);
}

/** 一覧を、実際に要求されるURLの形にそろえます */
function keepSet() {
  const s = new Set();
  KEEP_LIST.forEach((p) => {
    try { s.add(new URL(p, self.registration.scope).href); } catch (e) { /* 変な行は飛ばす */ }
  });
  return s;
}

/* 新しいこのファイルが届いたら、前のものを待たずにすぐ交代します */
self.addEventListener('install', () => {
  self.skipWaiting();
});

/**
 * 交代したときの片づけ
 *
 * ★捨てるのは「いまの版が使わないもの」だけです。**版が変わっただけでは捨てません。**
 *   版の印の付いたファイルは中身ごとに別のURLなので、古いものが残っていても
 *   まちがって使われることはありません。**要らなくなった分だけ落とします。**
 */
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // 2026-09-13 より前の、版の名前が付いた控えを片づけます（1回だけ起きます）
    const names = await caches.keys();
    await Promise.all(names.map((n) => (n === CACHE ? null : caches.delete(n))));

    const cache = await caches.open(CACHE);
    // ★`keep` という名前は下の関数（控えに入れる）と同じになるので使いません
    const のこす = keepSet();
    /* ★捨てるのは「**いま使っている道の、古い印**」だけです。
         `ページ本体`（`index.html?v=…` の形で控えに入ります）まで捨てると、
         電波がないときの逃げ場がなくなります。道で見分けます */
    const 今の道 = new Set([...のこす].map((u) => new URL(u).pathname));
    const reqs = await cache.keys();
    await Promise.all(reqs.map(
      (req) => (捨てるか(req.url, のこす, 今の道) ? cache.delete(req) : null)
    ));

    await self.clients.claim();
  })());
});

async function keep(req, res) {
  if (!res || !res.ok || res.type === 'opaque') return res;
  const cache = await caches.open(CACHE);
  cache.put(req, res.clone());
  return res;
}

/**
 * ★ページ本体を待つ上限
 *
 *   これがなかったので、電波が弱いときは**控えがすぐ横にあるのに、
 *   通信が「失敗」するまでいつまでも待っていました。**
 *   控えが使われるのは失敗したときだけで、**遅いだけのときは使われません。**
 *   「開くのに時間がかかる」の半分はこれです。
 */
const 待つ上限 = 2500;

/** 目印。「間に合わなかった」を表すだけのものです */
const おそい = Symbol('おそい');

/**
 * ページ本体を出す
 *
 * ★`cache:'no-store'` で取りに行きます。そうしないと、GitHub Pages が付けている
 *   「10分は使い回してよい」のせいで、ブラウザが古い index.html を出してしまい、
 *   「更新するを押しても新しくならない」ことが起きます。
 */
function ページを出す(e, req) {
  const 通信 = (async () => keep(
    req, await fetch(req.url, { cache: 'no-store', credentials: 'same-origin' })
  ))();
  // 誰も見ない失敗を残さないため、ここで受け止めておきます
  const 静かな通信 = 通信.catch(() => おそい);

  return (async () => {
    const cache = await caches.open(CACHE);
    const 控え = await cache.match(req, { ignoreSearch: true });
    // 控えがない初回は、待つしかありません
    if (!控え) {
      const 出た = await 静かな通信;
      if (出た !== おそい) return 出た;
      throw new Error('はじめての読み込みで、通信できませんでした');
    }
    const 早い方 = await Promise.race([
      静かな通信,
      new Promise((r) => setTimeout(() => r(おそい), 待つ上限)),
    ]);
    if (早い方 !== おそい) return 早い方;
    /* ★間に合わなかったので控えを出します。**通信は捨てません。**
         裏で控えを新しくしておくので、次に開いたときには新しい方が出ます。
         画面には js/update.js が「新しい版があります」を出します */
    e.waitUntil(静かな通信);
    return 控え;
  })();
}

/** 通信を先に試し、だめなら控えを出す（?v= のないこまごましたもの向け） */
async function networkFirst(req) {
  try {
    return await keep(req, await fetch(req));
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

/** 控えがあればそれを出し、なければ取りに行く（?v= 付きのファイルむけ） */
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  return keep(req, await fetch(req));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                    // 送信（同期）は素通し

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;          // Google への同期は素通し
  if (url.pathname.endsWith('/version.json')) return;  // 版の確認は必ず本物を見る

  // ページ本体。待つ上限を付けてあります
  if (req.mode === 'navigate') { e.respondWith(ページを出す(e, req)); return; }

  // 中身が変われば印（?v=）も変わるので、控えをそのまま使ってよい
  if (url.searchParams.has('v')) { e.respondWith(cacheFirst(req)); return; }

  e.respondWith(networkFirst(req));
});

/* ============================================================
 *  アプリの知らせ（Web Push。2026-11-20、ko-dai さんの指示）
 *
 *  クローズとジャーナルの未提出を、LINE ではなく、この端末の通知で知らせます。
 *  届けるのは Cloudflare（cloudflare/worker.js の「アプリの知らせ」）。登録は js/notify.js です。
 *
 *  ★iPhone は、届いた知らせを**必ず画面に出さないと**、何回かで知らせを止めてしまいます。
 *    だから中身が読めなくても、何かは必ず出します。
 *  ★押したら、アプリ（マイン）の、その店のその日の画面を開きます（開いていれば、その画面を前に出します）。
 *  ★アイコンの数（2026-11-21、ko-dai さんの指示）は「アプリを最後に開いてから届いた知らせの数」です。
 *    届くたびに1つ足し、知らせを押したとき・アプリを開いたとき（js/notify.js）に0へ戻します。
 *    ★はじめは「通知の一覧に出ている知らせの数」を数えていました。iPhone ではアプリを開いても一覧から下がらず、
 *      前の分に足されていきました（ko-dai さんの報告）。いまは数を自分で持ちます。
 *    数を持つ所は、控え（CACHE）の中の1行です（BADGE_KEY。版の印 ?v= がないので、片づけでは捨てられません）。
 *    ★js/notify.js も同じ所に0を書きます。名前を変えるときは2か所一緒に（test_sw_push.js が見ています）。
 *    数を出せない端末（古い iPhone など）でも、知らせは今までどおり出ます。
 * ============================================================ */
const BADGE_KEY = 'app-badge-count';

async function 数の控え() {
  return { c: await caches.open(CACHE), u: new URL(BADGE_KEY, self.registration.scope).href };
}

/** アイコンの数を動かします。差 … 1＝届いた（1つ足す）／-1＝押さずに消した（1つ減らす。0より下にはしない）／0＝0に戻す */
async function 数を出す(差) {
  try {
    const n = self.navigator;
    if (!n || typeof n.setAppBadge !== 'function') return;
    const 控え = await 数の控え();
    let 数 = 0;
    if (差) {
      const r = await 控え.c.match(控え.u);
      数 = Math.max(0, (r ? Number(await r.text()) || 0 : 0) + 差);
    }
    await 控え.c.put(控え.u, new Response(String(数)));
    if (数) await n.setAppBadge(数);
    else if (typeof n.clearAppBadge === 'function') await n.clearAppBadge();
  } catch (err) { /* 数を出せなくても、知らせは出ています */ }
}

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }
  const 題 = String(d.title || 'T3 Works');
  const 決め = { body: String(d.body || ''), data: { url: String(d.url || '') } };
  if (d.tag) 決め.tag = String(d.tag);
  e.waitUntil(self.registration.showNotification(題, 決め).then(() => 数を出す(1)));
});

/* 知らせを、押さずに消したとき（スワイプで消す・まとめて消す）。数を1つ減らします（2026-11-21、ko-dai さんの指示）
 * ★**iPhone はこれを知らせてくれません**（2026-11-21、ko-dai さんの iPhone で試して、数は減りませんでした）。
 *   iPhone では何も起きず、アプリを開いたときに0に戻ります。知らせてくれる端末（Android など）でだけ減ります。
 *   ★iPhone で通知の一覧に数を合わせる手は、他にありません（一覧を数える形は、開いても一覧から下がらず、前の分に足されました） */
self.addEventListener('notificationclose', (e) => {
  e.waitUntil(数を出す(-1));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const 行き先 = (e.notification.data && e.notification.data.url) || 'mine/';
  let url;
  try { url = new URL(行き先, self.registration.scope).href; } catch (err) { url = self.registration.scope; }
  // ★よその所へは開きません（行き先はアプリの中だけ）
  if (url.indexOf(self.registration.scope) !== 0) url = self.registration.scope;
  e.waitUntil((async () => {
    await 数を出す(0);   // 押したらアプリが開くので、0に戻します（開いたアプリの側でも戻します）
    const 窓たち = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of 窓たち) {
      if (w.url.indexOf(self.registration.scope) === 0 && 'focus' in w) {
        /* ★開いている画面を、その画面へ動かします。iPhone では navigate が使えないことがあるので、
             そのときは画面に「ここへ」と伝えます（受けるのは js/notify.js。2026-11-21） */
        let 動いた = false;
        try { if ('navigate' in w) { await w.navigate(url); 動いた = true; } } catch (err) { 動いた = false; }
        if (!動いた) { try { w.postMessage({ t3: 'open', url }); } catch (err) { /* 前に出すだけはします */ } }
        return w.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
    return null;
  })());
});
