/* ============================================================
 *  ご意見（不具合・こうしてほしい・質問）
 *
 *  2026-09-23、ko-dai さんの指示。現場がアプリの中で出して、ko-dai さんが返事を返します。
 *  ワークスとマインの「T3Dining」の欄から開きます。
 *
 *  ★掲示板です。社員全員が、全部の投稿と返事を見られます。
 *    出した人の名前はいつも付きます（匿名では出せません）。
 *
 *  ★画面（view）ではなく、上に重ねるパネルにしてあります（js/interview.js と同じ）。
 *    js/app.js の render() は画面ごとに他を全部隠す作りなので、画面を1つ足すと
 *    十数か所を直すことになり、1か所忘れると別の画面と重なって出ます。
 *    パネルなら js/app.js に1文字も触りません。
 *
 *  ★記録の入れ先は `_voice/<印>` です（`_shift/`・`_shiftw/` と同じ形）。
 *    1投稿＝1行。伸び続けないので、1行5万文字の壁に当たりません。
 *
 *  ★写真と動画は、記録に入れません。ドライブに置いて**IDだけ**を持ちます。
 *    動画はアプリでは見られません（ko-dai さんがドライブで見ます）。
 *    20MB を全端末に配ると、Cloudflare の回数と D1 の大きさに効くためです。
 *
 *  ★★消しても、1か所だけ残ります。
 *    記録の本文は写し（スプレッドシート）にも渡っていて、**シートには版の履歴があります**。
 *    端末・D1・ドライブからは消えますが、**履歴だけは消せません**。
 *    だからこのファイルは、どこにも「消しました」と書きません。
 *    **「みんなの画面から消しました」**と書きます。出す画面にも、その一言を置いています。
 *
 *  ★名前はアプリからは送りません。端末には名簿（staffAccounts）が配られていないので、
 *    アプリは自分の名前を知りません。番号から名前を入れるのは**受け側（Worker と GAS）**です。
 *    同期が戻るまでは「（あなた）」と出ます。
 * ============================================================ */
