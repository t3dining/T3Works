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
    staffAccounts: '社員のアカウント',
    shiftMemoTags: 'メモの決まり文句',
  };
  return 表[n] || n;
}

/**
 * 送れなかった理由を、人に言える言葉にします
 *
 * ★**赤の理由は3つあって、やることが全部ちがいます。**
 *     電波が無い     … 待つ（勝手に送られます）
 *     返事が来ない   … サーバーが混んでいます。**電波の問題ではありません**
 *     つながらない   … 設定かサーバーの不調
 *   ひとまとめに「オフライン、または通信できません」と出していたので、
 *   **どれなのか誰にも分かりませんでした。**
 *   ★1か所に置きます。`flush()` と `ask()` の両方から使います。
 */
/* ★4つに分けます（2026-09-15 まで3つでした）。
     「渡す口」… Google がスクリプトの結果を渡す段（script.googleusercontent.com）で止まり、
     JSON でない返事（404 のページなど）を返したとき。★**スクリプトは終わっています。**
     Apps Script の「実行数」で裏を取りました：端末が23回続けて赤だった 9/14 20:25〜20:41 の
     実行は**全部 2〜4秒で完了**。落ちているのはその後の「渡す段」で、こちらのコードの外です。
     送り直せば通ることが多いので、赤にせず静かに送り直します（`flush()` の finally）。
     2026-09-15 までこれは「つながらない」に混ざっていて、電波の話と見分けがつきませんでした */
function この失敗のたぐい(e) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return '電波なし';
  if (e && e.name === 'AbortError') return '返事なし';
  if (e && e.name === '渡す口') return '渡す口';
  return 'つながらない';
}

function この失敗はなにか(e, 上限ms) {
  const たぐい = この失敗のたぐい(e);
  if (たぐい === '電波なし') {
    return '電波が届いていません。つながれば自動で送られます（入力は消えません）';
  }
  if (たぐい === '返事なし') {
    // ★`**` のような飾りは書きません。画面は textContent で出すので、そのまま文字になります
    return `サーバーが${Math.round(上限ms / 1000)}秒たっても返事をしません。`
      + '混み合っているだけで、電波の問題ではありません。少し待つと自動で送り直します';
  }
  if (たぐい === '渡す口') {
    return 'Google 側で結果を受け取れませんでした。電波の問題ではありません。'
      + '自動で送り直します（入力は消えません）';
  }
  return 'サーバーにつながりません。少し待つと自動で送り直します';
}

/**
 * 返事を JSON として読む
 *
 * ★JSON でなければ「渡す口」の失敗にします。`res.json()` に任せると SyntaxError になり、
 *   `この失敗のたぐい()` が「つながらない」と読みます（2026-09-15 までそうでした）。
 *   HTTP の番号（404 など）も持たせて、記録に残します。
 */
/** 端末の日付を 'YYYY-MM-DD' にします（静かに通った回数を日ごとに数えるため） */
function 日付の文字(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function 返事を読む(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    const err = new Error(`Google の返事が JSON ではありません（HTTP ${res.status}）`);
    err.name = '渡す口';
    err.status = res.status;
    throw err;
  }
}

