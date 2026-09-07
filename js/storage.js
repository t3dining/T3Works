/* ============================================================
 *  データ保存レイヤー
 *
 *  いまは端末内（localStorage）に保存します。
 *  将来「社内全員で共有」する場合は、この LocalAdapter と同じ
 *  メソッドを持つアダプタ（例: GasAdapter / FirebaseAdapter）を
 *  追加して Store.adapter を差し替えるだけで済むようにしています。
 *
 *  データの形
 *    レコードキー : storeId + '/' + 'YYYY-MM-DD'
 *    レコード     : {
 *      staff: 'その日の担当者',
 *      items: { 項目id: { done: true/false, value: '', at: ISO日時 } },
 *      note:  '申し送り・気付き',
 *      submittedAt: ISO日時 または null,   // 提出したら入る
 *      submittedBy: '提出した担当者',
 *      updatedAt: ISO日時,
 *      updatedBy: '名前'
 *    }
 * ============================================================ */

/* ------------------------------------------------------------
 *  端末の中の保存先
 *
 *  いままで … localStorage。全部を1つの文字列にまとめ、書くたびに丸ごと
 *             書き直していました。iPhone の Safari は1つのサイトにつき
 *             5MB前後までなので、1年ほどで頭を打ちます。
 *  これから … IndexedDB（下の IdbAdapter）。端末の空きに応じて数百MB使えます。
 *
 *  ★アプリ側の書き方は変えていません。
 *    起動のときに全部を手元（_mem）へ読み込み、読み書きはその手元に対して行い、
 *    書いた分だけ、あとから IndexedDB へ流します。
 *
 *  ★こわれ方への備え（ここが大事です）
 *    1. 引っ越しは、元を消さずに行います。書いたあと読み直して1件ずつ照合し、
 *       さらに「次に開いたときにも正しく読めた」ことを確かめてから、
 *       はじめて元を消します。途中で閉じられても、元がそのまま残ります。
 *    2. 「どこまで同期したか」の印を、記録と同じ場所に置きます。
 *       別々の場所にあると、片方だけ消えたときに
 *       「記録は無いのに、印は進んだまま」になり、サーバーから戻ってこなくなります。
 *    3. 記録が0件なのに印だけ残っていたら、印を消します（全部取り直させます）。
 *       2 をすり抜けた場合の、最後の受け止めです。
 *    4. IndexedDB が使えない端末では、いままでどおり localStorage を使います。
 *    5. 書けなかったときは黙って落とさず、画面に知らせます。
 * ---------------------------------------------------------- */

/** 保存に失敗したときの知らせ先。画面側で Store.onError = fn を入れます */
function storeFail(message, e) {
  console.warn('保存の問題:', message, e || '');
  Store.lastError = message;
  if (typeof Store.onError === 'function') {
    try { Store.onError(message); } catch (e2) { /* 知らせ先の失敗は無視します */ }
  }
}

const LocalAdapter = {
  where: 'localStorage',

  _all() {
    try {
      return JSON.parse(localStorage.getItem(APP.storageKey) || '{}');
    } catch (e) {
      console.warn('保存データの読み込みに失敗しました', e);
      return {};
    }
  },
  _save(all) {
    try {
      localStorage.setItem(APP.storageKey, JSON.stringify(all));
      return true;
    } catch (e) {
      // いっぱいになると、ここに来ます。黙って落とすと
      //「チェックしたのに保存されていない」が起きるので、必ず知らせます
      storeFail('端末の保存がいっぱいです。設定から「端末の保存」を見てください', e);
      return false;
    }
  },
  get(key) {
    return this._all()[key] || null;
  },
  set(key, record) {
    const all = this._all();
    all[key] = record;
    this._save(all);
  },
  /** storeId + 年月('YYYY-MM') に含まれる全レコードを取得 */
  getMonth(storeId, ym) {
    const all = this._all();
    const prefix = `${storeId}/${ym}-`;
    const out = {};
    Object.keys(all).forEach((k) => {
      if (k.startsWith(prefix)) out[k.slice(prefix.length)] = all[k]; // 'DD' 部分
    });
    return out;
  },
  dump() {
    return this._all();
  },
  load(obj) {
    this._save(obj);
  },

  /* -------- 覚え書き（同期の印など） --------
     ★印の置き場所は、いままでと同じ名前のままにします。
        こちらに落ちてきたときに、今までの端末がそのまま動くようにするためです */
  _metaKey(name) {
    return name === 'since' ? `${APP.storageKey}:syncSince` : `${APP.storageKey}:${name}`;
  },
  meta(name) {
    return localStorage.getItem(this._metaKey(name));
  },
  setMeta(name, value) {
    try {
      if (value === null || value === undefined) localStorage.removeItem(this._metaKey(name));
      else localStorage.setItem(this._metaKey(name), String(value));
    } catch (e) {
      storeFail('端末の保存がいっぱいです', e);
    }
  },
  /** いま何文字使っているか */
  size() {
    const text = localStorage.getItem(APP.storageKey) || '';
    return { chars: text.length, keys: Object.keys(this._all()).length };
  },
};

/* ------------------------------------------------------------
 *  IndexedDB の保存先
 *
 *  記録は records、覚え書き（同期の印など）は meta に入れます。
 *  ★2つを同じデータベースに置くのが肝心です。
 *    端末がデータを捨てるときは、まとめて捨てられます。
 *    片方だけ残ると「記録は無いのに、印は進んだまま」になり、
 *    サーバーは「変わったものだけ」しか返さないので、記録が戻ってきません。
 * ---------------------------------------------------------- */
const IDB = { name: `${APP.storageKey}-db`, ver: 1, recs: 'records', meta: 'meta' };

