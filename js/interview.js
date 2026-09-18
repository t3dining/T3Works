/* ============================================================
 *  面接マニュアル（アルバイトの面接で、上から順に聞いていく一覧）
 *
 *  2026-09-18、ko-dai さんの指示。元は「面接マニュアル _印刷用.pdf」（1ページ）。
 *  ワークスとマインの「T3Dining」の欄から開きます。文はマネージで直します。
 *
 *  ★中身はアプリに書いてありません。スプレッドシート側（合言葉の内側）に入っています
 *    （設定名 `interviewManual`／置き場は js/storage.js の InterviewManual）。
 *    人の名前・金額・マイナンバーの扱いが入っているためです（公開物に書かない決まり）。
 *    ★ここに見本として本物の文を書かないでください。書いた瞬間、誰でも読めます。
 *
 *  ★画面（view）ではなく、上に重ねるパネルにしてあります。
 *    js/app.js の render() は、画面ごとに**ほかの画面を全部隠す**作りなので、
 *    画面を1つ足すと十数か所を直すことになり、1か所忘れると別の画面と重なって出ます。
 *    パネルなら js/app.js に1文字も触りません（この画面の出し入れは、このファイルだけで完結します）。
 *
 *  ★書き方（マネージの「書き方」と同じです。行の頭の記号で決まります）
 *     【見出し】   大きな区切り（例：【まず聞くこと】【採用なら】）
 *     ◆ 項目      聞くこと・伝えること。押すと ✓ が付きます   ※ ❖ でも同じ
 *     → 説明      項目の下の説明                             ※ ➢ でも同じ
 *     ・ 細かく    説明のさらに下                             ※ ■ でも同じ
 *     ！ 大事      赤で目立たせる                             ※ ! でも同じ
 *     ？ 聞く      応募者に聞くこと（吹き出しで出ます）          ※ ? でも同じ
 *     記号なし    ふつうの文
 *    PDF の記号（❖ ➢ ■）のまま貼っても読めるようにしてあります。
 *
 *  ★✓ は**この端末の中だけ**で、保存しません。面接が終わったら、一番下の「チェックを全て外す」
 *    （上の「チェックを消す」も同じ）で戻します。アプリを閉じても消えます（1人の面接のあいだだけ使う印です）。
 * ============================================================ */
