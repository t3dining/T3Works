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

const VERSION = 'b750a879';

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
 * ★ここに無い控えだけを捨てます。**あるものは残します。** */
const KEEP_LIST = ["css/style.css?v=ff0a159c", "drive/js/drive.js?v=b0b30727", "img/drive-icon-180.png?v=cf8bda78", "img/drive-icon-512.png?v=7c78116c", "img/drive-icon-64.png?v=7088d4ae", "img/manage-icon-180.png?v=ac18efea", "img/manage-icon-64.png?v=2b8a9145", "img/mine-icon-180.png?v=cbafcd5d", "img/mine-icon-512.png?v=2dbb903e", "img/mine-icon-64.png?v=ea09f133", "img/owner-icon-180.png?v=cbb1087e", "img/owner-icon-512.png?v=7972b6a3", "img/owner-icon-64.png?v=ce05c3fc", "img/shift-icon-180.png?v=ab0bd671", "img/shift-icon-64.png?v=0254ff8c", "img/t3dining-mark.png?v=c9163364", "img/works-icon-180.png?v=a0ee5b78", "img/works-icon-512.png?v=dddd764f", "img/works-icon-64.png?v=0f9cbed2", "js/app.js?v=1ca8bee6", "js/config.js?v=067d91ab", "js/shift-sheet.js?v=2b29c50a", "js/storage.js?v=6533b295", "js/sync.js?v=1723e6cc", "js/update.js?v=c530219e", "manage/css/admin.css?v=27e01b9d", "manage/js/admin.js?v=6a7eeece", "shift/css/submit.css?v=23cadf83", "shift/js/submit.js?v=5cbc0931", "story/css/story.css?v=55f08ac0", "story/js/story.js?v=72d03613"];

/**
 * この控えを捨てるか
 *
 * ★**いま使っている道の、古い印**だけを捨てます。
 *     ・印（?v=）が無いもの        … 触りません（ページ本体がこれです。
 *                                    捨てると電波が無いときの逃げ場を失います）
 *     ・一覧に無い道              … 触りません（よその画面のものかもしれません）
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
         電波が無いときの逃げ場が無くなります。道で見分けます */
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
 *   これが無かったので、電波が弱いときは**控えがすぐ横にあるのに、
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
    // 控えが無い初回は、待つしかありません
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

/** 通信を先に試し、だめなら控えを出す（?v= の無いこまごましたもの向け） */
async function networkFirst(req) {
  try {
    return await keep(req, await fetch(req));
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

/** 控えがあればそれを出し、無ければ取りに行く（?v= 付きのファイルむけ） */
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
