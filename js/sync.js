/* ============================================================
 *  共有同期（Google スプレッドシート＋Apps Script）
 *
 *  考え方
 *    ・チェックはこれまでどおり「まず端末内に即保存」。画面はすぐ反応します
 *    ・変更内容は送信箱にためて、裏でまとめてサーバーへ送ります
 *    ・電波が悪い／オフラインでも作業は続けられ、つながったら自動で送信されます
 *
 *  APP.syncUrl が空のあいだは、この機能は丸ごと無効（今までどおり端末内だけ）です。
 * ============================================================ */

/**
 * 設定の、画面に出す呼び名
 *
 * ★`shiftStaff` のような中の名前を、そのまま人に見せないための表です。
 *   ここに無いものは、そのままの名前で出ます（出さないより、ましです）。
 */
function 設定の呼び名(n) {
  const 表 = {
    checklists: 'クローズの項目', weeklies: '週間掃除の項目',
    anytimes: '随時掃除の項目',
    staffList: '担当者リスト', closedDows: '定休日',
    shiftStaff: 'シフトの名簿', salesTargets: '年間の売上目標',
    shiftMemoTags: 'メモの決まり文句',
  };
  return 表[n] || n;
}

const Sync = {
  _outboxKey: APP.storageKey + ':outbox',
  // ★「どこまで同期したか」の印は Store（記録と同じ場所）に置きます。
  //   記録とバラバラの場所にあると、片方だけ端末から消えたときに
  //   「記録は無いのに印は進んだまま」になり、サーバーが何も返さなくなります。
  //   この名前は、古い端末から印を引き継ぐときだけ使います（storage.js の boot）
  _sinceKey: APP.storageKey + ':syncSince',

  /** サーバー側で保存できなかった／上限に近い記録の知らせ */
  serverWarn: '',
  _pinKey: APP.storageKey + ':pin',

  timer: null,
  _loopTimer: null,
  /** いま「今日のクローズ」を見ているか。true のあいだは早く取りに行きます */
  hot: false,
  /**
   * 「ほかの端末が動いている」と分かっているあいだの終わり時刻
   *
   * ★ほかの端末の変更を受け取ったら、しばらく速く取りに行きます。
   *   2人以上で同じ日を見ているときだけ速くなるので、
   *   Apps Script の使える時間はほとんど増えません。
   */
  _busyUntil: 0,
  /** 動いていると見なす長さ（この間は速く取りに行きます） */
  busyMs: 40000,
  running: false,
  /** いま動いている送受信が始まった時刻。固まったのを見つけるために持ちます */
  runningSince: 0,
  /** これだけ待って返事が来なければ、あきらめて next を始めます */
  hangMs: 20000,
  lastError: '',
  lastSyncAt: null,
  // アプリを開いた最初の1回は、設定（項目・担当者・定休日）を丸ごと取り直す。
  // 受け取り位置がずれていても、必ず最新の内容から始められるようにするため。
  _settingsPulled: false,
  onChange: null, // 状態が変わったら呼ばれる（画面更新用）

  /* -------- 有効かどうか -------- */
  enabled() {
    return !!(APP.syncUrl && APP.syncUrl.trim());
  },
  pin() {
    return localStorage.getItem(this._pinKey) || '';
  },
  setPin(pin) {
    localStorage.setItem(this._pinKey, String(pin).trim());
  },
  clearPin() {
    localStorage.removeItem(this._pinKey);
  },

  /* -------- 送信箱 -------- */
  outbox() {
    try {
      const v = JSON.parse(localStorage.getItem(this._outboxKey) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  },
  _saveOutbox(list) {
    localStorage.setItem(this._outboxKey, JSON.stringify(list));
  },

  /**
   * 変更を送信箱に入れる
   *
   * ふだんは少し待ってからまとめて送ります（チェックを連打しても
   * 通信が1回で済むように）。ただし提出のように「すぐ他の人に
   * 見えてほしい」ものは、待たずにその場で送ります。
   */
  enqueue(op, atOnce) {
    if (!this.enabled()) return;
    const list = this.outbox();
    op.at = new Date().toISOString();
    list.push(op);
    this._saveOutbox(list);
    this._notify();
    // ★ここでは「速く取りに行く」を始めません。入れた人は、送るたびに
    //   その返事で最新をもらっているので、別に取りに行く必要がないためです。
    //   速くするのは「ほかの端末の変更が届いた」ときだけにしています
    //   （Apps Script の使える時間を、要るときにだけ使うため）。
    // ★以前は1.5秒ためていました。連打を1回の通信にまとめるためですが、
    //   1つ入れて画面を閉じるまでが1.5秒より短いことがあり、届かないことが
    //   ありました。0.6秒でも連打はまとまるので、こちらを短くしています。
    this.scheduleFlush(atOnce ? 0 : 600);
  },

  scheduleFlush(delay) {
    if (!this.enabled()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), delay);
  },

  /* -------- 送受信 -------- */
  async flush() {
    if (!this.enabled()) return;
    if (!this.pin()) return; // PIN未入力のあいだは送らない

    // ★前の送受信が終わっていないときは重ねません。
    //   ただし、電波が切れた拍子に返事が返ってこないまま固まることがあります。
    //   そのままにすると「running のまま」で二度と同期しなくなるので、
    //   長く待たされているものは、あきらめて次を始めます
    if (this.running) {
      const stuck = this.runningSince && (Date.now() - this.runningSince > this.hangMs);
      if (!stuck) return;
      this.lastError = '前の同期が返ってこなかったので、やり直します';
    }

    this.running = true;
    this.runningSince = Date.now();
    this._notify();

    const sending = this.outbox();
    const ops = this._withSummaries(sending);

    try {
      // 返事が返ってこないまま止まらないよう、時間を切ります。
      // iPhone はアプリを裏に回した拍子に、通信が返ってこないことがあります
      const stop = new AbortController();
      const timer = setTimeout(() => stop.abort(), this.hangMs);
      const body = JSON.stringify({
        pin: this.pin(),
        action: 'sync',
        since: Store.meta('since') || '',
        settingsAll: !this._settingsPulled,
        ops,
      });
      const res = await fetch(APP.syncUrl, {
        method: 'POST',
        signal: stop.signal,
        // ★アプリを閉じても、送りかけたものを最後まで送り切ってもらいます。
        //   これが無いと「チェックしてすぐ閉じた」ときに届きませんでした。
        //   64KBまでという決まりがあるので、大きいときは付けません
        //   （設定をまるごと送るときだけ大きくなります）
        //   ★文字数ではなく中身の大きさで見ます。日本語は1文字3バイトあるので、
        //     文字数で見ると64KBを超えていても通してしまいます
        keepalive: new Blob([body]).size < 60000,
        // text/plain にしないと CORS の事前確認が入り、Apps Script が応答できません
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
      });
      clearTimeout(timer);
      const json = await res.json();

      if (!json.ok) {
        this.lastError = json.error || '同期に失敗しました';
        // ロック中はPINを消さない（正しいPINを持っている人まで締め出さないため）
        if (json.code === 'bad_pin' || json.code === 'no_pin') this.clearPin();
        // 管理用PINが要る操作が現場アプリの送信箱に紛れ込んだ場合、
        // 何度送っても通らず、以降の同期が止まってしまう。捨てて先へ進む。
        if (json.code === 'need_admin') this._dropAdminOps(sending);
        return;
      }

      // 送れた分だけ送信箱から取り除く（送信中に増えた分は残す）
      const rest = this.outbox().slice(sending.length);
      this._saveOutbox(rest);

      // ほかの端末の変更が届いたなら、しばらく速く取りに行きます。
      // ★間隔を取り直さないと、次に取りに行くのが60秒後のままになります
      if ((json.records || []).length) {
        this._busyUntil = Date.now() + this.busyMs;
        this._loop();
      }

      this._applyPulled(json.records || [], json.settings);
      Store.setMeta('since', json.now || '');
      // シートに保存できなかった記録があれば、画面の帯に出します
      this.serverWarn = json.warn || '';
      this._settingsPulled = true;
      this.lastSyncAt = new Date();
      this.lastError = '';
      if (typeof render === 'function') render();
    } catch (e) {
      this.lastError = 'オフライン、または通信できません';
    } finally {
      this.running = false;
      this.runningSince = 0;
      this._notify();
      // ★送っているあいだに増えた分は、すぐ続けて送ります。
      //   前は成功していても15秒待っていたので、連続でチェックを入れると
      //   最後の何件かが15秒遅れて届いていました。
      //   送れなかったとき（エラー）だけ、間を空けて送り直します。
      if (this.outbox().length) this.scheduleFlush(this.lastError ? 15000 : 700);
    }
  },

  /**
   * いますぐ送る（待ち時間なし）
   *
   * アプリを裏に回したときと閉じるときに呼びます。
   * ためている分をその場で送り出すためのものです。
   */
  flushNow() {
    clearTimeout(this.timer);
    if (this.outbox().length) this.flush();
  },

  /**
   * 送信箱が空になるまで待つ
   *
   * ★提出のように「みんなに届いたことを見せたい」ものだけで使います。
   *   ふだんのチェックは、待たせずに裏で送ります。
   * 返り値 { ok, error }
   */
  async waitSent(ms = 15000) {
    if (!this.enabled()) return { ok: true, error: '' };
    if (!this.pin()) return { ok: false, error: 'PINが入っていません' };

    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (!this.outbox().length) return { ok: true, error: '' };
      if (this.running) {
        await new Promise((r) => setTimeout(r, 200));
      } else {
        clearTimeout(this.timer);
        await this.flush();
      }
      if (!this.outbox().length) return { ok: true, error: '' };
      if (this.lastError) return { ok: false, error: this.lastError };
    }
    return { ok: false, error: this.lastError || '送るのに時間がかかっています' };
  },

  /** 管理用PINが要る操作を送信箱から取り除く（現場アプリが詰まらないように）
   *
   * ★一覧は `js/config.js` の `ADMIN_SETTINGS` 1か所だけです。
   *   ここに手で並べてはいけません。**GASに足してこちらに足し忘れると、
   *   その設定を送った端末の同期が、ずっと赤いまま止まります**（2026-09-07）。
   */
  _dropAdminOps(送った) {
    const admin = typeof ADMIN_SETTINGS !== 'undefined' ? ADMIN_SETTINGS : [];
    let あたる = (op) => op.t === 'setting' && admin.includes(op.n);

    // ★一覧に当たるものが1つも無いのに断られたときは、**送った設定を全部捨てます。**
    //
    //   一覧はアプリとGASの2か所にあります。**片方だけ新しい時間**が必ずできます
    //   （アプリを公開してから、GASを貼るまでのあいだ）。そのとき
    //   GASは断るのにアプリは「捨てるものが無い」と思い、**永久に詰まります。**
    //   2026-09-07、`shiftStaff` を外したときに実際にこの窓が開きました。
    //   ★一覧が合っているかに関わらず、**断られたら詰まらせない**を優先します。
    if (!this.outbox().some(あたる)) {
      const 送った設定 = new Set((送った || [])
        .filter((op) => op.t === 'setting').map((op) => op.n));
      if (送った設定.size) あたる = (op) => op.t === 'setting' && 送った設定.has(op.n);
    }

    const 捨てる = this.outbox().filter(あたる);
    const rest = this.outbox().filter((op) => !あたる(op));
    this._saveOutbox(rest);
    // ★捨てたことを黙っていてはいけません。
    //   捨てたあと、次に取り込んだサーバーの分で**画面が元に戻ります。**
    //   赤い帯も出ないので、直した人は「保存された」と思ったまま消えます
    //   （2026-09-07、シフトが名簿で実地に見つけました）。
    //   ★詰まりは外すが、**外したことは言う。**
    if (捨てる.length) {
      const 名 = [...new Set(捨てる.map((op) => 設定の呼び名(op.n)))].join('・');
      this.lastError = `${名}は、この端末では保存できません`
        + '（管理用のPINが要ります）。直した分は元に戻ります。';
    }
  },

  /** いま覚えているPINが管理用かどうかを確かめる（管理アプリで使います） */
  async probeAdmin() {
    try {
      const res = await fetch(APP.syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ pin: this.pin(), action: 'ping' }),
      });
      const json = await res.json();
      if (!json.ok) return { admin: false, error: json.error || '' };
      return { admin: !!json.admin, error: '' };
    } catch (e) {
      return { admin: false, error: '通信できませんでした。電波の良いところでもう一度お試しください。' };
    }
  },

  /**
   * 同期とは別の頼みごとを1回だけ送ります（いまは日報の取り込みだけ）。
   * 送信箱は通さないので、失敗しても後から勝手に送り直したりはしません。
   */
  /** 返事を待つ上限。写真の読み取りは5〜8秒かかるので、長めに取ります */
  askMs: 60000,

  async ask(action, extra = {}) {
    if (!this.enabled()) return { ok: false, error: '共有の設定がされていません' };
    if (!this.pin()) return { ok: false, error: 'PINが入っていません' };
    // ★時間切れを入れます。これが無いと、サーバーが詰まったときに
    //   いつまでも待たされ、しかも「オフライン」と出て原因を取りちがえます
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), this.askMs);
    try {
      const res = await fetch(APP.syncUrl, {
        method: 'POST',
        signal: stop.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ pin: this.pin(), action, ...extra }),
      });
      return await res.json();
    } catch (e) {
      // 電波が無いのか、サーバーが返さないのかで、やることが違います
      const off = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (off) return { ok: false, error: '電波が届いていません。つながるところでもう一度ためしてください' };
      const late = e && e.name === 'AbortError';
      return {
        ok: false,
        error: late
          ? `サーバーが${Math.round(this.askMs / 1000)}秒たっても返事をしません。混み合っていることがあるので、少し待ってからもう一度押してください`
          : 'サーバーにつながりません。少し待ってからもう一度押してください',
      };
    } finally {
      clearTimeout(timer);
    }
  },

  /** 送る操作に、提出記録シート用のまとめを添える */
  _withSummaries(ops) {
    const keys = [...new Set(ops.filter((o) => o.k).map((o) => o.k))];
    const extra = keys.map((k) => ({ t: 'summary', k, v: summaryFor(k) })).filter((o) => o.v);
    return ops.concat(extra);
  },

  /** サーバーから届いた内容を端末に取り込む */
  _applyPulled(records, settings) {
    if (records.length) {
      // ★書き先は Store.adapter です。LocalAdapter を名指しにすると、
      //   保存先が IndexedDB に変わったときに、
      //   ほかの端末から届いた変更だけ別の場所へ入り、画面に出なくなります
      const all = Store.adapter.dump();
      records.forEach((row) => {
        all[row.k] = row.r;
      });
      Store.adapter.load(all);

      // まだ送っていない自分の変更は、取り込んだ内容の上に貼り直す
      this.outbox().forEach((op) => {
        if (!op.k) return;
        const rec = Store.getDay(...op.k.split('/'));
        if (op.t === 'item') rec.items[op.i] = op.v;
        else if (op.t === 'staff') rec.staff = op.v;
        else if (op.t === 'note') rec.note = op.v;
        else if (op.t === 'submit') { rec.submittedAt = op.v.submittedAt; rec.submittedBy = op.v.submittedBy; }
        else if (op.t === 'unsubmit') { rec.submittedAt = null; rec.submittedBy = ''; }
        Store.adapter.set(op.k, rec);
      });
    }
    if (settings) try {
      // ★設定の入れ先。**1つの表にしておきます。**
      //   「サーバーから入れる」と「まだ送っていない分を貼り直す」で
      //   一覧が別々だと、次に設定を足した人が片方を書き忘れ、
      //   その設定だけ静かに消えるようになります
      const 設定の入れ先 = {
        checklists: Checklists._key,
        weeklies: Weeklies._key,
        anytimes: Anytimes._key,
        staffList: Staff._key,
        drivers: Drivers._key,
        catchStaff: CatchStaff._key,
        shiftStaff: ShiftStaff._key,
        trainees: Trainees._key,
        trainings: Trainings._key,
        nippouFolders: NippouFolders._key,
        salesTargets: SalesTargets._key,
        shiftMemoTags: ShiftMemoTags._key,
        closedDows: Closed._dowsKey,
        closedExceptions: Closed._exKey,
      };
      Object.keys(設定の入れ先).forEach((n) => {
        if (settings[n]) localStorage.setItem(設定の入れ先[n], JSON.stringify(settings[n]));
      });

      // ★まだ送っていない設定は、取り込んだ内容の上に貼り直します。
      //   記録（records）はすぐ上で同じことをしていますが、設定は op.k を
      //   持たないので、その貼り直しから**外れていました**。
      //   返事を待つあいだに選んだ持ち場が消え、しかも消えた状態から
      //   作り直すので**送り直しても戻りませんでした**（2026-09-05に直しました）。
      //   ここは持ち場だけの話ではありません。担当者・配達する人・キャッチ・
      //   教育・日報フォルダ・定休日も同じ道を通ります
      this.outbox().forEach((op) => {
        if (op.t !== 'setting') return;
        const 箱 = 設定の入れ先[op.n];
        if (箱) localStorage.setItem(箱, JSON.stringify(op.v));
      });
    } catch (e) {
      // 設定はまだ localStorage に置いています。ここが満杯でも黙って落とさず知らせます
      storeFail('設定を端末に保存できませんでした', e);
    }
  },

  /**
   * ヘッダーのしるしに入れる絵（文字は出しません）
   *
   *   ok      … ✓  送り終わっている
   *   busy    … ぐるぐる  いま送っている（css でゆっくり回ります）
   *   pending … ↑  まだ送っていない分がある
   *   error   … !  送れていない／PIN未入力
   *
   * 色だけで見分けさせると、色の見え方が違う人には伝わりません。
   * かならず「形」も変えてあります。
   */
  iconSvg(kind) {
    const path = {
      ok: '<path d="M5 10.6l3.4 3.4L15.2 6.6"/>',
      busy: '<path d="M16.2 10a6.2 6.2 0 1 1-1.8-4.4"/><path d="M16.4 3.9v3.5h-3.5"/>',
      pending: '<path d="M10 15.6V5.2"/><path d="M5.8 9.4L10 5.2l4.2 4.2"/>',
      error: '<path d="M10 5.2v6.1"/><circle cx="10" cy="14.7" r="1.15" fill="currentColor" stroke="none"/>',
    }[kind] || '';
    return '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" '
      + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
  },

  /**
   * 設定画面に出す「しるしの見かた」
   *
   * ヘッダーの丸いしるしが何を表しているか、実物と同じ絵で並べます。
   * 色だけでなく形も違うので、色の見え方が違う人にも伝わります。
   */
  legendHtml() {
    const rows = [
      ['ok', '同期できています', '入力した内容が、みんなの端末に届いています'],
      ['busy', '送っています', '少し待つと ✓ に変わります'],
      ['pending', 'まだ送れていない分があります', 'つながり次第、自動で送られます。入力した内容が消えることはありません'],
      ['error', '送れていません', '電波を確かめてください。それでも赤いままなら「PINを入れ直す」を試してください'],
    ];
    return rows.map(([kind, name, desc]) =>
      '<li class="sync-legend__row">'
      + `<span class="sync-chip sync-chip--${kind}">${this.iconSvg(kind)}</span>`
      + '<span class="sync-legend__text">'
      + `<span class="sync-legend__name">${name}</span>`
      + `<span class="sync-legend__desc">${desc}</span>`
      + '</span></li>'
    ).join('');
  },

  /** 画面に出す状態 */
  status() {
    if (!this.enabled()) return { kind: 'off', text: '' };
    if (!this.pin()) return { kind: 'error', text: 'PIN未入力' };
    if (this.running) return { kind: 'busy', text: '同期中…' };
    const n = this.outbox().length;
    if (this.lastError) return { kind: 'error', text: n ? `未送信 ${n}件` : '同期エラー' };
    if (n) return { kind: 'pending', text: `未送信 ${n}件` };
    return { kind: 'ok', text: '同期済み' };
  },

  _notify() {
    if (typeof this.onChange === 'function') this.onChange();
  },

  /* -------- 起動 -------- */
  start() {
    if (!this.enabled() || this._started) return;
    this._started = true;
    window.addEventListener('online', () => this.scheduleFlush(500));
    document.addEventListener('visibilitychange', () => {
      // ★裏に回るとき（ホームに戻る・別のアプリに移る）に、ためている分を
      //   その場で送り出します。ここが無いと、チェックしてすぐ閉じた分が
      //   次にアプリを開くまで誰にも見えませんでした。
      if (document.hidden) this.flushNow();
      else this.scheduleFlush(300);
      this._loop();   // 表に戻ったら、間隔を取り直します
    });
    // 閉じるとき。iPhone では visibilitychange が来ないこともあるので両方見ます
    window.addEventListener('pagehide', () => this.flushNow());
    this._loop();
    this.scheduleFlush(300);
  },

  /**
   * 取りに行く間隔を、見ている画面に合わせて変える
   *
   *   ほかの端末が動いている     … 3秒おき（最後に届いてから40秒だけ）
   *   今日のクローズを開いている … 8秒おき（誰かの提出がすぐ出ます）
   *   ほかの画面              … 60秒おき
   *   アプリが裏にいる         … 取りに行かない
   *
   * ★ずっと3秒おきにはしません。Apps Script には1日に動かせる
   *   時間の上限があり、6店舗分の端末が始終聞きに行くと、
   *   夕方には上限に達して**誰も同期できなくなります**。
   *   「ほかの端末がいま入力している」あいだだけ速くする、という配り方です。
   *   1つの端末で closing をしているだけなら速くならないので、
   *   使う時間はほとんど増えません。
   */
  _loop() {
    clearTimeout(this._loopTimer);
    const busy = Date.now() < this._busyUntil;
    const wait = document.hidden ? 30000 : busy ? 3000 : (this.hot ? 8000 : 60000);
    this._loopTimer = setTimeout(() => {
      if (!document.hidden) this.flush();
      this._loop();
    }, wait);
  },
};

