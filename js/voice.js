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
            <span class="voice-card__kind">${種類の絵(r.種類)} ${文字(種類の名(r.種類))}</span>
            <span class="voice-card__state voice-card__state--${文字(r.状態 || '未読')}">${文字(r.状態 || '未読')}</span>
          </span>
          <span class="voice-card__body">${文字(String(r.本文 || '').slice(0, 80))}${String(r.本文 || '').length > 80 ? '…' : ''}</span>
          <span class="voice-card__foot">
            <span>${名}</span>
            <span>${文字(日時の文(r.出した時))}</span>
            ${添付 ? `<span class="voice-card__clip">📎 ${添付}</span>` : ''}
            ${返事あり ? '<span class="voice-card__reply">返事あり</span>' : ''}
          </span>
        </button>`;
    }).join('');
    return `${頭}<div class="voice-list">${行}</div>`;
  }

  function 出す画面の絵() {
    const 選び = 種類たち.map((k, i) => `
      <label class="voice-kind">
        <input type="radio" name="voiceKind" value="${k.id}"${i === 0 ? ' checked' : ''}>
        <span>${k.絵} ${文字(k.名)}</span>
      </label>`).join('');
    return `
      <div class="voice-form">
        <div class="voice-kinds">${選び}</div>
        <label class="voice-label" for="voiceText">どうしましたか</label>
        <textarea class="voice-text" id="voiceText" rows="7" maxlength="${本文の上限}"
          placeholder="いつ・どの画面で・何をしたら・どうなったか を書いてください"></textarea>
        <p class="voice-count" id="voiceCount">0／${本文の上限}文字</p>

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
        <p class="voice-state" id="voiceState"></p>
      </div>`;
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
   *  出す
   * ---------------------------------------------------------- */

  let 選んだもの = [];   // [{ kind, file, 秒 }]

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

  function つなぐ出す画面() {
    const text = document.getElementById('voiceText');
    const count = document.getElementById('voiceCount');
    const state = document.getElementById('voiceState');
    const file = document.getElementById('voiceFile');
    選んだもの = [];
    添付を描く();

    text.addEventListener('input', () => {
      count.textContent = `${text.value.length}／${本文の上限}文字`;
    });

    /* ★まとめて選べます。1つだめでも、通ったものは入れます。
         ★だめだったものは**最後にまとめて**出します（1つずつ上書きすると、
           最後の1件しか読めません。何が落ちたのか分からなくなります） */
    file.addEventListener('change', async () => {
      const 選ばれた = Array.prototype.slice.call(file.files || []);
      file.value = '';
      if (!選ばれた.length) return;
      state.textContent = '確かめています…';
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
      state.textContent = だめ.length ? `★${だめ.join('　／　')}` : '';
    });

    document.getElementById('voiceFiles').addEventListener('click', (e) => {
      const b = e.target.closest('[data-voice-unfile]');
      if (!b) return;
      選んだもの.splice(Number(b.dataset.voiceUnfile), 1);
      添付を描く();
    });

    document.getElementById('voiceCancel').addEventListener('click', () => {
      選んだもの = [];
      いまの画面 = 'list';
      出す();
    });

    document.getElementById('voiceSend').addEventListener('click', () => 送る());
  }

  async function 送る() {
    if (送っている) return;
    const text = document.getElementById('voiceText');
    const state = document.getElementById('voiceState');
    const 本文 = String(text.value || '').trim();
    if (!本文) { state.textContent = '★何があったかを書いてください'; return; }
    if (本文.length > 本文の上限) { state.textContent = `★${本文の上限}文字までです`; return; }
    if (!私の番号()) {
      state.textContent = '★あなたの番号が入っていません。設定で番号を入れてから出してください';
      return;
    }
    // ★添付があるときは、その場でドライブへ送ります。電波が無いと送れません
    if (選んだもの.length && typeof navigator !== 'undefined' && navigator.onLine === false) {
      state.textContent = '★電波が届いていません。写真や動画を付けるときは、つながってから出してください';
      return;
    }

    送っている = true;
    const 印 = 新しい印();
    const 添付 = [];
    try {
      for (let i = 0; i < 選んだもの.length; i++) {
        const x = 選んだもの[i];
        state.textContent = `${x.kind === 'movie' ? '動画' : '写真'}を送っています…（${i + 1}／${選んだもの.length}）`;
        const data = x.kind === 'photo' ? await 写真を縮める(x.file) : await 中身を読む(x.file);
        const res = await Sync.ask('voicePut', {
          voiceId: 印, kind: x.kind, seq: i + 1, data,
        }, { ms: 120000 });
        if (!res || !res.ok) {
          // ★ここで止めます。記録だけ先に作ると、写真の無い投稿が残ります
          state.textContent = `★${(res && res.error) || '送れませんでした'}`;
          送っている = false;
          return;
        }
        添付.push({ id: res.fileId, 型: x.kind, バイト: res.bytes, size: res.size });
        // ★動画は見せないので、受け取れたことだけは、はっきり出します
        state.textContent = `${x.kind === 'movie' ? '動画' : '写真'}を受け取りました（${res.size}）`;
      }

      const 種類 = (document.querySelector('input[name="voiceKind"]:checked') || {}).value || 'bug';
      const rec = {
        種類,
        本文,
        店舗: (typeof state !== 'undefined' && state && state.storeId) ? state.storeId : '',
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
      いまの画面 = 'one';
      いまの印 = 印;
      出す();
    } catch (e) {
      state.textContent = `★送れませんでした（${e && e.message ? e.message : e}）`;
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
    const rec = ひとつ(いまの印);
    if (!rec) return;
    const state = document.getElementById('voiceDropState');
    // ★「消しました」とは書きません。控えの履歴には残るためです
    const よいか = window.confirm(
      'この投稿を、みんなの画面から消します。\n\n'
      + '写真と動画もドライブから消します。\n'
      + '★控え（スプレッドシート）の履歴には残ります。そこは消せません。\n\n'
      + '消してよいですか。',
    );
    if (!よいか) return;

    const 添付 = (rec.添付 || []).map((a) => a.id).filter(Boolean);
    // ★記録が先です。こちらが先に消えていれば、ドライブが失敗しても人の目には触れません
    書く(いまの印, { 消えた: true, 消した時: new Date().toISOString() }, { t: 'voiceDrop' }, true);
    state.textContent = 'みんなの画面から消しました。';

    if (添付.length) {
      const res = await Sync.ask('voiceDrop', { fileIds: 添付 });
      if (!res || !res.ok) {
        // ★黙って失敗しません
        state.textContent = 'みんなの画面からは消しました。'
          + `★ただし写真か動画が消せませんでした（${(res && res.error) || '返事がありません'}）。ko-dai さんに伝えてください。`;
        return;
      }
    }
    setTimeout(() => {
      いまの画面 = 'list';
      出す();
    }, 1200);
  }

  /* ------------------------------------------------------------
   *  出し入れ
   * ---------------------------------------------------------- */

  function 開く() {
    const panel = document.getElementById('voicePanel');
    if (!panel) return;
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
    入れ先, 種類たち, 状態たち, 本文の上限, 写真の上限, 動画の上限, 添付の数, 動画の秒,
    文字, 新しい印, キー, 全部, ひとつ, 新しい返事の数, 確かめる, 大きさの文,
  };
})();
