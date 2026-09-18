/* ============================================================
 *  QRコード・URL（人にアプリを渡すとき）
 *
 *  2026-09-18、ko-dai さんの指示。2か所で使います。
 *    ① T3Dining の欄の**一番下**「QRコード・URL」 … ワークスとシフト提出の2枚
 *    ② 面接マニュアルのパネルの中                   … シフト提出の1枚
 *
 *  ★★「QRコード・URL」のボタンは、T3Dining の欄の**一番下**に置く決まりです
 *    （ko-dai さんの指示。指示がない限り動かさない）。ほかのボタンは**この上**に足してください。
 *    `道具/公開用を作る.py` の `check_t3dining_last()` が、一番下でなければ公開を止めます。
 *
 *  ★配る URL と QR の絵は js/config.js の1か所だけです（ここに書き写しません）。
 *      ワークス     … WORKS_SHARE_URL ／ WORKS_QR_IMG （絵は 素材/ワークスのQRを作る.swift）
 *      シフト提出   … SHIFT_SHARE_URL ／ SHIFT_QR_IMG （絵は 素材/シフト提出のQRを作る.swift・シフト部署）
 *    URL を変えたら、絵も作り直してください（道具が読み直して1文字も同じか確かめます）。
 *  ★QR にも URL にも、**合言葉や番号は入っていません。**全員が同じものを使います。
 *
 *  ★画面（view）ではなく、上に重ねるパネルです（面接マニュアルと同じ理由。js/app.js に触りません）。
 *    入れ物の見た目は面接マニュアルの `.interview` を使い回しています（css/style.css）。
 * ============================================================ */
const ShareView = (() => {
  const 渡すもの = {
    works: {
      名前: 'ワークス（アプリ）',
      説明: 'アプリ本体です。開いたら、合言葉と、その人の番号を入れてもらいます。',
      url: () => (typeof WORKS_SHARE_URL !== 'undefined' ? WORKS_SHARE_URL : ''),
      絵: () => (typeof WORKS_QR_IMG !== 'undefined' ? WORKS_QR_IMG : ''),
      絵の名: 'ワークスのQRコード',
      別に: '合言葉と番号は、QRコードやURLとは別に伝えてください。',
    },
    shift: {
      名前: 'シフト提出',
      説明: 'アルバイトがシフトの希望を出すページです。開いたら、その人のシフトの番号を入れてもらいます。',
      url: () => (typeof SHIFT_SHARE_URL !== 'undefined' ? SHIFT_SHARE_URL : ''),
      絵: () => (typeof SHIFT_QR_IMG !== 'undefined' ? SHIFT_QR_IMG : ''),
      絵の名: 'シフト提出ページのQRコード',
      別に: 'シフトの番号は、1人ずつ別に送ってください（アプリの番号とは別のものです）。',
    },
  };

  const 文字 = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  /** マイン（mine/）から開くと相対の img/ が /mine/img/ を見て404になるので、ロゴと同じく頭を付けます */
  const 頭 = () => (typeof document !== 'undefined' && document.body && document.body.dataset.assets) || '';

  /** 1枚分の絵。題 … 札の見出し（省くと名前） */
  function 札(kind, 題) {
    const d = 渡すもの[kind];
    if (!d) return '';
    const url = d.url();
    const 絵 = d.絵();
    if (!url) return '';
    return `<section class="share-card">
      <h3 class="share-card__title">${文字(題 || d.名前)}</h3>
      <p class="share-card__lead">${文字(d.説明)}</p>
      ${絵 ? `<img class="share-card__qr" src="${文字(頭() + 絵)}" alt="${文字(d.絵の名)}" width="200" height="200">` : ''}
      <p class="share-card__how">スマホのカメラで読み取ると開きます。LINEで送るときは「URLをコピー」を押して貼ります。</p>
      <textarea class="field__input share-card__url" rows="2" readonly aria-label="${文字(d.名前)}のURL">${文字(url)}</textarea>
      <button type="button" class="btn btn--primary share-card__copy" data-share-copy="${kind}">URLをコピー</button>
      <p class="share-card__note">${文字(d.別に)}</p>
    </section>`;
  }

  /** 「URLをコピー」。コピーできない端末では、URL を選んだ状態にして長押しで写してもらいます（シフトの QR と同じ動き） */
  async function 写す(btn) {
    // ★URL の欄は2行の textarea です（1行の欄だと途中で切れて、何を送るのか見えません）
    const kind = btn.getAttribute('data-share-copy');
    const url = 渡すもの[kind] ? 渡すもの[kind].url() : '';
    const 入れ物 = btn.parentElement.querySelector('.share-card__url');
    const できた = () => {
      btn.textContent = 'コピーしました';
      setTimeout(() => { btn.textContent = 'URLをコピー'; }, 1800);
    };
    try {
      await navigator.clipboard.writeText(url);
      できた();
      return;
    } catch (e) { /* 下の古いやり方を試します */ }
    // ★2番目：選んでから古いやり方（execCommand）で写します。新しいやり方を断る端末や、アプリの中の画面で効くことがあります
    if (入れ物) { 入れ物.focus(); 入れ物.select(); }
    let 写せた = false;
    try { 写せた = document.execCommand('copy'); } catch (e) { 写せた = false; }
    if (写せた) { できた(); return; }
    // ★この案内はすぐ戻しません。長押しして写すあいだ出ていないと、何をすればいいか分からなくなります
    btn.textContent = '選んだURLを長押しでコピー';
  }

  /* ------------------------------------------------------------
   *  パネル（T3Dining の欄の一番下から開く）
   * ---------------------------------------------------------- */
  let 戻る先 = null;

  function 開く() {
    const panel = document.getElementById('sharePanel');
    if (!panel) return;
    戻る先 = document.activeElement;
    document.getElementById('shareBody').innerHTML = 札('works') + 札('shift');
    panel.classList.remove('is-hidden');
    document.documentElement.classList.add('is-interview-open');
    panel.querySelector('.interview__scroll').scrollTop = 0;
    setTimeout(() => document.getElementById('shareClose').focus(), 30);
  }

  function 閉じる() {
    const panel = document.getElementById('sharePanel');
    if (!panel || panel.classList.contains('is-hidden')) return;
    panel.classList.add('is-hidden');
    // ★面接マニュアルが開いたままなら、画面の固定は外しません
    const 面接 = document.getElementById('interviewPanel');
    if (!面接 || 面接.classList.contains('is-hidden')) {
      document.documentElement.classList.remove('is-interview-open');
    }
    if (戻る先 && typeof 戻る先.focus === 'function') 戻る先.focus();
  }

  function つなぐ() {
    // どこに出した「URLをコピー」でも、ここ1か所で受けます
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-share-copy]');
      if (b) 写す(b);
    });
    // 面接マニュアルの中のシフト提出（中身は変わらないので、はじめに1回だけ入れます）
    const 面接の欄 = document.getElementById('interviewShare');
    if (面接の欄) 面接の欄.innerHTML = 札('shift', 'シフト提出のページを渡す');

    const btn = document.getElementById('storesShareBtn');
    const panel = document.getElementById('sharePanel');
    if (!btn || !panel) return;
    btn.addEventListener('click', 開く);
    document.getElementById('shareClose').addEventListener('click', 閉じる);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') 閉じる(); });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', つなぐ);
    else つなぐ();
  }

  return { 札, 文字 };
})();