const IdbAdapter = {
  where: 'IndexedDB',
  _db: null,
  _mem: {},        // 記録の手元の写し
  _meta: {},       // 覚え書きの手元の写し
  _dirty: new Set(),
  _metaDirty: new Set(),
  _waiting: false,

  /** 開いて、中身を全部 手元へ読み込みます */
  async open() {
    this._db = await new Promise((ok, ng) => {
      let req;
      try { req = indexedDB.open(IDB.name, IDB.ver); } catch (e) { ng(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB.recs)) db.createObjectStore(IDB.recs);
        if (!db.objectStoreNames.contains(IDB.meta)) db.createObjectStore(IDB.meta);
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ng(req.error || new Error('開けません'));
      req.onblocked = () => ng(new Error('ほかの画面が開いています'));
    });
    // 別の画面が作り直そうとしたら、こちらは閉じて譲ります
    this._db.onversionchange = () => { try { this._db.close(); } catch (e) { /* すでに閉じています */ } };

    this._mem = await this._readAll(IDB.recs);
    this._meta = await this._readAll(IDB.meta);
  },

  _readAll(name) {
    return new Promise((ok, ng) => {
      const tx = this._db.transaction(name, 'readonly');
      const st = tx.objectStore(name);
      const ks = st.getAllKeys();
      const vs = st.getAll();
      tx.oncomplete = () => {
        const out = {};
        (ks.result || []).forEach((k, i) => { out[k] = (vs.result || [])[i]; });
        ok(out);
      };
      tx.onerror = () => ng(tx.error || new Error('読めません'));
      tx.onabort = () => ng(tx.error || new Error('読めません'));
    });
  },

  /* -------- 読み書き（ここは待ちません。手元の写しを見ます） -------- */
  get(key) { return this._mem[key] || null; },

  set(key, record) {
    this._mem[key] = record;
    this._dirty.add(key);
    this._later();
  },

  getMonth(storeId, ym) {
    const prefix = `${storeId}/${ym}-`;
    const out = {};
    Object.keys(this._mem).forEach((k) => {
      if (k.startsWith(prefix)) out[k.slice(prefix.length)] = this._mem[k];
    });
    return out;
  },

  /**
   * いまの中身を渡す
   *
   * ★**写しを返します。**前は `this._mem` そのものを返していました。
   *   呼んだ側が `delete all[key]` すると**中の写しから直接消える**ので、
   *   そのあと `load(all)` に入っても「前は何があったか」が分からず、
   *   **IndexedDB から消せませんでした**（2026-09-07に直しました）。
   *   `js/sync.js` の `_applyPulled` も、渡されたものを書き換えてから
   *   `load()` に渡しています。
   */
  dump() { return { ...this._mem }; },

  load(obj) {
    // ★これは「入れ替え」です。**減った分も消さなければなりません。**
    //
    //   前は新しい方のキーにしか印を付けていませんでした。書き出しは
    //   `_mem[k] === undefined` のときに delete する作りなので、
    //   **印の付かない古いキーは IndexedDB に残り続けます。**
    //   手元の写しからは消えるので、その場では「0件」に見えます。
    //   **開き直すと全部戻ります。**
    //
    //   2026-09-07、シフトが試験データ14,688件を「消した」と報告したのに
    //   残っていた、という形で見つかりました。
    //   ★消したあとは、**開き直してから数え直して**ください。
    Object.keys(this._mem).forEach((k) => this._dirty.add(k));   // 前の分＝消える候補
    this._mem = { ...obj };
    Object.keys(this._mem).forEach((k) => this._dirty.add(k));   // 新しい分
    this._later();
  },

  meta(name) {
    const v = this._meta[name];
    return v === undefined ? null : v;
  },
  setMeta(name, value) {
    if (value === null || value === undefined) delete this._meta[name];
    else this._meta[name] = String(value);
    this._metaDirty.add(name);
    this._later();
  },

  /* -------- 書き出し --------
     まとめて書きます。同じ処理の中で何百件 入れても、書き込みは1回で済みます */
  _later() {
    if (this._waiting) return;
    this._waiting = true;
    Promise.resolve().then(() => { this._waiting = false; this.flush(); });
  },

  async flush() {
    if (!this._db) return;
    const keys = [...this._dirty];
    const metas = [...this._metaDirty];
    if (!keys.length && !metas.length) return;
    this._dirty.clear();
    this._metaDirty.clear();
    try {
      await new Promise((ok, ng) => {
        const names = [];
        if (keys.length) names.push(IDB.recs);
        if (metas.length) names.push(IDB.meta);
        const tx = this._db.transaction(names, 'readwrite');
        if (keys.length) {
          const st = tx.objectStore(IDB.recs);
          keys.forEach((k) => {
            if (this._mem[k] === undefined) st.delete(k); else st.put(this._mem[k], k);
          });
        }
        if (metas.length) {
          const st2 = tx.objectStore(IDB.meta);
          metas.forEach((n) => {
            if (this._meta[n] === undefined) st2.delete(n); else st2.put(this._meta[n], n);
          });
        }
        tx.oncomplete = ok;
        tx.onerror = () => ng(tx.error || new Error('書けません'));
        tx.onabort = () => ng(tx.error || new Error('書けません'));
      });
      if (Store.lastError) { Store.lastError = ''; }
    } catch (e) {
      // 書けなかった分は戻して、次の機会にもう一度ためします
      keys.forEach((k) => this._dirty.add(k));
      metas.forEach((n) => this._metaDirty.add(n));
      storeFail('端末に保存できませんでした。通信が切れていても記録は残るはずの場所です', e);
    }
  },

  /** 引っ越し。書いて、読み直して、1件ずつ照合します。合わなければ false */
  async fill(obj) {
    const keys = Object.keys(obj);
    await new Promise((ok, ng) => {
      const tx = this._db.transaction(IDB.recs, 'readwrite');
      const st = tx.objectStore(IDB.recs);
      keys.forEach((k) => st.put(obj[k], k));
      tx.oncomplete = ok;
      tx.onerror = () => ng(tx.error || new Error('書けません'));
      tx.onabort = () => ng(tx.error || new Error('書けません'));
    });
    const back = await this._readAll(IDB.recs);
    if (Object.keys(back).length < keys.length) return false;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (JSON.stringify(back[k]) !== JSON.stringify(obj[k])) return false;
    }
    this._mem = back;
    return true;
  },

  /** 引っ越しに失敗したときの片づけ。中途半端に入ったものを消します */
  clearRecs() {
    return new Promise((ok, ng) => {
      const tx = this._db.transaction(IDB.recs, 'readwrite');
      tx.objectStore(IDB.recs).clear();
      tx.oncomplete = () => { this._mem = {}; ok(); };
      tx.onerror = () => ng(tx.error || new Error('消せません'));
    });
  },

  /** いま何文字使っているか */
  size() {
    let chars = 0;
    const keys = Object.keys(this._mem);
    keys.forEach((k) => { chars += k.length + JSON.stringify(this._mem[k]).length; });
    return { chars, keys: keys.length };
  },
};