const InterviewView = (() => {
  const 記号 = {
    item: /^[◆❖◇]\s*/,
    sub: /^[→➢⇒]\s*/,
    sub2: /^[・■▪]\s*/,
    em: /^[！!]\s*/,
    ask: /^[？?]\s*/,
  };

  /**
   * 文を区切りと項目に分けます
   * 返すもの … [{ title, rows: [{ kind:'item', text, lines:[{kind,text}] } | { kind, text }] }]
   */
  function 読む(text) {
    const 区切り = [];
    let sec = null;
    let item = null;
    const 始める = (title) => { sec = { title, rows: [] }; 区切り.push(sec); item = null; };

    String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach((生) => {
      const 行 = 生.trim();
      if (!行) return;
      const 見出し = 行.match(/^【(.+)】$/);
      if (見出し) { 始める(見出し[1].trim()); return; }
      if (!sec) 始める('');

      if (記号.item.test(行)) {
        item = { kind: 'item', text: 行.replace(記号.item, ''), lines: [] };
        sec.rows.push(item);
        return;
      }
      let kind = 'text';
      let body = 行;
      ['sub', 'sub2', 'em', 'ask'].some((k) => {
        if (!記号[k].test(行)) return false;
        kind = k;
        body = 行.replace(記号[k], '');
        return true;
      });
      const line = { kind, text: body };
      // 応募者に聞くことは、項目の続きではなく区切りの中の1行として出します
      if (kind === 'ask') { sec.rows.push(line); item = null; return; }
      if (item) item.lines.push(line);
      else sec.rows.push(line);
    });
    return 区切り.filter((s) => s.title || s.rows.length);
  }

  /** 画面に出す文字は、必ずここを通します（中身はスプレッドシートから来るので、HTMLとして読みません） */
  const 文字 = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const 行の絵 = (line) => {
    if (line.kind === 'sub') return `<li class="interview-line interview-line--sub">${文字(line.text)}</li>`;
    if (line.kind === 'sub2') return `<li class="interview-line interview-line--sub2">${文字(line.text)}</li>`;
    if (line.kind === 'em') return `<li class="interview-line interview-line--em">${文字(line.text)}</li>`;
    return `<li class="interview-line">${文字(line.text)}</li>`;
  };

  /** 項目の数（✓ を数える分母） */
  const 項目の数 = (区切り) => 区切り.reduce((n, s) => n + s.rows.filter((r) => r.kind === 'item').length, 0);

  /**
   * 絵にします
   * 済み … ✓ を付けた項目の番号（上から数えた通し番号）。無ければ ✓ のボタンを出しません（マネージの見え方の確かめ用）
   */
  function 絵(区切り, 済み) {
    let n = 0;
    return 区切り.map((sec) => {
      const 数 = sec.rows.filter((r) => r.kind === 'item').length;
      const 始まり = n;
      const 中 = sec.rows.map((row) => {
        if (row.kind === 'ask') {
          return `<p class="interview-ask"><span class="interview-ask__tag">聞く</span>${文字(row.text)}</p>`;
        }
        if (row.kind !== 'item') {
          return `<ul class="interview-lines interview-lines--loose">${行の絵(row)}</ul>`;
        }
        const i = n++;
        const 済 = !!(済み && 済み.has(i));
        const 下 = row.lines.length
          ? `<ul class="interview-lines">${row.lines.map(行の絵).join('')}</ul>` : '';
        const 印 = 済み
          ? `<button type="button" class="interview-item__check" data-interview-item="${i}"
               aria-pressed="${済}" aria-label="${済 ? '済み（押すと戻します）' : 'まだ（押すと済みにします）'}"></button>`
          : '<span class="interview-item__dot" aria-hidden="true"></span>';
        return `<div class="interview-item${済 ? ' is-done' : ''}" data-interview-row="${i}">
          ${印}
          <div class="interview-item__body">
            <p class="interview-item__title">${文字(row.text)}</p>${下}
          </div>
        </div>`;
      }).join('');
      let 済数 = 0;
      for (let k = 始まり; k < 始まり + 数; k += 1) if (済み && 済み.has(k)) 済数 += 1;
      const 数の印 = 済み && 数 ? `<span class="interview-sec__count">${済数} / ${数}</span>` : '';
      const 頭 = sec.title
        ? `<h3 class="interview-sec__title"><span>${文字(sec.title)}</span>${数の印}</h3>` : '';
      return `<section class="interview-sec">${頭}${中}</section>`;
    }).join('');
  }

  /* ------------------------------------------------------------
   *  ワークス・マインのパネル
   * ---------------------------------------------------------- */
  let 済み = new Set();
  let 見ている印 = null;   // 出している文の保存時刻（変わったら出し直します）
  let 見張り = null;
  let 戻る先 = null;

  function 今の文() {
    return typeof InterviewManual !== 'undefined' ? InterviewManual.get() : null;
  }

  function 出す() {
    const body = document.getElementById('interviewBody');
    const lead = document.getElementById('interviewLead');
    const reset = document.getElementById('interviewReset');
    const foot = document.getElementById('interviewFoot');
    const resetAll = document.getElementById('interviewResetAll');
    if (!body) return;
    const v = 今の文();
    const 前の印 = 見ている印;
    見ている印 = v ? v.at : null;
    // ★文が直されたら、✓ の番号がずれるので消します
    if (前の印 && 見ている印 !== 前の印) 済み = new Set();

    const 区切り = 読む(v ? v.text : '');
    const 全部 = 項目の数(区切り);
    if (!区切り.length) {
      lead.textContent = '';
      body.innerHTML = `<div class="interview-empty">
        <p class="interview-empty__title">まだ入っていません</p>
        <p>面接マニュアルの文は、マネージの「面接マニュアル」で入れます。</p>
        <p>入れてあるのに出ないときは、ヘッダーの丸い印が ✓ になるまで待ってから開き直してください
          （合言葉と番号が入っている端末にだけ届きます）。</p>
      </div>`;
      reset.classList.add('is-hidden');
      foot.classList.add('is-hidden');
      return;
    }
    reset.classList.toggle('is-hidden', 済み.size === 0);
    // ★一番下のボタンは、項目があればいつも出します（✓ が無いあいだは押せないだけ）。
    //   出たり消えたりすると「どこにあったか」を毎回探すことになるためです
    foot.classList.toggle('is-hidden', !全部);
    resetAll.disabled = 済み.size === 0;
    lead.innerHTML = 全部
      ? `上から順に聞いていきます。済んだら左の丸を押すと <b>✓</b> が付きます。
         <span class="interview__progress">済み <b>${済み.size}</b> / ${全部}</span>`
      : '';
    body.innerHTML = 絵(区切り, 済み);
  }

  function 開く() {
    const panel = document.getElementById('interviewPanel');
    if (!panel) return;
    戻る先 = document.activeElement;
    出す();
    panel.classList.remove('is-hidden');
    document.documentElement.classList.add('is-interview-open');
    panel.querySelector('.interview__scroll').scrollTop = 0;
    setTimeout(() => document.getElementById('interviewClose').focus(), 30);
    // ★開いているあいだに同期で文が届いたら、出し直します（js/app.js の onChange には触らないため）
    clearInterval(見張り);
    見張り = setInterval(() => {
      const v = 今の文();
      if ((v ? v.at : null) !== 見ている印) 出す();
    }, 3000);
  }

  function 閉じる() {
    const panel = document.getElementById('interviewPanel');
    if (!panel || panel.classList.contains('is-hidden')) return;
    panel.classList.add('is-hidden');
    document.documentElement.classList.remove('is-interview-open');
    clearInterval(見張り);
    見張り = null;
    if (戻る先 && typeof 戻る先.focus === 'function') 戻る先.focus();
  }

  function 押した(e) {
    const b = e.target.closest('[data-interview-item]');
    if (!b) return;
    const i = Number(b.getAttribute('data-interview-item'));
    if (済み.has(i)) 済み.delete(i); else 済み.add(i);
    const 位置 = document.querySelector('#interviewPanel .interview__scroll').scrollTop;
    出す();
    document.querySelector('#interviewPanel .interview__scroll').scrollTop = 位置;
    const 次 = document.querySelector(`[data-interview-item="${i}"]`);
    if (次) 次.focus();
  }

  function パネルをつなぐ() {
    const btn = document.getElementById('storesInterviewBtn');
    const panel = document.getElementById('interviewPanel');
    if (!btn || !panel) return;
    btn.addEventListener('click', 開く);
    document.getElementById('interviewClose').addEventListener('click', 閉じる);
    document.getElementById('interviewReset').addEventListener('click', () => {
      済み = new Set();
      出す();
    });
    // ★一番下の「チェックを全て外す」。外したら一番上に戻して、次の人の面接をすぐ始められるようにします
    const note = document.getElementById('interviewFootNote');
    const 元の案内 = note.textContent;
    let 案内を戻す = null;
    document.getElementById('interviewResetAll').addEventListener('click', () => {
      済み = new Set();
      出す();
      note.textContent = '✓ を全て外しました。';
      clearTimeout(案内を戻す);
      案内を戻す = setTimeout(() => { note.textContent = 元の案内; }, 4000);
      panel.querySelector('.interview__scroll').scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('interviewBody').addEventListener('click', 押した);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') 閉じる();
    });
  }

  /* ------------------------------------------------------------
   *  マネージの「面接マニュアル」（直す欄と、見え方の確かめ）
   * ---------------------------------------------------------- */
  function 直す欄をつなぐ() {
    const input = document.getElementById('interviewInput');
    if (!input) return;
    const save = document.getElementById('interviewSave');
    const saved = document.getElementById('interviewSaved');
    const state = document.getElementById('interviewState');
    const preview = document.getElementById('interviewPreview');
    let 手を入れた = false;
    let 入れた印 = null;

    const 見え方 = () => {
      const 区切り = 読む(input.value);
      preview.innerHTML = 区切り.length
        ? 絵(区切り, null)
        : '<p class="admin-note">ここに、ワークスとマインでの見え方が出ます。</p>';
      const 全部 = 項目の数(区切り);
      document.getElementById('interviewCount').textContent = 全部 ? `${全部}項目` : '';
    };
    const 入れ直す = () => {
      const v = 今の文();
      入れた印 = v ? v.at : null;
      input.value = v ? v.text : '';
      state.textContent = v
        ? `最後に保存：${new Date(v.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
        : 'まだ一度も保存されていません。';
      見え方();
    };

    入れ直す();
    input.addEventListener('input', () => { 手を入れた = true; 見え方(); });
    save.addEventListener('click', () => {
      const v = InterviewManual.save(input.value);
      入れた印 = v.at;
      手を入れた = false;
      input.value = v.text;
      state.textContent = '保存しました。全店舗の端末に配られます。';
      見え方();
      saved.classList.remove('is-hidden');
      setTimeout(() => saved.classList.add('is-hidden'), 2500);
    });
    // ★同期で届いた文を入れます。**打っている途中は入れ替えません**（打った分が消えるので）
    setInterval(() => {
      if (手を入れた) return;
      const v = 今の文();
      if ((v ? v.at : null) !== 入れた印) 入れ直す();
    }, 3000);
  }

  if (typeof document !== 'undefined') {
    const はじめる = () => { パネルをつなぐ(); 直す欄をつなぐ(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', はじめる);
    else はじめる();
  }

  return { 読む, 絵, 項目の数, 文字 };
})();