const Sync = {
  _outboxKey: APP.storageKey + ':outbox',
  /* ★赤になった記録。**この端末の分だけ**です。
       2026-09-14、ko-dai さんに「赤が出たら文を教えてください」と頼みましたが、
       ★**赤は次の同期が通った瞬間に消えます。**同じ晩に測ったところ、11回のうち
       10回は1.4〜3.2秒で、**52秒が1回**でした。つまり跳ねるのは**ときどき**で、
       **その瞬間に画面を見ていないと捕まりません。**人に見張らせる形がまちがいでした。
       ★だから端末に残します。あとから設定画面で読めます。 */
  _logKey: APP.storageKey + ':syncLog',
  /** 残す件数。多くしても読みません。古いものから落とします */
  logMax: 20,
  /* ★静かに送り直して通った回数（日ごと）。赤くなった記録には載せません。
       「赤が減ったか」と「Google の渡す口がどれだけ落ちているか」を別々に読むためのものです */
  _quietKey: APP.storageKey + ':syncQuiet',
  // ★「どこまで同期したか」の印は Store（記録と同じ場所）に置きます。
  //   記録とバラバラの場所にあると、片方だけ端末から消えたときに
  //   「記録は無いのに印は進んだまま」になり、サーバーが何も返さなくなります。
  //   この名前は、古い端末から印を引き継ぐときだけ使います（storage.js の boot）
  _sinceKey: APP.storageKey + ':syncSince',

  /** サーバー側で保存できなかった／上限に近い記録の知らせ */
  serverWarn: '',
  _pinKey: APP.storageKey + ':pin',
  // ★自分の番号と、自分の名前だけを持ちます。**名簿は持ちません**
  //   （名簿を配ると、6店舗の端末に全員分の合言葉の写しが置かれます）
  _codeKey: APP.storageKey + ':staffCode',
  _nameKey: APP.storageKey + ':staffName',

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
  /** 閉じかけ・裏にいるあいだか。true のあいだは、失敗を記録しません */
  _とじかけ: false,
  running: false,
  /** いま動いている送受信が始まった時刻。固まったのを見つけるために持ちます */
  runningSince: 0,
  /**
   * これだけ待って返事が来なければ、あきらめます
   *
   * ★**サーバーの順番待ちより長くすること。**
   *   `gas/コード.gs` は `lock.tryLock(25000)` で、混んでいると
   *   **25秒まで順番を待ちます。**ここが 20000 だったので、
   *   **サーバーが仕事を始める前にアプリが切っていました。**
   *   切ったあともサーバーは書き込みを終えるので、
   *   **保存はできているのにボタンだけ赤**になっていました（2026-09-13）。
   *   数を動かすときは、必ず `コード.gs` の `tryLock` と一緒に見ること。
   */
  hangMs: 35000,
  /**
   * 読むだけの同期（送るものが無いとき）の上限
   *
   * ★2026-09-15 から、読むだけの同期はサーバーで鍵を取りません（`gas/コード.gs`）。
   *   だから25秒の順番待ちは無く、スクリプトは2〜4秒で終わります。それより長いのは
   *   Google が結果を渡す段が止まっているときで、待つより送り直す方が早く通ります。
   */
  readHangMs: 20000,
  lastError: '',
  lastSyncAt: null,
  /**
   * 続けて失敗した回数と、静かに送り直している最中か
   *
   * ★赤にする前に、3秒→6秒→12秒で3回、静かに送り直します（`静かな間`）。
   *   Google が結果を渡す段の失敗（渡す口）は、送り直せば通ることが多いからです。
   *
   * ★**送り直してよい理由は2つあって、成り立つ場面がちがいます。**
   *     ① 渡す口（404）… **スクリプトはもう終わっています。**送り直しても仕事は増えません。
   *        ★これは404のときだけ言えることです
   *     ② 返事なし（時間切れ）… **スクリプトはまだ動いているかもしれません。**
   *        こちらの fetch をやめても、向こうは止まりません。送り直すと**同じ仕事が2つ走ります。**
   *        それでも困らないのは、**ここで送るものが「この値にする」形（足し算ではない）**だからです。
   *        同じ値を2回書いても結果は同じで、**お金のかかる外への呼び出しもありません**
   *        （`gas/コード.gs` の `doPost` には UrlFetchApp も MailApp もありません。2026-09-16 に数えました）。
   *
   * ★**②の理由を、よそへ持っていかないこと。**2026-09-16、ジャーナルが日報の送り直しに
   *   ①の一文をコメントごと借りていき、**時間切れにも当てはめました。**写真の読み取りは
   *   Cloud Vision が1枚ずつ数えるので、3回送り直すと**1枚の写真が4枚**になります（月1000枚の枠）。
   *   気づいて直してくれましたが、**借りてきた理由は、借りてきた場面でしか成り立ちません。**
   *   送り直しを足す前に、**「同じ仕事が2つ走っても困らないか」をその場で数えること。**
   * ★電波が無いとき、PIN・番号・権限で断られたときは、送り直しても同じなので静かにしません。
   * ★4回目からは赤にして、今までどおり15秒おき（送信箱があるとき）に戻します。
   * ★赤くなった記録に書くのも、赤になったときだけです（`_保留` を見てください）。
   */
  _fails: 0,
  _quiet: false,
  静かな間: [3000, 6000, 12000],
  /** 直前の失敗が、送り直せば通るたぐいか（finally が見ます） */
  _送り直せる: false,
  /**
   * まだ記録に書いていない失敗（静かに送り直している最中の分）
   *
   * ★失敗はまずここにためます。**赤くなった記録に書くのは、赤になったときだけ**です。
   *   静かに送り直して通れば、日ごとの回数（`_quietKey`）に足すだけで、記録には残しません。
   *   2026-09-16 の朝、静かに通った1件が「赤くなった記録」に並んでいて、
   *   **赤くなった回数が減ったのかを読めなくなっていました。**
   */
  _保留: [],
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
  /** 自分の番号（PINのあとに入れるもの）。まだ入れていなければ空 */
  code() {
    return localStorage.getItem(this._codeKey) || '';
  },
  setCode(code) {
    localStorage.setItem(this._codeKey, String(code).trim());
  },
  clearCode() {
    localStorage.removeItem(this._codeKey);
    localStorage.removeItem(this._nameKey);
  },
  /** サーバーが「あなたは誰か」と返してきた名前。ヘッダーに出すだけに使います */
  myName() {
    return localStorage.getItem(this._nameKey) || '';
  },
  /**
   * サーバーの返事から、自分の名前を覚えます（判定はサーバーがしています）
   *
   * ★**通ったのに「誰か」が無いときは、覚えていた名前を消します**（2026-09-16）。
   *   番号が無いか、登録されていない番号です。前は足すだけで消さなかったので、
   *   一度正しく入れた端末で違う番号を入れ直すと、**前の人の名前がヘッダーに残りました**
   *   （マニュアル部署の報告）。使い方の「名前が出ていれば正しく入っています」が崩れていました。
   * ★呼ぶのは `ok` の返事のときだけです。サーバーは ok のとき、番号が合っていれば必ず `who` を付けます。
   */
  _rememberWho(json) {
    if (!json || !json.ok) return;
    if (json.who && json.who.name) {
      localStorage.setItem(this._nameKey, String(json.who.name));
    } else {
      localStorage.removeItem(this._nameKey);
    }
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

  /* -------- 赤になった記録 -------- */
  /** 新しい順に返します */
  log() {
    try {
      const v = JSON.parse(localStorage.getItem(this._logKey) || '[]');
      return Array.isArray(v) ? v.slice().reverse() : [];
    } catch (e) {
      return [];
    }
  },
  /**
   * 1件ためます（記録に書くのは赤になったときです。`_保留` を見てください）
   *
   * ★`たぐい` は短い見出し（電波なし／返事なし／つながらない／サーバーが断った）。
   *   `ms` は、あきらめるまでに何秒待ったか。**35秒なら時間切れ**と分かります。
   * ★ここが落ちても同期は止めません。記録は本体ではありません
   */
  _noteFail(たぐい, 文, ms, 番号) {
    /* ★閉じかけ・読み直しの最中は記録しません。
         2026-09-14 の1件目がこれでした。00:52 に新しい版を出し、00:59 に
         ko-dai さんが「更新する」を押したところ、**送りかけていた通信が
         ページの終わりで切られ**、「つながらない 13秒」として残りました。
         **サーバーは何も悪くありません。**
       ★ここを放っておくと、**アプリを閉じるたび・更新するたびに1件たまります。**
         見張りが雑音で埋まると、本物の1件が読めなくなります。今日ずっと直してきた形です。
       ★裏に回ったときも同じです。そのとき出ている通信は `flushNow()` の送り切りで、
         **画面が消えたせいで失敗したもの**です。裏では取りに行かないので（`_loop`）、
         ここで落ちるのはそれだけです。**表に戻したら、また記録します。**
       ★`document.hidden` を**直に見てはいけません。**
         はじめそう書いたら、**確認用ブラウザが裏にいるだけで1件も記録されません**でした。
         「たまたま裏だった」と「閉じた」を取りちがえて、**見張りごと黙ります。**
         印（`_とじかけ`）を自分で立てて、**表に戻したら自分で下ろします。** */
    if (this._とじかけ) return;
    // ★`s` は HTTP の番号（渡す口のときだけ。404 なら Google の「ファイルを開くことができません」）
    this._保留.push({ at: new Date().toISOString(), k: たぐい, t: 文, ms: ms || 0, n: 1, s: 番号 || 0 });
  },
  /** ためていた失敗を、赤くなった記録に書きます（赤になったとき。`flush()` の finally） */
  _記録に残す(失敗たち) {
    if (!失敗たち.length) return;
    try {
      const list = this.log().reverse();
      失敗たち.forEach((f) => {
        const 前 = list[list.length - 1];
        // ★同じ理由が続けて出たときは、件数を足すだけにします。
        //   15秒おきに送り直すので、そのままだと同じ行で20件が埋まります
        if (前 && 前.k === f.k && new Date(f.at).getTime() - new Date(前.at).getTime() < 10 * 60 * 1000) {
          前.n = (前.n || 1) + (f.n || 1);
          前.at = f.at;
          if (f.ms) 前.ms = Math.max(前.ms || 0, f.ms);
          if (f.s) 前.s = f.s;
        } else {
          list.push(f);
        }
      });
      localStorage.setItem(this._logKey, JSON.stringify(list.slice(-this.logMax)));
    } catch (e) { /* 記録できなくても、同期は続けます */ }
  },
  /**
   * ためていた失敗を「静かに送り直して通った分」に数えます（通ったとき。`flush()` の finally）
   *
   * ★日ごとの回数だけです。何が落ちたかは残しません（残すと赤くなった記録と同じ雑音になります）。
   *   7日より古い日は落とします。
   */
  _静かに通った(失敗たち) {
    if (!失敗たち.length) return;
    try {
      const v = this._静かな回数();
      const 日 = 日付の文字(new Date());
      v[日] = (v[日] || 0) + 失敗たち.reduce((a, f) => a + (f.n || 1), 0);
      Object.keys(v).sort().slice(0, -7).forEach((k) => { delete v[k]; });
      localStorage.setItem(this._quietKey, JSON.stringify(v));
    } catch (e) { /* 数えられなくても、同期は続けます */ }
  },
  /** 日ごとの「静かに通った」回数。{ 'YYYY-MM-DD': 回数 } */
  _静かな回数() {
    try {
      const v = JSON.parse(localStorage.getItem(this._quietKey) || '{}');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (e) {
      return {};
    }
  },
  /** 画面に出す分。今日と昨日の回数 */
  静かに通った回数() {
    const v = this._静かな回数();
    const 今日 = 日付の文字(new Date());
    const 昨日 = 日付の文字(new Date(Date.now() - 24 * 60 * 60 * 1000));
    return { 今日: v[今日] || 0, 昨日: v[昨日] || 0 };
  },
  /** 「消す」。赤くなった記録と、静かに通った回数の両方を消します */
  clearLog() {
    try { localStorage.removeItem(this._logKey); } catch (e) {}
    try { localStorage.removeItem(this._quietKey); } catch (e) {}
    this._保留 = [];
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
      // ★あきらめる時間（hangMs）と同じにすると、ちょうど切れた直後のものを
      //   「まだ固まっていない」と読んで1回空振りします。少しあとに置きます
      const stuck = this.runningSince && (Date.now() - this.runningSince > this.hangMs + 5000);
      if (!stuck) return;
      this.lastError = '前の同期が返ってこなかったので、やり直します';
    }

    this.running = true;
    this.runningSince = Date.now();
    this._notify();

    const sending = this.outbox();
    const ops = this._withSummaries(sending);
    // ★あきらめるまでに何秒待ったか。記録に入れます（35秒なら時間切れと分かります）
    const この回の始まり = Date.now();
    // ★書くときは鍵待ち（25秒）があるので長く、読むだけなら短く（readHangMs を見てください）
    const 上限 = ops.length ? this.hangMs : this.readHangMs;
    this._送り直せる = false;

    /* ★送った番号を覚えておきます。返事を待つあいだに人が番号を入れ直すと、
         **古い返事の「番号が要る」で、入れたばかりの番号を消してしまう**ためです（2026-09-16）。 */
    const 送った番号 = this.code();

    try {
      // 返事が返ってこないまま止まらないよう、時間を切ります。
      // iPhone はアプリを裏に回した拍子に、通信が返ってこないことがあります
      const stop = new AbortController();
      const timer = setTimeout(() => stop.abort(), 上限);
      const body = JSON.stringify({
        pin: this.pin(),
        code: this.code(),
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
      const json = await 返事を読む(res);

      if (!json.ok) {
        this.lastError = json.error || '同期に失敗しました';
        /* ★ここも残します。とくに `busy`（混み合っています）は、
             ★**順番待ちがあふれた**という意味で、一番知りたい1件です。
             通信できなかったときだけ数えていると、これが丸ごと落ちます */
        this._noteFail(
          json.code === 'busy' ? '順番待ち' : `サーバーが断った（${json.code || '理由なし'}）`,
          this.lastError, Date.now() - この回の始まり
        );
        // ★混み合い・サーバーの中の失敗は送り直せば通ります。PIN・番号・権限は送り直しても同じです
        this._送り直せる = ['busy', 'error'].includes(json.code);
        // ロック中はPINを消さない（正しいPINを持っている人まで締め出さないため）
        if (json.code === 'bad_pin' || json.code === 'no_pin') this.clearPin();
        // 管理用PINが要る操作が現場アプリの送信箱に紛れ込んだ場合、
        // 何度送っても通らず、以降の同期が止まってしまう。捨てて先へ進む。
        if (json.code === 'need_admin') this._dropAdminOps(sending);
        /* ★番号が要る／使えないと言われたとき。
             ★PINは消しません。**PINは合っている**からです。
               ここでPINまで消すと、番号を直したい人がPINからやり直しになります。
             ★送信箱も捨てません。番号を入れれば、そのまま送られます。 */
        if (json.code === 'need_staff_code') {
          if (this.code() === 送った番号) this.clearCode();
          this.needStaffCode = true;
        }
        return;
      }
      this.needStaffCode = false;
      this._rememberWho(json);

      // 送れた分だけ送信箱から取り除く（送信中に増えた分は残す）
      const rest = this.outbox().slice(sending.length);
      this._saveOutbox(rest);

      // ほかの端末の変更が届いたなら、しばらく速く取りに行きます。
      // ★間隔を取り直さないと、次に取りに行くのが60秒後のままになります
      // ★自分がいま送った分の返り（同じキー）では速くしません。
      //   2026-09-15 まで、自分で入れたチェックが自分の端末を40秒間3秒おきにしていました
      //   （端末を見分ける印が無いので、自分の行もそのまま返ってきます）。
      //   サーバーが直近10秒の行を何度か返すようになった（`readCursor_` の余白）ので、なおさら要ります
      const 自分の = new Set(sending.map((op) => op.k).filter(Boolean));
      const よそから = (json.records || []).some((r) => !自分の.has(r.k));
      if (よそから) {
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
      /* ★どちらなのかを分けます。**2026-09-13 まで分けていませんでした。**
           電波が無いときも、サーバーが返事をしないときも、同じ赤・同じ文だったので、
           **「通信状態が悪い」とアプリが言うだけで、確かめる手がありませんでした。**
           ko-dai さんも現場も、そう読むしかなかった状態です。
           すぐ下の `ask()` は、ずっとこの切り分けをしていました。
           ★**同じことを2か所に書いたのではなく、片方に書き忘れていた形です。** */
      const たぐい = この失敗のたぐい(e);
      this.lastError = この失敗はなにか(e, 上限);
      this._noteFail(たぐい, this.lastError, Date.now() - この回の始まり, e && e.status);
      // ★電波が無いときだけは、送り直しても同じなので静かにしません（online で自動で送ります）
      this._送り直せる = たぐい !== '電波なし';
    } finally {
      this.running = false;
      this.runningSince = 0;
      if (!this.lastError) {
        // ★静かに送り直して通りました。記録には残さず、日ごとの回数にだけ足します
        this._静かに通った(this._保留);
        this._保留 = [];
        this._fails = 0;
        this._quiet = false;
        // ★送っているあいだに増えた分は、すぐ続けて送ります。
        //   前は成功していても15秒待っていたので、連続でチェックを入れると
        //   最後の何件かが15秒遅れて届いていました。
        if (this.outbox().length) this.scheduleFlush(700);
      } else if (this._送り直せる && this._fails < this.静かな間.length) {
        /* ★静かな送り直し（`_fails` のコメントを見てください）。
             読むだけの同期でも送り直します。送り直さないと、次に取りに行く60秒後まで
             赤（いまは「送り直しています」）が残るためです */
        this._fails += 1;
        this._quiet = true;
        this.scheduleFlush(this.静かな間[this._fails - 1]);
      } else {
        // ★ここから赤。送れなかったときだけ、間を空けて送り直します（今までどおり）
        this._fails += 1;
        this._quiet = false;
        // ★赤になったので、ためていた失敗をここで初めて記録に書きます（静かに送り直した分も一緒に）
        this._記録に残す(this._保留);
        this._保留 = [];
        if (this.outbox().length) this.scheduleFlush(15000);
      }
      this._notify();
    }
  },

  /**
   * 画面に出す失敗の文
   *
   * ★静かに送り直している最中は空です。ヘッダーの丸・設定の文・帯は、
   *   `lastError` ではなく**こちら**を見ます（`lastError` は記録と送り直しの判断に使います）。
   */
  shownError() {
    return this._quiet ? '' : this.lastError;
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

  /**
   * 合言葉と番号が通るかだけを確かめます（記録は動かしません）
   *
   * ★★2026-09-16 まで、**この関数はありませんでした。**`js/app.js` の submitPin は、
   *   番号だけを入れる画面（「PINを入れ直す」／番号を求められたとき）でこれを呼んでいて、
   *   **`Sync.ping is not a function` で止まり、「確認中…」のまま閉じられませんでした。**
   *   番号は止まる前に覚えるので、裏の同期で名前は出ます。**画面だけが残ります。**
   *   ★番号を必須にしたあとは「番号はあとで」も出ないので、**全員がそこで止まるところでした。**
   *   マニュアル部署が「違う番号でも通る」と報告してきたのを本部で追って、実物で再現しました。
   * ★サーバーの `ping` は何も書かず、外への呼び出しもありません（`gas/コード.gs` の `handle_` の先頭）。
   * 返り値 { ok, error, code, who, admin }
   */
  async ping() {
    const 送った番号 = this.code();
    try {
      const res = await fetch(APP.syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ pin: this.pin(), code: 送った番号, action: 'ping' }),
      });
      const json = await 返事を読む(res);
      if (!json.ok) {
        if (json.code === 'need_staff_code') {
          if (this.code() === 送った番号) this.clearCode();
          this.needStaffCode = true;
        }
        return { ok: false, error: json.error || '', code: json.code || '', who: null, admin: false };
      }
      this.needStaffCode = false;
      this._rememberWho(json);
      return { ok: true, error: '', code: '', who: json.who || null, admin: !!json.admin };
    } catch (e) {
      return { ok: false, error: '通信できませんでした。電波の良いところでもう一度お試しください。',
               code: '', who: null, admin: false };
    }
  },

  /** いま覚えているPINが管理用かどうかを確かめる（管理アプリで使います） */
  async probeAdmin() {
    const r = await this.ping();
    return r.ok ? { admin: r.admin, error: '' } : { admin: false, error: r.error, code: r.code };
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
        body: JSON.stringify({ pin: this.pin(), code: this.code(), action, ...extra }),
      });
      return await 返事を読む(res);
    } catch (e) {
      // ★切り分けは この失敗はなにか() 1か所です。
      //   ここに書き写すと、片方だけ直った状態が必ずできます
      return { ok: false, error: この失敗はなにか(e, this.askMs), kind: この失敗のたぐい(e) };
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
      /* ★社員のアカウント（番号）だけは、**マネージにしか入れません。**
           番号は合言葉です。ふつうの設定と同じに配ると、**6店舗全部の端末に
           全員分の合言葉の写しが置かれます。**
           2026-09-10、ko-dai さんが登録した直後にこの形になっていました
           （サーバーは設定を選ばずに全部返します）。
           ★サーバー側でも止めます（gas/コード.gs）。ここは二重の押さえです。
           ★現場の端末に残っている写しは、その場で消します。 */
      if (window.T3_ADMIN_PAGE && settings.staffAccounts) {
        localStorage.setItem(StaffAccounts._key, JSON.stringify(settings.staffAccounts));
      }
      /* ★番号の締めつけ（`staffCodeRequired`）。**マネージの画面に出すためだけ**に持ちます。
           ★「番号が要るか」を決めるのは**サーバー**です（`gas/コード.gs` の `staffCodeRequired_`）。
             端末のこの値は**表示だけ**で、判定には使いません。
             端末で判定すると、画面をいじれば通ってしまいます（社員のアカウントと同じ考えです）。
           ★現場の端末には要りません（マネージにしか切り替えが無いため）。 */
      if (window.T3_ADMIN_PAGE && settings.staffCodeRequired !== undefined) {
        localStorage.setItem(APP.storageKey + ':staffCodeRequired',
                             JSON.stringify(settings.staffCodeRequired === true));
      }
      /* ★ここに「マネージ以外なら消す」を置いていました。**外しました。**
           2026-09-11、ko-dai さんが登録した社員のアカウントが**消えました。**
           端末の保存は**ページごとではなく、おおもと（オリジン）ごと**です。
           `/manage/` と `/` は同じおおもとなので鍵も共通で、
           **同じ端末でワークスを開いた瞬間に、マネージで登録したものが消えます。**
           守りのつもりで足したものが、**唯一の控えを消していました。**
           配らないようにするのは**サーバーの仕事**です（`ADMIN_ONLY_SETTINGS`）。
           消す処理は、守りとしては弱く、壊し方としては強すぎました。 */
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
      ['busy', '送っています', '少し待つと ✓ に変わります。通らなかったときに静かに送り直している最中も、この印です'],
      ['pending', 'まだ送れていない分があります', 'つながり次第、自動で送られます。入力した内容が消えることはありません'],
      ['error', '送れていません', '3回送り直しても通らなかったときです。理由は帯に出ます。'
        + '「電波が届いていません」なら待つだけ。「サーバーが返事をしません」「Google 側で結果を受け取れませんでした」なら'
        + '混み合っているだけで、電波の問題ではありません。入力した内容は、どれでも消えません'],
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

  /**
   * 赤になった記録を、読める形にします
   *
   * ★`legendHtml()` と同じで、**ここ1か所**です。ワークス・マイン・マネージ・配達記録が
   *   同じものを出します。画面ごとに書き写すと、片方だけ古くなります。
   */
  logHtml() {
    const list = this.log();
    /* ★1行目は「静かに送り直して通った分」の回数です。記録には残しません。
         ここを分けないと、静かに通った分まで赤い行に見えて、
         **赤が減ったのかが読めません**（2026-09-16 の朝がそうでした） */
    const 静か = this.静かに通った回数();
    const 頭 = '<li class="sync-log__quiet">'
      + `静かに送り直して通った分：<b>今日 ${静か.今日}回</b>・昨日 ${静か.昨日}回`
      + '<span class="sync-log__quiet-note">画面は赤くなっていません。'
      + '下に残るのは、3回送り直しても通らなかった分だけです</span></li>';
    if (!list.length) {
      return 頭 + '<li class="sync-log__none">まだ1件もありません。'
        + '同期が赤くなると、ここに日時と理由が残ります</li>';
    }
    return 頭 + list.map((r) => {
      const d = new Date(r.at);
      const 日 = `${d.getMonth() + 1}/${d.getDate()} `
        + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      // ★待った秒数。35秒なら「時間切れ」、0秒に近ければ「はじめから届いていない」
      const 秒 = r.ms >= 1000 ? `${Math.round(r.ms / 1000)}秒` : '';
      const かず = r.n > 1 ? `<span class="sync-log__n">${r.n}回</span>` : '';
      return '<li class="sync-log__row">'
        + `<span class="sync-log__when">${日}</span>`
        + `<span class="sync-log__kind">${r.k || ''}${r.s ? ` ${r.s}` : ''}</span>`
        + `<span class="sync-log__ms">${秒}</span>${かず}`
        + '</li>';
    }).join('');
  },

  /** 画面に出す状態 */
  status() {
    if (!this.enabled()) return { kind: 'off', text: '' };
    if (!this.pin()) return { kind: 'error', text: 'PIN未入力' };
    if (this.running) return { kind: 'busy', text: '同期中…' };
    const n = this.outbox().length;
    // ★静かに送り直している最中は赤にしません（`_fails` のコメントを見てください）
    if (this.lastError && this._quiet) {
      return { kind: 'busy', text: n ? `送り直しています（未送信 ${n}件）` : '送り直しています…' };
    }
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
      if (document.hidden) {
        // ★裏に回ります。ここから先の失敗は「画面が消えたから」です
        this._とじかけ = true;
        this.flushNow();
      } else {
        this._とじかけ = false;   // 表に戻りました。また記録します
        this.scheduleFlush(300);
      }
      this._loop();   // 表に戻ったら、間隔を取り直します
    });
    // 閉じるとき。iPhone では visibilitychange が来ないこともあるので両方見ます
    window.addEventListener('pagehide', () => {
      // ★ここから先の失敗は「閉じたから」です。サーバーのせいではありません
      this._とじかけ = true;
      this.flushNow();
    });
    // 読み直し（更新するを押した・URLを開き直した）も同じです
    window.addEventListener('beforeunload', () => { this._とじかけ = true; });
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