const Store = {
  adapter: LocalAdapter,

  /* ============================================================
   *  保存先の用意（起動のときに1回だけ）
   *
   *  ★途中で失敗しても、いままでの場所（localStorage）で
   *    そのまま動き続けます。アプリが使えなくなることはありません。
   * ============================================================ */
  lastError: '',
  onError: null,
  movedThisTime: false,

  async boot() {
    this.movedThisTime = false;
    // 使えない端末（プライベートブラウズなど）は、いままでどおり
    if (typeof indexedDB === 'undefined' || !indexedDB) return this.usage();

    try {
      await IdbAdapter.open();
    } catch (e) {
      console.warn('新しい保存先を開けませんでした。いままでの場所を使います', e);
      return this.usage();
    }

    const already = Object.keys(IdbAdapter._mem).length;
    const old = LocalAdapter.dump();
    const oldN = Object.keys(old).length;

    // ---- 引っ越し（元は消しません）----
    if (!already && oldN) {
      let done = false;
      try { done = await IdbAdapter.fill(old); } catch (e) { done = false; }
      if (!done) {
        // 中途半端に入ったものを片づけて、いままでの場所を使い続けます
        try { await IdbAdapter.clearRecs(); } catch (e2) { /* 片づけの失敗は無視します */ }
        storeFail('保存先の引っ越しに失敗しました。いままでの場所を使い続けます');
        return this.usage();
      }
      this.movedThisTime = true;
      IdbAdapter.setMeta('movedAt', new Date().toISOString());
      IdbAdapter.setMeta('oldKept', '1');      // 元をまだ残しています
    }

    // ---- 同期の印を、記録と同じ場所へ ----
    if (IdbAdapter.meta('since') === null) {
      IdbAdapter.setMeta('since', localStorage.getItem(`${APP.storageKey}:syncSince`) || '');
    }

    this.adapter = IdbAdapter;

    // ---- 前回 引っ越して、今回も正しく読めた。ここではじめて元を消します ----
    if (!this.movedThisTime && IdbAdapter.meta('oldKept') === '1' && already) {
      try { localStorage.removeItem(APP.storageKey); } catch (e) { /* 消せなくても困りません */ }
      IdbAdapter.setMeta('oldKept', '0');
    }

    // ---- 最後の受け止め ----
    // 記録が1件も無いのに印だけ進んでいたら、サーバーは何も返してくれません。
    // 印を消して、次の同期で全部取り直させます
    if (!Object.keys(IdbAdapter._mem).length && IdbAdapter.meta('since')) {
      IdbAdapter.setMeta('since', '');
      console.warn('記録が空だったので、次の同期で全部取り直します');
    }

    await IdbAdapter.flush();
    return this.usage();
  },

  /* -------- 覚え書き（同期の印など） -------- */
  meta(name) { return this.adapter.meta(name); },
  setMeta(name, value) { return this.adapter.setMeta(name, value); },

  /** 書きかけを、いますぐ書き切ります（閉じるとき用） */
  flushNow() {
    if (this.adapter.flush) return this.adapter.flush();
    return Promise.resolve();
  },

  /** いまどれくらい使っているか（設定の画面に出します） */
  usage() {
    const s = this.adapter.size();
    // ★中身の一致ではなく名前で見ます。差し替えても正しく判定できるようにするためです
    const local = this.adapter.where === 'localStorage';
    return {
      where: this.adapter.where,
      isOld: local,
      keys: s.keys,
      mb: s.chars / 1024 / 1024,
      // localStorage は5MB前後で頭を打ちます。IndexedDB は端末の空き次第です
      limitMb: local ? 5 : 0,
      moved: !!(this.adapter.meta && this.adapter.meta('movedAt')),
    };
  },

  key(storeId, dateStr) {
    return `${storeId}/${dateStr}`;
  },

  /** 1日分のレコードを取得（無ければ空レコード） */
  getDay(storeId, dateStr) {
    const rec = this.adapter.get(this.key(storeId, dateStr));
    if (!rec) {
      return { staff: '', items: {}, note: '', submittedAt: null, submittedBy: '', updatedAt: null, updatedBy: '' };
    }
    if (rec.staff === undefined) rec.staff = '';
    if (rec.submittedAt === undefined) rec.submittedAt = null;
    return rec;
  },

  /** 提出する */
  submit(storeId, dateStr) {
    const rec = this.getDay(storeId, dateStr);
    const now = new Date().toISOString();
    rec.submittedAt = now;
    rec.submittedBy = rec.staff || '';
    rec.updatedAt = now;
    rec.updatedBy = rec.submittedBy;
    this.adapter.set(this.key(storeId, dateStr), rec);
    return rec;
  },

  /** 提出を取り消す */
  unsubmit(storeId, dateStr) {
    const rec = this.getDay(storeId, dateStr);
    if (!rec.submittedAt) return rec;
    rec.submittedAt = null;
    rec.submittedBy = '';
    rec.updatedAt = new Date().toISOString();
    rec.updatedBy = rec.staff || '';
    this.adapter.set(this.key(storeId, dateStr), rec);
    return rec;
  },

  /** その日の担当者を設定 */
  setStaff(storeId, dateStr, name) {
    const rec = this.getDay(storeId, dateStr);
    rec.staff = name;
    rec.updatedAt = new Date().toISOString();
    rec.updatedBy = name;
    this.adapter.set(this.key(storeId, dateStr), rec);
  },

  /** 1項目を更新（担当者はその日の担当者を使うので項目ごとには持たない） */
  setItem(storeId, dateStr, itemId, patch) {
    const rec = this.getDay(storeId, dateStr);
    const cur = rec.items[itemId] || { done: false, value: '', at: null };
    const next = { ...cur, ...patch };
    if (patch.done !== undefined) {
      next.at = patch.done ? new Date().toISOString() : null;
    }
    rec.items[itemId] = next;
    rec.updatedAt = new Date().toISOString();
    rec.updatedBy = rec.staff || '';
    this.adapter.set(this.key(storeId, dateStr), rec);
    return next;
  },

  /** 申し送りメモを更新 */
  setNote(storeId, dateStr, note) {
    const rec = this.getDay(storeId, dateStr);
    rec.note = note;
    rec.updatedAt = new Date().toISOString();
    rec.updatedBy = rec.staff || '';
    this.adapter.set(this.key(storeId, dateStr), rec);
  },

  /** 月内の日別レコード { 'DD': record } */
  getMonth(storeId, ym) {
    return this.adapter.getMonth(storeId, ym);
  },

  /**
   * その入れ先に入っている記録の名前を全部（'_shiftw/baguru-2026-09-1-xxxxxx'
   * なら 'baguru-2026-09-1-xxxxxx' の方を返します）
   *
   * ★うしろの6桁は**その人に配った番号**です。ここに本物の数を書かないでください。
   *   番号は 100000〜999999 のただの乱数なので、**6桁ちょうどの数はどれも
   *   誰かの番号になりえます。**当たれば、その人の希望を読んで上書きできます
   *   （2026-09-07、シフトの指摘。`xxxxxx` に直しました）。
   *
   * ★1人1行にしたシフトの希望を集めるのに使います。
   *   1件ずつ getDay で引くには、まずどんな名前で入っているかが要ります。
   */
  keysUnder(storeId) {
    const prefix = `${storeId}/`;
    return Object.keys(this.adapter.dump())
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  },

  /** その店舗で最初に記録がある日付（'YYYY-MM-DD'）。無ければ null
   *  週間掃除の記録（storeId/W2026-08-02）は日付ではないので除きます */
  firstDate(storeId) {
    const prefix = `${storeId}/`;
    const dates = Object.keys(this.adapter.dump())
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    return dates[0] || null;
  },

  /* -------- バックアップ -------- */
  exportJson() {
    return JSON.stringify(
      { app: APP.storageKey, exportedAt: new Date().toISOString(), data: this.adapter.dump() },
      null,
      2
    );
  },
  importJson(text) {
    const parsed = JSON.parse(text);
    const data = parsed.data || parsed;
    if (typeof data !== 'object' || Array.isArray(data)) throw new Error('形式が違います');
    // 既存データにマージ（同じ日付は取り込み側を優先）
    const merged = { ...this.adapter.dump(), ...data };
    this.adapter.load(merged);
  },
};

