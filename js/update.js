/* ============================================================
 *  新しい版のお知らせ
 *
 *  考え方
 *    公開したファイルには、中身から計算した「版の印」が付きます。
 *    アプリは version.json を時々見に行き、いま開いている印と
 *    違っていたら、画面下に「新しい版があります」と出します。
 *
 *    ボタンを押すと読み込み直します。このとき URL に印を付けるので、
 *    端末に残っている古いページではなく、必ず新しいものが読まれます。
 *
 *  version.json と <meta name="app-version"> は 公開用を作る.py が付けます。
 *  手元でそのまま開いたときは印がないので、この機能は動きません。
 * ============================================================ */

const Updater = {
  interval: 5 * 60 * 1000,   // 5分おきに確かめる
  _checking: false,
  _started: false,
  _found: '',                // 見つかった新しい印

  /** いま開いている版の印 */
  current() {
    const meta = document.querySelector('meta[name="app-version"]');
    return meta ? meta.content.trim() : '';
  },

  async check() {
    if (this._checking || this._found || !this.current()) return;
    this._checking = true;
    try {
      // cache: 'no-store' で、端末に残っている控えを使わず必ず取りに行く
      const res = await fetch('version.json', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      if (!json.v || json.v === this.current()) return;

      // ★この印でもう一度読み直したのに、まだ古いまま。
      //   端末に残っている控えか、古い世話係（sw.js）が
      //   古いページを出し続けています。押しても直らないのはこれです。
      //   その場合は、控えを捨てて世話係を外してから読み直します
      const tried = new URLSearchParams(location.search).get('v');
      if (tried && tried === json.v) {
        await this.heal();
        return;
      }
      this.show(json.v);
    } catch (e) {
      /* 通信できないときは何もしない。次の機会に確かめます */
    } finally {
      this._checking = false;
    }
  },

  /**
   * 「更新する」を押しても新しくならないときの立て直し
   *
   *  控えを全部捨て、世話係（sw.js）も外してから読み直します。
   *  世話係は次に開いたときに登録し直されるので、外したままにはなりません。
   *
   *  ★1回だけにします。読み直しても直らない相手だったときに、
   *    読み直しをくり返してしまうのを防ぐためです。
   */
  async heal() {
    const mark = 't3d-healed';
    try {
      if (sessionStorage.getItem(mark)) return;   // この画面ではもう試しました
      sessionStorage.setItem(mark, '1');
    } catch (e) {
      /* シークレットモードなどで使えないときは、そのまま進めます */
    }
    await this.dropCaches();
    location.replace(this.reloadUrl('t', Date.now()));
  },

  /** 端末に残っている控えと、世話係を消す */
  async dropCaches() {
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
    } catch (e) {
      /* 消せなくても、読み直しは行います */
    }
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (e) {
      /* 同上 */
    }
  },

  show(version) {
    this._found = version;
    const bar = document.getElementById('updateBar');
    if (!bar) return;
    bar.classList.remove('is-hidden');
    document.body.classList.add('has-update');
  },

  /**
   * 読み込み直す。URLに印を付けて、古いページが使われないようにする
   *
   * ★もとのURLに付いていた ?from=mine などは残します。
   *   捨ててしまうと、読み直したあとに画面が変わってしまいます
   *   （配達記録の「ホームに戻る」が消える、など）
   */
  apply() {
    location.replace(this.reloadUrl('v', this._found));
  },

  /** いまのURLに印を足したものを返す（もとの ?付き の内容は残す） */
  reloadUrl(name, value) {
    const params = new URLSearchParams(location.search);
    params.set(name, value);
    // 前回の印は残しておく必要がないので消します
    if (name === 'v') params.delete('t');
    if (name === 't') params.delete('v');
    return location.pathname + '?' + params.toString() + location.hash;
  },

  /**
   * 設定の「今すぐ最新にする」
   *
   * 端末に残っている控えを全部捨ててから読み直します。
   * 「画面が古いままな気がする」というときの最後の手段です。
   * チェックの記録は別の場所にあるので消えません。
   */
  async force() {
    await this.dropCaches();
    location.replace(this.reloadUrl('t', Date.now()));
  },

  /**
   * アプリが置いてある場所（…/T3Works/）を返す
   * mine / manage / owner / drive は1つ下の階層にあるので、その分だけ戻ります
   */
  root() {
    const dir = location.pathname.replace(/[^/]*$/, '');
    return dir.replace(/(mine|manage|owner|drive)\/$/, '');
  },

  /**
   * 読み込みの世話係（sw.js）を登録する
   *
   * ホーム画面に追加したアプリは、iPhone が index.html を長く
   * 持ち続けます。そのままだと、アプリを開き直したときに
   * 古い画面が出てしまうので、sw.js に面倒を見てもらいます。
   */
  registerWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
    const root = this.root();
    // updateViaCache:'none' … sw.js 自体は控えを使わず、毎回取りに行く
    navigator.serviceWorker
      .register(root + 'sw.js', { scope: root, updateViaCache: 'none' })
      .catch(() => { /* 使えない端末では、これまでどおり動きます */ });
  },

  start() {
    if (this._started || !this.current()) return;
    this._started = true;
    this.registerWorker();

    const bar = document.getElementById('updateBar');
    if (bar) bar.querySelector('.update-bar__btn').addEventListener('click', () => this.apply());

    // アプリに戻ってきたときは、その場で確かめる
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.check();
    });
    setInterval(() => this.check(), this.interval);
    setTimeout(() => this.check(), 4000);
  },
};