const VoiceView = (() => {
  /** 記録の入れ先（店舗idの場所に置きます。日付の形ではないので提出記録には出ません） */
  const 入れ先 = '_voice';

  const 種類たち = [
    { id: 'bug', 名: '不具合', 絵: '🐞' },
    { id: 'want', 名: 'こうしてほしい', 絵: '💡' },
    { id: 'ask', 名: '質問', 絵: '❓' },
  ];

  /** 状態は、ko-dai さんだけが動かします */
  const 状態たち = ['未読', '見ました', '直しています', '直しました', 'しません'];

  /* ★上限は受け側（gas/ご意見.gs）と同じ数です。**2か所で守ります**
       （画面で隠すのは守りになりません。番号を持つ人はアプリを通さずに送れます） */
  const 本文の上限 = 2000;
  const 写真の上限 = 4 * 1024 * 1024;
  const 動画の上限 = 20 * 1024 * 1024;
  const 添付の数 = 4;
  const 動画の秒 = 15;

  /** どこまで見たか（この端末の中だけ。返事の赤い印に使います） */
  const 見た印キー = `${typeof APP !== 'undefined' ? APP.storageKey : 't3d'}:voiceSeen`;

  let いまの画面 = 'list';   // list（一覧）／new（出す）／one（1件）
  let いまの印 = '';         // one のとき、どの投稿か
  let 送っている = false;    // 二重に押させないための印

  /* ------------------------------------------------------------
   *  小さな道具
   * ---------------------------------------------------------- */

  /** 画面に出す文字は、必ずここを通します（人が書いた文なので、HTMLとして読みません） */
  const 文字 = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  /** いま開いているアプリの版（不具合の切り分けに使います） */
  function いまの版() {
    try {
      const meta = document.querySelector('meta[name="app-version"]');
      return meta ? String(meta.content || '').trim() : '';
    } catch (e) { return ''; }
  }

  /** マインかどうか（返事の欄を出すかの判断。★本当の可否はサーバーが確かめます） */
  function 返事を書ける() {
    return typeof isMine === 'function' && isMine();
  }

  /** この端末の番号（自分の投稿かを見るため） */
  function 私の番号() {
    try { return String(Sync.code() || ''); } catch (e) { return ''; }
  }

  /** 新しい投稿の印（20260923-a1b2c3）。★6桁は当てられても困らない値だけに使います */
  function 新しい印() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const 日 = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
    let 尻 = '';
    const 文字たち = '0123456789abcdefghijklmnopqrstuvwxyz';
    for (let i = 0; i < 6; i++) 尻 += 文字たち[Math.floor(Math.random() * 文字たち.length)];
    return `${日}-${尻}`;
  }

  const キー = (印) => `${入れ先}/${印}`;

  /** 大きさを人に言える形に（3.2MB のように） */
  function 大きさの文(bytes) {
    if (bytes >= 1024 * 1024) return `${Math.round((bytes / 1024 / 1024) * 10) / 10}MB`;
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  }

  /** いつの話かを、短く（9/23 1:40） */
  function 日時の文(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('ja-JP', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  const 種類の名 = (id) => (種類たち.find((k) => k.id === id) || { 名: '' }).名;
  const 種類の絵 = (id) => (種類たち.find((k) => k.id === id) || { 絵: '' }).絵;

  /* ------------------------------------------------------------
   *  記録の読み書き
   * ---------------------------------------------------------- */

  /** 全部の投稿（新しい順）。消えたものは出しません */
  function 全部() {
    if (typeof Store === 'undefined' || !Store.adapter) return [];
    const 箱 = Store.adapter.dump();
    return Store.keysUnder(入れ先)
      .map((印) => ({ 印, rec: 箱[キー(印)] }))
      .filter((x) => x.rec && typeof x.rec === 'object' && !x.rec.消えた)
      .sort((a, b) => String(b.rec.出した時 || '').localeCompare(String(a.rec.出した時 || '')));
  }

  function ひとつ(印) {
    if (typeof Store === 'undefined' || !Store.adapter) return null;
    const rec = Store.adapter.dump()[キー(印)];
    return rec && typeof rec === 'object' ? rec : null;
  }

  /** この端末に書いて、送信箱に積みます */
  function 書く(印, rec, op, すぐ) {
    Store.adapter.set(キー(印), rec);
    Sync.enqueue({ ...op, k: キー(印) }, !!すぐ);
  }

  /* ------------------------------------------------------------
   *  返事の赤い印（自分の投稿に返事が付いたとき）
   * ---------------------------------------------------------- */

  function 見た印を読む() {
    try { return String(localStorage.getItem(見た印キー) || ''); } catch (e) { return ''; }
  }

  function 見た印を書く() {
    try { localStorage.setItem(見た印キー, new Date().toISOString()); } catch (e) { /* 覚えられない端末は、いつも印が出ます */ }
  }

  /** まだ見ていない返事の数（自分の投稿だけ数えます） */
  function 新しい返事の数() {
    const 私 = 私の番号();
    if (!私) return 0;
    const 見た = 見た印を読む();
    return 全部().filter((x) => String(x.rec.番号 || '') === 私
      && x.rec.返事の時 && String(x.rec.返事の時) > 見た).length;
  }

  /** T3Dining の欄のボタンに、赤い印を出します */
  function 印を出す() {
    const btn = document.getElementById('storesVoiceBtn');
    if (!btn) return;
    const 数 = 新しい返事の数();
    let dot = btn.querySelector('.voice-dot');
    if (!数) { if (dot) dot.remove(); return; }
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'voice-dot';
      btn.appendChild(dot);
    }
    dot.textContent = String(数);
    dot.setAttribute('aria-label', `返事が${数}件`);
  }

  /* ------------------------------------------------------------
   *  写真と動画
   * ---------------------------------------------------------- */

  /**
   * 写真を、送れる大きさまで小さくします
   *
   * ★ジャーナルの `cashShrink` とは別物です。あちらはレシートの**字を読む**ためのもので、
   *   色を捨てて 2000px で残します。こちらは**人が見る**ためのものなので、色を残して
   *   1600px・品質0.7 にします。同じ名前にも、共通にもしていません。
   */
  function 写真を縮める(file) {
    return new Promise((ok, だめ) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const 倍 = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * 倍);
        c.height = Math.round(img.height * 倍);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', 0.7).split('base64,')[1] || '');
      };
      img.onerror = () => { URL.revokeObjectURL(url); だめ(new Error('写真を読めませんでした')); };
      img.src = url;
    });
  }

  /**
   * 動画の長さ（秒）。測れないときは -1 を返します
   *
   * ★測れなくても、大きさでは必ず断ります。**測れないことを黙って通しません**
   */
  function 動画の長さ(file) {
    return new Promise((ok) => {
      const v = document.createElement('video');
      const url = URL.createObjectURL(file);
      let 終わった = false;
      const 返す = (秒) => {
        if (終わった) return;
        終わった = true;
        URL.revokeObjectURL(url);
        ok(秒);
      };
      v.preload = 'metadata';
      v.onloadedmetadata = () => 返す(Number(v.duration) || -1);
      v.onerror = () => 返す(-1);
      setTimeout(() => 返す(-1), 5000);   // 測れないまま待たせません
      v.src = url;
    });
  }

  /** ファイルをそのまま base64 に（動画用。縮めません） */
  function 中身を読む(file) {
    return new Promise((ok, だめ) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split('base64,')[1] || '');
      r.onerror = () => だめ(new Error('ファイルを読めませんでした'));
      r.readAsDataURL(file);
    });
  }

  /**
   * 選ばれたファイルを確かめます
   * 返すもの … { ok:true, kind, file, 秒 } か { ok:false, 訳 }
   */
  async function 確かめる(file) {
    const 型 = String(file.type || '');
    if (型.indexOf('image/') === 0) {
      // 縮めるので、元が大きくても構いません。ただし読み込めない大きさは先に断ります
      if (file.size > 40 * 1024 * 1024) return { ok: false, 訳: `写真が大きすぎます（${大きさの文(file.size)}）` };
      return { ok: true, kind: 'photo', file };
    }
    if (型.indexOf('video/') === 0) {
      const 秒 = await 動画の長さ(file);
      if (秒 > 0 && 秒 > 動画の秒 + 1) {
        return { ok: false, 訳: `動画は${動画の秒}秒までです（この動画は${Math.round(秒)}秒）` };
      }
      if (file.size > 動画の上限) {
        return { ok: false, 訳: `動画が大きすぎます（${大きさの文(file.size)}／上限${大きさの文(動画の上限)}）。短く撮り直してください` };
      }
      return { ok: true, kind: 'movie', file, 秒 };
    }
    return { ok: false, 訳: '写真か動画を選んでください' };
  }

  /* ------------------------------------------------------------
   *  画面
   * ---------------------------------------------------------- */

  const 中身 = () => document.getElementById('voiceMain');

  function 一覧の絵() {
    const 私 = 私の番号();
    const list = 全部();
    const 頭 = `
      <p class="interview__lead">
        アプリの不具合・こうしてほしいこと・質問を出す所です。
        出したものは<strong>社員全員が見られます</strong>。ko-dai さんが返事を書きます。
      </p>`;
    if (!list.length) {
      return `${頭}<p class="voice-empty">まだ1件もありません。右上の「出す」から出してください。</p>`;
    }
    const 行 = list.map((x) => {
      const r = x.rec;
      const 自分 = 私 && String(r.番号 || '') === 私;
      const 名 = r.名前 ? 文字(r.名前) : (自分 ? '（あなた）' : '');
      const 返事あり = !!r.返事の時;
      const 添付 = (r.添付 || []).length;
      return `
        <button type="button" class="voice-card voice-card--${文字(r.種類)}" data-voice-open="${文字(x.印)}">
          <span class="voice-card__head">
            <span class="voice-card__kind">${種類の絵(r.種類)} ${文字(種類の名(r.種類))}${r.画面 ? `／${文字(画面の名(r.画面))}` : ''}</span>
            <span class="voice-card__state voice-card__state--${文字(r.状態 || '未読')}">${文字(r.状態 || '未読')}</span>
          </span>
          <span class="voice-card__body">${文字(String(r.本文 || '').slice(0, 80))}${String(r.本文 || '').length > 80 ? '…' : ''}</span>
          <span class="voice-card__foot">
            ${r.店舗 ? `<span>${文字(店舗の名(r.店舗))}</span>` : ''}
            <span>${名}</span>
            <span>${文字(日時の文(r.出した時))}</span>
            ${添付 ? `<span class="voice-card__clip">📎 ${添付}</span>` : ''}
            ${返事あり ? '<span class="voice-card__reply">返事あり</span>' : ''}
          </span>
        </button>`;
    }).join('');
    return `${頭}<div class="voice-list">${行}</div>`;
  }

  function ひとつの絵(印) {
    const r = ひとつ(印);
    if (!r) return '<p class="voice-empty">この投稿は、もうありません。</p>';
    const 私 = 私の番号();
    const 自分 = 私 && String(r.番号 || '') === 私;
    const 消せる = 自分 || 返事を書ける();
    const 写真 = (r.添付 || []).map((a, i) => (a.型 === 'photo'
      ? `<div class="voice-shot" data-voice-shot="${文字(a.id)}"><p class="voice-shot__note">写真を読み込んでいます…</p></div>`
      : `<div class="voice-shot voice-shot--movie"><p class="voice-shot__note">🎬 動画（${文字(a.size || 大きさの文(a.バイト || 0))}）<br>アプリでは見られません。ko-dai さんがドライブで見ます。</p></div>`)).join('');

    const 返事 = r.返事の時
      ? `<div class="voice-reply">
           <p class="voice-reply__head">ko-dai さんの返事（${文字(日時の文(r.返事の時))}）</p>
           <p class="voice-reply__body">${文字(r.返事)}</p>
         </div>`
      : '';

    const 書く欄 = 返事を書ける()
      ? `<div class="voice-write">
           <label class="voice-label">状態</label>
           <div class="voice-states">
             ${状態たち.map((s) => `<button type="button" class="voice-state-btn${(r.状態 || '未読') === s ? ' is-on' : ''}" data-voice-state="${文字(s)}">${文字(s)}</button>`).join('')}
           </div>
           <label class="voice-label" for="voiceReplyText">返事</label>
           <textarea class="voice-text" id="voiceReplyText" rows="4" maxlength="${本文の上限}">${文字(r.返事 || '')}</textarea>
           <div class="voice-actions">
             <button type="button" class="voice-btn voice-btn--send" id="voiceReplySend">返事を出す</button>
           </div>
           <p class="voice-state" id="voiceReplyState"></p>
         </div>`
      : '';

    return `
      <div class="voice-one">
        <button type="button" class="voice-back" id="voiceBack">‹ 一覧へ</button>
        <p class="voice-one__kind">${種類の絵(r.種類)} ${文字(種類の名(r.種類))}
          <span class="voice-card__state voice-card__state--${文字(r.状態 || '未読')}">${文字(r.状態 || '未読')}</span></p>
        <p class="voice-one__body">${文字(r.本文)}</p>
        <div class="voice-shots">${写真}</div>
        <p class="voice-one__foot">
          ${文字(r.名前 || (自分 ? '（あなた）' : ''))}
          ／ ${文字(日時の文(r.出した時))}
          ${r.店舗 ? ` ／ ${文字(r.店舗)}` : ''}
          ${r.版 ? ` ／ 版 ${文字(r.版)}` : ''}
        </p>
        ${(r.添付 || []).some((a) => a.型 === 'movie')
          ? `<p class="voice-one__id">動画のファイル名は <strong>${文字(印)}_1.mp4</strong> です（ドライブで、この名前で探せます）</p>`
          : ''}
        ${返事}
        ${書く欄}
        ${消せる ? `<div class="voice-actions voice-actions--drop">
            <button type="button" class="voice-btn voice-btn--drop" id="voiceDrop">この投稿を消す</button>
          </div>
          <p class="voice-state" id="voiceDropState"></p>` : ''}
      </div>`;
  }

  function 出す() {
    const 箱 = 中身();
    if (!箱) return;
    if (いまの画面 === 'new') 箱.innerHTML = 出す画面の絵();
    else if (いまの画面 === 'one') 箱.innerHTML = ひとつの絵(いまの印);
    else 箱.innerHTML = 一覧の絵();

    const 出すボタン = document.getElementById('voiceNew');
    if (出すボタン) 出すボタン.classList.toggle('is-hidden', いまの画面 !== 'list');

    if (いまの画面 === 'new') つなぐ出す画面();
    if (いまの画面 === 'one') つなぐひとつ();
    印を出す();
  }

  /* ------------------------------------------------------------
   *  出す（★ボタンを選ぶだけで出せます。2026-09-23、ko-dai さんの指示）
   *
   *  ★よくある問い合わせフォームの形です。**1文字も打たずに出せます。**
   *    現場は打つ手間が減り、見る側は「どの画面の、どんなことか」がそろいます。
   *  ★ここで増やした欄（画面・症状・いつ）は、**受け側の直しが要りません**。
   *    Worker も GAS も、投稿の中身を**丸ごと**記録に入れる作りだからです（`rec = op.v`）。
   *  ★見た目は、一覧のカード（`.voice-card`）などを**使い回して**います。
   *    `css/style.css` は本部の持ち物なので、新しい飾りを足さずに作りました。
   * ---------------------------------------------------------- */

  /**
   * どの画面のことか
   *
   * ★業務の一覧（`TASKS`）とは**別に持ちます**。あちらは「店舗ごとに出す業務」、
   *   こちらは「出す人が選ぶ言葉」で、まとめ方が違います（お金まわりは3画面で1つ）。
   */
  const 画面たち = [
    { id: 'day', 名: 'クローズ', 絵: '🌙' },
    { id: 'cash', 名: 'ジャーナル', 絵: '💴' },
    { id: 'week', 名: '週間掃除', 絵: '🧹' },
    { id: 'train', 名: '教育', 絵: '🎓' },
    { id: 'shift', 名: 'シフト', 絵: '🗓' },
    { id: 'report', 名: '提出記録・達成状況', 絵: '📋' },
    { id: 'money', 名: 'お金まわり', 絵: '💰', 添え: '立替金・キャッチ・会議資料' },
    { id: 'login', 名: 'ログイン・番号・設定', 絵: '🔑' },
    { id: 'other', 名: 'わからない・その他', 絵: '❓' },
  ];

  /** 何が起きたか。種類ごとに聞くことが変わります */
  const 症状たち = {
    bug: [
      { id: 'nores', 名: '押しても何も起きない' },
      { id: 'error', 名: '赤い帯・エラーが出た' },
      { id: 'lost', 名: '入れたものが消えた・保存されていない' },
      { id: 'wrong', 名: '表示がおかしい（数字・並び・文字）' },
      { id: 'slow', 名: '動きが遅い・固まる' },
      { id: 'missing', 名: '出るはずのものが出ない' },
      { id: 'other', 名: 'その他' },
    ],
    want: [
      { id: 'item', 名: '項目を増やしたい・減らしたい' },
      { id: 'easy', 名: '入力を楽にしてほしい' },
      { id: 'view', 名: '見やすくしてほしい' },
      { id: 'new', 名: '新しい機能がほしい' },
      { id: 'other', 名: 'その他' },
    ],
    ask: [
      { id: 'how', 名: '使い方が分からない' },
      { id: 'where', 名: 'どこにあるか分からない' },
      { id: 'mean', 名: 'この表示の意味が分からない' },
      { id: 'ok', 名: 'こうしてよいか確かめたい' },
      { id: 'other', 名: 'その他' },
    ],
  };

  /**
   * どの店舗のことか
   *
   * ★`STORES`（`js/config.js` の共通）から作ります。**自前で並べません。**
   *   店舗が増えたり名前が変わったりしたとき、ここだけ古くなるのを防ぐためです。
   * ★「店舗に関係ない」も必ず置きます。アプリ全体の話や、家で気づいたことも出せるように。
   */
  function 店舗たち() {
    const 元 = (typeof STORES !== 'undefined' && Array.isArray(STORES)) ? STORES : [];
    return 元.map((x) => ({ id: x.id, 名: x.name }))
      .concat([{ id: 'none', 名: '店舗に関係ない・全体のこと' }]);
  }

  const 店舗の名 = (id) => {
    if (!id) return '';
    if (id === 'none') return '店舗に関係ない';
    const 元 = (typeof STORES !== 'undefined' && Array.isArray(STORES)) ? STORES : [];
    const x = 元.find((s) => s.id === id);
    return x ? x.name : id;
  };

  /** いつからか（不具合のときだけ聞きます） */
  const いつたち = [
    { id: 'now', 名: 'さっき' },
    { id: 'today', 名: '今日' },
    { id: 'yesterday', 名: '昨日から' },
    { id: 'always', 名: '前からずっと' },
    { id: 'unknown', 名: '覚えていない' },
  ];

  const 名を引く = (一覧, id) => (一覧.find((x) => x.id === id) || { 名: '' }).名;
  const 画面の名 = (id) => 名を引く(画面たち, id);
  const 症状の名 = (種類, id) => 名を引く(症状たち[種類] || [], id);
  const いつの名 = (id) => 名を引く(いつたち, id);

  /** 種類ごとの、聞くことの並び */
  function 問いの並び(種類) {
    const 題 = {
      bug: 'どうなりましたか', want: '何をしてほしいですか', ask: '何が分かりませんか',
    }[種類] || 'どうしましたか';
    const 並び = [
      { id: '店舗', 題: 'どの店舗のことですか', 札: 店舗たち() },
      { id: '画面', 題: 'どの画面のことですか', 札: 画面たち },
      { id: '症状', 題, 札: 症状たち[種類] || [] },
    ];
    // ★「いつから」は不具合のときだけ。要望と質問には要りません（押す回数を増やさないため）
    if (種類 === 'bug') 並び.push({ id: 'いつ', 題: 'いつからですか', 札: いつたち });
    return 並び;
  }

  /**
   * いま開いている店舗
   *
   * ★関数の中で `state` という名前を使わないでください。`js/app.js` の `state`（画面の状態）が
   *   隠れて、**店舗がいつも空のまま記録されます**。落ちないので気づけません（2026-09-23 に直しました）。
   */
  function いまの店舗() {
    try {
      return (typeof state !== 'undefined' && state && state.storeId) ? String(state.storeId) : '';
    } catch (e) { return ''; }
  }

  let 選んだもの = [];       // [{ kind, file, 秒 }]
  let 答え = {};             // { 種類, 画面, 症状, いつ }
  let 問いの位置 = 0;        // 0 = 種類、1〜 = 問いの並び、そのあと = 確かめる画面

  function 添付を描く() {
    const 箱 = document.getElementById('voiceFiles');
    if (!箱) return;
    箱.innerHTML = 選んだもの.map((x, i) => `
      <span class="voice-chip">
        ${x.kind === 'movie' ? '🎬' : '🖼'} ${文字(x.file.name || (x.kind === 'movie' ? '動画' : '写真'))}
        （${大きさの文(x.file.size)}${x.kind === 'movie' && x.秒 > 0 ? `・${Math.round(x.秒)}秒` : ''}）
        <button type="button" class="voice-chip__x" data-voice-unfile="${i}" aria-label="外す">✕</button>
      </span>`).join('');
  }

  /** 選ぶボタンを並べます（一覧のカードを使い回します） */
  function 札の絵(札, いまの値) {
    return `<div class="voice-list">${札.map((x) => `
      <button type="button" class="voice-card${いまの値 === x.id ? ' voice-card--bug' : ''}" data-voice-pick="${文字(x.id)}">
        <span class="voice-card__head">
          <span class="voice-card__kind">${x.絵 ? `${x.絵} ` : ''}${文字(x.名)}</span>
        </span>
        ${x.添え ? `<span class="voice-card__foot"><span>${文字(x.添え)}</span></span>` : ''}
      </button>`).join('')}</div>`;
  }

  /**
   * 何歩目か（「2／5」のように出します。あと何回押すかが分かるように）
   *
   * ★種類を選ぶ前は出しません。種類で歩数が変わるので（**不具合は6歩、要望と質問は5歩**）、
   *   先に出すと数が変わって、かえって迷わせます。
   * ★この数は `問いの並び()` から出しています（`length + 2`）。**ここに数を書かないこと。**
   *   問いを1つ足したとき、**このコメントだけ古いまま残りました**（2026-09-23、マニュアルの指摘）。
   */
  function 歩みの絵() {
    if (!答え.種類) return '';
    const 全部 = 問いの並び(答え.種類).length + 2;
    return `<p class="voice-count">${Math.min(問いの位置 + 1, 全部)}／${全部}</p>`;
  }

  function 戻るの絵() {
    return 問いの位置 > 0 ? '<button type="button" class="voice-back" id="voiceStepBack">‹ 前へ</button>' : '';
  }

  function 出す画面の絵() {
    // 0歩目 … 何のことか
    if (問いの位置 === 0) {
      return `${歩みの絵()}
        <p class="voice-label">何のことですか</p>
        ${札の絵(種類たち.map((k) => ({ id: k.id, 名: k.名, 絵: k.絵 })), 答え.種類)}
        <div class="voice-actions"><button type="button" class="voice-btn" id="voiceCancel">やめる</button></div>`;
    }

    const 並び = 問いの並び(答え.種類);
    // 1〜n歩目 … その問い
    if (問いの位置 <= 並び.length) {
      const 問い = 並び[問いの位置 - 1];
      return `${戻るの絵()}${歩みの絵()}
        <p class="voice-label">${文字(問い.題)}</p>
        ${札の絵(問い.札, 答え[問い.id])}
        <div class="voice-actions"><button type="button" class="voice-btn" id="voiceCancel">やめる</button></div>`;
    }

    // 最後 … 選んだものを見せて、写真と ひとこと を足して出す
    const 症状の見出し = { bug: 'どうなった', want: 'してほしいこと', ask: '聞きたいこと' }[答え.種類] || '中身';
    const 選んだ行 = [
      ['何のこと', 種類の名(答え.種類)],
      ['どの店舗', 店舗の名(答え.店舗)],
      ['どの画面', 画面の名(答え.画面)],
      [症状の見出し, 症状の名(答え.種類, 答え.症状)],
    ];
    if (答え.いつ) 選んだ行.push(['いつから', いつの名(答え.いつ)]);

    return `${戻るの絵()}${歩みの絵()}
      <div class="voice-reply">
        <p class="voice-reply__head">この内容で出します</p>
        ${選んだ行.map(([k, v]) => `<p class="voice-reply__body"><strong>${文字(k)}</strong>：${文字(v)}</p>`).join('')}
      </div>

      <label class="voice-label" for="voiceText">ひとこと（無くても出せます）</label>
      <textarea class="voice-text" id="voiceText" rows="4" maxlength="${本文の上限}"
        placeholder="くわしく書けることがあれば。無ければ、このまま出してください"></textarea>

      <label class="voice-label">写真・動画（${添付の数}つまで。動画は${動画の秒}秒まで）</label>
      <p class="voice-note">
        その場で撮っても、<strong>保存してある写真や動画から選んでも</strong>構いません。まとめて選べます。<br>
        動画は<strong>アプリでは見られません</strong>。ko-dai さんがドライブで見ます。
        受け取れたら、ここに大きさが出ます。
      </p>
      <!-- ★capture は付けません。付けるとカメラだけが開き、**保存した写真を選べなくなります**
           （2026-09-23、ko-dai さんの指摘）。無しなら「撮る／選ぶ」の両方が出ます -->
      <input type="file" id="voiceFile" accept="image/*,video/*" multiple class="voice-file">
      <div class="voice-files" id="voiceFiles"></div>

      <p class="voice-warn">
        ★人の名前・金額・店舗の売上は書かないでください。
        出したものは全員の端末に配られ、<strong>消しても控えの履歴には残ります</strong>。
      </p>
      <div class="voice-actions">
        <button type="button" class="voice-btn voice-btn--send" id="voiceSend">出す</button>
        <button type="button" class="voice-btn" id="voiceCancel">やめる</button>
      </div>
      <p class="voice-state" id="voiceState"></p>`;
  }

  function つなぐ出す画面() {
    const 箱 = 中身();

    const 戻る = document.getElementById('voiceStepBack');
    if (戻る) {
      戻る.addEventListener('click', () => {
        問いの位置 = Math.max(0, 問いの位置 - 1);
        出す();
      });
    }

    const やめる = document.getElementById('voiceCancel');
    if (やめる) {
      やめる.addEventListener('click', () => {
        選んだもの = [];
        答え = {};
        問いの位置 = 0;
        いまの画面 = 'list';
        出す();
      });
    }

    // 選ぶボタン。押したら、その場で次の問いへ進みます（「次へ」を押させません）
    箱.querySelectorAll('[data-voice-pick]').forEach((b) => {
      b.addEventListener('click', () => {
        const 値 = b.dataset.voicePick;
        if (問いの位置 === 0) {
          // ★種類を選び直したら、あとの答えは捨てます（ちぐはぐな組み合わせを残さないため）
          if (答え.種類 !== 値) 答え = { 種類: 値 };
          問いの位置 = 1;
        } else {
          const 問い = 問いの並び(答え.種類)[問いの位置 - 1];
          答え[問い.id] = 値;
          問いの位置 += 1;
        }
        出す();
      });
    });

    const file = document.getElementById('voiceFile');
    if (!file) return;   // 選んでいる途中の画面には、ここから下はありません

    const しらせ = document.getElementById('voiceState');
    添付を描く();

    const text = document.getElementById('voiceText');
    if (text) text.value = String(答え.ひとこと || '');

    /* ★まとめて選べます。1つだめでも、通ったものは入れます。
         ★だめだったものは**最後にまとめて**出します（1つずつ上書きすると、
           最後の1件しか読めません。何が落ちたのか分からなくなります） */
    file.addEventListener('change', async () => {
      const 選ばれた = Array.prototype.slice.call(file.files || []);
      file.value = '';
      if (!選ばれた.length) return;
      しらせ.textContent = '確かめています…';
      const だめ = [];
      for (let i = 0; i < 選ばれた.length; i++) {
        const f = 選ばれた[i];
        /* ★型ちがいは、数の上限より**先に**言います。
             あとに回すと、4つ埋まったときに「写真でも動画でもない」ものまで
             「4つまでです」と出て、**なぜ入らないのかが分からなくなります**
             （2026-09-23、PDF を混ぜて確かめました） */
        const 型 = String(f.type || '');
        if (型.indexOf('image/') !== 0 && 型.indexOf('video/') !== 0) {
          だめ.push(`${f.name || '1つ'}：写真か動画を選んでください`);
          continue;
        }
        if (選んだもの.length >= 添付の数) {
          だめ.push(`${f.name || 'あと'}：付けられるのは${添付の数}つまでです`);
          continue;
        }
        const 見 = await 確かめる(f);
        if (!見.ok) { だめ.push(`${f.name || '1つ'}：${見.訳}`); continue; }
        選んだもの.push(見);
        添付を描く();
      }
      しらせ.textContent = だめ.length ? `★${だめ.join('　／　')}` : '';
    });

    document.getElementById('voiceFiles').addEventListener('click', (e) => {
      const b = e.target.closest('[data-voice-unfile]');
      if (!b) return;
      選んだもの.splice(Number(b.dataset.voiceUnfile), 1);
      添付を描く();
    });

    document.getElementById('voiceSend').addEventListener('click', () => 送る());
  }

  /** 選んだものから、読める文を組み立てます（一覧と1件に出る本文になります） */
  function 本文を組む(ひとこと) {
    const 並び = 問いの並び(答え.種類);
    const 店 = 店舗の名(答え.店舗);
    const 行 = [
      `${店 ? `${店}／` : ''}${画面の名(答え.画面)}／${症状の名(答え.種類, 答え.症状)}`,
    ];
    if (答え.いつ) 行.push(`いつから：${いつの名(答え.いつ)}`);
    if (ひとこと) 行.push(ひとこと);
    return 行.join('\n');
  }

  async function 送る() {
    if (送っている) return;
    const しらせ = document.getElementById('voiceState');
    const text = document.getElementById('voiceText');
    const ひとこと = String((text && text.value) || '').trim();
    if (ひとこと.length > 本文の上限) { しらせ.textContent = `★ひとことは${本文の上限}文字までです`; return; }
    if (!私の番号()) {
      しらせ.textContent = '★あなたの番号が入っていません。設定で番号を入れてから出してください';
      return;
    }
    // ★添付があるときは、その場でドライブへ送ります。電波が無いと送れません
    if (選んだもの.length && typeof navigator !== 'undefined' && navigator.onLine === false) {
      しらせ.textContent = '★電波が届いていません。写真や動画を付けるときは、つながってから出してください';
      return;
    }

    送っている = true;
    const 印 = 新しい印();
    const 添付 = [];
    try {
      for (let i = 0; i < 選んだもの.length; i++) {
        const x = 選んだもの[i];
        しらせ.textContent = `${x.kind === 'movie' ? '動画' : '写真'}を送っています…（${i + 1}／${選んだもの.length}）`;
        const data = x.kind === 'photo' ? await 写真を縮める(x.file) : await 中身を読む(x.file);
        const res = await Sync.ask('voicePut', {
          voiceId: 印, kind: x.kind, seq: i + 1, data,
        }, { ms: 120000 });
        if (!res || !res.ok) {
          // ★ここで止めます。記録だけ先に作ると、写真の無い投稿が残ります
          しらせ.textContent = `★${(res && res.error) || '送れませんでした'}`;
          送っている = false;
          return;
        }
        添付.push({ id: res.fileId, 型: x.kind, バイト: res.bytes, size: res.size });
        // ★動画は見せないので、受け取れたことだけは、はっきり出します
        しらせ.textContent = `${x.kind === 'movie' ? '動画' : '写真'}を受け取りました（${res.size}）`;
      }

      const rec = {
        種類: 答え.種類,
        画面: 答え.画面 || '',      // ★選んだ答えも別の欄で持ちます（一覧で絞れるように）
        症状: 答え.症状 || '',
        いつ: 答え.いつ || '',
        ひとこと,
        本文: 本文を組む(ひとこと),  // ★古い投稿と同じ形でも読めるように、文も作って入れます
        // ★選んだ店舗を入れます。「店舗に関係ない」は空にします
        //   （開いている店舗を自動で入れる形はやめました。T3Dining の欄から開くと、
        //     どの店舗も開いていないので**いつも空**になるためです。2026-09-23）
        店舗: 答え.店舗 === 'none' ? '' : (答え.店舗 || いまの店舗()),
        番号: 私の番号(),     // ★名前は受け側が入れます（端末は名簿を持っていません）
        名前: '',
        版: いまの版(),
        添付,
        出した時: new Date().toISOString(),
        状態: '未読',
        返事: '',
        返事の時: null,
        消えた: false,
      };
      書く(印, rec, { t: 'voice', v: rec }, true);
      選んだもの = [];
      答え = {};
      問いの位置 = 0;
      いまの画面 = 'one';
      いまの印 = 印;
      出す();
    } catch (e) {
      しらせ.textContent = `★送れませんでした（${e && e.message ? e.message : e}）`;
    } finally {
      送っている = false;
    }
  }

  /* ------------------------------------------------------------
   *  1件（写真・返事・消す）
   * ---------------------------------------------------------- */

  function つなぐひとつ() {
    document.getElementById('voiceBack').addEventListener('click', () => {
      いまの画面 = 'list';
      出す();
    });

    // 写真は、開いたときに1枚ずつ取りに行きます
    document.querySelectorAll('[data-voice-shot]').forEach((箱) => 写真を出す(箱));

    const 書く欄 = document.getElementById('voiceReplySend');
    if (書く欄) {
      let 選んだ状態 = (ひとつ(いまの印) || {}).状態 || '未読';
      document.querySelectorAll('[data-voice-state]').forEach((b) => {
        b.addEventListener('click', () => {
          選んだ状態 = b.dataset.voiceState;
          document.querySelectorAll('[data-voice-state]').forEach((x) => x.classList.toggle('is-on', x === b));
        });
      });
      書く欄.addEventListener('click', () => {
        const rec = ひとつ(いまの印);
        if (!rec) return;
        const 文 = String(document.getElementById('voiceReplyText').value || '').trim();
        const 次 = { ...rec, 状態: 選んだ状態, 返事: 文, 返事の時: new Date().toISOString() };
        書く(いまの印, 次, { t: 'voiceReply', v: { 状態: 選んだ状態, 返事: 文 } }, true);
        // ★「出しました」とは書きません。ここはまだ送信箱に積んだだけで、
        //   元の投稿が消えていればサーバーが断ります（そのときは画面の帯に出ます）
        document.getElementById('voiceReplyState').textContent = '返事を送りました。届いたら全員の画面に出ます。';
      });
    }

    const 消すボタン = document.getElementById('voiceDrop');
    if (消すボタン) 消すボタン.addEventListener('click', () => 消す());
  }

  async function 写真を出す(箱) {
    const id = 箱.dataset.voiceShot;
    const res = await Sync.ask('voiceImage', { fileId: id });
    if (res && res.ok && res.image) {
      箱.innerHTML = `<img class="voice-shot__img" alt="付けられた写真" src="data:${文字(res.type || 'image/jpeg')};base64,${res.image}">`;
    } else {
      // ★黙って消しません。なぜ出ないのかを書きます
      箱.innerHTML = `<p class="voice-shot__note">写真を出せませんでした（${文字((res && res.error) || '')}）</p>`;
    }
  }

  async function 消す() {
    if (送っている) return;   // ★待っているあいだ、二度押しを止めます
    const rec = ひとつ(いまの印);
    if (!rec) return;
    /* ★`state` という名前を使いません。`js/app.js` の `state`（画面の状態）を覆い隠すためです。
         いまは中で `.textContent` しか使っていないので無害ですが、**あとから誰かが中に
         `state.storeId` と書いた瞬間、落ちない壊れ方に戻ります**（本部の指摘・2026-09-23）。
       ★欄が無いときにも落ちないようにします。ここで落ちると**記録はもう消えているのに**、
         人には「押したのに何も言わない」に見えます */
    const 欄 = document.getElementById('voiceDropState');
    const しらせる = (文) => { if (欄) 欄.textContent = 文; };
    // ★「消しました」とは書きません。控えの履歴には残るためです
    const よいか = window.confirm(
      'この投稿を、みんなの画面から消します。\n\n'
      + '写真と動画もドライブから消します。\n'
      + '★控え（スプレッドシート）の履歴には残ります。そこは消せません。\n\n'
      + '消してよいですか。',
    );
    if (!よいか) return;

    const 添付 = (rec.添付 || []).map((a) => a.id).filter(Boolean);

    /* ★記録が先です。**ただし「送信箱に積む」だけでは先になりません。**
         `Sync.enqueue` は積むだけで待たず、`Sync.ask` は直接サーバーへ行くので、
         **添付の方が先に消えていました**（2026-09-23、本部の指摘）。
         コメントには「記録が先です」と書いてあったのに、**順番は書いてあるとおりでは
         ありませんでした。**送り切るのを見届けてから、添付に進みます。
       ★`waitSent()` は提出と同じ仕掛けです（送信箱が空になるまで待ちます）。 */
    送っている = true;
    try {
      書く(いまの印, { 消えた: true, 消した時: new Date().toISOString() }, { t: 'voiceDrop' }, true);
      しらせる('消しています…');

      const 送り = await Sync.waitSent();
      if (!送り.ok) {
        /* ★ここで止めます。記録が消えていないのに添付だけ消すと、
             **「写真があるのに出ない投稿」**が全員の画面に残ります */
        しらせる(`★まだ、みんなの画面から消せていません（${送り.error || '送れませんでした'}）。`
          + '写真と動画はそのままにしてあります。電波が戻れば自動で送られるので、'
          + 'しばらくしてからもう一度開いてください。');
        return;
      }
      しらせる('みんなの画面から消しました。');

      if (添付.length) {
        const res = await Sync.ask('voiceDrop', { fileIds: 添付 });
        if (!res || !res.ok) {
          // ★黙って失敗しません
          しらせる('みんなの画面からは消しました。'
            + `★ただし写真か動画が消せませんでした（${(res && res.error) || '返事がありません'}）。`
            + '出したばかりの投稿だと、控えが追いつくまで断られることがあります。'
            + '少し時間をおいて、もう一度消してみてください。'
            + 'それでも消えないときは ko-dai さんに伝えてください。');
          return;
        }
      }
      setTimeout(() => {
        いまの画面 = 'list';
        出す();
      }, 1200);
    } finally {
      送っている = false;
    }
  }

  /* ------------------------------------------------------------
   *  出し入れ
   * ---------------------------------------------------------- */

  /**
   * パネルを、ヘッダーのすぐ下から始めます
   *
   * ★右上の「同期のしるし」「⚙ 設定」「📋 提出記録」（マインでは「ホーム」「Manage」も）を、
   *   このページでも**そのまま使える**ようにするためです（ko-dai さんの指示・2026-09-23）。
   * ★**同じものをパネルの中に作り直しません。**同期のしるしを描いているのは `js/app.js` で、
   *   作り直すと**更新が2か所**になります。片方だけ古い状態で止まり、**落ちないので気づけません**。
   *   本物を出しておけば、更新は1か所のままです。
   * ★`css/style.css` は本部の持ち物なので触りません。この1行だけ、ここで当てます
   *   （`.interview` は面接マニュアルと QRコード・URL も使っているので、CSS を変えると
   *     よその分野の見た目まで変わります）。
   */
  function ヘッダーの下に置く() {
    const panel = document.getElementById('voicePanel');
    const header = document.querySelector('.app-header');
    if (!panel) return;
    if (!header) {   // ヘッダーが無い画面では、今までどおり全面（バーがノッチを払うのが正しい）
      panel.style.top = '';
      ノッチを二重に払わない(panel, null);
      return;
    }
    /* ★ヘッダー**全部**ではなく、**上の段（.app-header__inner）の下**に合わせます。
         ヘッダーの中には**店舗タブ（.store-tabs）も入って**いて、ご意見の画面では要らないのに
         その分だけ**暗い余白**になっていました（2026-09-23、ko-dai さんの指摘）。
         ★試し台に店舗タブを足して**同じ余白を出してから**直しています（手元では31px でした）。
       ★上の段が見つからないときは、ヘッダー全部に倒します（余白は出ますが、隠れるよりましです）。 */
    const 上の段 = header.querySelector('.app-header__inner');
    const 下端 = (上の段 || header).getBoundingClientRect().bottom;
    panel.style.top = `${Math.max(0, Math.round(下端))}px`;
    ノッチを二重に払わない(panel, header);
  }

  /**
   * ★パネルのバーから、ノッチ（画面上の切り欠き）の分の余白を引きます
   *
   * ★バー（`.interview__bar`）は、もともと**画面いっぱいに出す前提**で作られていて、
   *   `padding: calc(env(safe-area-inset-top) + 10px) …` と、**自分でノッチの分を払います**。
   *   パネルをヘッダーの下に動かしたので、**ヘッダーもノッチを払い、バーもノッチを払う**——
   *   **二重**になり、iPhone ではノッチの高さ（50〜60pt）の暗い余白が出ていました
   *   （2026-09-24、ko-dai さんの指摘。**最新版なのに直っていない**、で分かりました）。
   * ★**机のブラウザでは再現しません。**`env(safe-area-inset-top)` が 0 だからです。
   *   前の日に「余白 0px」と測ったのは、**ノッチの無い所で測っていた**だけでした。
   *   ヘッダーとバーに作り物のノッチ（59px）を入れて、**同じ余白を出してから**直しています。
   * ★引く量は、**ヘッダーが実際に払った分**（`.app-header` の `padding-top`）をそのまま使います。
   *   CSS の式をここに書き写さないためです（書き写すと、2か所がずれたときに黙って余白が戻ります）。
   * ★`css/style.css` は本部の持ち物で、`.interview__bar` は**面接マニュアルと QRコード も使う**ので、
   *   CSS は直しません。ご意見のパネルのバーにだけ、ここで当てます。
   */
  function ノッチを二重に払わない(panel, header) {
    const bar = panel.querySelector('.interview__bar');
    if (!bar || typeof getComputedStyle !== 'function') return;
    bar.style.paddingTop = '';   // ★先に外します。外さずに測ると、前に当てた値から**もう一度**引いてしまいます
    if (!header) return;         // ヘッダーの下に置かないときは、バーがノッチを払うのが正しい
    const ノッチ = parseFloat(getComputedStyle(header).paddingTop) || 0;
    if (ノッチ <= 0) return;     // ノッチが無い端末では、何もしません
    const いま = parseFloat(getComputedStyle(bar).paddingTop) || 0;
    bar.style.paddingTop = `${Math.max(0, Math.round(いま - ノッチ))}px`;
  }

  function 開く() {
    const panel = document.getElementById('voicePanel');
    if (!panel) return;
    ヘッダーの下に置く();
    いまの画面 = 'list';
    panel.classList.remove('is-hidden');
    document.body.classList.add('is-voice-open');
    出す();
    見た印を書く();      // 開いたら、返事は読んだことにします
    印を出す();
  }

  function 閉じる() {
    const panel = document.getElementById('voicePanel');
    if (!panel) return;
    panel.classList.add('is-hidden');
    document.body.classList.remove('is-voice-open');
    選んだもの = [];
    印を出す();
  }

  function つなぐ() {
    const btn = document.getElementById('storesVoiceBtn');
    const panel = document.getElementById('voicePanel');
    if (!btn || !panel) return;
    btn.addEventListener('click', 開く);
    document.getElementById('voiceClose').addEventListener('click', 閉じる);
    document.getElementById('voiceNew').addEventListener('click', () => {
      いまの画面 = 'new';
      出す();
    });
    中身().addEventListener('click', (e) => {
      const b = e.target.closest('[data-voice-open]');
      if (!b) return;
      いまの印 = b.dataset.voiceOpen;
      いまの画面 = 'one';
      出す();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.classList.contains('is-hidden')) 閉じる();
    });
    /* ★画面の向きが変わると、ヘッダーの高さも変わります（横にするとスマホは低くなります）。
         置き直さないと、パネルがヘッダーに重なるか、下に隙間が空きます。

       ★**3つとも要ります**（本部の指摘・2026-09-23。どれも実機でしか出ません）。
         ・`resize` … ふつうの大きさ変わり
         ・`orientationchange` … ★iOS は `resize` が鳴った時点で**ヘッダーの高さがまだ変わっていない**
           ことがあり、回転前の値で置いてしまいます。こちらでもう一度置き直します
         ・`visualViewport` の `resize` … ★iOS は**ソフトキーボードで `window` の `resize` が鳴りません**。
           いまは「ひとこと」以外を打たずに出せるので当たる場面は減りましたが、打つ人はいます */
    const 置き直す = () => {
      if (!panel.classList.contains('is-hidden')) ヘッダーの下に置く();
    };
    window.addEventListener('resize', 置き直す);
    window.addEventListener('orientationchange', 置き直す);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', 置き直す);
    // 同期で返事が届いたら、赤い印を出し直します
    setInterval(() => {
      印を出す();
      if (!panel.classList.contains('is-hidden') && いまの画面 === 'list') 出す();
    }, 20000);
    印を出す();
  }

  if (typeof document !== 'undefined') {
    const はじめる = () => つなぐ();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', はじめる);
    else はじめる();
  }

  return {
    // ★`ヘッダーの下に置く` は検算から呼びます（実機の回転は試せないので、
    //   「**高さが変わったら追いかけるか**」だけを作り物の DOM で通します）
    ヘッダーの下に置く, ノッチを二重に払わない,
    入れ先, 種類たち, 状態たち, 本文の上限, 写真の上限, 動画の上限, 添付の数, 動画の秒,
    文字, 新しい印, キー, 全部, ひとつ, 新しい返事の数, 確かめる, 大きさの文,
  };
})();