/* ============================================================
 *  定休日の設定
 *
 *  2段構え：
 *    1) 曜日の定休日   … 店舗ごとに「毎週◯曜が休み」（設定画面で変更可）
 *    2) 個別の日の例外 … 「この日だけ営業する」「この日は休業する」
 *                        年末年始のような臨時休業もこちら
 *  例外は曜日の設定より優先されます。
 * ============================================================ */
const Closed = {
  _dowsKey: APP.storageKey + ':closedDows',
  _exKey: APP.storageKey + ':closedExceptions',

  _read(key) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch (e) {
      return {};
    }
  },
  _write(key, obj) {
    localStorage.setItem(key, JSON.stringify(obj));
  },

  /* -------- 1) 曜日の定休日 -------- */
  /** 設定画面で変えていればそれを、なければ config.js の初期値を使う */
  dows(storeId) {
    const saved = this._read(this._dowsKey)[storeId];
    if (Array.isArray(saved)) return saved;
    return (getStore(storeId).closedDays || []).slice();
  },
  setDows(storeId, dows) {
    const all = this._read(this._dowsKey);
    all[storeId] = [...dows].sort();
    this._write(this._dowsKey, all);
  },

  /* -------- 2) 個別の日の例外 -------- */
  /** { 'YYYY-MM-DD': 'open' | 'closed' } */
  exceptions(storeId) {
    return this._read(this._exKey)[storeId] || {};
  },
  exceptionOn(storeId, dateStr) {
    return this.exceptions(storeId)[dateStr] || null;
  },
  /** kind に null を渡すと例外を取り消して曜日の設定に戻す */
  setException(storeId, dateStr, kind) {
    const all = this._read(this._exKey);
    const mine = { ...(all[storeId] || {}) };
    if (kind === 'open' || kind === 'closed') mine[dateStr] = kind;
    else delete mine[dateStr];
    all[storeId] = mine;
    this._write(this._exKey, all);
  },

  /* -------- 判定 -------- */
  isClosed(storeId, y, m, d) {
    const p2 = (n) => String(n).padStart(2, '0');
    const ex = this.exceptionOn(storeId, `${y}-${p2(m)}-${p2(d)}`);
    if (ex === 'open') return false;
    if (ex === 'closed') return true;
    return this.dows(storeId).includes(new Date(y, m - 1, d).getDay());
  },
};