/** 提出記録シートに書くためのまとめ（キーは 'storeId/YYYY-MM-DD'） */
function summaryFor(key) {
  const [storeId, dateStr] = key.split('/');
  const store = getStore(storeId);
  if (!store || !dateStr) return null;
  // 週間掃除（storeId/W2026-08-02）と随時掃除（storeId/ANYTIME）は
  // 日別の提出記録シートには出しません（記録そのものは同じように同期されます）
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

  const [y, m, d] = dateStr.split('-').map(Number);
  const rec = Store.getDay(storeId, dateStr);
  const base = { date: dateStr, storeName: store.name };

  if (Closed.isClosed(storeId, y, m, d)) return { ...base, closed: true };

  const items = getChecklist(storeId)
    .flatMap((sec) => sec.items.filter((it) => appliesTo(it, store, y, m, d, sec)));
  const missing = items.filter((it) => !rec.items?.[it.id]?.done).map((it) => it.label);

  return { ...base, closed: false, total: items.length, done: items.length - missing.length, missing };
}

/* ============================================================
 *  Store / 設定の変更を横取りして送信箱に積む
 *  （app.js 側は今までどおり呼ぶだけでよくなります）
 * ============================================================ */
(function hookStore() {
  const key = (s, d) => `${s}/${d}`;

  const _setItem = Store.setItem.bind(Store);
  Store.setItem = function (storeId, dateStr, itemId, patch) {
    const next = _setItem(storeId, dateStr, itemId, patch);
    Sync.enqueue({ t: 'item', k: key(storeId, dateStr), i: itemId, v: next });
    return next;
  };

  const _setStaff = Store.setStaff.bind(Store);
  Store.setStaff = function (storeId, dateStr, name) {
    _setStaff(storeId, dateStr, name);
    Sync.enqueue({ t: 'staff', k: key(storeId, dateStr), v: name, by: name });
  };

  const _setNote = Store.setNote.bind(Store);
  Store.setNote = function (storeId, dateStr, note) {
    _setNote(storeId, dateStr, note);
    Sync.enqueue({ t: 'note', k: key(storeId, dateStr), v: note });
  };

  const _submit = Store.submit.bind(Store);
  Store.submit = function (storeId, dateStr) {
    const rec = _submit(storeId, dateStr);
    // ★提出は待たずにすぐ送ります。ここで1.5秒ためると、
    //   押した直後にアプリを閉じられたときに届かないことがあります
    Sync.enqueue({
      t: 'submit', k: key(storeId, dateStr),
      v: { submittedAt: rec.submittedAt, submittedBy: rec.submittedBy }, by: rec.submittedBy,
    }, true);
    return rec;
  };

  const _unsubmit = Store.unsubmit.bind(Store);
  Store.unsubmit = function (storeId, dateStr) {
    const rec = _unsubmit(storeId, dateStr);
    Sync.enqueue({ t: 'unsubmit', k: key(storeId, dateStr) }, true);
    return rec;
  };

  const _saveChecklist = Checklists.save.bind(Checklists);
  Checklists.save = function (storeId, sections) {
    const all = _saveChecklist(storeId, sections);
    Sync.enqueue({ t: 'setting', n: 'checklists', v: all });
    return all;
  };

  const _saveAnytime = Anytimes.save.bind(Anytimes);
  Anytimes.save = function (storeId, items) {
    const all = _saveAnytime(storeId, items);
    Sync.enqueue({ t: 'setting', n: 'anytimes', v: all });
    return all;
  };

  const _saveWeekly = Weeklies.save.bind(Weeklies);
  Weeklies.save = function (storeId, items) {
    const all = _saveWeekly(storeId, items);
    Sync.enqueue({ t: 'setting', n: 'weeklies', v: all });
    return all;
  };

  const _saveStaff = Staff.saveFromText.bind(Staff);
  Staff.saveFromText = function (text) {
    const names = _saveStaff(text);
    Sync.enqueue({ t: 'setting', n: 'staffList', v: names });
    return names;
  };

  const _saveDrivers = Drivers.saveFromText.bind(Drivers);
  Drivers.saveFromText = function (text) {
    const names = _saveDrivers(text);
    Sync.enqueue({ t: 'setting', n: 'drivers', v: names });
    return names;
  };

  const _saveCatch = CatchStaff.save.bind(CatchStaff);
  CatchStaff.save = function (map) {
    const clean = _saveCatch(map);
    Sync.enqueue({ t: 'setting', n: 'catchStaff', v: clean });
    return clean;
  };

  const _saveTrainings = Trainings.save.bind(Trainings);
  Trainings.save = function (storeId, sections) {
    const all = _saveTrainings(storeId, sections);
    Sync.enqueue({ t: 'setting', n: 'trainings', v: all });
    return all;
  };

  // ★教育の名前は管理用PINが要りません（各店舗で入れるものなので）
  const _saveTrainees = Trainees.save.bind(Trainees);
  Trainees.save = function (storeId, people) {
    const all = _saveTrainees(storeId, people);
    Sync.enqueue({ t: 'setting', n: 'trainees', v: all });
    return all;
  };

  const _saveShiftStaff = ShiftStaff.save.bind(ShiftStaff);
  ShiftStaff.save = function (map) {
    const clean = _saveShiftStaff(map);
    Sync.enqueue({ t: 'setting', n: 'shiftStaff', v: clean });
    return clean;
  };

  const _saveNippou = NippouFolders.save.bind(NippouFolders);
  NippouFolders.save = function (map) {
    const clean = _saveNippou(map);
    Sync.enqueue({ t: 'setting', n: 'nippouFolders', v: clean });
    return clean;
  };

  // ★年間の売上目標。公開物（js/config.js）から外したので、ここから同期に乗せます。
  //   店舗ごとの金額はスプレッドシート側（非公開）に入ります（2026-09-05）
  const _saveTargets = SalesTargets.save.bind(SalesTargets);
  SalesTargets.save = function (map) {
    const clean = _saveTargets(map);
    Sync.enqueue({ t: 'setting', n: 'salesTargets', v: clean });
    return clean;
  };

  // ★シフトのメモの決まり文句。中身は社員の名前なので、公開物（js/config.js）から
  //   外してここから同期に乗せます（2026-09-07）
  const _saveMemoTags = ShiftMemoTags.save.bind(ShiftMemoTags);
  ShiftMemoTags.save = function (map) {
    const clean = _saveMemoTags(map);
    Sync.enqueue({ t: 'setting', n: 'shiftMemoTags', v: clean });
    return clean;
  };

  const _setDows = Closed.setDows.bind(Closed);
  Closed.setDows = function (storeId, dows) {
    _setDows(storeId, dows);
    Sync.enqueue({ t: 'setting', n: 'closedDows', v: Closed._read(Closed._dowsKey) });
  };

  const _setException = Closed.setException.bind(Closed);
  Closed.setException = function (storeId, dateStr, kind) {
    _setException(storeId, dateStr, kind);
    Sync.enqueue({ t: 'setting', n: 'closedExceptions', v: Closed._read(Closed._exKey) });
  };
})();