/* -------- チェック項目（管理アプリで変更し、全端末へ配られます） --------
 *
 *  項目には「いつから」「いつまで」を持たせています。
 *    addedAt   … この日から出す（過去の日にはさかのぼって出しません）
 *    retiredAt … この日から出さない（それより前の日には残ります）
 *  こうすることで、項目を足しても過去が確認漏れ扱いにならず、
 *  項目を消しても過去の記録は当時のまま残ります。
 */
const Checklists = {
  _key: APP.storageKey + ':checklists',

  _read() {
    try {
      const v = JSON.parse(localStorage.getItem(this._key) || 'null');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (e) {
      return {};
    }
  },

  /** 保存されている全店舗分。管理アプリの一括保存で使います */
  all() {
    return this._read();
  },

  /** その店舗の区分と項目。未設定なら config.js の初期値を使う */
  sections(storeId) {
    const saved = this._read()[storeId];
    if (Array.isArray(saved) && saved.length) return saved;
    return defaultChecklist(storeId);
  },

  /** まだ一度も編集されていない（config.js の初期値のまま）かどうか */
  isDefault(storeId) {
    const saved = this._read()[storeId];
    return !(Array.isArray(saved) && saved.length);
  },

  save(storeId, sections) {
    const all = this._read();
    all[storeId] = sections;
    localStorage.setItem(this._key, JSON.stringify(all));
    return all;
  },
};

/* -------- 週間掃除の項目（こちらも管理アプリで変更し、全端末へ配られます） --------
 *
 *  毎日のチェック項目（Checklists）と同じ考え方ですが、
 *  区分はなく、ただの項目の並びです。
 *  「項目を1つも置かない」設定もできるよう、空の配列も設定済みとして扱います。
 */
const Weeklies = {
  _key: APP.storageKey + ':weeklies',

  _read() {
    try {
      const v = JSON.parse(localStorage.getItem(this._key) || 'null');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (e) {
      return {};
    }
  },

  /** 保存されている全店舗分。管理アプリの一括保存で使います */
  all() {
    return this._read();
  },

  /** その店舗の項目。未設定なら config.js の初期値を使う */
  items(storeId) {
    const saved = this._read()[storeId];
    if (Array.isArray(saved)) return saved;
    return defaultWeekly(storeId);
  },

  /** まだ一度も編集されていない（config.js の初期値のまま）かどうか */
  isDefault(storeId) {
    return !Array.isArray(this._read()[storeId]);
  },

  save(storeId, items) {
    const all = this._read();
    all[storeId] = items;
    localStorage.setItem(this._key, JSON.stringify(all));
    return all;
  },
};
/* -------- 随時掃除の項目（マネージで登録します） --------
 *
 *  「暇なとき」「汚くなったら」やる掃除です。週間掃除（Weeklies）と
 *  同じ形にしてあります。**達成率には入りません。**
 *
 * ★記録は `店舗id/ANYTIME` に1つだけです。項目を足しても行は増えません
 *   （5万文字の心配はありません）。
 */
const Anytimes = {
  _key: APP.storageKey + ':anytimes',

  _read() {
    try {
      const v = JSON.parse(localStorage.getItem(this._key) || 'null');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (e) {
      return {};
    }
  },

  /** 保存されている全店舗分。管理アプリの一括保存で使います */
  all() {
    return this._read();
  },

  /** その店舗の項目。未設定なら config.js の初期値を使う */
  items(storeId) {
    const saved = this._read()[storeId];
    if (Array.isArray(saved)) return saved;
    return defaultAnytime(storeId);
  },

  /** まだ一度も編集されていない（config.js の初期値のまま）かどうか */
  isDefault(storeId) {
    return !Array.isArray(this._read()[storeId]);
  },

  save(storeId, items) {
    const all = this._read();
    all[storeId] = items;
    localStorage.setItem(this._key, JSON.stringify(all));
    return all;
  },
};


/* -------- 教育の項目（マネージで変更し、全端末へ配られます） --------
 *
 *  クローズのチェック項目（Checklists）とまったく同じ形です。
 *  未設定の店舗は config.js の初期値を使います。
 * ---------------------------------------------------------- */
const Trainings = {
  _key: APP.storageKey + ':trainings',

  _read() {
    try {
      const v = JSON.parse(localStorage.getItem(this._key) || 'null');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (e) {
      return {};
    }
  },

  /** 保存されている全店舗分。管理アプリの一括保存で使います */
  all() {
    return this._read();
  },

  /** その店舗の区分と項目。未設定なら config.js の初期値を使う */
  sections(storeId) {
    const saved = this._read()[storeId];
    if (Array.isArray(saved)) return saved;
    return defaultTraining(storeId);
  },

  /** まだ一度も編集されていない（config.js の初期値のまま）かどうか */
  isDefault(storeId) {
    return !Array.isArray(this._read()[storeId]);
  },

  save(storeId, sections) {
    const all = this._read();
    all[storeId] = sections;
    localStorage.setItem(this._key, JSON.stringify(all));
    return all;
  },
};

/* -------- 教育を受ける人（店舗ごと） --------
 *
 *  ★管理用PINは要りません。名前を足すのは各店舗なので、
 *    現場のアプリ（ワークス）からも入れられるようにしてあります。
 *  ★1人1人に id を振ります。名前を直しても、それまでの進み具合が
 *    そのまま続くようにするためです。
 * ---------------------------------------------------------- */
const Trainees = {
  _key: APP.storageKey + ':trainees',

  /** { 店舗id: [{ id, n: 名前, at: 入れた日 }] } をまるごと返します */
  all() {
    try {
      const saved = JSON.parse(localStorage.getItem(this._key) || 'null');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        const out = {};
        Object.keys(saved).forEach((store) => {
          out[store] = (saved[store] || [])
            .map((v) => ({ id: String(v.id || ''), n: String(v.n || ''), at: v.at || '' }))
            .filter((v) => v.id && v.n);
        });
        return out;
      }
    } catch (e) {
      /* 壊れていたら空に戻す */
    }
    return {};
  },

  /** その店舗の人（登録した順） */
  list(storeId) {
    return (this.all()[storeId] || []).slice();
  },

  save(storeId, people) {
    const all = this.all();
    all[storeId] = people;
    localStorage.setItem(this._key, JSON.stringify(all));
    return all;
  },

  /** 1人足す。同じ名前がすでにあれば足しません */
  add(storeId, name) {
    const clean = String(name || '').trim();
    if (!clean) return null;
    const people = this.list(storeId);
    if (people.some((p) => p.n === clean)) return null;
    const person = { id: newTraineeId(), n: clean, at: new Date().toISOString() };
    people.push(person);
    this.save(storeId, people);
    return person;
  },

  /** 名前を直す（進み具合はそのまま続きます） */
  rename(storeId, id, name) {
    const clean = String(name || '').trim();
    if (!clean) return;
    const people = this.list(storeId);
    const one = people.find((p) => p.id === id);
    if (!one) return;
    one.n = clean;
    this.save(storeId, people);
  },

  /** 一覧から外す（記録そのものは消えません） */
  remove(storeId, id) {
    this.save(storeId, this.list(storeId).filter((p) => p.id !== id));
  },
};

/** 人の id。名前を直しても進み具合が続くように、名前とは別に持ちます */
function newTraineeId() {
  return 'tp-' + Math.random().toString(36).slice(2, 9);
}

/* -------- 担当者リスト（プルダウンの選択肢） -------- */
const Staff = {
  _key: APP.storageKey + ':staffList',

  /** 設定で保存されたリスト。未設定・空・壊れている場合は config.js の STAFF を使う */
  list() {
    try {
      const saved = JSON.parse(localStorage.getItem(this._key) || 'null');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (e) {
      /* 壊れていたら初期値に戻す */
    }
    return STAFF.slice();
  },

  /** 改行区切りの文字列から保存（空行と重複は除く） */
  saveFromText(text) {
    const names = [];
    text.split('\n').forEach((line) => {
      const name = line.trim();
      if (name && !names.includes(name)) names.push(name);
    });
    localStorage.setItem(this._key, JSON.stringify(names));
    return names;
  },
};

/* -------- キャッチをする人のリスト --------
 *
 *  現金支払い管理表で「キャッチ」を選んだときの、
 *  「誰に渡したか」のプルダウンです。全店舗で共通で、マネージで編集します。
 *  名前を消しても、過去に入れた記録はその名前のまま残ります。
 */
const CatchStaff = {
  _key: APP.storageKey + ':catchStaff',

  /** { 店舗id: [名前] } をまるごと返します */
  all() {
    try {
      const saved = JSON.parse(localStorage.getItem(this._key) || 'null');
      // 前は全店舗ひとまとめの配列でした。そのときの分は、そのまま全店舗の人として扱います
      if (Array.isArray(saved)) {
        const map = {};
        if (saved.length) pickableStores().forEach((s) => { map[s.id] = saved.slice(); });
        return map;
      }
      if (saved && typeof saved === 'object') return saved;
    } catch (e) {
      /* 壊れていたら初期値に戻す */
    }
    return { ...CATCH_STAFF };
  },

  /** その店舗の人。店舗を指定しなければ、全店舗をつないだ一覧（重複なし） */
  list(storeId) {
    const map = this.all();
    if (storeId) return (map[storeId] || []).slice();
    const out = [];
    pickableStores().forEach((s) => (map[s.id] || []).forEach((n) => {
      if (!out.includes(n)) out.push(n);
    }));
    return out;
  },

  /** 何人登録されているか（重複は1人と数えます） */
  count() { return this.list().length; },

  save(map) {
    const clean = {};
    Object.keys(map || {}).forEach((id) => {
      const names = [];
      (map[id] || []).forEach((n) => {
        const name = String(n).trim();
        if (name && !names.includes(name)) names.push(name);
      });
      if (names.length) clean[id] = names;
    });
    localStorage.setItem(this._key, JSON.stringify(clean));
    return clean;
  },

  /** 1店舗分を、改行区切りの文字列から保存 */
  saveFromText(storeId, text) {
    const map = this.all();
    map[storeId] = String(text || '').split('\n');
    return this.save(map);
  },
};

/* -------- シフトに入るアルバイトの名簿 --------
 *
 *  クローズの担当者（Staff＝社員）とも、キャッチをする人（CatchStaff）とも
 *  別物です。同じ人が入っていてもかまいません。
 *  マネージの「シフト」で、店舗ごとに登録します。
 *
 *  ここに登録した人だけが、提出ページの名前選びに出ます。
 *  名前を消しても、組みおわったシフトはその名前のまま残ります
 *  （記録の中に名前を書き写しているため）。
 */
const ShiftStaff = {
  _key: APP.storageKey + ':shiftStaff',

  /**
   * { 店舗id: [{ n: 名前, c: 番号, s: 送りずみか, p: 持ち場 }] } をまるごと返します
   *
   * 名前だけの配列で入っていた時期のものは、番号なしとして読みます
   * （保存し直すと番号が振られます）。
   * p（持ち場）は 'k'（キッチン）か 'h'（ホール）。決めていなければ空です。
   */
  all() {
    try {
      const saved = JSON.parse(localStorage.getItem(this._key) || 'null');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        const out = {};
        Object.keys(saved).forEach((id) => {
          out[id] = (saved[id] || []).map((v) => (
            typeof v === 'string'
              ? { n: v, c: '', s: false, p: '' }
              : {
                n: String(v.n || ''), c: String(v.c || ''), s: !!v.s,
                p: SHIFT_LANES.some((l) => l.id === v.p) ? v.p : '',
              }
          )).filter((v) => v.n);
        });
        return out;
      }
    } catch (e) {
      /* 壊れていたら空に戻す */
    }
    return {};
  },

  /**
   * その人のふだんの持ち場（'k' か 'h'。決めていなければ空）
   *
   * 希望を取り込むときに、この持ち場へ入れます。
   */
  laneOf(storeId, name) {
    const who = this.people(storeId).find((p) => p.n === name);
    return who ? (who.p || '') : '';
  },

  /** その店舗の人（名前と番号）。店舗を指定しなければ、シフトを組む店舗全部 */
  people(storeId) {
    const map = this.all();
    if (storeId) return (map[storeId] || []).slice();
    const out = [];
    SHIFT_STORES.forEach((id) => (map[id] || []).forEach((p) => out.push({ ...p, store: id })));
    return out;
  },

  /** 名前だけの一覧（並び順は登録した順） */
  list(storeId) {
    return this.people(storeId).map((p) => p.n);
  },

  /** 何人登録されているか */
  count(storeId) { return this.people(storeId).length; },

  /** いま使われている番号全部（重ならない番号を作るために見ます） */
  codes() {
    return this.people().map((p) => p.c).filter(Boolean);
  },

  /**
   * 保存する
   *
   * ★番号が入っていない人には、ここで新しい番号を振ります。
   *   名前を書くだけで使えるようにするためです。
   *   すでに番号がある人の番号は、そのまま変えません
   *   （変えてしまうと、その人が入れなくなります）。
   */
  save(map) {
    const clean = {};
    const used = new Set();
    // まず、いま決まっている番号を集める（重複を避けるため）
    Object.keys(map || {}).forEach((id) => (map[id] || []).forEach((p) => {
      const c = String((p && p.c) || '').trim();
      if (c) used.add(c);
    }));

    Object.keys(map || {}).forEach((id) => {
      const list = [];
      (map[id] || []).forEach((p) => {
        const name = String((p && p.n) || '').trim();
        if (!name || list.some((x) => x.n === name)) return;
        let code = String((p && p.c) || '').trim();
        if (!code) {
          code = makeShiftCode(used);
          used.add(code);
        }
        const lane = SHIFT_LANES.some((l) => l.id === (p && p.p)) ? p.p : '';
        list.push({ n: name, c: code, s: !!(p && p.s), p: lane });
      });
      if (list.length) clean[id] = list;
    });
    localStorage.setItem(this._key, JSON.stringify(clean));
    return clean;
  },

  /**
   * 1店舗分を、改行区切りの名前から保存
   *
   * すでにいる人の番号は引き継ぎ、新しく書かれた人には番号を振ります。
   * 消された人は、番号ごといなくなります。
   */
  saveFromText(storeId, text) {
    const map = this.all();
    const before = map[storeId] || [];
    map[storeId] = String(text || '').split('\n').map((line) => {
      const name = line.trim();
      const old = before.find((p) => p.n === name);
      return {
        n: name,
        c: old ? old.c : '',
        s: old ? old.s : false,
        p: old ? (old.p || '') : '',
      };
    }).filter((p) => p.n);
    return this.save(map);
  },

  /** その人の番号を作り直す（前の番号では入れなくなります） */
  reissue(storeId, name) {
    const map = this.all();
    const list = map[storeId] || [];
    const who = list.find((p) => p.n === name);
    if (!who) return this.all();
    who.c = makeShiftCode(this.codes());
    // 番号が変わったら、送りずみの印は外します（送り直しが要るため）
    who.s = false;
    return this.save(map);
  },

  /** その人のふだんの持ち場を決める（'k' / 'h' / 空で「決めていない」） */
  setLane(storeId, name, lane) {
    const map = this.all();
    const who = (map[storeId] || []).find((p) => p.n === name);
    if (!who) return this.all();
    who.p = SHIFT_LANES.some((l) => l.id === lane) ? lane : '';
    return this.save(map);
  },

  /** 番号をその人に送りずみか、の印を付け外しする */
  setSent(storeId, name, on) {
    const map = this.all();
    const who = (map[storeId] || []).find((p) => p.n === name);
    if (!who) return this.all();
    who.s = !!on;
    return this.save(map);
  },
};

/* -------- 配達する人のリスト（交通費アプリのプルダウン） --------
 *
 *  クローズの担当者（Staff）とは別物です。
 *  あちらは社員、こちらはバグるのアルバイトなので、混ざらないように
 *  分けてあります。マネージの「交通費」で編集します。
 *
 *  名前を消しても、過去に入れた記録はその名前のまま残ります
 *  （記録の中に名前を書き写しているため）。
 */
const Drivers = {
  _key: APP.storageKey + ':drivers',

  /** 設定で保存されたリスト。未設定・空・壊れている場合は config.js の DRIVERS を使う */
  list() {
    try {
      const saved = JSON.parse(localStorage.getItem(this._key) || 'null');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (e) {
      /* 壊れていたら初期値に戻す */
    }
    return DRIVERS.slice();
  },

  /** 改行区切りの文字列から保存（空行と重複は除く） */
  saveFromText(text) {
    const names = [];
    text.split('\n').forEach((line) => {
      const name = line.trim();
      if (name && !names.includes(name)) names.push(name);
    });
    localStorage.setItem(this._key, JSON.stringify(names));
    return names;
  },
};

/**
 * 店舗ごとの日報フォルダ（マネージで登録）
 *
 *  { 店舗id: 'フォルダのURL' } の形で持ちます。
 *  取り込みのときは、このフォルダの中（と、1つ下の年フォルダの中）から
 *  「年月」で始まるファイルを探します。
 */
/* ------------------------------------------------------------
 *  テスト用の日報（この端末の中だけ）
 *
 *  ★入れておくと、「日報に書く」がこちらへ書きます。
 *    本番の日報を汚さずに、まとめて試すためのものです。
 *  ★わざと同期しません。ほかの端末に広がると、
 *    現場が知らないうちにテスト先へ書いてしまうためです。
 *  ★空にすれば、いつもの本番に戻ります。
 * ---------------------------------------------------------- */
const NippouTest = {
  _key: APP.storageKey + ':nippouTest',
  get() {
    try { return localStorage.getItem(this._key) || ''; } catch (e) { return ''; }
  },
  save(url) {
    const clean = String(url || '').trim();
    try {
      if (clean) localStorage.setItem(this._key, clean);
      else localStorage.removeItem(this._key);
    } catch (e) { /* 入らなくても困りません */ }
    return clean;
  },
};

/**
 * シフトのメモの決まり文句（店舗ごと。マネージで登録します）
 *
 *  シフト表のメモ欄の下に出るボタンです。押すたびにメモへ足す・外すが入れかわります。
 *
 * ★もとは js/config.js に直書きされていて、GitHub Pages で**誰でも読めていました**
 *   （2026年9月7日に設定へ移しました）。中身は**社員の名前**です。
 *   ★このコメントに**実際の名前を書かないでください。**
 *   **config.js には書き戻さないでください。**
 * ★**空の配列も残します。**「ボタンを出さない」という登録だからです。
 *   「まだ登録していない」（キーが無い）とは別のものとして扱います。
 * ★all() は**登録した分だけ**返します。コードに書いてある分をここで重ねると、
 *   「登録した」と「まだ登録していない」が見分けられなくなります。
 *   重ねるのは config.js の shiftMemoTagsOf() の役目です。
 */
const ShiftMemoTags = {
  _key: APP.storageKey + ':shiftMemoTags',

  all() {
    try {
      const saved = JSON.parse(localStorage.getItem(this._key) || 'null');
      if (saved && typeof saved === 'object') return saved;
    } catch (e) {
      /* 壊れていたら初期値に戻す */
    }
    return {};
  },

  /** その店舗の決まり文句。**登録が無ければ null**（空の配列とは別です） */
  get(storeId) {
    const v = this.all()[storeId];
    return Array.isArray(v) ? v : null;
  },

  /** 登録が1つでもあるか */
  any() { return Object.keys(this.all()).length > 0; },

  save(map) {
    const clean = {};
    Object.keys(map || {}).forEach((k) => {
      if (!Array.isArray(map[k])) return;
      clean[k] = map[k].map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
    });
    localStorage.setItem(this._key, JSON.stringify(clean));
    return clean;
  },

  /** 1店舗だけ入れかえます（ほかの店舗の登録はそのまま残します） */
  setFor(storeId, list) {
    if (!storeId) return this.all();
    return this.save({ ...this.all(), [storeId]: Array.isArray(list) ? list : [] });
  },
};

/**
 * 年間の売上目標（店舗ごと。マネージで登録します）
 *
 * ★もとは js/config.js に金額が直書きされていて、GitHub Pages で
 *   **誰でも読めていました**（2026年9月5日に設定へ移しました）。
 *   店舗別の内訳と、そこから足せる合計まで読める状態でした。
 *   ★このコメントに**実際の金額を書かないでください。**『いくら漏れていたか』を
 *     書くと、そのコメント自体がまた漏らします（2026-09-05に一度やりました）。
 *   **config.js には書き戻さないでください。**
 */
const SalesTargets = {
  _key: APP.storageKey + ':salesTargets',

  all() {
    try {
      const saved = JSON.parse(localStorage.getItem(this._key) || 'null');
      if (saved && typeof saved === 'object') return saved;
    } catch (e) {
      /* 壊れていたら空に戻す */
    }
    return { ...SALES_TARGETS };
  },

  get(storeId) { return Number(this.all()[storeId]) || 0; },

  /** 登録が1つでもあるか。無ければ画面に「まだ登録されていません」と出します */
  any() { return Object.keys(this.all()).length > 0; },

  save(map) {
    const clean = {};
    Object.keys(map || {}).forEach((k) => {
      const n = Math.max(Math.round(Number(map[k]) || 0), 0);
      if (n) clean[k] = n;
    });
    localStorage.setItem(this._key, JSON.stringify(clean));
    return clean;
  },
};

const NippouFolders = {
  _key: APP.storageKey + ':nippouFolders',

  all() {
    try {
      const saved = JSON.parse(localStorage.getItem(this._key) || 'null');
      if (saved && typeof saved === 'object') return saved;
    } catch (e) {
      /* 壊れていたら初期値に戻す */
    }
    return { ...NIPPOU_FOLDERS };
  },

  get(storeId) { return this.all()[storeId] || ''; },

  /** フォルダのURLからIDだけ取り出す（URLでもIDでも入れられるように） */
  idOf(storeId) {
    const v = String(this.get(storeId) || '').trim();
    const m = /\/folders\/([a-zA-Z0-9_-]+)/.exec(v);
    return m ? m[1] : v;
  },

  save(map) {
    const clean = {};
    Object.keys(map || {}).forEach((k) => {
      const v = String(map[k] || '').trim();
      if (v) clean[k] = v;
    });
    localStorage.setItem(this._key, JSON.stringify(clean));
    return clean;
  },
};
