/* ============================================================
 *  ★画面が止まったことを、その場で知らせる
 *
 *  2026年9月5日、消し忘れた1行でマネージのトップが止まりました。
 *  画面は途中まで描いて終わり、**どこにも何も出ませんでした**。
 *  出ていたのは、ふだん誰も開かない開発者ツールの中だけです。
 *  たまたま別件でそこを見た人がいたから見つかりました。
 *
 *  CLAUDE.md の「黙って失敗しない」は、保存には効いていましたが
 *  （storeFail → showStoreError）、**コードの止まりには効いていません**でした。
 *  ここでそろえます。
 *
 *  ★見た目は CSS に頼りません。シフトの提出ページは style.css を読まないので、
 *    そこでも必ず出るように、字と色をこの中に書いています。
 *  ★このファイルは4つのアプリすべてが一番はじめに読みます。
 *    だから、ここに置けば全部に効きます。
 * ============================================================ */
(function () {
  // ★ブラウザ以外で読まれることがあります。検算は jsc で config.js を
  //   読み込むので、ここで window を当てにすると**検算が落ちます**
  //   （2026-09-05、実際に シフトの test.js を落としました）。
  if (typeof window === 'undefined'
      || typeof window.addEventListener !== 'function') return;

  var 出したもの = '';

  function 知らせる(なに, どこ) {
    try {
      var 印 = String(なに) + '|' + String(どこ);
      if (印 === 出したもの) return;      // 同じものを何度も出しません
      出したもの = 印;

      var 帯 = document.getElementById('appError');
      if (!帯) {
        var 親 = document.body || document.documentElement;
        if (!親) return;
        帯 = document.createElement('div');
        帯.id = 'appError';
        帯.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9500;'
          + 'background:#c0392b;color:#fff;font-size:14px;font-weight:700;'
          + 'line-height:1.5;text-align:center;'
          + 'padding:12px 16px calc(12px + env(safe-area-inset-bottom));';
        親.appendChild(帯);
      }
      帯.textContent = '⚠ アプリで問題が起きました。この画面を見せてください。'
        + '（' + なに + ' ／ ' + どこ + '）';
    } catch (e) {
      /* 知らせる側で転ばないこと。ここで投げると、また黙って終わります */
    }
  }

  /**
   * どのファイルの何行目か
   *
   * ★非同期の中で転ぶと e.filename が空になります（2026-09-05に実際そうでした）。
   *   そのときは stack の1本目から拾います。**場所が一番知りたい情報**です。
   */
  function 場所(err, ファイル, 行) {
    if (ファイル) return String(ファイル).split('/').pop() + ':' + (行 || '?');
    var st = (err && err.stack) || '';
    var m = st.match(/([^/\s()]+\.js):(\d+)/);
    return m ? (m[1] + ':' + m[2]) : '';
  }

  window.addEventListener('error', function (e) {
    // 画像の読み込み失敗などは e.message を持ちません。そこは拾いません
    if (!e || !e.message) return;
    知らせる(e.message, 場所(e.error, e.filename, e.lineno) || '場所は分かりません');
  });

  window.addEventListener('unhandledrejection', function (e) {
    if (!e) return;
    var r = e.reason;
    知らせる((r && r.message) || String(r), 場所(r) || '待っていた処理');
  });
})();

/* ============================================================
 *  設定ファイル
 *  ここだけ編集すれば「店舗」「確認項目」を変更できます。
 *  他のファイルは触らなくてOKです。
 * ============================================================ */

const APP = {
  title: 'T3 Works',
  company: 'T3Dining株式会社',
  logo: 'img/t3dining.png', // ヘッダーに出る会社ロゴ

  // ★月間表（縦=確認項目／横=1〜31日のマトリクス）を使うかどうか
  //   false … 「日別／月間表」の切替ボタンごと消えて、日別だけになります
  //   true  … 月間表が復活します（機能は消していないので、ここを true にするだけ）
  showMonthView: false,

  // ★全店舗で共有するための接続先（Apps Script のウェブアプリURL）
  //   空のあいだは今までどおり「この端末の中だけ」で動きます。
  //   SETUP.md の手順で取得したURLをここに貼ると共有版になります。
  syncUrl: 'https://script.google.com/macros/s/AKfycbzzLm89vm45kaMHcAMPb9DsrYxFeZwW-Q6UDo2NITHEPBUK3hSslVWiLONEPGxpPCVW/exec',

  // ★「今日」が切り替わる時刻（時）
  //   締め作業が0時をまたぐことが多いので、朝までは前の日あつかいにします。
  //   6 … 朝6時に翌日へ切り替わる（0 にすると 0時ちょうどで切り替わります）
  dayStartHour: 6,

  storageKey: 't3d-check-v1', // ← 変更するとデータが分かれるので通常は触らない
};

/**
 * 業務上の「今日」
 *
 * 朝 APP.dayStartHour 時より前は、前の日として扱います。
 * 例）8月14日の 1:00 → 「8月13日」。
 *     26時までの締め作業でも、開くページは前の日のままです。
 */
function businessDate(now) {
  const d = now ? new Date(now) : new Date();
  d.setHours(d.getHours() - (APP.dayStartHour || 0));
  return d;
}

/* ------------------------------------------------------------
 *  全角で入れたものを半角に直す
 *
 *  iPhone や iPad の日本語キーボードのままだと「１２．６」のように
 *  全角で入ってしまい、そのままでは数字として読めません。
 *  数字を入れる欄では、入力中に半角へ直しています。
 *
 *  ※ そのために、数字の欄は type="number" ではなく type="text" です。
 *    type="number" は全角が入った瞬間に中身を空にしてしまい、
 *    こちらから読み取って直すことすらできないためです。
 *
 *  ※ 日本語を書く欄（備考・項目名・名前など）は直しません。
 *    文章の中の全角は、書いた人がそのつもりで書いているためです。
 * ---------------------------------------------------------- */

/**
 * 全角の英数字・記号を半角にする
 *   ＡＢＣ１２３ → ABC123 ／ 全角スペース → 半角スペース
 * ひらがな・カタカナ・漢字はそのままです。
 */
function toHalfWidth(text) {
  return String(text == null ? '' : text)
    // 全角の ！ 〜 ～ は、半角の ! 〜 ~ より 0xFEE0 だけ後ろに並んでいます
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ');
}

/**
 * 数字として読めるように直す
 *   １２．６ → 12.6 ／ ６。２ → 6.2 ／ ３，３８０ → 3380
 */
function toHalfWidthNumber(text) {
  return toHalfWidth(text)
    .replace(/。/g, '.')          // 句点 → 小数点（テンキーで出やすい）
    .replace(/[、,]/g, '')        // 桁区切り → 取り除く
    .replace(/[‐―ー−]/g, '-')    // 全角のハイフンいろいろ
    .replace(/\s/g, '');          // 空白は取り除く
}

/**
 * 日本語の変換を決めるために押されたエンターか
 *
 *  「たいむかーど」と打って変換を決めるときのエンターも、ふつうのエンターと
 *  同じ keydown で飛んできます。見分けずに「決定」あつかいにすると、
 *  変換の途中で入力が終わってしまい、言葉が途中で切れます。
 *
 *  ★エンターで何かを決める欄には、必ずこれを通してください。
 *    isComposing を見ない古い端末のために、229（変換中の合図）も見ています。
 */
function imeEnter(e) {
  return !!(e.isComposing || e.keyCode === 229 || e.which === 229);
}

/**
 * 入力欄に「全角で入れても半角に直す」動きを付ける
 * （入力中と、欄から離れたときの2回直します）
 *
 *   kind = 'number' … 数字の欄（桁区切りや空白も落とします）
 *   kind = 'code'   … PINなど、半角で書くと決まっている欄
 */
function bindHalfWidthInput(input, kind) {
  if (!input) return;
  const conv = kind === 'number' ? toHalfWidthNumber : toHalfWidth;
  const fix = () => {
    const fixed = conv(input.value);
    if (fixed === input.value) return;
    const atEnd = input.selectionStart === input.value.length;
    input.value = fixed;
    // 途中を直しているときにカーソルが飛ばないよう、末尾のときだけ戻します
    if (atEnd) {
      try { input.setSelectionRange(fixed.length, fixed.length); } catch (e) { /* 対応していない欄 */ }
    }
  };
  input.addEventListener('input', fix);
  input.addEventListener('blur', fix);
}

/** 数字の欄むけ（一番よく使うので短く呼べるようにしています） */
function bindNumericInput(input) {
  bindHalfWidthInput(input, 'number');
}

/* ------------------------------------------------------------
 *  1) 店舗一覧
 *     id は英数字で固定（あとから変えるとデータが紐付かなくなります）
 * ---------------------------------------------------------- */
/*  logo … img フォルダの画像。ファイルが無い場合は color の丸印を表示します。
 *        差し替えるときは同じファイル名で img フォルダに上書きするだけでOK。   */
const STORES = [
  // color … 選択中タブや進捗バーに使う店舗カラー。
  //          白文字を載せるので、明るすぎる色は読みにくくなります
  // closedDays … 毎週の定休日の初期値（0=日 1=月 2=火 3=水 4=木 5=金 6=土）。
  //          その曜日は確認チェック不要になり、確認漏れにも数えません。
  //          省略すれば定休日なし。複数なら [2, 3] のように並べます。
  //          ★アプリの「⚙ 設定 → 定休日」で変更でき、そちらが優先されます
  { id: 'kojare',   name: 'こじゃれ',       short: 'こじゃれ', color: '#c0392b', logo: 'img/kojare.png' },
  { id: 'sumimaro', name: '炭まろ',         short: '炭まろ',   color: '#a9453c', logo: 'img/sumimaro.png' },
  { id: 'chacoru',  name: 'ちゃこる',       short: 'ちゃこる', color: '#c14a1e', logo: 'img/chacoru.png', closedDays: [0] },
  { id: 'baguru',   name: 'バグる',         short: 'バグる',   color: '#bf5480', logo: 'img/baguru.png', closedDays: [2] },
  // popo は焦げ茶(#5a3728)だと暗くて表の色が沈むので、明るいキャラメル色にしています
  { id: 'popo',     name: 'popo',           short: 'popo',     color: '#946444', logo: 'img/popo.png' },
  { id: 'oiden',    name: 'おいでんテラス', short: 'おいでん', color: '#b3690c', logo: 'img/oiden.png', closedDays: [2] },
];

/* ------------------------------------------------------------
 *  2) 担当者リストの初期値
 *     日付の下のプルダウンに並ぶ名前です。
 *     アプリの「⚙ 設定」からいつでも追加・削除できます
 *     （設定で変更した内容が優先され、こちらは初期値としてのみ使われます）。
 * ---------------------------------------------------------- */
const STAFF = [
  // ★ここは**空にしてあります**（2026-09-05）。
  //
  //   前は12人の名字が書いてありました。このファイルは GitHub Pages で
  //   **誰でも読めます**。会社名も6店舗の名前も同じ場所にあるので、
  //   「この会社の従業員は誰か」が名字で分かる状態でした。
  //   本人たちの同意を取って出したものではありません。
  //
  //   名前は**マネージで登録**します（スプレッドシート側＝非公開に入ります）。
  //   キャッチをする人（CATCH_STAFF）や日報フォルダと同じ形です。
  //   ★ここに名前を書き戻さないでください。書いた瞬間、また公開されます。
];

/* ------------------------------------------------------------
 *  3) 確認項目（★あとから追加・変更する場所★）
 *
 *  section = 見出しのかたまり
 *    id    : 英数字で固定
 *    title : 画面に出る見出し
 *    items : 項目の配列
 *
 *  item
 *    id    : 英数字で固定（★変えると過去データが消えて見えるので注意★）
 *    label : 画面に出る項目名
 *    hint  : 補足説明（省略可）
 *    type  : 'check'  → チェックだけ（既定）
 *            'number' → チェック＋数値入力（売上・客数など）
 *            'text'   → チェック＋文字入力（引継ぎ事項など）
 *    unit  : 'number' のときの単位（省略可）
 *    onlyDays : その日だけ出す項目（省略可）
 *               例）onlyDays: [28] → 28日だけ表示。他の日は出ず、確認漏れにも数えない
 *    hideOnDows : その曜日は出さない項目（省略可）
 *               0=日 1=月 2=火 3=水 4=木 5=金 6=土
 *               例）hideOnDows: [5, 6] → 金・土だけ出ない。出ない日は確認漏れにも数えない
 *
 *  ↓ いまは「よくある項目」を仮で入れています。実際の項目に差し替えてください。
 * ---------------------------------------------------------- */
const CHECKLIST = [
  {
    id: 'open',
    title: '開店前',
    items: [
      { id: 'op01', label: '冷蔵庫・冷凍庫の温度確認', type: 'number', unit: '℃' },
      { id: 'op02', label: 'レジ釣銭・開始金の確認',   type: 'check' },
      { id: 'op03', label: '予約表の確認（人数・時間・要望）', type: 'check' },
      { id: 'op04', label: '仕込み・在庫の確認',       type: 'check' },
      { id: 'op05', label: '店内・トイレ清掃の確認',   type: 'check' },
      { id: 'op06', label: '身だしなみ・制服の確認',   type: 'check' },
    ],
  },
  {
    id: 'during',
    title: '営業中',
    items: [
      { id: 'dr01', label: '予約席のセッティング完了', type: 'check' },
      { id: 'dr02', label: '品切れメニューの共有',     type: 'text', hint: '品切れがあれば内容を記入' },
      { id: 'dr03', label: 'ピークアウト後の店内清掃', type: 'check' },
    ],
  },
  {
    id: 'report',
    title: '日報入力（売上・仕入・人件費）',
    items: [
      { id: 'rp01', label: '現金売上の入力',   type: 'number', unit: '円' },
      { id: 'rp02', label: 'クレジット売上の入力', type: 'number', unit: '円' },
      { id: 'rp03', label: '電子マネー売上の入力', type: 'number', unit: '円' },
      { id: 'rp04', label: '当日客数の入力',   type: 'number', unit: '人' },
      { id: 'rp05', label: '仕入伝票の入力',   type: 'check' },
      { id: 'rp06', label: '人件費（勤怠）の締め', type: 'check' },
      { id: 'rp07', label: '来店経路の入力',   type: 'check' },
      { id: 'rp08', label: 'レジ締めと現金の実査が一致', type: 'check' },
    ],
  },
  {
    id: 'close',
    title: '閉店後',
    items: [
      { id: 'cl01', label: '火元・ガス元栓の確認', type: 'check' },
      { id: 'cl02', label: '冷蔵庫・冷凍庫の閉め忘れ確認', type: 'check' },
      { id: 'cl03', label: '売上金の保管・入金',   type: 'check' },
      { id: 'cl04', label: '施錠・戸締りの確認',   type: 'check' },
    ],
  },
];

/* ------------------------------------------------------------
 *  4) 店舗ごとに項目を変えたい場合だけ設定
 *     例）popo だけ別の項目にする
 *     const CHECKLIST_OVERRIDES = { popo: [ { id:'open', title:'開店前', items:[...] } ] };
 * ---------------------------------------------------------- */
const CHECKLIST_OVERRIDES = {

  /* ===== バグる ===== */
  baguru: [
    {
      id: 'hall',
      title: 'ホール',
      items: [
        { id: 'bg-h01', label: 'ゴミ落ちていないか' },
        { id: 'bg-h02', label: '椅子が上がっているか' },
        { id: 'bg-h03', label: 'A卓の荷物かご' },
        { id: 'it-mso432ijcg7', label: 'C卓の荷物かご', addedAt: '2026-08-11', type: 'check' },
        { id: 'bg-h04', label: 'バッシやり忘れ' },
        { id: 'bg-h05', label: 'ランチメニュー', hideOnDows: [5, 6], pauses: [{"from": "2026-08-10", "to": "2026-08-14"}] },
        { id: 'bg-h06', label: '肉の日POP入れ忘れ（２８日のみ）', onlyDays: [28] },
        { id: 'bg-h07', label: '肉の日POP抜き忘れ（２９日のみ）', onlyDays: [29] },
        { id: 'bg-h08', label: '卓上備品補充' },
        { id: 'bg-h09', label: '洗濯物' },
        { id: 'bg-h10', label: 'シルバー拭きなど洗濯機入れ忘れないか' },
        { id: 'bg-h11', label: '岩塩・BP・ガーリックチップ補充' },
        { id: 'bg-h12', label: 'スープ移し' },
        { id: 'bg-h13', label: '使用済みコップ残っていないか' },
        { id: 'bg-h14', label: 'ロールカーテン' },
        { id: 'bg-h15', label: 'ケミガード補充' },
        { id: 'bg-h16', label: 'スープレードル定位置にあるか' },
        { id: 'bg-h17', label: '明日の予約確認' },
        { id: 'it-msljqvepslk', label: '通信テスト', addedAt: '2026-08-09', retiredAt: '2026-08-10', type: 'check' },
      ],
    },
    {
      id: 'kitchen',
      title: 'キッチン',
      items: [
        { id: 'bg-k01', label: '仕込み表' },
        { id: 'bg-k02', label: '唐揚げ在庫チェック（F卓も）' },
        { id: 'bg-k03', label: 'タコライス在庫チェック' },
        { id: 'it-mslkg6qy82j', label: 'ミックスチーズ補充', addedAt: '2026-08-09', type: 'check' },
        { id: 'bg-k04', label: '米移し' },
        { id: 'bg-k05', label: '米ラップチェック' },
        { id: 'bg-k06', label: 'ハンバーグのラップ・蓋' },
        { id: 'bg-k07', label: 'グリドル・コンロ清掃' },
        { id: 'bg-k08', label: 'スチコン締め' },
        { id: 'bg-k24', label: 'フライヤーの火チェック' },
        { id: 'bg-k09', label: '炭移し' },
        { id: 'bg-k10', label: 'IH電源' },
        { id: 'bg-k11', label: 'ペレット電源' },
        { id: 'bg-k12', label: '炊飯器保温' },
        { id: 'bg-k13', label: 'ビールサーバー締め' },
        { id: 'bg-k14', label: '油補充' },
        { id: 'bg-k15', label: '洗剤補充' },
        { id: 'it-mso44ss87yq', label: 'ケミクール補充', addedAt: '2026-08-11', type: 'check' },
        { id: 'bg-k16', label: 'ごみ捨て' },
        { id: 'bg-k18', label: 'シンク清掃チェック' },
        { id: 'bg-k17', label: 'シンクのゴミかごチェック' },
        { id: 'bg-k19', label: '洗浄機横清掃チェック' },
        { id: 'bg-k20', label: '洗えた物戻し忘れ' },
        { id: 'bg-k21', label: '冷蔵庫・冷凍庫扉チェック' },
        { id: 'bg-k22', label: 'F卓ショーケース扉チェック' },
        { id: 'bg-k23', label: 'F卓ショーケース水受けチェック' },
      ],
    },
    {
      id: 'toilet',
      title: 'トイレ',
      items: [
        { id: 'bg-t01', label: 'トイレ掃除チェック' },
        { id: 'bg-t02', label: 'トイレ備品補充チェック' },
        { id: 'bg-t03', label: 'トイレマット干し' },
        { id: 'bg-t04', label: 'エアコンチェック' },
        { id: 'bg-t05', label: '水回りチェック' },
      ],
    },
    {
      id: 'sec-mso2tufee2',
      title: '2階',
      items: [
        { id: 'it-mso2u7nqkma', label: '2階電気', addedAt: '2026-08-11', type: 'check' },
        { id: 'it-mso2uk8wfck', label: 'エアコン', addedAt: '2026-08-11', type: 'check' },
        { id: 'it-mso2uoo0lg8', label: '階段の電気', addedAt: '2026-08-11', type: 'check' },
      ],
    },
    {
      id: 'whole',
      title: '全体',
      items: [
        { id: 'bg-z01', label: '発注（FAX流し忘れないか）' },
        { id: 'bg-z07', label: '売上金チェック' },
        { id: 'bg-z08', label: '入金帳・封筒チェック' },
        { id: 'bg-z09', label: '両替金チェック' },
        { id: 'bg-z10', label: '日報入力' },
        { id: 'bg-z11', label: 'ジャーナルLINE' },
        { id: 'bg-z03', label: 'エアコン電源' },
        { id: 'bg-z04', label: '電気' },
        { id: 'bg-z02', label: '入口・車庫扉施錠' },
        { id: 'bg-z12', label: 'キッチン出入り口施錠' },
        { id: 'bg-z05', label: '洗濯機水栓' },
        { id: 'bg-z06', label: 'ガス元栓' },
      ],
    },
  ],

  /* ===== こじゃれ ===== */
  kojare: [
    {
      id: 'kj-kitchen',
      title: 'キッチン',
      items: [
        { id: 'kj-k03', label: 'まな板漂白' },
        { id: 'kj-k07', label: '冷蔵庫・冷凍庫扉チェック' },
        { id: 'kj-k13', label: '炊飯器の米移し' },
        { id: 'kj-k14', label: '炊飯器の保温切られているか' },
        { id: 'it-msojdvsxqsl', label: '米のラップがしっかりされているか', addedAt: '2026-08-11', type: 'check' },
        { id: 'kj-k15', label: '台上食材の確認' },
        { id: 'kj-k18', label: 'ディスペンサー補充、しまってあるか', addedAt: '2026-08-12' },
        { id: 'kj-k19', label: '乾物補充', addedAt: '2026-08-12' },
        { id: 'kj-k20', label: '揚げ場補充', addedAt: '2026-08-12' },
        { id: 'kj-k21', label: '油補充', addedAt: '2026-08-12' },
        { id: 'kj-k22', label: 'レンジ拭き', addedAt: '2026-08-12' },
        { id: 'kj-k09', label: 'ドリンクサーバー電源' },
        { id: 'kj-k10', label: 'お湯ポット' },
        { id: 'kj-k11', label: 'ビールサーバー締め' },
        { id: 'kj-k16', label: 'おしぼり出す' },
        { id: 'kj-k05', label: '裏口の戸締り' },
        { id: 'kj-k04', label: '賄い後シンク、ゴミ受けカゴ' },
        { id: 'kj-k12', label: 'ゴミ袋を縛ってあるか' },
        { id: 'kj-k06', label: '水道が閉まっているか' },
        { id: 'kj-k08', label: 'ガスの元栓' },
        { id: 'kj-k02', label: 'エアコン確認' },
        { id: 'kj-k01', label: '電気' },
      ],
    },
    {
      id: 'kj-hall',
      title: '1階ホール',
      items: [
        { id: 'kj-h10', label: '掃除機ゴミ捨て', addedAt: '2026-08-12' },
        { id: 'kj-h05', label: 'セットの確認' },
        { id: 'kj-h03', label: '各部屋エアコン確認' },
        { id: 'kj-h08', label: '灰皿', addedAt: '2026-08-12' },
        { id: 'kj-h04', label: '喫煙所' },
        { id: 'kj-h06', label: 'トイレ' },
        { id: 'kj-h07', label: '賄い後テーブル' },
        { id: 'kj-h09', label: '全体エアコン確認', addedAt: '2026-08-12' },
        { id: 'kj-h01', label: '外看板' },
        { id: 'kj-h02', label: '電気' },
      ],
    },
    {
      id: 'kj-2f',
      title: '2階',
      items: [
        { id: 'kj-f03', label: 'ユーセン確認', onlyDows: [5, 6] },
        { id: 'kj-f07', label: '製氷機電源ON', onlyDows: [4] },
        { id: 'kj-f08', label: '製氷機電源OFF', onlyDows: [6] },
        { id: 'kj-f04', label: '洗浄機', onlyDows: [5, 6] },
        { id: 'kj-f05', label: 'ビールサーバー締め', onlyDows: [5, 6] },
        { id: 'kj-f06', label: 'ドリンクサーバー締め', onlyDows: [5, 6] },
        { id: 'kj-f02', label: 'エアコン確認', onlyDows: [5, 6] },
        { id: 'kj-f01', label: '電気', onlyDows: [5, 6] },
      ],
    },
    {
      id: 'kj-irregular',
      title: 'イレギュラー',
      items: [
        { id: 'kj-i01', label: '仕込み移し後2階ストッカー出しっ放し' },
      ],
    },
    {
      id: 'kj-all',
      title: '全体',
      items: [
        { id: 'kj-z01', label: '発注（FAX流し忘れないか）' },
        { id: 'kj-z02', label: '売上金チェック' },
        { id: 'kj-z03', label: '入金帳・封筒チェック' },
        { id: 'kj-z04', label: '両替金チェック' },
        { id: 'kj-z05', label: '日報入力' },
        { id: 'kj-z06', label: 'ジャーナルLINE' },
        { id: 'kj-z07', label: 'ファックス転送' },
        { id: 'kj-z08', label: '各タブレット、決済端末' },
        { id: 'kj-z09', label: '玄関鍵' },
      ],
    },
  ],

  /* ===== 炭まろ ===== */
  sumimaro: [
    {
      id: 'sm-kitchen',
      title: 'キッチン',
      items: [
        { id: 'sm-k17', label: 'まな板漂白' },
        { id: 'sm-k01', label: '冷蔵庫・冷凍庫扉チェック' },
        { id: 'sm-k06', label: '炊飯器の米移し' },
        { id: 'sm-k28', label: '炊飯器の保温切られているか' },
        { id: 'sm-k07', label: '米のラップがしっかりされているか' },
        { id: 'sm-k02', label: '台上食材の確認' },
        { id: 'sm-k10', label: 'ディスペンサー補充、しまってあるか' },
        { id: 'sm-k11', label: '乾物補充' },
        { id: 'sm-k12', label: '揚げ場補充' },
        { id: 'sm-k16', label: '油補充' },
        { id: 'sm-k19', label: 'レンジ拭き' },
        { id: 'sm-k20', label: 'コンロ掃除' },
        { id: 'sm-k22', label: 'by準備されてるか', onlyDows: [4] },
        { id: 'sm-k21', label: '氷寄せ', onlyDows: [4] },
        { id: 'sm-k09', label: 'セットの確認' },
        { id: 'sm-k08', label: 'ドリ場ショーケース水受け' },
        { id: 'sm-k15', label: 'アルコール類少ないの新品に買える' },
        { id: 'sm-k18', label: 'おしぼりいっぱいなら外に出してあるか' },
        { id: 'sm-k23', label: 'ゴミ箱洗ってあるか', onlyDows: [5, 6] },
        { id: 'sm-k24', label: 'プリンター電源' },
        { id: 'sm-k25', label: 'ビールサーバー締め' },
        { id: 'sm-k26', label: 'フライヤー締めてあるか', onlyDows: [5, 6] },
        { id: 'sm-k27', label: 'フライヤー電源' },
        { id: 'sm-k13', label: '賄い後シンク、ゴミ受けカゴ' },
        { id: 'sm-k14', label: 'シンクゴミ' },
        { id: 'sm-k03', label: '炭壺閉まってるか' },
        { id: 'sm-k05', label: 'ゴミ袋を縛ってあるか' },
        { id: 'sm-k04', label: '水道が閉まっているか' },
      ],
    },
    {
      id: 'sm-1f-hall',
      title: '1階ホール',
      items: [
        { id: 'sm-h01', label: '掃除機ゴミ捨て' },
        { id: 'sm-h07', label: 'セットの確認' },
        { id: 'sm-h04', label: '個室の３つの暖房電源', onlyMonths: [11, 12, 1, 2, 3] },
        { id: 'sm-h02', label: '外灰皿' },
        { id: 'sm-h03', label: 'ユーセン確認' },
        { id: 'sm-h06', label: '業務用エアコン×3確認' },
        { id: 'sm-h05', label: 'ガスの元栓' },
        { id: 'sm-h08', label: '電気' },
      ],
    },
    {
      id: 'sm-2f',
      title: '2階',
      items: [
        { id: 'sm-f02', label: '冷蔵庫・冷凍庫扉チェック' },
        { id: 'sm-f06', label: 'ドリンク少ないの新品に変える' },
        { id: 'sm-f08', label: '家庭用エアコン×1確認' },
        { id: 'sm-f04', label: '掃除機ゴミ捨て' },
        { id: 'sm-f05', label: 'セットの確認' },
        { id: 'sm-f03', label: 'ストッカー扉' },
        { id: 'sm-f01', label: '窓戸締り' },
        { id: 'sm-f07', label: '業務用エアコン×1確認' },
        { id: 'sm-f09', label: 'トイレ電気' },
        { id: 'sm-f10', label: '電気' },
      ],
    },
    {
      id: 'sm-all',
      title: '全体',
      items: [
        { id: 'sm-z01', label: '発注（FAX流し忘れないか）' },
        { id: 'sm-z02', label: '売上金チェック' },
        { id: 'sm-z03', label: '入金帳・封筒チェック' },
        { id: 'sm-z04', label: '両替金チェック' },
        { id: 'sm-z05', label: '日報入力' },
        { id: 'sm-z06', label: 'ジャーナルLINE' },
        { id: 'sm-z07', label: 'ファックス転送' },
        { id: 'sm-z08', label: '各タブレット、決済端末' },
        { id: 'sm-z09', label: '玄関鍵' },
      ],
    },
  ],

  /* ===== ちゃこる ===== */
  chacoru: [
    {
      id: 'ch-kitchen',
      title: 'キッチン',
      items: [
        { id: 'ch-a27', label: 'まな板漂白' },
        { id: 'ch-a01', label: '冷蔵庫・冷凍庫扉チェック' },
        { id: 'ch-a12', label: '炊飯器の米移し' },
        { id: 'ch-a33', label: '炊飯器の保温切られているか', addedAt: '2026-08-12' },
        { id: 'it-msojcofnv3k', label: '米のラップがしっかりされているか', addedAt: '2026-08-11', type: 'check' },
        { id: 'ch-a05', label: '台上食材の確認' },
        { id: 'ch-a18', label: 'ディスペンサー補充、しまってあるか' },
        { id: 'ch-a19', label: '乾物補充' },
        { id: 'ch-a21', label: '揚げ場補充' },
        { id: 'ch-a26', label: '油補充' },
        { id: 'ch-d06', label: '余り米、冷凍or他店舗に渡す', onlyDows: [6] },
        { id: 'ch-a29', label: 'レンジ拭き' },
        { id: 'ch-a30', label: 'コンロ掃除' },
        { id: 'ch-d02', label: 'by準備されてるか', onlyDows: [4, 5] },
        { id: 'ch-d01', label: '氷寄せ', onlyDows: [4, 5] },
        { id: 'ch-d04', label: 'by解凍の再冷凍', onlyDows: [6] },
        { id: 'ch-a13', label: 'ドリ場ショーケース水受け' },
        { id: 'ch-a24', label: 'アルコール類少ないの新品に買える' },
        { id: 'ch-d05', label: 'ゴミ箱洗ってあるか', onlyDows: [6] },
        { id: 'ch-a10', label: 'プリンター電源' },
        { id: 'ch-a14', label: 'ビールサーバー締め' },
        { id: 'ch-d03', label: 'フライヤー締めてあるか', onlyDows: [5, 6] },
        { id: 'ch-a16', label: 'フライヤー元栓' },
        { id: 'ch-a02', label: '裏口の戸締り' },
        { id: 'ch-a32', label: '賄い後シンク、ゴミ受けカゴ' },
        { id: 'ch-a23', label: 'シンクゴミ' },
        { id: 'ch-a07', label: '炭壺閉まってるか' },
        { id: 'ch-a09', label: 'ゴミ袋を縛ってあるか' },
        { id: 'ch-a08', label: '水道が閉まっているか' },
        { id: 'ch-a06', label: 'ガスの元栓' },
        { id: 'ch-d07', label: '2階の開きかけの生樽おろす', onlyDows: [6], retiredAt: '2026-08-13' },
      ],
    },
    {
      id: 'ch-1f-hall',
      title: '1階ホール',
      items: [
        { id: 'ch-a11', label: '掃除機ゴミ捨て' },
        { id: 'ch-a15', label: 'セットの確認' },
        { id: 'ch-a04', label: 'エアコン確認F1' },
        { id: 'ch-a20', label: '外灰皿' },
        { id: 'ch-a25', label: 'ユーセン確認' },
        { id: 'ch-a17', label: '納品されたおしぼり中に入れてあるか' },
        { id: 'ch-a28', label: 'おしぼりいっぱいなら外に出してあるか' },
        { id: 'ch-a22', label: '賄い後テーブル' },
        { id: 'ch-a31', label: '外看板' },
        { id: 'ch-a03', label: '業務用エアコン×2確認' },
      ],
    },
    {
      id: 'ch-2f',
      title: '2階',
      items: [
        { id: 'ch-b04', label: '冷蔵庫・冷凍庫扉チェック' },
        { id: 'ch-b08', label: 'ドリンク少ないの新品に変える' },
        { id: 'ch-d07', label: '2階の開きかけの生樽おろす', onlyDows: [6], addedAt: '2026-08-12' },
        { id: 'ch-b07', label: 'セットの確認' },
        { id: 'ch-b03', label: '窓戸締り' },
        { id: 'ch-b01', label: '業務用エアコン×1確認' },
        { id: 'ch-b02', label: '家庭用エアコン×4確認' },
        { id: 'ch-b05', label: 'トイレ電気' },
        { id: 'ch-b06', label: '外照明' },
      ],
    },
    {
      id: 'ch-3f',
      title: '3階',
      items: [
        { id: 'ch-c03', label: 'ストッカー扉' },
        { id: 'ch-c04', label: '掃除機ゴミ捨て' },
        { id: 'ch-c02', label: '窓戸締り' },
        { id: 'ch-c05', label: '更衣室　扇風機、エアコン確認' },
        { id: 'ch-c01', label: '電気' },
      ],
    },
    {
      id: 'ch-all',
      title: '全体',
      items: [
        { id: 'ch-z01', label: '発注（FAX流し忘れないか）' },
        { id: 'ch-z02', label: '売上金チェック' },
        { id: 'ch-z03', label: '入金帳・封筒チェック' },
        { id: 'ch-z04', label: '両替金チェック' },
        { id: 'ch-z05', label: '日報入力' },
        { id: 'ch-z06', label: 'ジャーナルLINE' },
        { id: 'ch-z07', label: 'ファックス転送' },
        { id: 'ch-z08', label: '各タブレット、決済端末' },
        { id: 'ch-z09', label: '玄関鍵' },
      ],
    },
  ],

  /* ===== popo ===== */
  popo: [
    {
      id: 'pp-kitchen',
      title: 'キッチン',
      items: [
        { id: 'it-msoj9sz58bc', label: 'まな板漂白', addedAt: '2026-08-11', type: 'check' },
        { id: 'pp-k01', label: '水が出しっぱになってないか' },
        { id: 'pp-k24', label: '洗浄機確認' },
        { id: 'pp-k14', label: 'モナン系とグラノラ補充確認' },
        { id: 'pp-k02', label: 'IH電源' },
        { id: 'pp-k03', label: '炊飯器洗えてるか' },
        { id: 'pp-k04', label: '炊飯器保温切れてるか' },
        { id: 'pp-k05', label: 'コンロのガス確認' },
        { id: 'pp-k06', label: 'ボイラー電源' },
        { id: 'pp-k07', label: 'プリンター電源' },
        { id: 'pp-k25', label: 'ビールサーバー確認' },
        { id: 'pp-k23', label: 'コーヒーマシン電源' },
        { id: 'pp-k08', label: 'スチコン' },
        { id: 'pp-k12', label: 'ホットプレートコンセント抜く' },
        { id: 'pp-k13', label: '野菜、乾物、デザートトッピング系補充確認' },
        { id: 'pp-k19', label: 'レンジ拭けてるか' },
        { id: 'pp-k21', label: 'パスタ場、パティ等しっかりラップされてるか' },
        { id: 'pp-k09', label: 'パンケーキグリドル電源' },
        { id: 'pp-k10', label: 'ソフトマシン確認' },
        { id: 'pp-k16', label: 'パティとランチ確認' },
        { id: 'pp-k30', label: 'ランチとパティ回収するか確認' },
        { id: 'pp-k11', label: 'クロッフルマシンとかき氷器コンセント抜く' },
        { id: 'pp-k22', label: 'フライヤー電源' },
        { id: 'pp-k15', label: '冷蔵冷凍庫、ストッカー扉確認' },
        { id: 'pp-k18', label: 'ドリ場ショーケース下の水捨て' },
        { id: 'pp-k17', label: 'エアコン確認' },
        { id: 'pp-k20', label: '計りが拭けてるか' },
        { id: 'pp-k26', label: '残飯残ってないか' },
        { id: 'pp-k27', label: 'ゴミ袋縛ってあるか' },
        { id: 'pp-k28', label: 'コースがあれば盛り込み等確認' },
        { id: 'pp-k29', label: '仕込み表確認' },
        { id: 'pp-k31', label: '電気' },
      ],
    },
    {
      id: 'pp-hall',
      title: 'ホール',
      items: [
        { id: 'pp-h01', label: 'リザーブ表確認' },
        { id: 'pp-h02', label: 'セット確認' },
        { id: 'pp-h03', label: '更衣室扉施錠' },
        { id: 'pp-h04', label: '更衣室のショーケース確認' },
        { id: 'pp-h05', label: 'デシャップ下、更衣室ショーケース下の水捨て' },
        { id: 'pp-h06', label: 'トイレ確認' },
        { id: 'pp-h07', label: '灰皿確認' },
        { id: 'pp-h08', label: 'レジiPad系電源' },
        { id: 'pp-h09', label: 'ウーバーPad画面暗くする' },
        { id: 'pp-h10', label: '食べログとインスタ確認' },
      ],
    },
    {
      id: 'pp-all',
      title: '全体',
      items: [
        { id: 'pp-z01', label: '発注（FAX流し忘れないか）' },
        { id: 'pp-z02', label: '売上金チェック' },
        { id: 'pp-z03', label: '入金帳・封筒チェック' },
        { id: 'pp-z04', label: '両替金チェック' },
        { id: 'pp-z05', label: '日報入力' },
        { id: 'pp-z06', label: 'ジャーナルLINE' },
        { id: 'pp-z07', label: '入り口、レジ小窓、大扉施錠' },
        { id: 'pp-z08', label: '翌日の事前オーダー確認' },
        { id: 'pp-z09', label: '電気' },
        { id: 'pp-z10', label: 'ガス元栓' },
        { id: 'it-mso3xwzhe1x', label: '入口施錠', addedAt: '2026-08-11', type: 'check' },
      ],
    },
  ],

  /* ===== おいでんテラス ===== */
  oiden: [
    {
      id: 'od-all',
      title: '全体',
      items: [
        { id: 'od-z01', label: '電気6箇所全て切ったか' },
        { id: 'od-z02', label: 'ドリバ窓、扉閉まってるか' },
        { id: 'od-z03', label: 'キッチン窓、扉閉まってるか' },
        { id: 'od-z04', label: 'ガスの元栓2箇所閉めたか' },
        { id: 'od-z05', label: '冷蔵庫冷凍庫11箇所異常ないか' },
        { id: 'od-z06', label: 'エアコン2箇所切ったか' },
        { id: 'od-z07', label: 'フライヤー切ったか' },
      ],
    },
  ],

};

/* ------------------------------------------------------------
 *  4) 週間掃除の項目
 *
 *  毎日のチェックとは別に、「週に1回まわす掃除」を1か月の表で管理します。
 *  縦が項目、横が週（日曜はじまり）です。
 *
 *  item
 *    id    : 英数字で固定（★変えると過去の記録が消えて見えるので注意★）
 *    label : 画面に出る項目名
 *    group : 見出し（掃除する場所）。WEEKLY_GROUPS のどれか。
 *            省略すると「その他」にまとまります
 *    every : 'week'   … 毎週やる（省略時はこちら）
 *            'biweek' … 2週間に1回でよい
 *    addedAt / retiredAt … 管理アプリで追加・削除した日（過去の記録を守るため）
 *
 *  ここに書いてあるのは初期値です。管理アプリで店舗ごとに
 *  追加・削除・並べ替え・頻度の変更ができ、そちらが優先されます。
 * ---------------------------------------------------------- */

/* 見出しの並び順。ここに書いた順に上から出ます。
   場所を増やしたくなったら、この行に足してください */
const WEEKLY_GROUPS = ['ホール', 'キッチン', 'トイレ', '外'];

/* 見出しの決まっていない項目のいき先 */
const WEEKLY_GROUP_OTHER = 'その他';

const WEEKLY_DEFAULT = [
  { id: 'wk-seat',    label: '2名席ガタつき確認',     group: 'ホール' },
  { id: 'wk-station', label: 'ステーション備品補充',   group: 'ホール' },
  { id: 'wk-floor',   label: '床の黒ずみ・机の溝掃除', group: 'ホール' },
  { id: 'wk-fridge',  label: '冷蔵庫フィルター',       group: 'キッチン' },
  { id: 'wk-steam',   label: 'スチコンフィルター',     group: 'キッチン' },
  { id: 'wk-case',    label: 'ショーケースサッシ掃除', group: 'キッチン' },
  { id: 'wk-gutter',  label: '溝掃除',                 group: 'キッチン' },
  { id: 'wk-grease',  label: 'グリスト',               group: 'キッチン' },
  { id: 'wk-stocker', label: 'ストッカー霜取り',       group: 'キッチン' },
  { id: 'wk-shelf',   label: '食器棚拭き掃除',         group: 'キッチン' },
  { id: 'wk-toilet',  label: 'トイレの洗面所水垢取り', group: 'トイレ' },
];

/* ------------------------------------------------------------
 *  2週間の区切り（期）の起点
 *
 *  ここに書いた日曜から、2週間ずつ区切っていきます。
 *  全店舗で同じ区切りになるので、6店舗まとめて比べられます。
 *  ずらしたくなったら、この日付を別の日曜に書き換えるだけです
 *  （過去の記録は週ごとに持っているので、消えたりしません）。
 * ---------------------------------------------------------- */
const PERIOD_ANCHOR = '2026-08-02';

/* 店舗ごとに初期値を変えたいときはここに書きます。
   （書かなければ全店舗 WEEKLY_DEFAULT から始まります）
   例）const WEEKLY_OVERRIDES = { popo: [ { id:'wk-a', label:'…' } ] }; */
const WEEKLY_OVERRIDES = {

  /* ---- バグる ----
     お店の掃除表から写したものです。上から順に「ホール」→「キッチン」。
     頻度が「週1回」「2週に1回」以外のものは入れていません
     （夏前・毎週月曜日・暇な時・汚くなったら の6項目）。 */
  baguru: [
    { id: 'bg-sash',         label: '窓サッシ',                     group: 'ホール' },
    { id: 'bg-chair',        label: '椅子の足裏',                   group: 'ホール',   every: 'biweek' },
    { id: 'bg-light',        label: 'ライト周り',                   group: 'ホール' },
    { id: 'bg-dishup',       label: 'デシャップ周り拭き掃除',       group: 'ホール' },
    { id: 'bg-dishup-towel', label: 'デシャップ周りタオル交換',     group: 'ホール',   every: 'biweek' },
    { id: 'bg-water',        label: 'ウォーターサーバー周り',       group: 'ホール',   every: 'biweek' },
    { id: 'bg-btable',       label: 'B卓椅子と壁の間',              group: 'ホール',   every: 'biweek' },
    { id: 'bg-ac',           label: 'エアコンフィルター',           group: 'ホール',   every: 'biweek' },
    { id: 'bg-register',     label: 'レジ周り拭き掃除',             group: 'ホール' },

    { id: 'bg-griddle',      label: 'グリドル壁',                   group: 'キッチン', every: 'biweek' },
    { id: 'bg-conro',        label: 'コンロ',                       group: 'キッチン' },
    { id: 'bg-steam-around', label: 'スチコン周り',                 group: 'キッチン' },
    { id: 'bg-yakidai',      label: '焼き台壁のしつこい汚れ',       group: 'キッチン', every: 'biweek' },
    { id: 'bg-ih-wall',      label: 'IH周りの壁',                   group: 'キッチン', every: 'biweek' },
    // 掃除表では「毎週月曜日」。曜日の指定はできないので、毎週の項目として入れています
    { id: 'bg-fridge-low',   label: '全冷蔵庫下段拭き掃除',         group: 'キッチン' },
    { id: 'bg-stocker',      label: 'ストッカー霜取り',             group: 'キッチン' },
    { id: 'bg-drink-sash',   label: 'ドリンク冷蔵庫サッシ',         group: 'キッチン' },
    { id: 'bg-inside',       label: '庫内清掃',                     group: 'キッチン' },
    { id: 'bg-gutter',       label: '溝掃除',                       group: 'キッチン' },
    { id: 'bg-chawan',       label: '茶碗棚タオル',                 group: 'キッチン', every: 'biweek' },
    { id: 'bg-mixer',        label: '肉ミキサー周り',               group: 'キッチン' },
    { id: 'bg-f-hamburg',    label: 'ハンバーグ冷蔵庫フィルター×2', group: 'キッチン' },
    { id: 'bg-f-fryer',      label: 'フライヤー横冷蔵庫フィルター', group: 'キッチン' },
    { id: 'bg-f-steamside',  label: 'スチコン横冷蔵庫フィルター',   group: 'キッチン' },
    { id: 'bg-f-ih',         label: 'IH下冷蔵庫フィルター',         group: 'キッチン' },
    { id: 'bg-f-drink',      label: 'ドリンク冷蔵庫フィルター',     group: 'キッチン' },
    { id: 'bg-f-steam',      label: 'スチコンフィルター',           group: 'キッチン' },
    { id: 'bg-ih-tray',      label: 'IHフィルターと受け皿',         group: 'キッチン' },
    { id: 'bg-pellet',       label: 'ペレットウォーマー受け皿',     group: 'キッチン' },
    { id: 'bg-f-server',     label: 'サーバーフィルター',           group: 'キッチン' },
    { id: 'bg-f-ice',        label: '製氷機フィルター',             group: 'キッチン' },
    { id: 'bg-f-case',       label: 'F卓右側ショーケースフィルター', group: 'キッチン' },
    { id: 'bg-case-tray',    label: 'ショーケース受け皿×2',         group: 'キッチン' },
  ],

  /* ---- popo ----
     お店の掃除表から写したものです。表の順どおり。
     掃除表で「月1回」だったものは、2週に1回として入れています。
     決まった間隔がないもの（暇なとき・汚くなったら）は、この表ではなく
     ANYTIME_OVERRIDES の「随時掃除」に入れています。
     ※「トイレの洗面所水垢取り」は、掃除表でホールの欄にあるので
        ここでもホールに入れてあります */
  popo: [
    { id: 'pp-sash',         label: '窓サッシ',                 group: 'ホール',   every: 'biweek' },
    { id: 'pp-chair',        label: '椅子の足裏',               group: 'ホール',   every: 'biweek' },
    { id: 'pp-light',        label: 'ライト周り',               group: 'ホール',   every: 'biweek' },
    { id: 'pp-dishup',       label: 'デシャップ周り',           group: 'ホール' },
    { id: 'pp-towel',        label: '食器タオル交換',           group: 'ホール',   every: 'biweek' },
    { id: 'pp-toilet-basin', label: 'トイレの洗面所水垢取り',   group: 'ホール' },
    { id: 'pp-ac',           label: 'エアコンフィルター',       group: 'ホール',   every: 'biweek' },
    { id: 'pp-register',     label: 'レジ周り',                 group: 'ホール' },
    { id: 'pp-vacuum10',     label: '10卓後ろの掃除機がけ',     group: 'ホール' },
    { id: 'pp-station',      label: 'ステーション掃除',         group: 'ホール' },
    { id: 'pp-locker',       label: '更衣室冷蔵庫掃除',         group: 'ホール' },

    { id: 'pp-soft',         label: 'ソフトマシン洗浄',         group: 'キッチン' },
    { id: 'pp-shelf',        label: '棚掃除（皿どかして）',     group: 'キッチン', every: 'biweek' },

    /* フィルター類。もとは「スチコンフィルター」「サーバー・冷蔵庫フィルター」の
       2つでしたが、どれをやったか分かるように1台ずつに分けました。
       頻度・場所は分ける前と同じ（2週に1回・キッチン）です */
    { id: 'pp-f-fridge4',    label: '四面冷蔵庫フィルター',     group: 'キッチン', every: 'biweek' },
    { id: 'pp-f-server',     label: 'サーバーフィルター',       group: 'キッチン', every: 'biweek' },
    { id: 'pp-f-drink',      label: 'ドリンク冷蔵庫フィルター', group: 'キッチン', every: 'biweek' },
    { id: 'pp-f-ice',        label: '製氷機フィルター',         group: 'キッチン', every: 'biweek' },
    { id: 'pp-f-rice',       label: '炊飯器横冷蔵庫フィルター', group: 'キッチン', every: 'biweek' },
    { id: 'pp-f-steamside',  label: 'スチコン横冷蔵庫フィルター', group: 'キッチン', every: 'biweek' },
    { id: 'pp-f-patty',      label: 'パティ冷凍庫フィルター',   group: 'キッチン', every: 'biweek' },
    { id: 'pp-f-steam',      label: 'スチコンフィルター',       group: 'キッチン', every: 'biweek' },
    { id: 'pp-f-fryer',      label: 'フライヤー横冷凍庫フィルター', group: 'キッチン', every: 'biweek' },
    { id: 'pp-f-griddle',    label: 'パンケーキグリドル下冷蔵庫フィルター', group: 'キッチン', every: 'biweek' },
    { id: 'pp-f-soft',       label: 'ソフトクリームメーカーフィルター', group: 'キッチン', every: 'biweek' },
    { id: 'pp-f-dishup',     label: 'デシャップ冷蔵庫フィルター', group: 'キッチン', every: 'biweek' },
    { id: 'pp-f-water',      label: 'ウォーターサーバーのフィルター', group: 'キッチン', every: 'biweek' },

    { id: 'pp-rice',         label: '炊飯器周り',               group: 'キッチン' },
    { id: 'pp-stocker',      label: 'ストッカー霜取り',         group: 'キッチン', every: 'biweek' },
    { id: 'pp-case-sash',    label: 'ショーケース冷蔵庫サッシ', group: 'キッチン' },
    { id: 'pp-gutter',       label: '溝掃除',                   group: 'キッチン' },
    { id: 'pp-washer',       label: '洗浄機周り',               group: 'キッチン', every: 'biweek' },

    { id: 'pp-smoke',        label: '上の煙感知器綺麗にする',   group: '外',       every: 'biweek' },
  ],

};

/* ------------------------------------------------------------
 *  4-2) 随時掃除（決まった間隔がない掃除）
 *
 *  「暇なとき」「汚くなったら」のように、いつやると決まっていない掃除です。
 *  期限が無いので達成率は出さず、代わりに **最後にやった日** を残します。
 *
 *    id    : 英数字で固定（★変えると過去の記録が消えて見えます★）
 *    label : 画面に出る項目名
 *    group : 見出し（WEEKLY_GROUPS と同じ並び）
 *    note  : 掃除表に書いてあった目安（「暇なとき」など）。省略可
 * ---------------------------------------------------------- */
const ANYTIME_DEFAULT = [];

const ANYTIME_OVERRIDES = {

  /* ---- バグる ---- */
  baguru: [
    { id: 'bg-a-f-ac',    label: 'F卓エアコンフィルター', group: 'ホール',   note: '夏前' },
    // 目安（頻度）の指定がないので note なし。決まったら足せます
    { id: 'bg-a-entrance', label: '入口床黒ずみ掃除',    group: 'ホール' },

    { id: 'bg-a-sink',    label: 'シンク下',         group: 'キッチン', note: '暇なとき' },
    { id: 'bg-a-fryer',   label: 'フライヤー作業台下', group: 'キッチン', note: '暇なとき' },
    { id: 'bg-a-washer',  label: '洗浄機周り',       group: 'キッチン', note: '汚くなったら' },
    { id: 'bg-a-server',  label: 'サーバー周り',     group: 'キッチン', note: '汚くなったら' },
    { id: 'bg-a-griddle', label: 'グリドル下',       group: 'キッチン', note: '暇なとき' },
    { id: 'bg-a-griddle-sink', label: 'グリドルシンク下', group: 'キッチン', note: '暇なとき' },

    { id: 'bg-a-toilet-ac', label: 'トイレエアコンフィルター', group: 'トイレ', note: '夏前' },
  ],

  /* ---- popo ---- */
  popo: [
    { id: 'pp-a-floor',   label: '床の黒ずみ・机の溝掃除', group: 'ホール',   note: '暇なとき' },
    { id: 'pp-a-machine', label: 'サーバー・ソフト・コーヒーマシン下', group: 'キッチン', note: '暇なとき' },
    { id: 'pp-a-griddle', label: 'パンケーキグリドル削り', group: 'キッチン', note: '汚くなったら' },
    { id: 'pp-a-fryer',   label: 'フライヤー周りの油汚れ掃除', group: 'キッチン', note: '暇なとき' },
    { id: 'pp-a-fridge4', label: '4面冷蔵庫庫内清掃', group: 'キッチン', note: '暇なとき' },
    { id: 'pp-a-sink',    label: 'シンク下',         group: 'キッチン', note: '暇な時' },
    { id: 'pp-a-mogura',  label: 'もぐら',           group: 'キッチン', note: '暇なとき' },
    { id: 'pp-a-floor-t', label: 'トイレ床',         group: 'トイレ',   note: '汚くなったら' },
  ],

};

/** 店舗の随時掃除の項目（初期値） */
function defaultAnytime(storeId) {
  return ANYTIME_OVERRIDES[storeId] || ANYTIME_DEFAULT;
}

/** 店舗の随時掃除の項目を取得（管理アプリで変更された内容が優先されます） */
function getAnytime(storeId) {
  return typeof Anytimes !== 'undefined' ? Anytimes.items(storeId) : defaultAnytime(storeId);
}

/**
 * その項目を現場（ワークス・マイン）に出すか
 *
 * 週間掃除と同じ考え方です。マネージは消したものも含めて全部見えます。
 *
 *   ・`draft`     … マネージで足しただけで、まだ名前がない
 *   ・`retiredAt` … 消した項目
 *
 * ★随時掃除は週ごとの表を持たず、達成率にも入りません。
 *   「最後にやった日」だけを見せる作りなので、消したら現場からは下ろします。
 *   記録（`店舗id/ANYTIME`）は消しません。同じ id で足し直せば戻ります。
 */
function anytimeShows(item) {
  return !item.draft && !item.retiredAt;
}

/** 随時掃除の記録は、日付ではなく1つのまとまりに入れます（storeId/ANYTIME） */
const ANYTIME_KEY = 'ANYTIME';

/* ------------------------------------------------------------
 *  4-4) 現金売上（ジャーナルの写真から読み取る）
 *
 *  閉店したときにレジから出す「精算」の紙を撮ると、その中の
 *  現金売上の金額を読み取ります。読み取りは Google のOCRで、
 *  文字を返すところまでが Apps Script（gas/現金売上.gs）の役目です。
 *  ★どこが現金売上かを見つけるのは、ここでやります。
 *    レシートの形が変わっても、貼り直しではなく公開で直せるようにするためです。
 *
 *  記録の入れ先は、その日のクローズの記録と同じ場所です。
 *  項目の1つ（CASH_ITEM）として持たせているので、
 *  Apps Script 側を直さなくても、そのまま全端末へ配られます。
 *
 *  1日分の中身（JSON）
 *    sales   : ジャーナルの現金売上（円）
 *    counted : 封筒に避けた金額（円）。まだ数えていなければ null
 *    photo   : ドライブに残した写真のID
 *    ocr     : OCRが読んだ生の金額（人が直したかどうかが分かります）
 *    at, by  : 入れた日時と人
 * ---------------------------------------------------------- */

/** その日の記録の中で、現金売上を入れておく項目名（チェック項目とはぶつかりません） */
const CASH_ITEM = '__cash';

/**
 * 手で入れる分の「書きかけ」を入れておく項目名
 *
 * ★なぜ CASH_ITEM と分けるか。
 *   CASH_ITEM は「記録した日」の印にもなっていて、月の一覧や週の表が
 *   それを見て『記録ずみ』を数えます。書きかけをそこに混ぜると、
 *   まだ記録していない日が記録ずみに見えてしまいます。
 *
 * ★中身
 *   m      … 出前館・ウーバー・ロケットナウ（NIPPOU_LABELS のキー）
 *   shiire … 仕入明細   { '仕入先の名前': { f: 当日現金, g: 掛仕入 } }
 *   jinken … 人件費     { '社員': { f: 人数, g: 金額 } }
 *
 *   どれも「入れた文字そのまま」です（計算式のまま覚えます）。
 */
const CASH_HAND = '__cashHand';

/** その日が入る週の月曜（'YYYY-MM-DD'）を返します */
function cashWeekStart(y, m, d) {
  const t = new Date(y, m - 1, d);
  // getDay() は 0=日 なので、月曜からの日数に直します（日曜は6日前が月曜）
  const back = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - back);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}`;
}

/** 月曜から日曜までの7日分（'YYYY-MM-DD' の並び） */
function cashWeekDays(startStr) {
  const [y, m, d] = startStr.split('-').map(Number);
  const p2 = (n) => String(n).padStart(2, '0');
  const out = [];
  for (let i = 0; i < 7; i++) {
    const t = new Date(y, m - 1, d + i);
    out.push(`${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}`);
  }
  return out;
}

/** 「9/1（月）〜 9/7（日）」のような表記 */
function cashWeekLabel(startStr) {
  const days = cashWeekDays(startStr);
  const [, sm, sd] = days[0].split('-').map(Number);
  const [, em, ed] = days[6].split('-').map(Number);
  return `${sm}/${sd}（月）〜 ${em}/${ed}（日）`;
}

/** 週を送る（n 週あと。マイナスなら前） */
function cashWeekShift(startStr, n) {
  const [y, m, d] = startStr.split('-').map(Number);
  return cashWeekStart(y, m, d + n * 7);
}

/**
 * ジャーナルの支払いの欄が始まる目印
 *
 * ★店舗ごとに決め打ちにせず、3つとも探します。
 *   OCRは1文字読みまちがえることがあるので、当たる目印が多い方が強いためです。
 *     おいでんテラス          … 支払方法
 *     こじゃれ                … 支払内訳
 *     炭まろ・ちゃこる・バグる・popo … 支払情報
 */
const CASH_SECTION_MARKS = ['支払方法', '支払内訳', '支払情報', '支払明細'];

/** 支払いの欄が終わる目印（ここから先の「現金」は数えません） */
const CASH_SECTION_END = ['現金以外', '割引', '割増', 'クレジット明細', 'その他支払明細',
  'ドロア', '釣銭', '預かり', '締め', '担当'];

/**
 * 現金の次に来る、ほかの支払い方法
 *
 * ★紙によっては「現金」「7件」「￥5,120」が別々の行に分かれて出てきます。
 *   そこで、現金の行から下へ少し探しに行きます。
 *   ただし、ほかの支払い方法に当たったらそこで止めます
 *   （止めないと、クレジットの金額を現金として拾ってしまいます）。
 */
const CASH_OTHER_ROWS = ['クレジット', 'カード', '電子マネー', 'ポイント', '商品券',
  '掛売', '売掛', 'QR', 'その他支払', 'コード決済', '小計', '合計', '値引'];

/** 現金の行から、何行下まで金額を探しに行くか */
const CASH_LOOK_AHEAD = 3;

/** 「現金」に見えるが、現金売上ではない行 */
const CASH_NOT_ROWS = ['現金以外', '現金売上', '預かり現金', '現金釣銭', '現金有高', '現金過不足'];

/** 目印を探すとき用。空きを全部取り除きます（OCRは「現 金」のように離すことがあります） */
function cashPlain(line) {
  return cashNormalize(line).replace(/[\s\u3000]/g, '');
}

/** 全角の数字と記号を半角にして、数字の中の区切りを取り除く */
function cashNormalize(line) {
  return String(line || '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，、]/g, ',')
    .replace(/[￥]/g, '¥')
    .replace(/,\s+(?=\d)/g, ',')    // 「300, 000」のように空きが入ることがあります
    // ★OCRが旧字や似た字で読むことがあります。実際に「消費稅」と出ました
    // ★旧字・異体字をそろえます。実際に出たもの：
    //   「消費稅」／「(內消費税」（内ではなく內）。
    //   一文字ちがうだけで「内消費税を除く」が効かなくなり、
    //   8%の内消費税を合計と取りちがえました
    .replace(/稅/g, '税')
    .replace(/內/g, '内')
    .replace(/賣/g, '売')
    .replace(/數/g, '数')
    .replace(/當/g, '当')
    .replace(/營/g, '営')
    .replace(/圓/g, '円');
}

/** 文字を数にする（「5,120」「5.120」→ 5120。数でなければ null） */
function cashNumOf(text) {
  const n = Number(String(text).replace(/[,.\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * 1行から「¥ か 円 の付いた金額」を取り出す
 *
 * ★これが一番確かな目印なので、まずこれだけで探します。
 */
function cashMarkedOf(line) {
  const s = cashNormalize(line);
  const out = [];
  const re = /¥\s*([\d][\d,.]*)|([\d][\d,.]*)\s*円/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const v = cashNumOf(m[1] !== undefined ? m[1] : m[2]);
    if (v !== null) out.push(v);
  }
  return out.length ? out[out.length - 1] : null;
}

/**
 * 1行から「目印の無い数字」を取り出す（最後の手だて）
 *
 * ★ここが一番間違えやすいところです。実際に、OCRが「7件」を「714」と
 *   読んでいて、それを金額として拾ってしまいました。
 *   なので **0円 か、1000円以上** しか受け付けません。
 *   件数（0〜99くらい）を金額とまちがえないためです。
 *   本当に1000円未満だった日は読み取れませんが、そのときは手で入れてもらいます
 *   （まちがった金額が入るより、入らない方が安全です）。
 */
function cashBareOf(line) {
  const s = cashNormalize(line);
  const out = [];
  const re = /([\d][\d,.]*)\s*([件点%個人])?/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m[2]) continue;                       // 「4件」のような数え方は外します
    const v = cashNumOf(m[1]);
    if (v === null) continue;
    if (v !== 0 && v < 1000) continue;        // 件数らしい小さな数は受け付けません
    out.push(v);
  }
  return out.length ? out[out.length - 1] : null;
}

/**
 * 名前だけが先に並んでいるときの読み方
 *
 * 「現金」の下に、金額の付かない支払い方法の名前が続き、そのあとに
 * 金額がまとめて出てくる形です。名前の並びの**先頭が現金のとき**だけ、
 * そのあとの最初の金額を現金のものとします。
 *
 * ★先頭でなければ、あきらめて null を返します。順番がずれていると、
 *   よその支払いの金額を現金として入れてしまうためです。
 */
function cashStackedOf(lines, at) {
  const isLabel = (t) => CASH_OTHER_ROWS.some((k) => cashPlain(t).includes(k));

  // 現金のすぐ上が、ほかの支払い方法の名前なら、並びの先頭ではありません
  const above = lines[at - 1];
  if (above && isLabel(above) && cashMarkedOf(above) === null) return null;

  let names = 0;
  for (let j = at + 1; j < Math.min(at + 10, lines.length); j++) {
    const line = lines[j];
    const plain = cashPlain(line);
    if (CASH_SECTION_END.some((k) => plain.includes(k))) return null;

    const money = cashMarkedOf(line);
    if (money !== null) {
      // 名前が2つ以上つづいたあとの、最初の金額。そこまで来ていなければ見送ります
      return names >= 2 ? money : null;
    }
    if (isLabel(line)) names += 1;
  }
  return null;
}

/**
 * 読み取った文字から、現金売上を取り出す
 *
 * 返り値
 *   { yen: 数字, how: 'read' }   … 現金の行から読めた
 *   { yen: 0,    how: 'none' }   … 支払いの欄はあったが、現金の行が無い（＝現金なしの日）
 *   { yen: null, how: 'ng' }     … 読み取れない（現金の行はあるのに金額が拾えない場合も含む）
 *
 * ★「現金の行はあるのに金額が読めない」ときに 0円 を入れてはいけません。
 *   本当は売上があった日を 0円 で記録してしまうためです。'ng' にして、
 *   人に入れてもらいます。
 */
function parseJournalCash(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let from = -1;
  for (let i = 0; i < lines.length && from < 0; i++) {
    if (CASH_SECTION_MARKS.some((mark) => cashPlain(lines[i]).includes(mark))) from = i;
  }
  if (from < 0) return { yen: null, how: 'ng' };

  let sawCash = false;   // 現金の行そのものは見つかったか
  for (let i = from + 1; i < lines.length; i++) {
    const line = lines[i];
    const plain = cashPlain(line);
    if (CASH_SECTION_END.some((mark) => plain.includes(mark))) break;
    if (!plain.includes('現金')) continue;
    if (CASH_NOT_ROWS.some((ng) => plain.includes(ng))) continue;
    // 「(含む 現金釣銭 ¥0)」のような、かっこ書きの但し書きは数えません
    if (/^[(（]/.test(plain)) continue;
    sawCash = true;

    // 「現金」の行から少し下までを、金額をさがす範囲にします
    // （炭まろ・ちゃこる・バグる・popo の紙は、件数と金額が下の行に分かれます）
    const window = [];
    const last = Math.min(i + CASH_LOOK_AHEAD, lines.length - 1);
    for (let j = i; j <= last; j++) {
      if (j > i) {
        const p = cashPlain(lines[j]);
        // ほかの支払い方法まで来てしまったら、そこで止めます
        if (CASH_OTHER_ROWS.some((k) => p.includes(k))) break;
        if (CASH_SECTION_END.some((k) => p.includes(k))) break;
      }
      window.push(lines[j]);
    }

    // ★2段に分けて探します。
    //   ① ¥ か 円 の付いた金額（一番確か）を、範囲全部から
    //   ② それが1つも無いときだけ、目印の無い数字から
    //   1行ずつ「①→②」で見てしまうと、「7件」を読みまちがえた「714」を
    //   先に拾ってしまいます（実際にそうなりました）
    for (const one of window) {
      const v = cashMarkedOf(one);
      if (v !== null) return { yen: v, how: 'read' };
    }
    for (const one of window) {
      const v = cashBareOf(one);
      if (v !== null) return { yen: v, how: 'read' };
    }

    // ★ここまでで見つからないとき。
    //   紙によっては、支払い方法の**名前だけが先に並び、金額はそのあとに
    //   まとめて出る**ことがあります（こじゃれの紙で実際に起きました）。
    //     現金 ／ クレジット ／ その他支払 0点 売掛金 ／ … ／ 250,000円 ／ 80,000円
    //   このときは、名前の並びのあとに出てくる**最初の金額**が現金のものです。
    const stacked = cashStackedOf(lines, i);
    if (stacked !== null) return { yen: stacked, how: 'read' };
  }

  // 現金の行はあったのに、金額だけ拾えなかったとき。
  // ここで 0円 にすると、売上があった日を 0円 で残してしまいます
  if (sawCash) return { yen: null, how: 'ng' };

  // 支払いの欄はあったのに現金の行が無い＝その日は現金の会計が1件も無かった
  // （おいでんテラスの紙は、現金が無い日は行ごと出ません）
  return { yen: 0, how: 'none' };
}

/* ------------------------------------------------------------
 *  ジャーナル（日計レポート／精算レポート）から、日報に入れる数を読む
 *
 *  ★考え方
 *    OCRは必ずまちがえます。実際に「38件」が「3814」、
 *    「電子マネー」が「電子又一」と読まれた例があります。
 *    そこで、読んだ数をそのまま信じません。
 *    レシート自身が持っている計算式で検算し、
 *    合わないものは【入れません】。空欄の方が安全です。
 *
 *    さらに、1つだけ読めなかったときは、
 *    ほかの数から【計算で埋めます】（当てずっぽうではなく引き算です）。
 * ---------------------------------------------------------- */

/** 読む行。OCRで名前が崩れるので、短い手がかりをいくつも並べます */
const JOURNAL_FIELDS = [
  { key: 'guests', name: '客数',
    // ★exact … その行そのものがこの字だけのときも、その項目とみなします。
    //   「客数」の「数」が落ちて「客」だけになることがありました。
    //   hit に入れると「111客」まで項目名に見えてしまうので、分けています
    hit: ['客数'], exact: ['客'],
    skip: ['組数', '客単価', '男性', '女性', '選択なし'], unit: '客人名' },
  { key: 'men', name: '男性',
    hit: ['男性'], skip: [], unit: '客人名' },
  { key: 'women', name: '女性',
    hit: ['女性'], skip: [], unit: '客人名' },
  { key: 'nosel', name: '選択なし',
    hit: ['選択なし'], skip: [], unit: '客人名' },
  { key: 'per', name: '客単価（税込）',
    hit: ['客単価(税込)', '客単価（税込）', '客単価'], skip: ['税抜'] },
  { key: 'gross', name: '売上',
    hit: ['総売上', '売上'], skip: ['純売上', '売上点数', '控除', '点'] },
  { key: 'tax', name: '消費税',
    hit: ['消費税'], skip: ['内消費税', '(内'] },
  { key: 'net', name: '純売上',
    hit: ['純売上'], skip: ['控除後純売上'] },
  { key: 'cash', name: '現金',
    hit: ['現金'], skip: ['現金以外', '現金売上', '預かり現金', '現金釣銭', '現金約銭', '現金有高', '現金過不足'] },
  { key: 'credit', name: 'クレジット',
    hit: ['クレジット', 'クレシ', 'カード'], skip: ['明細'] },
  { key: 'point', name: 'ポイント',
    hit: ['ポイント'], skip: ['明細'] },
  { key: 'emoney', name: '電子マネー',
    hit: ['電子マネー', '電子マネ', '電子又', '電子'], skip: ['明細'] },
  { key: 'voucher1', name: '商品券（釣無し）',
    hit: ['商品券(釣無', '商品券（釣無', '商品券(釣無し'], skip: ['未使用'] },
  { key: 'voucher2', name: '商品券（釣有り）',
    hit: ['商品券(釣有', '商品券（釣有'], skip: ['釣銭', '約銭'] },
  { key: 'kake', name: '掛売',
    hit: ['掛売', '売掛'], skip: [] },
  { key: 'received', name: 'お預かり現金',
    hit: ['お預かり現金', '預かり現金', 'お預り現金'], skip: [] },
  { key: 'change', name: 'おつり',
    hit: ['おつり', 'お釣り', '釣銭合計'], skip: ['商品券'] },
];

/** 支払方法（合計すると売上になるもの） */
const JOURNAL_PAY = ['cash', 'credit', 'point', 'emoney', 'voucher1', 'voucher2', 'kake'];

/** 金額を探すとき、何行先まで見るか */
const JOURNAL_AHEAD = 3;

/**
 * その行に、ちがう項目名がいくつ入っているか
 *
 * ★「総売上 純売上」のように2つ並んだ見出し行から金額を取ると、
 *   よその数を取りちがえます（実際にこじゃれで起きました）。
 *   2つ以上あったら、その行は使いません。
 */
function journalLabelCount(line) {
  const p = cashPlain(line);
  if (!p) return 0;
  // ★「その項目ではない」と分かっているもの（skip）は数えません。
  //   これが無いと「純売上」の行が『売上と純売上の2つ』に見えて、捨ててしまいます
  return JOURNAL_FIELDS.filter((f) =>
    f.hit.some((h) => p.includes(cashPlain(h)))
    && !f.skip.some((ng) => p.includes(cashPlain(ng)))).length;
}

/** その行が、どれかの項目名に見えるか */
function journalIsLabel(line) {
  const p = cashPlain(line);
  if (!p) return false;
  return JOURNAL_FIELDS.some((f) => f.hit.some((h) => p.includes(cashPlain(h))));
}

/** 「120客」「60人」のように、単位のついた数を取り出す */
function journalUnitOf(line, units) {
  const s = cashNormalize(line);
  const re = new RegExp(`([\\d][\\d,.]*)\\s*[${units}]`);
  const m = re.exec(s);
  return m ? cashNumOf(m[1]) : null;
}

/* ------------------------------------------------------------
 *  「項目名だけの列 → 値だけの列」で出てきたときの対応づけ
 *
 *  紙を斜めから撮ると、OCRが左の列を上から下まで読んでから、
 *  右の列を上から下まで読むことがあります。実際にこうなりました。
 *
 *      客数 / 男性 / 女性 / 選択なし / 客単価(税込) / …      ← 名前だけ
 *      6205 / 120客 / 40客 / 80客 / 客 / ¥1,250 / …        ← 値だけ
 *
 *  ★うしろからそろえます。紙の上の方は写真から切れやすく、
 *    名前が1つ足りないことがあるためです（上の例では「組数」が切れています）。
 * ---------------------------------------------------------- */

/** 名前だけの行（数字も ¥ も無い） */
function journalWordOnly(line) {
  const s = cashNormalize(line).trim();
  if (!s) return false;
  return !/[\d¥]/.test(s);
}

/** 値だけの行。数が読めなかった単位だけの行（「客」など）も、場所取りとして数えます */
function journalValueOnly(line) {
  const s = cashNormalize(line).trim();
  if (!s) return false;
  if (/^[¥\d]/.test(s)) return true;
  return /^[客人点組件円]$/.test(s);
}

/** 項目名の行番号 → その値の行 */
function journalPairs(lines) {
  const out = {};
  let i = 0;
  while (i < lines.length) {
    let a = i;
    while (a < lines.length && journalWordOnly(lines[a])) a++;
    let b = a;
    while (b < lines.length && journalValueOnly(lines[b])) b++;
    // 名前が3つ以上ならび、そのあとに値が3つ以上ならんだときだけ、対応づけます
    if (a - i >= 3 && b - a >= 3) {
      const n = Math.min(a - i, b - a);
      for (let k = 0; k < n; k++) out[a - 1 - k] = lines[b - 1 - k];
      i = b;
    } else {
      i = Math.max(i + 1, a);
    }
  }
  return out;
}

/**
 * 支払の欄だけ、名前の並びと金額の並びを順番どおりに対応づけます
 *
 * ★支払の欄は、名前も金額も必ず同じ順で出ます。途中で行がずれても、
 *   何番目かは変わりません。実際にこうなりました：
 *     電子又一 / 2514 / 商品券(釣無L) 0件 / ¥20,000 / ¥0
 *   （¥20,000 は電子マネーの金額で、商品券の行より下に出ています）
 *   かっこ書き（「(含む商品券未使用金額 ¥0)」など）は数に入れません。
 */
function journalPaySeq(lines) {
  const mine = JOURNAL_FIELDS.filter((f) =>
    JOURNAL_PAY.indexOf(f.key) >= 0 || f.key === 'received' || f.key === 'change');

  let from = -1;
  for (let i = 0; i < lines.length; i++) {
    if (CASH_SECTION_MARKS.some((m) => cashPlain(lines[i]).includes(m))) { from = i; break; }
  }
  if (from < 0) return {};

  const labels = [];
  const amounts = [];
  for (let i = from + 1; i < lines.length; i++) {
    const p = cashPlain(lines[i]);
    if (!p) continue;
    // かっこ書きは、その上の項目の内わけなので数えません
    if (/^[(（]/.test(p) || p.indexOf('含') >= 0) continue;
    const f = mine.find((x) => !x.skip.some((ng) => p.includes(cashPlain(ng)))
      && x.hit.some((h) => p.includes(cashPlain(h))));
    if (f && !labels.some((l) => l === f.key)) labels.push(f.key);
    const v = cashMarkedOf(lines[i]);
    if (v !== null) amounts.push(v);
  }

  const out = {};
  const n = Math.min(labels.length, amounts.length);
  for (let k = 0; k < n; k++) out[labels[k]] = amounts[k];
  return out;
}

/**
 * 1つの項目の数の「候補」を集めます
 *
 * ★読み取りは、値が項目名の【下】に来ることも【上】に来ることもあります。
 *   実際に、同じ紙の中で
 *     売上 …「¥250,000 → 売上 → ¥220,000」（値が上）
 *     現金 …「現金 → 38件 → ¥130,000」（値が下）
 *   と、途中で向きが変わっていました。
 *   どちらか片方だけ見ていると、必ずどこかで取りちがえます。
 *
 *   そこで【上・下・列の対応づけ】を候補として集めておき、
 *   どれが正しいかは、レシート自身の計算式（検算）に決めてもらいます。
 */
function journalCandidates(lines, field, pairs, seq) {
  for (let i = 0; i < lines.length; i++) {
    const p = cashPlain(lines[i]);
    if (!p) continue;
    if (field.skip.some((ng) => p.includes(cashPlain(ng)))) continue;
    const same = (field.exact || []).some((e) => p === cashPlain(e));
    if (!same && !field.hit.some((h) => p.includes(cashPlain(h)))) continue;
    if (!same && journalLabelCount(lines[i]) > 1) continue;   // 見出しが2つ並んだ行は使いません

    // ★2まわりします。1まわり目は「¥や単位のついた、たしかな数」だけ。
    //   2まわり目でようやく、目印の無い数字を見ます。
    //   こうしないと「38件」が「3814」と崩れたとき、それを金額にしてしまいます
    const sure1 = (line) => {
      if (field.unit) {
        const u = journalUnitOf(line, field.unit);
        if (u !== null) return u;
      }
      return cashMarkedOf(line);
    };
    // ★窓の中の「¥や単位のついた数」は、全部を候補にします。
    //   1つずれて出ることがあるためです。実際にこうなりました：
    //     掛売 / 0件 / お預かり現金 / ¥0 / ¥93,830 / おつり / ¥27,450
    //   （¥0 は掛売の金額で、お預かりは その次）
    //   目印の無い数字は最後の手だてなので、1つだけ・見つからなかったときだけ見ます
    const scan = (from, to, step) => {
      const got = [];
      for (let j = from; step > 0 ? j <= to : j >= to; j += step) {
        if (j !== i && journalIsLabel(lines[j])) break;
        const v = sure1(lines[j]);
        if (v !== null && got.indexOf(v) < 0) got.push(v);
      }
      if (got.length) return got;
      // ★支払の項目では、目印の無い数字を金額にしません。
      //   「25件」が「2514」と崩れると、それを金額にしてしまうためです。
      //   読めなければ「読めず」にして、引き算で埋めさせます
      if (JOURNAL_PAY.indexOf(field.key) >= 0) return [];
      for (let j = from; step > 0 ? j <= to : j >= to; j += step) {
        if (j !== i && journalIsLabel(lines[j])) break;
        const v = cashBareOf(lines[j]);
        if (v !== null) return [v];
      }
      return [];
    };

    // ① その行と、下の行
    const down = scan(i, Math.min(i + JOURNAL_AHEAD, lines.length - 1), 1);
    // ② 上の行
    const up = scan(i - 1, Math.max(0, i - JOURNAL_AHEAD), -1);
    // ③ 名前の列と値の列に分かれていたときの、対応づけ
    const pairedLine = pairs && pairs[i];
    const paired = pairedLine
      ? (sure1(pairedLine) !== null ? sure1(pairedLine) : cashBareOf(pairedLine))
      : null;

    // ★「N件」があるときは、上を見ません。
    //   支払の欄は必ず「項目名 → N件 → 金額」の順に出るので、
    //   ここで上も候補にすると、1つずつずれた並びでも合計が合ってしまい、
    //   検算が守りになりません（実際にそうなりました）。
    const cnt = /(^|[^\d])\d+\s*件/;
    const next = i + 1 < lines.length ? cashNormalize(lines[i + 1]).trim() : '';
    const after = i + 2 < lines.length ? cashNormalize(lines[i + 2]) : '';
    const anchored = cnt.test(cashNormalize(lines[i]))
      || cnt.test(next)
      // 「38件」が「3814」のように崩れることがあります。
      // 数字だけの行のあとに金額が続いていれば、それは件数の行です
      || (/^\d+$/.test(next) && /¥\s*\d/.test(after));

    const out = [];
    const push = (v) => { if (v !== null && out.indexOf(v) < 0) out.push(v); };
    down.forEach(push);
    push(seq && seq[field.key] !== undefined ? seq[field.key] : null);
    push(paired);
    if (!anchored) up.forEach(push);
    // ★下の行から取れなかったときは、当てにならないので「読めず」も候補に入れます。
    //   実際に「ポイント」で、上にあったクレジットの金額を拾ってしまいました
    if (!down.length && out.length) out.push(null);
    // ★支払の項目が 0 と読めたときは「読めず」も候補にします。
    //   よその「¥0」を掴むと、0 として通ってしまい、
    //   引き算で埋める機会を失います（8/6の電子マネーが実際にそうなりました）。
    //   本当に0なら、引き算しても0になるので、害はありません
    if (JOURNAL_PAY.indexOf(field.key) >= 0 && out.indexOf(0) >= 0 && out.indexOf(null) < 0) {
      out.push(null);
    }
    // 「N件」があるのに金額が読めなかったときは、素直に「読めず」にします
    if (anchored && !down.length) return [];
    return out;
  }
  return [];
}

/**
 * 足りないものを、ほかの数から埋めます（当てずっぽうではなく引き算です）
 *
 * ★選ぶとき（journalPick）にも通します。そうしないと
 *   「よその0を掴んだ組み合わせ」と「読めずの組み合わせ」が同じ点になり、
 *   埋めれば正しくなる方を選べません
 */
function journalFill(v) {
  const out = { ...v };
  const fixed = [];
  const has = (k) => out[k] !== null && out[k] !== undefined;

  // ★埋める前に、ありえない値でないか見ます。
  //   歯止めが無かったせいで「現金 −151,120／商品券 268,590」でも
  //   計算だけは辻褄が合ってしまい、それが選ばれました
  if (!has('cash') && has('received') && has('change') && out.received >= out.change) {
    out.cash = out.received - out.change; fixed.push('現金');
  }
  if (has('gross')) {
    const miss = JOURNAL_PAY.filter((k) => !has(k));
    if (miss.length === 1) {
      const rest = JOURNAL_PAY.filter((k) => k !== miss[0]).reduce((a, k) => a + out[k], 0);
      const d = out.gross - rest;
      if (d >= 0 && d <= out.gross) {
        out[miss[0]] = d;
        fixed.push((JOURNAL_FIELDS.find((f) => f.key === miss[0]) || {}).name);
      }
    }
  }
  if (!has('net') && has('gross') && has('tax')) { out.net = out.gross - out.tax; fixed.push('純売上'); }
  if (!has('gross') && has('net') && has('tax')) { out.gross = out.net + out.tax; fixed.push('売上'); }
  return { v: out, fixed };
}

/**
 * ありえない組み合わせでないか
 *
 * ★これが無いと、検算の式だけは満たす「めちゃくちゃな組み合わせ」が選ばれます。
 *   実際に 現金 −151,120／商品券 268,590 が選ばれました。
 */
function journalSane(v) {
  const has = (k) => v[k] !== null && v[k] !== undefined;
  for (let i = 0; i < JOURNAL_PAY.length; i++) {
    const k = JOURNAL_PAY[i];
    if (!has(k)) continue;
    if (v[k] < 0) return false;                          // 支払がマイナスはありません
    if (has('gross') && v[k] > v.gross) return false;    // 売上より多い支払もありません
  }
  if (has('received') && has('change') && v.received < v.change) return false;
  if (has('guests') && v.guests < 0) return false;
  if (has('net') && has('gross') && v.net > v.gross) return false;
  if (has('tax') && v.tax < 0) return false;
  return true;
}

/** 検算をして、通った数・落ちた数を返します */
function journalCheck(v) {
  const has = (k) => v[k] !== null && v[k] !== undefined;
  const sumPay = () => JOURNAL_PAY.reduce((a, k) => a + (v[k] || 0), 0);
  const checks = [];
  const add = (name, left, right, covers) => {
    checks.push({ name, left, right, ok: left === right, covers });
  };

  if (has('gross')) add('支払方法の合計 ＝ 売上', sumPay(), v.gross, JOURNAL_PAY.concat(['gross']));
  if (has('gross') && has('tax') && has('net')) {
    add('売上 − 消費税 ＝ 純売上', v.gross - v.tax, v.net, ['gross', 'tax', 'net']);
  }
  if (has('received') && has('change') && has('cash')) {
    add('お預かり − おつり ＝ 現金', v.received - v.change, v.cash, ['cash', 'received', 'change']);
  }
  if (has('men') && has('women') && has('guests')) {
    add('男性＋女性＋選択なし ＝ 客数', v.men + v.women + (v.nosel || 0), v.guests,
      ['guests', 'men', 'women', 'nosel']);
  }
  // 客単価が 0 のときは、読めていないだけなので検算しません
  if (has('per') && v.per > 0 && has('guests') && has('gross') && v.guests) {
    const calc = Math.round(v.gross / v.guests);
    checks.push({
      name: '売上 ÷ 客数 ＝ 客単価（税込）', left: calc, right: v.per,
      ok: Math.abs(calc - v.per) <= 2, covers: ['guests', 'per', 'gross'],
    });
  }
  if (has('gross') && has('net') && !has('tax')) {
    const r = v.gross ? v.net / v.gross : 0;
    checks.push({
      name: '純売上が売上の88〜95%に入っているか',
      left: Math.round(r * 1000) / 10, right: '88〜95',
      ok: r >= 0.88 && r <= 0.95, covers: ['gross', 'net'],
    });
  }
  return checks;
}

/** 候補の組み合わせを試して、検算が一番通るものを選びます */
function journalPick(cands) {
  const keys = Object.keys(cands);
  const pick = {};
  keys.forEach((k) => { pick[k] = cands[k].length ? cands[k][0] : null; });

  const multi = keys.filter((k) => cands[k].length > 1);
  let total = 1;
  multi.forEach((k) => { total *= cands[k].length; });
  if (total > 100000) return pick;          // 多すぎるときは、最初の候補のまま

  let best = null;
  const score = (v) => {
    if (!journalSane(v)) return { ok: 0, ng: 99, got: 0, point: -9999 };
    const filled = journalFill(v).v;
    if (!journalSane(filled)) return { ok: 0, ng: 99, got: 0, point: -9999 };
    const cs = journalCheck(filled);
    const ok = cs.filter((c) => c.ok).length;
    const ng = cs.length - ok;
    const got = keys.filter((k) => v[k] !== null && v[k] !== undefined).length;
    // 候補は「下から取れたもの」が先に入っています。
    // 同じだけ検算が通るなら、先の候補を選びます
    let far = 0;
    keys.forEach((k) => {
      const at = cands[k].indexOf(v[k]);
      if (at > 0) far += at;
    });
    return { ok, ng, got, point: ok * 10 - ng * 25 + got - far * 2 };
  };
  const cur = { ...pick };
  const rec = (i) => {
    if (i === multi.length) {
      const sc = score(cur);
      if (!best || sc.point > best.point) best = { v: { ...cur }, point: sc.point };
      return;
    }
    const k = multi[i];
    for (let n = 0; n < cands[k].length; n++) { cur[k] = cands[k][n]; rec(i + 1); }
  };
  rec(0);
  return best ? best.v : pick;
}

/**
 * ジャーナルの文字から、日報に入れる数を読み取ります。
 *
 *   返すもの
 *     v      … 読めた数（読めなかったものは null）
 *     checks … 検算の結果
 *     sure   … その数を使ってよいか（守ってくれる式が通ったか）
 *     ok     … 5つとも使えるか
 */
function parseJournal(text) {
  const lines = String(text || '').split(/\r?\n/);
  const pairs = journalPairs(lines);
  const seq = journalPaySeq(lines);
  const cands = {};
  JOURNAL_FIELDS.forEach((f) => { cands[f.key] = journalCandidates(lines, f, pairs, seq); });

  const picked = journalFill(journalPick(cands));
  const v = picked.v;
  const fixed = picked.fixed;
  const has = (k) => v[k] !== null && v[k] !== undefined;
  const sumPay = () => JOURNAL_PAY.reduce((a, k) => a + (v[k] || 0), 0);

  /* ---- 検算。★1つ1つの数に「守ってくれる式」を結びつけ、
     その式が通った数だけを使います ---- */
  const checks = journalCheck(v);
  const sure = {};
  Object.keys(v).forEach((k) => {
    if (!has(k)) return;
    const mine = checks.filter((c) => c.covers.indexOf(k) >= 0);
    sure[k] = mine.length > 0 && mine.every((c) => c.ok);
  });

  const bad = checks.filter((c) => !c.ok);
  const needed = ['cash', 'credit', 'emoney', 'net', 'guests'];

  // 写真の下が切れていると、支払の行がそろわず、合計が売上に届きません
  const cut = has('gross') && sumPay() < v.gross && !has('received');

  return {
    v, checks, fixed, sure, cut,
    ok: needed.every((k) => sure[k]),
    missing: needed.filter((k) => !sure[k])
      .map((k) => (JOURNAL_FIELDS.find((f) => f.key === k) || {}).name),
    why: cut
      ? '紙の下の方が写っていないようです。おつりの行まで入るように撮り直してください'
      : bad.length ? bad.map((c) => c.name).join('、') + ' が合いません' : '',
  };
}

/** 日報に5つを自動で入れられる店舗（ジャーナルの様式が同じもの）
 *  ★こじゃれは精算レポートという別の様式で、まだ読めません。
 *    読み取り全文をもらえれば足せます。おいでんテラスも未確認です。 */
const JOURNAL_STORES = ['sumimaro', 'chacoru', 'baguru', 'popo'];

/** 日報のA列にある項目名。★行番号ではなく、この名前で行を探します
 *  （店舗によって行がずれています。popoは商品券の行が1つ多く、
 *    ロケットナウが18行目、バグるは17行目でした） */
const NIPPOU_LABELS = {
  cash:      '現金売上',
  credit:    'クレジット',
  emoney:    '電子マネー',
  net:       '純売上',
  guests:    '当日客数',
  total:     '当日総合計',        // 書いたあとの検算に使います
  demaeCash: '出前館現金',
  demaeCard: '出前館クレジット',
  uberCash:  'ウーバー現金',
  uberCard:  'ウーバークレジット',
  rocket:    'ロケットナウ',
};

/* ------------------------------------------------------------
 *  手で入れる分は「＝で始まる計算式」でも入れられます
 *
 *  出前館・ウーバー・ロケットナウは、1日に何件も出るので
 *  「=1000+2000+3000」と足し算のまま入れたいことがあります。
 *  そのまま日報のマスにも計算式として入るので、
 *  あとから日報を開いたときに「何件でいくらだったか」が残ります。
 *
 *  ★eval は使いません。入れた文字がそのまま動いてしまうためです。
 *    数と ＋−×÷ と かっこ だけを、自分で読んで計算します。
 *    読めない形（文字が混ざっている、かっこが合わない）は null を返し、
 *    画面で「計算できません」と出します。**まちがった数は使いません。**
 * ---------------------------------------------------------- */

/**
 * 計算式に使う文字を半角にします
 *
 * ★iPhone や iPad の日本語キーボードだと「＝１０００＋２０００」と全角になります。
 *   cashNormalize は数字しか直さない（記号を直すとOCRの読み取りに響く）ので、
 *   計算式のところだけ、ここで記号もそろえます。
 */
function cashFormulaPlain(text) {
  return cashNormalize(text)
    .replace(/[＝]/g, '=')
    .replace(/[＋]/g, '+')
    .replace(/[－ー−–—]/g, '-')
    .replace(/[＊×✕]/g, '*')
    .replace(/[／÷]/g, '/')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[．]/g, '.')
    .replace(/[　]/g, ' ');
}

/** 「=1000+2000」の形か */
function cashIsFormula(text) {
  return /^\s*=/.test(cashFormulaPlain(text));
}

/**
 * 計算式を計算します。読めなければ null
 *
 * 使えるのは 数字 ＋ − × ÷ ( ) と、見やすさのためのカンマだけです。
 */
function cashFormulaEval(text) {
  let s = cashFormulaPlain(text).replace(/^\s*=/, '');
  s = s.replace(/[,\s]/g, '');
  if (!s) return null;
  // ★ここに無い文字が1つでもあれば、計算しません
  if (!/^[\d+\-*/().]+$/.test(s)) return null;

  let at = 0;
  const peek = () => s[at];
  const eat = (c) => { if (s[at] === c) { at++; return true; } return false; };

  //  式 … 項（＋か− 項）*
  function expr() {
    let v = term();
    if (v === null) return null;
    for (;;) {
      if (eat('+')) { const r = term(); if (r === null) return null; v += r; }
      else if (eat('-')) { const r = term(); if (r === null) return null; v -= r; }
      else return v;
    }
  }
  //  項 … 数（×か÷ 数）*
  function term() {
    let v = unary();
    if (v === null) return null;
    for (;;) {
      if (eat('*')) { const r = unary(); if (r === null) return null; v *= r; }
      else if (eat('/')) {
        const r = unary();
        if (r === null || r === 0) return null;   // 0で割るのは読めない扱いにします
        v /= r;
      } else return v;
    }
  }
  //  頭についた ＋ −
  function unary() {
    if (eat('+')) return unary();
    if (eat('-')) { const v = unary(); return v === null ? null : -v; }
    return atom();
  }
  //  数、または かっこ
  function atom() {
    if (eat('(')) {
      const v = expr();
      if (v === null || !eat(')')) return null;
      return v;
    }
    const from = at;
    while (at < s.length && /[\d.]/.test(peek())) at++;
    if (at === from) return null;
    const n = Number(s.slice(from, at));
    return Number.isFinite(n) ? n : null;
  }

  const v = expr();
  if (v === null || at !== s.length || !Number.isFinite(v)) return null;
  return Math.round(v);
}

/**
 * 手で入れた分を数にします
 *
 * ★数でも「=1000+2000」でも受け取ります。
 *   前に記録した日は数で残っているので、どちらも読めないといけません。
 *   計算できないものは 0 ではなく null を返します。
 *   0 にすると、入れまちがえた日を「0円だった日」として記録してしまいます。
 */
function cashMinusNum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v);
  if (cashIsFormula(s)) return cashFormulaEval(s);
  const n = Number(cashFormulaPlain(s).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** 引き算に使う数。入れていない欄は 0 として扱います */
function cashMinusOr0(v) {
  const n = cashMinusNum(v);
  return n === null ? 0 : n;
}

/* ------------------------------------------------------------
 *  仕入明細と人件費（日報のE列）
 *
 *  日報の日別ページは、右半分がこうなっています。
 *
 *      E列（名前）      F列        G列
 *      ④仕入明細
 *      仕入先          当日現金    掛仕入     ← 見出し
 *      仕入先A         …          …
 *      （…仕入先が並ぶ…）
 *      買い出し
 *      当日総合計       0          60,000     ← ここから下は日報の計算
 *      ⑤人件費
 *      区分            人数        金額       ← 見出し
 *      社員                        20,000
 *      アルバイト                  30,000
 *      交通費           5          1,500
 *
 *  ★仕入先はアプリに持ちません。日報のE列にあるものが正です。
 *    店舗ごとに違い、業者が増えることもあるので、
 *    持たせるとすぐ古くなります（行番号で覚えないのと同じ考えです）。
 * ---------------------------------------------------------- */

/** 見出しの名前（空きや全角を落として見くらべます） */
const NIPPOU_E_MARKS = {
  shiireHead: '仕入先',
  jinkenHead: '区分',
};

/** そこで打ち切る行（ここから下は日報が計算する所です） */
function nippouEStop(name) {
  const p = String(name || '').replace(/[\s　]/g, '');
  if (/合計|累計|税抜/.test(p)) return true;
  // 「⑤人件費」「⑥来店経路」のような、次の節の見出し
  if (/^[①-⑳]/.test(p)) return true;
  return false;
}

/**
 * 日報から返ってきたE列の並びを、仕入と人件費に切り分けます
 *
 *   grid … [{ row, name, f, g, fx, gx }, …]
 *   返り … { shiire: [...], jinken: [...] }
 *
 * ★見出し（「仕入先」「区分」）の次の行から、合計・累計・次の節の手前までを取ります。
 *   行番号は使いません。様式が変わってもついていけます。
 */
function nippouGridSplit(grid) {
  const rows = Array.isArray(grid) ? grid : [];
  const out = { shiire: [], jinken: [] };
  const 拾う = (見出し) => {
    const at = rows.findIndex((r) =>
      String(r.name || '').replace(/[\s　]/g, '') === 見出し);
    if (at < 0) return [];
    const got = [];
    for (let i = at + 1; i < rows.length; i++) {
      if (nippouEStop(rows[i].name)) break;
      got.push(rows[i]);
    }
    return got;
  };
  out.shiire = 拾う(NIPPOU_E_MARKS.shiireHead);
  out.jinken = 拾う(NIPPOU_E_MARKS.jinkenHead);
  return out;
}

/** 日報に書く前の引き算。手で入れてもらう分を差し引きます */
const NIPPOU_MINUS = {
  cash:   ['demaeCash', 'uberCash'],
  credit: ['demaeCard', 'uberCard', 'rocket'],
  emoney: [],
  net:    [],
  guests: [],
};

/**
 * ジャーナルの読み取りと、手で入れた分から、日報に入れる5つを作ります。
 *   j … parseJournal の v（ジャーナルから読めた数）
 *   m … 手入力（出前館・ウーバー・ロケットナウ）
 */
function nippouValues(j, m) {
  const out = {};
  ['cash', 'credit', 'emoney', 'net', 'guests'].forEach((k) => {
    if (j[k] === null || j[k] === undefined) { out[k] = null; return; }
    out[k] = NIPPOU_MINUS[k].reduce((a, x) => a - cashMinusOr0(m && m[x]), j[k]);
  });
  return out;
}


/**
 * 写真は長い辺をこの大きさまで小さくしてから送ります（文字が読める大きさ）
 *
 * ★大きさ（ピクセル）は減らしません。文字の読み取りに一番効くのがここだからです。
 */
const CASH_PHOTO_MAX = 2000;

/**
 * 机を大きく落とせたときの、長い辺の大きさ
 *
 * ★紙が写真の半分より小さかったときだけ、こちらを使います。
 *   落とした分の余裕を字に回して、読み取りを確かにするためです。
 *   それでも、机まで写していたころよりファイルは小さくなります。
 * ★少ししか落とせなかったとき（もともと紙が大きく写っている写真）は、
 *   いつもどおり CASH_PHOTO_MAX です。大きくすると、かえって重くなるためです。
 */
const CASH_PHOTO_MAX_CROP = 2400;
/** 紙がこれより小さく写っていたら、上の大きさを使います */
const CASH_CROP_SHARE = 0.75;

/**
 * 送るときの画質
 *
 * ★ここが待ち時間の大半です。読み取りも記録も5〜6秒かかっていて、
 *   記録の方は文字を読んでいないので、**送る時間**が犯人だと分かりました。
 *   レシートは白地に黒の字なので、画質を落としても字の形はほとんど崩れません。
 *   0.82 → 0.62 で、送る大きさがおよそ半分になります。
 * ★読み取れなかったときは、いちど元の画質で送り直します（下の RETRY）。
 */
const CASH_PHOTO_Q = 0.62;
/** 読み取れなかったときに、もう一度だけ試す画質 */
const CASH_PHOTO_Q_RETRY = 0.9;

/**
 * 貼ってほしい 現金売上.gs の版の印
 *
 * ★この行は gas/build_paste.py が書きかえます。手で直さないでください。
 *   サーバーが返してくる印とちがっていたら、貼り直しがまだ、ということです。
 *   写真を撮ったときに、その場で画面に出します。
 */
const CASH_GAS_VERSION = '69d20519';

/**
 * 貼ってほしい 日報に書く.gs の版の印
 *
 * ★この行は gas/build_paste.py が書きかえます。手で直さないでください。
 * ★なぜ要るか。日報へ書く側は「見る → 確かめる → 書く → 当日総合計で検算」と
 *   守りが厚いのですが、**新しく足した書き方を古いGASが知らないとき**だけは
 *   すり抜けます。古いGASは知らない指示を黙って素通りさせ、
 *   当日総合計は合ったままなので、検算でも捕まりません。
 *   実際、計算式（=1000+2000）で書けるようにしたとき、
 *   古いGASのままだと「入れた式を次の日に書き直せない」状態になりました。
 *   そこで書く前に版を見くらべ、食いちがっていれば**書かせません**。
 */
const NIPPOU_GAS_VERSION = '2665a317';


/* ------------------------------------------------------------
 *  4-5) アルバイトの教育（教育マニュアル）
 *
 *  店舗ごとに、教える項目を大きなくくり（大カテゴリー）に分けて並べます。
 *  中身の形はクローズのチェック項目と同じです。
 *
 *  進み具合は「人ごと」に持ちます。記録の入れ先は  storeId/TRAIN  ひとつで、
 *  その中の項目名を  人のid::項目id  にして分けています。
 *  （こうすると Apps Script 側を直さずに、いつもの同期でそのまま配られます）
 *
 *  ★全部にチェックが入った人は、一覧から消えます（下の「終わった人」に移ります）。
 *    記録は消えないので、あとから見返せます。
 * ---------------------------------------------------------- */

/** 教育の記録の入れ先（storeId/TRAIN）。日付ではないので提出記録には出ません */
const TRAIN_KEY = 'TRAIN';

/** その人のその項目を入れておく名前 */
/**
 * ★昔の作り（1店舗を1行にまとめていたころ）のキーです。
 *   いまは使いません。前に入れたものを持ってくるときだけ使います。
 */
function trainItemKey(personId, itemId) {
  return `${personId}::${itemId}`;
}

/**
 * 教育の記録は「人ごとに1行」です（例 `chacoru/TRAIN-tp-abc1234`）。
 *
 * ★なぜ分けたか
 *   1店舗を1行にまとめていると、34項目のお店で19人目に
 *   Googleスプレッドシートの「1マス5万文字」に届きます。
 *   そこを超えるとシートへの書き込みが例外になり、
 *   教育だけでなく【全部の同期】が止まってしまいます。
 *   人ごとに分ければ1行は2,800文字ほどで頭打ちになり、二度と当たりません。
 */
function trainDayKey(personId) {
  return `${TRAIN_KEY}-${personId}`;
}

/**
 * 教える項目（★あとから足す場所★）
 *
 * section = 大カテゴリー
 *   id     : 英数字で固定（★変えると、それまでの進み具合が消えて見えます★）
 *   title  : 画面に出る見出し
 *   items  : 中の項目
 *
 * item
 *   id     : 英数字で固定（同上）
 *   label  : 画面に出る項目名
 *   hint   : 補足（省略可）
 */
const TRAIN_DEFAULT = [];

/**
 * 店舗ごとの中身。書いていない店舗は上の TRAIN_DEFAULT（＝まだ空）を使います
 *
 * ★かっこの中は、2つの項目を見分けるためのものは label に残し、
 *   ただの補足は hint（項目の下に小さく出ます）にしてあります。
 */
const TRAIN_OVERRIDES = {

  /* ===== こじゃれ ===== */
  kojare: [
    {
      id: 'kj-tr-basic',
      title: '基本ルール',
      items: [
        { id: 'kj-tr-b01', label: 'あいさつ', hint: 'おはようございます・お疲れ様です' },
        { id: 'kj-tr-b02', label: '更衣室と履物の説明' },
        { id: 'kj-tr-b03', label: 'タイムカード', hint: '出勤は15分刻み、退勤は1分刻み' },
        { id: 'kj-tr-b04', label: '手洗い' },
        { id: 'kj-tr-b05', label: 'スタッフ用の飲み物の説明', hint: '水か烏龍茶ならOK、男はストロー✗' },
        { id: 'kj-tr-b06', label: 'タバコルール' },
        { id: 'kj-tr-b07', label: '制服の再説明' },
        { id: 'kj-tr-b08', label: 'キッチン内ルール', hint: '誰かの後ろを通るときと刃物類を持っているときの声掛け' },
      ],
    },
    {
      id: 'kj-tr-hall',
      title: 'ホールの基本',
      items: [
        { id: 'kj-tr-h01', label: 'おしぼりルール' },
        { id: 'kj-tr-h02', label: '卓番説明', hint: '各席の収容人数の説明も' },
        { id: 'kj-tr-h03', label: 'トイレチェック' },
      ],
    },
    {
      id: 'kj-tr-guide',
      title: '来店退店対応',
      items: [
        { id: 'kj-tr-g01', label: '予約済みの場合' },
        { id: 'kj-tr-g02', label: '予約無しの場合' },
        { id: 'kj-tr-g03', label: '1階のご案内' },
        { id: 'kj-tr-g04', label: '2階のご案内' },
        { id: 'kj-tr-g05', label: 'ご案内後の説明（席のみ予約の場合）' },
        { id: 'kj-tr-g06', label: 'ご案内後の説明（コース予約の場合）' },
        { id: 'kj-tr-g07', label: 'お会計' },
        { id: 'kj-tr-g08', label: 'お見送り' },
      ],
    },
    {
      id: 'kj-tr-serve',
      title: '配膳',
      items: [
        { id: 'kj-tr-s01', label: 'トレンチの持ち方' },
        { id: 'kj-tr-s02', label: 'お伺い時のルール', hint: 'ノック回数、注文を受けるときの姿勢、扉開閉時の声掛け' },
        { id: 'kj-tr-s03', label: '料理、ドリンクに付けるシルバーの説明' },
        { id: 'kj-tr-s04', label: 'お済みのお皿やグラスがあったら下げる' },
        { id: 'kj-tr-s05', label: '鍋説明（単品の場合）' },
        { id: 'kj-tr-s06', label: '鍋説明（コースの場合）' },
        { id: 'kj-tr-s07', label: 'インターホンのルール' },
      ],
    },
    {
      id: 'kj-tr-bus',
      title: 'バッシング・セットの説明＆ルール',
      items: [
        { id: 'kj-tr-c01', label: 'バッシングのルール説明' },
        { id: 'kj-tr-c02', label: 'セットの説明（基本セットVer）' },
        { id: 'kj-tr-c03', label: 'セットの説明（コースVer）' },
      ],
    },
    {
      id: 'kj-tr-drink',
      title: 'ドリンク',
      items: [
        { id: 'kj-tr-d01', label: 'ドリンクの作り方' },
      ],
    },
    {
      id: 'kj-tr-wash',
      title: '洗い物',
      items: [
        { id: 'kj-tr-w01', label: '洗い物ルール' },
      ],
    },
  ],

  /* ===== ちゃこる ===== */
  chacoru: [
    {
      id: 'ch-tr-basic',
      title: '基本ルール',
      items: [
        { id: 'ch-tr-b01', label: 'あいさつ', hint: 'おはようございます・お疲れ様です' },
        { id: 'ch-tr-b02', label: '更衣室と履物の説明' },
        { id: 'ch-tr-b03', label: 'タイムカード', hint: '出勤は15分刻み、退勤は1分刻み' },
        { id: 'ch-tr-b04', label: '手洗い' },
        { id: 'ch-tr-b05', label: 'スタッフ用の飲み物の説明', hint: '水か烏龍茶ならOK、男はストロー✗' },
        { id: 'ch-tr-b06', label: 'タバコルール' },
        { id: 'ch-tr-b07', label: '制服の再説明' },
        { id: 'ch-tr-b08', label: 'キッチン内ルール', hint: '誰かの後ろを通るときと刃物類を持っているときの声掛け' },
      ],
    },
    {
      id: 'ch-tr-hall',
      title: 'ホールの基本',
      items: [
        { id: 'ch-tr-h01', label: 'おしぼりルール' },
        { id: 'ch-tr-h02', label: '卓番説明', hint: '各席の収容人数の説明も' },
        { id: 'ch-tr-h03', label: 'トイレチェック' },
      ],
    },
    {
      id: 'ch-tr-guide',
      title: '来店退店対応',
      items: [
        { id: 'ch-tr-g01', label: '予約済みの場合' },
        { id: 'ch-tr-g02', label: '予約無しの場合' },
        { id: 'ch-tr-g03', label: '1階のご案内' },
        { id: 'ch-tr-g04', label: '2階のご案内' },
        { id: 'ch-tr-g05', label: 'ご案内後の説明（席のみ予約の場合）' },
        { id: 'ch-tr-g06', label: 'ご案内後の説明（コース予約の場合）' },
        { id: 'ch-tr-g07', label: 'お会計' },
        { id: 'ch-tr-g08', label: 'お見送り' },
      ],
    },
    {
      id: 'ch-tr-serve',
      title: '配膳',
      items: [
        { id: 'ch-tr-s01', label: 'トレンチの持ち方' },
        { id: 'ch-tr-s02', label: 'お伺い時のルール', hint: 'ノック回数、注文を受けるときの姿勢、扉開閉時の声掛け' },
        { id: 'ch-tr-s03', label: '料理、ドリンクに付けるシルバーの説明' },
        { id: 'ch-tr-s04', label: 'お済みのお皿やグラスがあったら下げる' },
        { id: 'ch-tr-s05', label: '鍋説明（単品の場合）' },
        { id: 'ch-tr-s06', label: '鍋説明（コースの場合）' },
        { id: 'ch-tr-s07', label: '飲み放題注文の注意点', hint: 'ちび紙の書き方' },
        { id: 'ch-tr-s08', label: 'オーダーの取り方' },
        { id: 'ch-tr-s09', label: 'インターホンのルール' },
      ],
    },
    {
      id: 'ch-tr-bus',
      title: 'バッシング・セットの説明＆ルール',
      items: [
        { id: 'ch-tr-c01', label: 'バッシングのルール説明' },
        { id: 'ch-tr-c02', label: 'セットの説明（基本セットVer）' },
        { id: 'ch-tr-c03', label: 'セットの説明（コースVer）' },
      ],
    },
    {
      id: 'ch-tr-handy',
      title: 'ハンディー',
      items: [
        { id: 'ch-tr-y01', label: 'ハンディーの使い方' },
      ],
    },
    {
      id: 'ch-tr-drink',
      title: 'ドリンク',
      items: [
        { id: 'ch-tr-d01', label: 'ドリンクの作り方' },
      ],
    },
    {
      id: 'ch-tr-wash',
      title: '洗い物',
      items: [
        { id: 'ch-tr-w01', label: '洗い物ルール' },
      ],
    },
  ],

  /* ===== 炭まろ =====
     ちゃこると同じ中身です。「飲み放題注文の注意点」の
     （ちび紙の書き方）だけ、炭まろには付けていません */
  sumimaro: [
    {
      id: 'sm-tr-basic',
      title: '基本ルール',
      items: [
        { id: 'sm-tr-b01', label: 'あいさつ', hint: 'おはようございます・お疲れ様です' },
        { id: 'sm-tr-b02', label: '更衣室と履物の説明' },
        { id: 'sm-tr-b03', label: 'タイムカード', hint: '出勤は15分刻み、退勤は1分刻み' },
        { id: 'sm-tr-b04', label: '手洗い' },
        { id: 'sm-tr-b05', label: 'スタッフ用の飲み物の説明', hint: '水か烏龍茶ならOK、男はストロー✗' },
        { id: 'sm-tr-b06', label: 'タバコルール' },
        { id: 'sm-tr-b07', label: '制服の再説明' },
        { id: 'sm-tr-b08', label: 'キッチン内ルール', hint: '誰かの後ろを通るときと刃物類を持っているときの声掛け' },
      ],
    },
    {
      id: 'sm-tr-hall',
      title: 'ホールの基本',
      items: [
        { id: 'sm-tr-h01', label: 'おしぼりルール' },
        { id: 'sm-tr-h02', label: '卓番説明', hint: '各席の収容人数の説明も' },
        { id: 'sm-tr-h03', label: 'トイレチェック' },
      ],
    },
    {
      id: 'sm-tr-guide',
      title: '来店退店対応',
      items: [
        { id: 'sm-tr-g01', label: '予約済みの場合' },
        { id: 'sm-tr-g02', label: '予約無しの場合' },
        { id: 'sm-tr-g03', label: '1階のご案内' },
        { id: 'sm-tr-g04', label: '2階のご案内' },
        { id: 'sm-tr-g05', label: 'ご案内後の説明（席のみ予約の場合）' },
        { id: 'sm-tr-g06', label: 'ご案内後の説明（コース予約の場合）' },
        { id: 'sm-tr-g07', label: 'お会計' },
        { id: 'sm-tr-g08', label: 'お見送り' },
      ],
    },
    {
      id: 'sm-tr-serve',
      title: '配膳',
      items: [
        { id: 'sm-tr-s01', label: 'トレンチの持ち方' },
        { id: 'sm-tr-s02', label: 'お伺い時のルール', hint: 'ノック回数、注文を受けるときの姿勢、扉開閉時の声掛け' },
        { id: 'sm-tr-s03', label: '料理、ドリンクに付けるシルバーの説明' },
        { id: 'sm-tr-s04', label: 'お済みのお皿やグラスがあったら下げる' },
        { id: 'sm-tr-s05', label: '鍋説明（単品の場合）' },
        { id: 'sm-tr-s06', label: '鍋説明（コースの場合）' },
        // ★ちゃこるにある「ちび紙の書き方」は、炭まろには付けません
        { id: 'sm-tr-s07', label: '飲み放題注文の注意点' },
        { id: 'sm-tr-s08', label: 'オーダーの取り方' },
        { id: 'sm-tr-s09', label: 'インターホンのルール' },
      ],
    },
    {
      id: 'sm-tr-bus',
      title: 'バッシング・セットの説明＆ルール',
      items: [
        { id: 'sm-tr-c01', label: 'バッシングのルール説明' },
        { id: 'sm-tr-c02', label: 'セットの説明（基本セットVer）' },
        { id: 'sm-tr-c03', label: 'セットの説明（コースVer）' },
      ],
    },
    {
      id: 'sm-tr-handy',
      title: 'ハンディー',
      items: [
        { id: 'sm-tr-y01', label: 'ハンディーの使い方' },
      ],
    },
    {
      id: 'sm-tr-drink',
      title: 'ドリンク',
      items: [
        { id: 'sm-tr-d01', label: 'ドリンクの作り方' },
      ],
    },
    {
      id: 'sm-tr-wash',
      title: '洗い物',
      items: [
        { id: 'sm-tr-w01', label: '洗い物ルール' },
      ],
    },
  ],

};

/** このファイルに書いてある初期値 */
function defaultTraining(storeId) {
  return TRAIN_OVERRIDES[storeId] || TRAIN_DEFAULT;
}

/**
 * その店舗の教える項目
 *
 * ★マネージで直した内容があれば、そちらが優先されます。
 *   クローズの項目と同じ考え方です（config.js は初期値としてだけ使われます）。
 * ★やめた項目（retiredAt）は数えません。
 */
function getTraining(storeId) {
  const list = typeof Trainings !== 'undefined'
    ? Trainings.sections(storeId)
    : defaultTraining(storeId);
  return list
    .filter((sec) => !sec.retiredAt)
    .map((sec) => ({ ...sec, items: sec.items.filter((it) => !it.retiredAt) }))
    .filter((sec) => sec.items.length);
}

/** その店舗の項目の数（全部で何個か） */
function trainTotal(storeId) {
  return getTraining(storeId).reduce((n, sec) => n + sec.items.length, 0);
}

/* ------------------------------------------------------------
 *  5) 業務の一覧（★ページを増やす場所★）
 *
 *  アプリは「店舗を選ぶ → 業務を選ぶ → その画面」の3段です。
 *  新しい業務のページを足すときは、ここに1つ足してください。
 *
 *    id    : 画面の名前。URL（#/店舗/ここ/…）にも使います
 *    name  : 業務選択画面と見出しに出る名前
 *    sub   : その下に出る短い説明
 *    icon  : カードに出す絵文字（店舗カードのロゴにあたる場所）
 *    when  : 省略可。false を返すと一覧に出しません
 *
 *  「その店舗のいまの状況」を業務選択画面に出すため、
 *  status(storeId) は app.js の taskStatus() が担当します。
 * ---------------------------------------------------------- */

/* ------------------------------------------------------------
 *  4-3) 立替金（買い出しなどを現金で立て替えたとき）
 *
 *  お店に紐づかない話なので、店舗ではなく「月」でまとめます。
 *  記録の入れ先は  _expense/2026-08  のような形です。
 *  （店舗idの場所に _expense を置いているだけで、仕組みは他と同じ。
 *    日付の形ではないので、提出記録シートには出ません）
 *
 *  1件分の中身
 *    d       : 支払った日（'YYYY-MM-DD'）
 *    by      : 立て替えた人
 *    label   : 支払い項目
 *    yen     : 金額
 *    receipt : 領収書があるか（true / false）
 *
 *  「精算済み（現金を渡した）」は  paid:名前  という項目で持ちます。
 * ---------------------------------------------------------- */
/* ------------------------------------------------------------
 *  スプレッドシートの1マスに入る文字数
 *
 *  ★`gas/コード.gs` の `CELL_MAX` / `CELL_SOFT` と**同じ数**です。
 *    片方だけ変えないでください。**`test_gas_fields.py` が見張っています。**
 *  ★超えると、その1件は**書けません**（ほかの記録は無事です）。
 *    4万文字で先に知らせて、あふれる前に手を打てるようにしています。
 * ---------------------------------------------------------- */
/* ------------------------------------------------------------
 *  管理用PINが要る設定
 *
 *  ★`gas/コード.gs` の `ADMIN_SETTINGS` と**同じ並び**です。
 *    片方だけ変えないでください。**`test_gas_fields.py` が見張っています。**
 *
 *  ★これがずれると、**同期がずっと赤いまま**になります。
 *    現場のアプリ（管理用PINを持たない）がこの設定を送ると、GASは
 *    `need_admin` で断ります。アプリは送信箱から取り除けず、**同じものを
 *    送り続けて、以降の記録が全部止まります。**
 *    2026-09-07、GAS側に3つ足したのにこちら側を足しておらず、
 *    実際にそうなりました（`shiftStaff` `salesTargets` `shiftMemoTags`）。
 * ---------------------------------------------------------- */
const ADMIN_SETTINGS = ['checklists', 'weeklies', 'anytimes', 'staffList', 'closedDows',
  'salesTargets', 'shiftMemoTags'];
// ★`shiftStaff`（シフトの名簿）は、2026-09-07 に**わざと外しました。**
//   ko-dai さんの判断で、**各店長の端末から名簿を直せるようにする**ためです。
//   緩むところ（ふつうのPINで名前も番号も書ける）を先に数えて伝えたうえでの決定です。
//   ★戻すときは `gas/コード.gs` と**同時に**。片方だけだと同期が止まります。

const CELL_MAX = 50000;
const CELL_SOFT = 40000;

const EXPENSE_STORE = '_expense';

/**
 * 支払い項目の選び方
 *   id    : 記録に残す種類
 *   name  : ボタンに出る文字
 *   store : true … どの店舗かを選ぶ
 *   people: true … 何人かを入れる（キャッチ用）
 *   who   : true … 誰に渡したかを選ぶ（キャッチ用）
 *   free  : true … 内容を自由に書く
 */
const EXPENSE_KINDS = [
  { id: 'parking', name: '駐車場代' },
  { id: 'buy',     name: '買い出し',   store: true },
  // who … 誰に渡したかを選ぶ（キャッチだけ）
  { id: 'catch',   name: 'キャッチ',   store: true, people: true, who: true },
  { id: 'change',  name: '両替手数料' },
  { id: 'other',   name: 'その他',     free: true },
];

function getExpenseKind(id) {
  return EXPENSE_KINDS.find((k) => k.id === id) || null;
}

/**
 * 一覧に出る名前を組み立てる
 *   買い出し＋こじゃれ        → 買い出し（こじゃれ）
 *   キャッチ＋こじゃれ＋46人  → こじゃれキャッチ 46名
 */
function expenseLabelOf(kindId, storeId, people, free) {
  const kind = getExpenseKind(kindId);
  if (!kind) return (free || '').trim();
  if (kind.free) return (free || '').trim();
  const store = storeId ? getStore(storeId).name : '';
  if (kind.people) return `${store}キャッチ ${people || 0}名`;
  if (kind.store) return `${kind.name}（${store}）`;
  return kind.name;
}

/** その月の記録の入れ先（'2026-08' → _expense/2026-08） */
function expenseMonthKey(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** 精算済みの印を入れる項目名 */
function expensePaidKey(name) {
  return `paid:${name}`;
}

/* ------------------------------------------------------------
 *  精算履歴（スプレッドシートの1枚目にあたる表）
 *
 *  その月分をまとめて会社の口座から払った、という記録です。
 *  人ごとの「精算」とは別物で、こちらは経理担当だけが触ります。
 *
 *  入れ先は、その月の記録の中に1つだけ置く settle という項目です。
 *      _expense/2026-01 の items['settle'] = { d: 精算日, label: 出金口座 }
 *  金額は持ちません。その月の記録から毎回そのまま計算します
 *  （スプレッドシートで ='1月'!C17 と参照していたのと同じ考え方）。
 * ---------------------------------------------------------- */
const SETTLE_KEY = 'settle';

/**
 * 精算履歴のページを出すか
 *
 * ★いまは false（どのアプリにも出しません）。
 *   精算の記録はスプレッドシート側で付ける形にしたためです。
 *
 * **記録そのものは消していません。** `_expense/YYYY-MM` の
 * `items['settle']` はそのまま残っていて、同期でも運ばれ続けます。
 * この1行を true に戻せば、入っている分がそのまま画面に出ます。
 */
const SETTLE_PAGE_ON = false;

/** 出金口座のボタンに出る候補。ここに無い口座は自由に書けます */
const SETTLE_ACCOUNTS = ['GMO支払い用'];

/**
 * キャッチをやっている店舗
 * ここに書いた順で、キャッチ集計の表に並びます（0人の月でも行は出ます）。
 * 書いていない店舗でも、記録があればその下に足して出します。
 */
const CATCH_STORES = ['kojare', 'sumimaro', 'chacoru', 'popo', 'oiden', 'maito'];

/**
 * キャッチだけで使う行き先
 *
 * ★ STORES には入れません。入れてしまうと、店舗タブ・クローズ・週間掃除・
 *   会議資料など、お店として動かしている画面全部に出てしまいます。
 *   ここはキャッチの店舗選びと、キャッチ集計にだけ出ます。
 *
 * お店としても使うようになったら、STORES へ移してください
 * （そのときは色・ロゴ・定休日・確認項目もいります）。
 */
const CATCH_ONLY_STORES = [
  // 白文字を載せるので、明るすぎない色にしています。
  // お店（赤〜茶の暖色）とは別のものだと分かるよう、青みにしてあります
  //
  // ★ off: true … いまは保留。アプリのどこにも出しません。
  //    出すときは、この行の  off: true,  を消すだけです（ほかは直しません）。
  { id: 'maito', name: 'まいと', short: 'まいと', color: '#4a6580', off: true },
];

/**
 * 全部の行き先（保留中のものも入っています）
 *
 * ★名前や色を引くためのものです。保留中のものも残してあるのは、
 *   もし記録が入っていたときに、名前が引けずに よその店舗の名前で
 *   出てしまうのを防ぐためです（getStore は見つからないと1つ目を返します）。
 */
function allStores() {
  return STORES.concat(CATCH_ONLY_STORES);
}

/** 画面で「選べるもの」として出す行き先（保留中のものは出しません） */
function pickableStores() {
  return allStores().filter((s) => !s.off);
}

/** キャッチ集計の表と、ランキングのしぼり込みに出す店舗（保留中のものは出しません） */
function catchStoreIds() {
  return CATCH_STORES.filter((id) => !getStore(id).off);
}

/**
 * 「渡した相手」を入れてもらう開始日
 *
 * これより前の分は、人数と金額だけで記録できます。
 * 8月までは誰に渡したかを控えていなかったので、
 * 入れられないものを必須にしても手が止まるだけだからです。
 */
const CATCH_WHO_FROM = '2026-09-01';

/** その日の記録で「渡した相手」を入れるか */
function catchWhoNeeded(dateStr) {
  return (dateStr || '') >= CATCH_WHO_FROM;
}

/** 入力画面に出す一文。開始日から作るので、日を動かせば文も付いてきます */
function catchWhoNoteText() {
  const [y, m] = CATCH_WHO_FROM.split('-').map(Number);
  const last = m === 1 ? `${y - 1}年12` : `${m - 1}`;   // 開始月の1つ前
  return `${last}月までの分は、<b>渡した相手を入れずに</b>記録できます。`;
}

/**
 * キャッチをしてくれるアルバイトの名前（初期値）
 *
 * 現金支払い管理表で「キャッチ」を選んだときに、
 * 「誰に渡したか」のプルダウンに並びます。全店舗で共通です。
 * ★中身はマネージの「キャッチをする人」で登録します（ここは空のままでOK）。
 */
const CATCH_STAFF = {};   // { 店舗id: ['名前', …] }。マネージで登録します

/** プルダウンで、リストに無い人を書くときの目印 */
const CATCH_OTHER = '__other__';

/* ------------------------------------------------------------
 *  会議資料の議事録
 *
 *  その月の議題を、1つずつ記録として入れます。
 *      _meeting/2026-06 の items['n001'] = { text: '見出し\n中身\n中身', seq: 0 }
 *  1行目が見出し、2行目からがその中身です（もとのスプレッドシートで
 *  1つのセルに改行を入れて書いていたのと同じ形にしてあります）。
 *
 *  ★入れ先が日付の形（YYYY-MM-DD）ではないので、クローズの提出記録シートには
 *    出ません。Apps Script（バックエンド）を直さなくても、そのまま同期に乗ります
 *    （現金支払い管理表・配達記録と同じ手です）。
 * ---------------------------------------------------------- */
const MEETING_STORE = '_meeting';

/**
 * 会議資料の1店舗分の数字の並び
 *
 * ★もとは `js/meeting-data.js` にありましたが、**ここへ移しました**（2026年9月5日）。
 *   あちらは会社の売上・原価・人件費が入っていて公開から外すファイルです。
 *   `js/app.js` は `MEETING_FIELDS` を `typeof` の守りなしに5か所で使っているので、
 *   置いたままだと、外した瞬間に会議資料の画面が例外で落ちます。
 */
const MEETING_FIELDS = ['inc', 'ex', 'guests', 'cost', 'labor', 'katch', 'katchPeople',
  'gas', 'water', 'power', 'gasUse', 'waterUse', 'powerUse'];

/** 取り込んだ議事メモを、その月分は記録として書き写しずみ、という印 */
const MEETING_SEED_KEY = 'seeded';

/**
 * 会議資料の数字を記録へ写した印（1か月に1つ）
 *
 * ★`js/meeting-data.js` は GitHub Pages で誰でも読めます。会社の売上・原価・
 *   人件費が店舗別・月別に出てしまうので、公開から外します。
 *   ただし外すと画面から消えるので、先に記録へ写します。
 */
const MEETING_MOVED_KEY = 'moved';

/** その月の議事録の入れ先（'2026-06' → _meeting/2026-06） */
function meetingMonthKey(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

/* ------------------------------------------------------------
 *  シフト
 *
 *  半月分（1〜15日／16日〜末日）を1つのまとまりとして扱います。
 *  今のスプレッドシートの1シートと同じ区切りです。
 *
 *  入れ先は  _shift/baguru-2026-09-1  のような形です。
 *  （店舗idの場所に _shift を置き、そのうしろに「店舗-年-月-前半1/後半2」を
 *    つなげています。日付の形ではないので提出記録シートには出ず、
 *    バックエンドを直さずに同期へ乗ります。現金支払い管理表と同じ手です）
 *
 *  1つの入れ先に、3種類のものが入ります。
 *
 *    w:なまえ1     … 出してもらった希望
 *        { days: { '2026-09-03': [{ s: 'dinner', t: '18.5' }], … },
 *          note: '連絡ごと', sentAt: 出した日時 }
 *        s は 'open' 'full' 'lunch' 'dinner' のどれかです
 *
 *    d:2026-09-03  … 組んだ結果（1日分）
 *        { open:   [{ n: 'なまえ1', t: ''     }],
 *          lunch:  [{ n: 'なまえ2', t: '11.5' }, { n: 'なまえ3', t: '11', f: true }],
 *          dinner: [{ n: 'なまえ4', t: '18'   }],
 *          memo: '社員1休み' }
 *        f: true     … F（通し）。ランチの枠にだけ入り、灰色で出ます
 *        early: true … 早上がり（Fで入れているが、早めに帰す人）。橙のふちで出ます
 *        patty       … その日の「パティ」の枠（'lunch' か 'dinner'）。
 *                      その枠全部が桃色のふちで囲まれます
 *
 *    phase         … その半月がどこまで進んだか
 *        { v: 'open' | 'built', at: 日時, by: 名前 }
 *        なし   … まだ募集していない（アルバイトには出ません）
 *        open   … 募集中（アルバイトが出せます）
 *        built  … 確定ずみ（もう出せません）
 *
 * ---------------------------------------------------------- */
const SHIFT_STORE = '_shift';

/**
 * シフトを組む店舗。ここに書いた店舗にだけ「シフト」の業務が出ます
 *
 * ★6店舗そろいました（2026-09-07）。枠は店舗ごとに違います。
 *     バグる … 立ち上げ／ランチ／ディナー（F あり）
 *     popo   … 出勤〜退勤の時刻を入れる（枠を選ばない）
 *     ほかの4店舗 … 仕込み／営業（→ SHIFT_SLOTS_STORES）
 * ★名簿はマネージの「シフトに入る人」で店舗ごとに登録します。
 *   ここに足しただけでは、まだ誰も番号を持っていません。
 * ★足してもアルバイトには出ません。こちらが「募集をはじめる」を
 *   押したときだけ、その半月が提出ページに出ます。
 */
const SHIFT_STORES = ['kojare', 'sumimaro', 'chacoru', 'baguru', 'popo', 'oiden'];

/**
 * 時間帯（枠）
 *
 *   id    : 記録に残す名前（★変えると過去の分が読めなくなります）
 *   name  : 画面に出る名前。今のシフト表と同じ書き方です
 *   hint  : 提出ページに出す説明。何時から何時までかを書きます
 *   start : 既定の開始時刻。この時刻の人は、表に時刻を書きません。
 *           空にすると、その枠は必ず時刻を書きます（今のDinnerがこれです）
 *   times : 選べる開始時刻。空なら時刻を選ばせません（今のOpenがこれです）
 *
 *  時刻は '17' = 17時、'17.5' = 17時半 の書き方です。
 *
 *  ★ここに書いてあるのは**初めの形**だけです。
 *    実際に使う枠は、**マネージの「シフトの枠と時刻」で店舗ごとに直せます**
 *    （定休日や名簿と同じで、コードを直さなくても変えられます）。
 *    読むときは必ず shiftSlotsOf(店舗id) を通してください。
 *
 *  ★id だけは直せません。記録に残るのは id なので、変えると
 *    過去に組んだ分が読めなくなります。画面に出る名前（name）は自由です。
 *    例）夜だけのお店は open を「仕込み」、dinner を「営業」と呼び、
 *        lunch を使わない設定にします。記録の形は変わりません。
 */
const SHIFT_SLOTS_DEFAULT = [
  {
    // ★説明に時刻を書き写しません。時刻は下の pick から自動で出ます
    //   （書き写すと、マネージで時刻を直したときに説明だけ古く残ります）
    id: 'open', name: '立ち上げ', hint: '開店の準備から',
    // 9:00〜10:30 を15分ごと。ふだんは10:00です。
    // ★askTime: false … 提出ページでは時刻を選ばせません。
    //   立ち上げはいつも10:00で、前後にずらすのはこちらの都合だからです
    times: ['9', '9.25', '9.5', '9.75', '10', '10.25', '10.5'], pick: '10',
    askTime: false,
  },
  { id: 'lunch',  name: 'ランチ',   hint: 'お昼の営業',
    times: ['11', '11.5', '12'], pick: '11' },
  { id: 'dinner', name: 'ディナー', hint: '夜の営業（ラストまで）',
    times: ['17', '17.5', '18', '18.5', '19'], pick: '17' },
];

/**
 * 店舗ごとの「初めの形」（コードに書いておく分）
 *
 *  形は下の `_shiftset`（マネージで直す分）と**まったく同じ**です。
 *  重ねる順は  SHIFT_SLOTS_DEFAULT → ここ → マネージで直した分  です。
 *  ですから、ここに書いた店舗も**あとからマネージで自由に変えられます**。
 *
 *  ★こじゃれ・炭まろ・ちゃこる・おいでんは「仕込み／営業」の2つです
 *    （2026-09-07 に ko-dai の指示）。ランチの枠は使いません。
 *    id は open / dinner のままです。**id は記録に残るので変えません。**
 *    画面に出る名前だけ「仕込み」「営業」にしています。
 *  ★バグると popo はここに書きません。今までのままです。
 */
const SHIFT_SLOTS_2 = {
  // 仕込み … 時刻は聞きません（open は askTime: false）。
  //          そのまま営業まで続けて入る人が多いので、押すと営業も一緒に入ります
  //          （→ shiftAfterOpen）
  'slot:open':   { name: '仕込み', hint: '仕込みから入る' },
  // ランチの枠は使いません。F（通し）も、ランチが無いので出ません
  //  （→ shiftWishSlots）
  'slot:lunch':  { use: false },
  'slot:dinner': { name: '営業',   hint: '営業から入る' },
};

const SHIFT_SLOTS_STORES = {
  kojare:   SHIFT_SLOTS_2,
  sumimaro: SHIFT_SLOTS_2,
  chacoru:  SHIFT_SLOTS_2,
  oiden:    SHIFT_SLOTS_2,
};

/**
 * 店舗ごとの「枠と時刻」の入れ先
 *
 *  1店舗が1行です（`_shiftset/popo`）。中身は枠ごとの直しだけを持ちます。
 *
 *    slot:open   { name: '仕込み', hint: '…',
 *                  times: ['16','16.5'], pick: '16' }
 *
 *  ★**どの枠を使うかは、ここでは変えられません**（コード＝`SHIFT_SLOTS_STORES`）。
 *    前は `use: false` を入れられましたが、切り替える場面が無いので外しました。
 *
 *  ★上の SHIFT_SLOTS_DEFAULT に**重ねて**読みます。書いていないところは
 *    初めの形のままです。あとで項目を足しても、前の設定が壊れません。
 *  ★入れ先を分けてあるのは、Apps Script が `_shift/店舗id-` で半月を
 *    数えているためです（→ SHIFT_WISH_STORE と同じ理由）。
 */
const SHIFT_SET_STORE = '_shiftset';

/** 枠1つ分の設定の入れ先（'slot:open'） */
function shiftSlotSetKey(slotId) {
  return `slot:${slotId}`;
}

/**
 * 提出ページ用の受け皿
 *
 * ★提出ページ（shift/）は Store を持ちません（アプリのPINと切り離すため）。
 *   そこでは Apps Script が渡してくれた枠を、ここに入れてから使います。
 *   **店舗idも一緒に控えます。**別の店舗の枠を取りちがえないためです。
 */
let shiftSlotsGiven = null;

/**
 * 設定を**重ねて**1つの並びにします
 *
 *  重ねる順は3枚です。**下ほど強い**です。
 *
 *    1. SHIFT_SLOTS_DEFAULT … 全店舗の初めの形
 *    2. SHIFT_SLOTS_STORES  … その店舗の初めの形（コードに書いた分）
 *    3. items               … マネージで直した分（`_shiftset/店舗id`）
 *
 * ★重ねる所はここ1つだけです。組む画面（記録から読む）と
 *   提出ページ（Apps Script からもらう）で別々に組み立てると、
 *   片方だけ直したときに見た目が食い違います。
 * ★2枚目があるので、**マネージの「初めの形に戻す」を押すと**
 *   全店舗の形（立ち上げ）ではなく、**その店舗の形（仕込み）に戻ります。**
 *   戻すボタンは name に '' を書くので、空は「書いていない」と読みます。
 * ★空にはなりません。全部「使わない」にしても初めの形に戻します
 *   （枠が1つも無いと、シフトの画面が真っ白になってしまうため）。
 */
function shiftMergeSlots(items, storeId) {
  const mine = SHIFT_SLOTS_STORES[storeId] || {};
  const src = items && typeof items === 'object' ? items : {};
  const 並び = (x) => (Array.isArray(x) && x.length ? x : null);
  const out = [];
  SHIFT_SLOTS_DEFAULT.forEach((slot) => {
    const key = shiftSlotSetKey(slot.id);
    const b = mine[key] || {};   // その店舗の初めの形
    const v = src[key] || {};    // マネージで直した分
    // ★使う／使わないは**コードで決めます。マネージからは変えられません**
    //   （2026-09-07 ko-dai の指示。「切り替える場面がない」ため画面から外しました）。
    //   前に保存された `use` は読みません。残っていても効きません
    if (b.use === false) return;
    out.push({
      ...slot,
      name: v.name || b.name || slot.name,
      hint: v.hint !== undefined ? v.hint
        : (b.hint !== undefined ? b.hint : slot.hint),
      times: 並び(v.times) || 並び(b.times) || slot.times,
      pick: v.pick || b.pick || slot.pick,
    });
  });
  return out.length ? out : SHIFT_SLOTS_DEFAULT.slice();
}

/**
 * Apps Script から受け取った設定を控える（提出ページだけが呼びます）
 *
 * ★渡すのは**設定そのもの**（`{ 'slot:open': {…} }`）です。
 *   組み立てた並びではありません。重ねるのは上の1か所にまかせます。
 */
function setShiftSlots(storeId, items) {
  if (!storeId) { shiftSlotsGiven = null; return; }
  const src = items && typeof items === 'object' ? items : {};
  shiftSlotsGiven = {
    storeId,
    list: shiftMergeSlots(src, storeId),
    // ★入れ方（時刻を入れるか、通しの境目はどこか）も一緒に控えます。
    //   ここを渡し忘れると、提出ページだけ古い決まりで動きます
    style: src[SHIFT_STYLE_KEY] || {},
  };
}

/** その店舗の枠（★枠を読むときは、必ずここを通してください） */
function shiftSlotsOf(storeId) {
  // 提出ページ。Apps Script からもらったものを使います
  if (shiftSlotsGiven && shiftSlotsGiven.storeId === storeId) {
    return shiftSlotsGiven.list;
  }
  // ★Store はこのファイルより後に読み込まれます。呼ばれるのは
  //   読み込みが全部おわってからなので、ここで見れば間に合います
  try {
    if (typeof Store !== 'undefined' && storeId) {
      return shiftMergeSlots(Store.getDay(SHIFT_SET_STORE, storeId).items, storeId);
    }
  } catch (e) {
    // 設定が読めなくても、初めの形で動かします
  }
  // ★ここでも重ねます。SHIFT_SLOTS_DEFAULT をそのまま返すと、
  //   設定が読めないときだけ、仕込み／営業の店舗にバグるの3つの枠が出ます
  return shiftMergeSlots(null, storeId);
}

/**
 * その店舗の「初めの形」（マネージで直す前の姿）
 *
 * ★マネージの編集画面が使います。**`SHIFT_SLOTS_DEFAULT` を直に読まないでください。**
 *   直に読むと、仕込み／営業の4店舗で「立ち上げ・ランチ・ディナーの3つ」が
 *   出てしまい、そのまま保存すると**店舗ごとの形が黙って消えます。**
 * ★使わない枠も落とさずに返します（`use: false` を付けて返します）。
 *   編集画面は「使う」のチェックを外した状態で出す必要があるためです。
 */
function shiftBaseSlots(storeId) {
  const mine = SHIFT_SLOTS_STORES[storeId] || {};
  return SHIFT_SLOTS_DEFAULT.map((slot) => {
    const b = mine[shiftSlotSetKey(slot.id)] || {};
    return {
      ...slot,
      use: b.use !== false,
      name: b.name || slot.name,
      hint: b.hint !== undefined ? b.hint : slot.hint,
      times: Array.isArray(b.times) && b.times.length ? b.times : slot.times,
      pick: b.pick || slot.pick,
    };
  });
}

/** その店舗で、その枠を使っているか */
function shiftHasSlot(storeId, slotId) {
  return shiftSlotsOf(storeId).some((s) => s.id === slotId);
}

/* -------- 入れ方（枠で選ぶか、時間を入れるか） -------- */

/**
 * シフトの入れ方
 *
 *   range     … true なら「出勤〜退勤の時刻を入れる」やり方。
 *               false（ふつう）は「立ち上げ・ランチ…の枠を選ぶ」やり方です
 *   step      … 選べる時刻の刻み（0.5 = 30分ごと）
 *   from / to … 出退勤で選べる時刻の幅
 *   lunchTo   … **F（通し）の境目**。この時刻より前に出て、あとまで残る人がFです
 *   patty     … パティのボタンを出すか
 *
 * ★時刻は '17' = 17時、'17.5' = 17時半 の書き方です（ほかと同じ）。
 */
/** 入れ方の設定を入れておく名前 */
const SHIFT_STYLE_KEY = 'style';

const SHIFT_STYLE_DEFAULT = {
  range: false, step: 0.5, from: '8', to: '24', lunchTo: '17', patty: true,
  // 退勤で選べる幅。書かなければ出勤と同じ（from / to）を使います
  endFrom: '', endTo: '',
};

/**
 * 店舗ごとの入れ方（書いていない店舗は上のまま）
 *
 * ★popo は「出勤〜退勤の時刻を入れる」やり方です（2026-09-05に ko-dai の指示）。
 *   アルバイトは枠を選ばず、時刻だけ入れます。どの行に入るかは
 *   出勤時刻から決めます（shiftSlotByTime）。
 * ★lunchTo: '17' … 17時より前に出て、17時より**あと**まで残る人をFとします。
 *   Fは名前を灰色に塗るだけで、**バグるのような「F」の字は出しません**。
 */
const SHIFT_STYLE_STORES = {
  // ★出勤と退勤で、選べる幅が違います（2026-09-07 ko-dai の指示）。
  //   出勤 10:00〜24:00 ／ 退勤 13:00〜27:00。
  //   27:00 は「翌朝3時」の書き方です。日付をまたぐ時刻を 25・26・27 と続けて
  //   書くのは、飲食のシフト表のふつうの書き方で、`shiftTimeText` もそのまま出します
  popo: {
    range: true, step: 0.5, from: '10', to: '24',
    endFrom: '13', endTo: '27', lunchTo: '17', patty: false,
  },
  // ★仕込み／営業の4店舗。パティはバグるの言葉なので出しません
  //   （2026-09-07「メモ欄のボタンは全部消して、ただのメモ欄に」）
  kojare:   { patty: false },
  sumimaro: { patty: false },
  chacoru:  { patty: false },
  oiden:    { patty: false },
};

/** その店舗の入れ方（マネージで直した分も重ねます） */
function shiftStyleOf(storeId) {
  const base = { ...SHIFT_STYLE_DEFAULT, ...(SHIFT_STYLE_STORES[storeId] || {}) };
  if (shiftSlotsGiven && shiftSlotsGiven.storeId === storeId) {
    return { ...base, ...(shiftSlotsGiven.style || {}) };
  }
  try {
    if (typeof Store !== 'undefined' && storeId) {
      const v = (Store.getDay(SHIFT_SET_STORE, storeId).items || {})[SHIFT_STYLE_KEY];
      if (v) {
        const out = { ...base };
        ['step', 'from', 'to', 'endFrom', 'endTo', 'lunchTo'].forEach((k) => { if (v[k]) out[k] = v[k]; });
        ['range', 'patty'].forEach((k) => { if (typeof v[k] === 'boolean') out[k] = v[k]; });
        return out;
      }
    }
  } catch (e) {
    // 読めなくても、初めの形で動かします
  }
  return base;
}

/** その店舗は「出勤〜退勤の時刻を入れる」やり方か */
function shiftUsesRange(storeId) {
  return !!shiftStyleOf(storeId).range;
}

/** その店舗でパティを使うか */
function shiftHasPatty(storeId) {
  return !!shiftStyleOf(storeId).patty;
}

/**
 * 選べる時刻の一覧（'8', '8.5', '9' … ）
 *
 * ★出勤と退勤で、別の幅にできます（`shiftRangeTimes(店舗id, 'out')` が退勤）。
 *   popo は 出勤 10:00〜24:00 ／ 退勤 13:00〜27:00 です。
 */
function shiftRangeTimes(storeId, どちら) {
  const st = shiftStyleOf(storeId);
  const step = Number(st.step) > 0 ? Number(st.step) : 0.5;
  // ★退勤（'out'）だけ別の幅にできます。書いていなければ出勤と同じです
  const 退勤 = どちら === 'out';
  const from = Number(退勤 && st.endFrom ? st.endFrom : st.from);
  const to = Number(退勤 && st.endTo ? st.endTo : st.to);
  const out = [];
  if (!isFinite(from) || !isFinite(to) || to <= from) return out;
  for (let t = from; t <= to + 1e-9; t += step) {
    out.push(shiftTimeKey(t));
  }
  return out;
}

/**
 * その人がF（通し）か
 *
 * ★枠で選ぶ店舗（バグる）は、出してもらったときの印（entry.f）をそのまま見ます。
 * ★時刻を入れる店舗（popo）は、**入っている時刻から毎回決めます**。
 *   時刻を直せばFかどうかも変わるので、印を持たせません。
 *   境目は lunchTo（popo は17時）。**その前に出て、そのあとまで残る人**がFです。
 */
function shiftIsFull(storeId, entry) {
  if (!entry) return false;
  if (!shiftUsesRange(storeId)) return !!entry.f;
  const at = Number(entry.t);
  const to = Number(entry.e);
  const sakai = Number(shiftStyleOf(storeId).lunchTo);
  if (!isFinite(at) || !isFinite(to) || !isFinite(sakai)) return false;
  return at < sakai && to > sakai;
}

/** 名前のうしろに「F」の字を出すか（popo は塗るだけで、字は出しません） */
function shiftShowsFullMark(storeId) {
  return !shiftUsesRange(storeId);
}

/**
 * その時刻なら、どの枠に入るか
 *
 *   11:00 より前  … 立ち上げ
 *   11:00〜16:59 … ランチ
 *   17:00 以降    … ディナー
 *
 * ★立ち上げに入れた人の時刻を手で書き換えたとき、これを見て
 *   自動で枠を移します。10:00の欄に「18:00」と書いてあるより、
 *   ディナーの欄に入っていた方が読みまちがえません。
 */
function shiftSlotByTime(t) {
  const n = Number(t);
  if (!isFinite(n)) return null;
  if (n >= 17) return 'dinner';
  if (n >= 11) return 'lunch';
  return 'open';
}

/**
 * パティを付けられる枠
 *
 * その日のランチかディナーの、どちらか一方だけです。
 * （両方に付けることはありません。付け替えると前のは外れます）
 */
const SHIFT_PATTY_SLOTS = ['lunch', 'dinner'];

/**
 * 立ち上げ（仕込み）のあと、そのまま続けて入る枠
 *
 *  立ち上げだけ出して帰る人はいないので、提出ページで立ち上げを押すと
 *  この枠も一緒に入ります。
 *
 *  ★枠の並び順で「次」を見ます。名前では見ません。
 *      バグる（立ち上げ→ランチ→ディナー）  … ランチ
 *      仕込み／営業の4店舗（仕込み→営業）    … 営業
 *  ★立ち上げが無い店舗や、立ち上げが最後の店舗では null を返します。
 *    呼ぶ側は、null なら何も足しません。
 */
function shiftAfterOpen(storeId) {
  const slots = shiftSlotsOf(storeId);
  const i = slots.findIndex((s) => s.id === 'open');
  if (i < 0) return null;
  return slots[i + 1] || null;
}

/**
 * 立ち上げからあふれた人を回す先（ランチの、一番早い時刻）
 *
 * ★ランチを使っていない店舗（夜だけのお店）では null を返します。
 *   呼ぶ側は、null なら回し先を出しません。
 */
function shiftSpillTo(storeId) {
  const lunch = shiftSlotsOf(storeId).find((x) => x.id === 'lunch');
  if (!lunch) return null;
  return { slot: lunch.id, time: lunch.pick, label: `${shiftTimeText(lunch.pick)}から入れる` };
}

/**
 * F（通し）
 *
 *  ランチからディナーまで通しで入る、という出し方です。
 *  **組んだ表では「ランチ」の枠にだけ名前が出て、灰色の印が付きます。**
 *  ディナーの枠には出しません（今のスプレッドシートで、ランチのセルを
 *  グレーに塗りつぶしているのと同じ形にしてあります）。
 *
 *  開始時刻はランチと同じものから選べて、あとから組む画面で直せます。
 */
const SHIFT_FULL_ID = 'full';

/**
 * 提出ページで選べる枠。立ち上げ → F → ランチ → ディナー の並びです
 *
 * ★F（通し）は「ランチからディナーまで」という意味なので、
 *   **ランチとディナーの両方を使っている店舗にだけ**出します。
 *   夜だけのお店（仕込み／営業）には F がありません。
 */
function shiftWishSlots(storeId) {
  const slots = shiftSlotsOf(storeId);
  const lunch = slots.find((s) => s.id === 'lunch');
  const dinner = slots.find((s) => s.id === 'dinner');
  if (!lunch || !dinner) return slots.slice();

  const full = {
    id: SHIFT_FULL_ID,
    name: 'F',
    hint: `${lunch.name}から${dinner.name}まで通し（時間はお店が決めます）`,
    // 時刻はランチと同じものから。ふだんはランチの始まりに入ります。
    // ★askTime: false … 提出ページでは選ばせません。通しで入る人の
    //   開始時刻は、その日の人の入りぐあいを見てこちらで決めるためです
    times: lunch.times, pick: lunch.pick, askTime: false,
  };
  // F はランチのすぐ前に入れます（立ち上げ → F → ランチ → ディナー）
  const out = [];
  slots.forEach((s) => {
    if (s.id === 'lunch') out.push(full);
    out.push(s);
  });
  return out;
}

/** id から枠を引く（F も引けます） */
function getShiftSlot(storeId, id) {
  return shiftWishSlots(storeId).find((s) => s.id === id) || null;
}

/**
 * 1日を横に分ける枠（持ち場）
 *
 *  今のスプレッドシートで、1日が2列に分かれているところです。
 *  左がキッチン、右がホール。記録には id（'k' / 'h'）で入ります。
 *  ★増やしたいときはここに足せば、画面も印刷も列が増えます。
 */
const SHIFT_LANES = [
  { id: 'k', name: 'キッチン' },
  { id: 'h', name: 'ホール' },
];

/** 持ち場が入っていない古い記録は、キッチンとして扱います */
function shiftLaneOf(entry) {
  const v = entry && entry.p;
  return SHIFT_LANES.some((l) => l.id === v) ? v : SHIFT_LANES[0].id;
}

/**
 * 組む画面で、横に何日分並べるか
 *
 * ★端末の画面の幅で決めます。スマホは2日、iPadやパソコンの
 *   横長の画面ではもっと並べて、縦のスクロールを減らします。
 *   1日分（キッチン＋ホール）に必要な幅と、左の枠名の列から出しています。
 */
const SHIFT_DAY_W = 240;     // 1日分の、これくらいは欲しい幅（px）
const SHIFT_LABEL_W = 58;    // 左の枠名の列
const SHIFT_COLS_MAX = 8;    // 印刷の1段と同じ8日まで

function shiftCols(width) {
  const w = Number(width) || 0;
  if (!w) return 2;
  const n = Math.floor((w - SHIFT_LABEL_W) / SHIFT_DAY_W);
  return Math.max(2, Math.min(SHIFT_COLS_MAX, n));
}

/**
 * 印刷の表を、何段に分けるか
 *
 * ★元のスプレッドシートと同じ2段（1段8日）です。
 *   1列が17.8mmしかないので、名前は入る大きさまで自動で小さくします
 *   （shiftFitSize）。段を増やせば列は広がりますが、見た目が変わります。
 */
const SHIFT_PRINT_ROWS = 2;

/** 印刷したときの、左はし（立ち上げ・ランチ…）の列の幅（ミリ）。css と同じ数です。
    縦書きにしたので、1文字分の幅で足ります */
const SHIFT_SHEET_LABEL_MM = 5;

/**
 * 印刷を何枚に分けるか（店舗ごと）
 *
 * ★popo は2枚です（2026-09-05に ko-dai の指示）。
 *   popo は「10:00〜15:00」と時間帯まで書くので、1枚に16日を詰めると
 *   名前が7.7ptまで小さくなります。2枚に分ければ1段が4日になり、
 *   1マスの幅が倍（17.8mm → 35.6mm）になるので、**12ptまで戻せます**。
 * ★増やすと紙は増えますが、字は大きくなります。
 */
const SHIFT_PRINT_PAGES_STORES = { popo: 2 };

/** その店舗の枚数（書いていない店舗は1枚） */
function shiftPrintPages(storeId) {
  const n = SHIFT_PRINT_PAGES_STORES[storeId];
  return n >= 1 ? n : 1;
}

/**
 * その半月を何段かに分けたときの、1段分の日数
 *
 * ★店舗を渡すと、その店舗の枚数で割ります。渡さなければ1枚分です
 *   （提出ページはアルバイトの端末で1枚に描くので、渡しません）。
 */
function shiftPrintCols(dayCount, storeId) {
  const 段 = SHIFT_PRINT_ROWS * (storeId ? shiftPrintPages(storeId) : 1);
  return Math.ceil(dayCount / 段);
}

/**
 * 文字の幅を「全角いくつ分」で数えます
 *
 * ★「11:00 なまえ５もじ」なら、半角6文字（0.5分）＋かな5文字で 8分。
 *   フォントを読み込む前でも数えられるので、印刷でも絵でも同じ答えになります。
 */
function shiftTextEm(text) {
  let n = 0;
  for (const ch of String(text)) n += /[\u0020-\u007e\uff61-\uff9f]/.test(ch) ? 0.5 : 1;
  return n;
}

/**
 * マスの幅に名前が1行で収まる、文字の大きさを返します
 *
 * ★名前を折り返させないための計算です。単位は呼ぶ側にまかせます
 *   （印刷はポイント、絵はピクセル）。max より大きくはしません。
 */
function shiftFitSize(texts, width, max) {
  let em = 0;
  texts.forEach((t) => { em = Math.max(em, shiftTextEm(t)); });
  if (em <= 0) return max;
  return Math.min(max, (width / em) * 0.97);
}

/* -------- メモにすぐ足せる決まり文句 --------
 *
 * ★社員の動きの連絡です。毎回おなじ言葉を打つので、ボタンにしています。
 *   押すたびに足す・外すが入れかわります。
 *
 * ★ここは**空にしてあります**（2026-09-07）。
 *
 *   前は社員3人の名前が書いてありました。このファイルは GitHub Pages で
 *   **誰でも読めます**。会社名も6店舗の名前も同じ場所にあるので、
 *   「この会社で誰がどの店に動くか」まで読める状態でした。
 *   本人たちの同意を取って出したものではありません。
 *
 *   決まり文句は**マネージの「メモの決まり文句」で登録**します
 *   （スプレッドシート側＝非公開に入ります）。担当者（STAFF）や
 *   配達する人（DRIVERS）、年間の売上目標（SALES_TARGETS）と同じ形です。
 *   ★ここに名前を書き戻さないでください。書いた瞬間、また公開されます。
 */
const SHIFT_MEMO_TAGS = [];

/**
 * 店舗ごとの決まり文句（書いていない店舗は上のものを使います）
 *
 * ★ここに書けば、その店舗だけ入れかわります。
 */
const SHIFT_MEMO_TAGS_STORES = {
  // ★popo の分もマネージへ移しました（2026-09-07）。名前はここに書きません。
  // ★空にするとボタンが1つも出ず、ただのメモ欄になります
  //   （2026-09-07 に ko-dai の指示）。行ごと出しません（→ app.js）。
  //   **店舗idと空の並びだけなので、これは人の名前ではありません。**
  //   マネージで登録すれば、そちらが勝ちます
  kojare: [], sumimaro: [], chacoru: [], oiden: [],
};

/**
 * 1店舗に登録できる決まり文句の数
 *
 * ★`js/storage.js` の `ShiftMemoTags.save` が `slice(0, ここの数)` で切ります。
 *   **切られると黙って消えるので、マネージが先に止めます**（→ saveShiftMemoTags）。
 * ★2か所に同じ数があるので、`test.js` が storage.js を読んで見くらべます。
 *   片方だけ変えると検査が落ちます。
 */
const SHIFT_MEMO_TAGS_MAX = 12;

/**
 * その店舗の決まり文句
 *
 * ★読むところはここ1つだけです。**マネージの登録が先**で、
 *   登録が無いときだけ、上に書いてある分を使います。
 * ★提出ページ（shift/）は storage.js を読み込みません。
 *   `typeof` で見てから触ります（`Store` と同じ形です）。
 */
function shiftMemoTagsOf(storeId) {
  try {
    if (typeof ShiftMemoTags !== 'undefined') {
      const v = ShiftMemoTags.get(storeId);
      if (v) return v;
    }
  } catch (e) {
    // 読めなくても、画面は出します
  }
  return SHIFT_MEMO_TAGS_STORES[storeId] || SHIFT_MEMO_TAGS;
}

/**
 * 名前の欄を保存したときに、名簿から消える人
 *
 * ★消えた人の番号は、そこで使えなくなります。**名前を戻しても新しい番号**になり、
 *   前の番号では提出ページに入れません。**画面には何も出ません。**
 * ★これは「作り直す」を押さなくても起きます。**名前を1文字打ちまちがえるだけ**で、
 *   別人が増えて、元の人が消えます（2026-09-07、本部が実物で数えました）。
 *   だから保存の前に聞きます。→ shiftRosterConfirm
 */
function shiftRosterVanishing(storeId, text) {
  if (typeof ShiftStaff === 'undefined') return [];
  const これから = new Set(String(text || '').split('\n')
    .map((x) => x.trim()).filter(Boolean));
  return ShiftStaff.people(storeId).map((p) => p.n).filter((n) => !これから.has(n));
}

/**
 * 消える人がいたら聞く（押してよければ true）
 *
 * ★止めるためのものではありません。**うっかりを拾う**ためのものです。
 *   店長が名簿を直せる、というのは ko-dai の決めごとです（2026-09-07）。
 *   権限は狭めず、事故だけ拾います。
 */
function shiftRosterConfirm(storeId, text) {
  const 消える = shiftRosterVanishing(storeId, text);
  if (!消える.length) return true;
  return window.confirm(
    `${消える.join('・')} が名簿から消えます。\n\n`
    + '★その人の番号は使えなくなります。\n'
    + '　あとで名前を戻しても、番号は新しくなります\n'
    + '　（前の番号では、提出ページに入れません）。\n\n'
    + '名前を打ちまちがえたときも、同じことが起きます。\n'
    + '組みおわったシフトは、そのまま残ります。\n\n'
    + '進めますか。');
}

/**
 * その店舗の決まり文句が「登録されている」か
 *
 * ★**空で登録した（＝ボタンを出さない）**と、**まだ登録していない**は
 *   別のものです。前者は何も出さず、後者は「マネージで登録します」と出します。
 *   黙って消えると、直したのか壊れたのかが分かりません。
 */
function shiftMemoTagsSet(storeId) {
  try {
    if (typeof ShiftMemoTags !== 'undefined' && ShiftMemoTags.get(storeId)) return true;
  } catch (e) {
    // 同上
  }
  return Array.isArray(SHIFT_MEMO_TAGS_STORES[storeId]);
}

/**
 * 「マネージで登録します」と出すか
 *
 * ★出すのは、**1つも出ていなくて、しかも登録もされていない**ときだけです。
 *   ボタンが出ている店舗に出すと、言っていることが画面と食いちがいます。
 */
function shiftMemoTagsAsk(storeId) {
  return !shiftMemoTagsOf(storeId).length && !shiftMemoTagsSet(storeId);
}
const SHIFT_MEMO_SEP = '・';

/** メモを「・」で分けたもの */
function shiftMemoParts(memo) {
  return String(memo || '').split(SHIFT_MEMO_SEP).map((x) => x.trim()).filter(Boolean);
}

/** その言葉がメモに入っているか */
function shiftMemoHas(memo, tag) {
  return shiftMemoParts(memo).indexOf(tag) >= 0;
}

/** 押したときの、あとのメモ（入っていれば外し、無ければ足します） */
function shiftMemoToggle(memo, tag) {
  const parts = shiftMemoParts(memo);
  const i = parts.indexOf(tag);
  if (i >= 0) parts.splice(i, 1);
  else parts.push(tag);
  return parts.join(SHIFT_MEMO_SEP);
}

/* -------- 人が足りないマス --------
 *
 * ★元のスプレッドシートで、赤く塗って「ここにもう1人ほしい」と
 *   分かるようにしているのと同じものです。日ごとに
 *   ['dinner|k', …] の形で持ちます。
 */
function shiftShortKey(slotId, laneId) {
  return `${slotId}|${laneId}`;
}

/** 1つのマスで足りないと書ける、一番多い人数 */
const SHIFT_SHORT_MAX = 9;

/**
 * 足りない人数の一覧を読みます
 *
 * ★はじめは「足りる・足りない」の2つだけで、['dinner|k'] のような
 *   一覧で持っていました。その形で保存されたものは「1人」として読みます。
 */
function shiftShortMap(v) {
  const out = {};
  if (Array.isArray(v)) {
    v.forEach((k) => { if (typeof k === 'string' && k) out[k] = 1; });
    return out;
  }
  if (v && typeof v === 'object') {
    Object.keys(v).forEach((k) => {
      const n = Math.floor(Number(v[k]));
      if (n > 0) out[k] = Math.min(n, SHIFT_SHORT_MAX);
    });
  }
  return out;
}

/**
 * 見本・テスト用の人か
 *
 * ★提出ページがちゃんと動いているかを確かめるための番号です。
 *   名前に「テスト」が入っている人は、Mine やワークスの
 *   シフト作成にはいっさい出しません（名簿の数にも入れません）。
 *   マネージの「シフトに入る人」には出るので、番号は配れます。
 */
function isShiftTester(name) {
  return String(name || '').indexOf('テスト') >= 0;
}

/** 見本（テスト用）の人の名前。店舗ごとに1人ずつ作ります */
const SHIFT_TESTER_NAME = 'テスト';

/**
 * その店舗で「シフトに入る人」（名簿と番号）を出すか
 *
 * ★名簿は**全店舗**に出します。まだシフトを組んでいない店舗でも、
 *   名前と番号を先に用意でき、見本（テスト用）も作れるようにするためです。
 * ★シフトを**組む**ところ（希望の取り込み・表・印刷）は
 *   SHIFT_STORES の店舗だけです（shiftBuilds）。
 */
function shiftRosterShows() {
  return true;
}

/* -------- 他店舗にも所属している人 -------- */

/**
 * 2つ以上の店舗に入っている人の表しかた
 *
 * ★**同じ番号を、両方の店舗の名簿に入れておく**だけです。新しい持ち物は増やしません。
 *   こうすると、どちらの店舗から見ても同じ状態に見えます。
 *   こじゃれで「炭まろにも所属」を押すと、炭まろの名簿にもその人が出て、
 *   炭まろ側でも押された状態になります。**同じ人を二重に登録する手間が消えます。**
 *
 * ★前は「同じ名前なら同じ人」と見ていましたが、やめました。
 *   同じ名前の別人がいると、勝手に結ばれてしまうためです。
 *   いまは**押して決めたときだけ**結ばれます。
 *
 * ★番号はその人のものなので、どの店舗から出しても同じ人として届きます。
 */

/** その番号の人が入っている店舗（名簿に同じ番号があるところ全部） */
function shiftLinkedStores(code) {
  const want = String(code || '');
  if (!want) return [];
  const map = ShiftStaff.all();
  return STORES.map((s) => s.id)
    .filter((id) => (map[id] || []).some((p) => String(p.c || '') === want));
}

/**
 * その人が入る店舗を決め直す
 *
 * ★入れる店舗には**同じ名前・同じ番号**で足し、外す店舗からは消します。
 * ★もとの店舗は必ず残します（そこから押しているので、外せてしまうと
 *   その人がどこにも居なくなります）。
 * ★足す先にすでに同じ名前の人がいたら、**その人の番号をこちらに合わせます**
 *   （別々に登録されていた同じ人を、1人にまとめる形です）。
 */
function shiftSetLinked(fromStore, name, code, stores) {
  const map = ShiftStaff.all();
  const want = new Set([fromStore, ...(stores || [])]);

  STORES.forEach((s) => {
    const id = s.id;
    const list = (map[id] || []).slice();
    const at = list.findIndex((p) => String(p.c || '') === String(code)
      || (id !== fromStore && p.n === name));

    if (want.has(id)) {
      if (at < 0) list.push({ n: name, c: code, s: false, p: '' });
      else list[at] = { ...list[at], n: name, c: code };
    } else if (at >= 0 && id !== fromStore) {
      list.splice(at, 1);
    }
    if (list.length) map[id] = list;
    else delete map[id];
  });
  return ShiftStaff.save(map);
}

/** その店舗でシフトを組むか（名簿だけの店舗と見分けます） */
function shiftBuilds(storeId) {
  return SHIFT_STORES.includes(storeId);
}

/**
 * ワークスとマインの業務一覧に「シフト」を出すか
 *
 * ★`js/config.js` の「5) 業務の一覧」は本部のものなので、
 *   あちらからはこの関数を呼んでもらいます。出す条件を変えたくなったら、
 *   **ここだけ**直せば済むようにしてあります。
 */
function shiftTaskShows(storeId) {
  return shiftBuilds(storeId) || shiftRosterShows(storeId);
}

/** シフトを組むときに出す人だけ（見本は外します） */
function shiftBuildNames(storeId) {
  return ShiftStaff.list(storeId).filter((n) => !isShiftTester(n));
}

/** そのマスで、あと何人ほしいか */
function shiftShortOf(day, slotId, laneId) {
  return (day.short || {})[shiftShortKey(slotId, laneId)] || 0;
}

/** その希望が、組んだ表のどの枠に入るか（F はランチへ） */
function shiftSlotFor(wishSlotId) {
  return wishSlotId === SHIFT_FULL_ID ? 'lunch' : wishSlotId;
}

/**
 * 同じ日に一緒に選べない組み合わせ
 *
 * F はランチとディナーの両方に入るという意味なので、
 * F を押したらランチとディナーは消え、ランチかディナーを押したら F が消えます。
 */
function shiftClashes(slotId) {
  if (slotId === SHIFT_FULL_ID) return ['lunch', 'dinner'];
  if (slotId === 'lunch' || slotId === 'dinner') return [SHIFT_FULL_ID];
  return [];
}

/**
 * その枠で最初に選ばれている時刻
 *
 * ★どの枠にも必ず時刻があります。時刻なしでシフトに入れられると、
 *   表を見たときに「何時から来るのか分からない人」ができてしまうためです。
 */
function shiftDefaultTime(storeId, slotId) {
  const slot = getShiftSlot(storeId, slotId);
  if (!slot || !slot.times.length) return '';
  return slot.pick && slot.times.includes(slot.pick) ? slot.pick : slot.times[0];
}

/**
 * '17.5' → '17:30'（読みやすい書き方）
 *
 * 中では「時」を小数で持っています。11.5 なら11時半、11.25 なら11時15分。
 */
function shiftTimeText(t) {
  const v = String(t === null || t === undefined ? '' : t);
  if (v === '') return '';
  const n = Number(v);
  if (!isFinite(n)) return '';
  const h = Math.floor(n);
  const mi = Math.round((n - h) * 60);
  return `${h}:${String(mi).padStart(2, '0')}`;
}

/**
 * 書いてもらった時刻を、中で持つ形に直す
 *
 *   18:30 → '18.5' ／ 1830 → '18.5' ／ 18 → '18' ／ 18時30分 → '18.5'
 *   １８：３０ のような全角も読みます。
 *   読めなければ null を返します（そのときは直しません）。
 *
 * ★どの端末でも使えます。ボタンで足りない時刻は、ここから入れてください。
 */
function shiftTimeFrom(text) {
  const raw = toHalfWidth(String(text || '')).replace(/\s/g, '');
  if (!raw) return null;
  // 「18時30分」「18時」も読めるようにします
  const s2 = raw.replace(/時/g, ':').replace(/分/g, '');

  let h = null;
  let mi = 0;
  let m = /^(\d{1,2}):(\d{1,2})$/.exec(s2);          // 18:30
  if (m) { h = Number(m[1]); mi = Number(m[2]); }
  if (h === null) {
    m = /^(\d{1,2}):?$/.exec(s2);                    // 18 ／ 18:
    if (m) { h = Number(m[1]); mi = 0; }
  }
  if (h === null) {
    // 11.5 は「11時半」。今のシフト表で (11.5) と書いているのと同じ読み方です
    m = /^(\d{1,2})\.(\d{1,2})$/.exec(raw);
    if (m) { h = Number(m[1]); mi = Math.round(Number('0.' + m[2]) * 60); }
  }
  if (h === null) {
    m = /^(\d{1,2})(\d{2})$/.exec(raw);              // 1830 の書き方
    if (m) { h = Number(m[1]); mi = Number(m[2]); }
  }
  if (h === null || h < 0 || h > 29 || mi < 0 || mi > 59) return null;
  return shiftTimeKey(h + mi / 60);
}

/**
 * 中で持つ形にそろえる
 *
 * ★ちょうどの時刻は '18'、半なら '18.5' と、余計な 0 を付けません。
 *   ボタン（'11' '11.5' …）と同じ書き方にそろえないと、
 *   選んだボタンに色が付かなくなります。
 */
function shiftTimeKey(hours) {
  const mi = Math.round(hours * 60);
  const v = mi / 60;
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000);
}

/**
 * 表に書くときの時刻
 *
 *   17    → 17:00      17.5  → 17:30      11.25 → 11:15
 *   既定の時刻の人には、何も付けません（ランチの11時など）。
 *
 * ★以前は ⑰ や (17.5) と書いていましたが、読みちがえるので
 *   全部「時:分」にそろえました。
 */
function shiftTimeMark(storeId, slotId, t) {
  const v = String(t === null || t === undefined ? '' : t);
  // ★入っている時刻は、必ず全部書きます。
  //   前は「ふだんの時刻の人は書かない」ことにしていましたが、
  //   11時の人だけ時刻が出ないのは、かえって分かりにくいためです
  if (!getShiftSlot(storeId, slotId) || v === '') return '';
  return shiftTimeText(v);
}

/** 表に出す1人分（'18:00 そう' のような形） */
function shiftNameText(storeId, slotId, entry) {
  const mark = shiftTimeSpan(storeId, slotId, entry);
  const name = String((entry && entry.n) || '');
  return mark ? `${mark} ${name}` : name;
}

/**
 * 表に出す時刻。**退勤まで入っていれば「10:00〜15:00」と出します**
 *
 * ★時刻を入れる店舗（popo）だけ、うしろが付きます。
 *   枠で選ぶ店舗（バグる）は退勤を持たないので、今までどおり「10:00」です。
 */
function shiftTimeSpan(storeId, slotId, entry) {
  const at = entry && entry.t;
  if (at === undefined || at === null || at === '') return '';

  // ★時刻を入れる店舗（popo）では、枠が引けるかを見ません。
  //   時刻はその人自身のものなので、枠の設定に左右されてはいけません。
  //   前は枠が引けないと時刻ごと消えていました（使わない設定にした枠に
  //   人が残っていると、名前だけになって何時の人か分からなくなります）
  if (!shiftUsesRange(storeId)) return shiftTimeMark(storeId, slotId, at);

  const from = shiftTimeText(at);
  const to = entry && entry.e;
  return to === undefined || to === null || to === '' ? from : `${from}〜${shiftTimeText(to)}`;
}

/**
 * 印刷の1マスで、時刻と名前を分けたもの
 *
 * ★1段8日だと1マスが17.8mmしかありません。時刻と名前を1行に並べると
 *   名前が6ptほどまで小さくなって読めなかったので、**2段に分けます**。
 *   時刻を名前の上の段に置くと、名前は1マスの幅をまるごと使えるので
 *   9pt以上にできます。どの時刻が誰のものかは、上下の並びで分かります。
 *
 * ★時刻は名前と同じ大きさです。「11:00」は5文字分（2.5）で、
 *   名前（4〜5文字分）より狭いので、同じ大きさにしても
 *   名前は小さくなりません。色だけ少しうすくして見分けます。
 */
const SHIFT_TIME_SCALE = 1;


/** F（通し）の人の名前のうしろに付く「 F」の分の幅 */
const SHIFT_FULL_MARK_EM = 0.9;

function shiftNameParts(storeId, slotId, entry) {
  return {
    time: shiftTimeSpan(storeId, slotId, entry),
    name: String((entry && entry.n) || ''),
    // ★F の人は名前のうしろに「 F」が付きます。この幅も数に入れないと、
    //   その人だけマスからはみ出ます。
    //   popo は塗るだけで字を出さないので、幅も要りません
    full: shiftShowsFullMark(storeId) && shiftIsFull(storeId, entry),
  };
}

/**
 * その1人分が、名前の大きさの何倍の幅になるか
 *
 * ★時刻は名前の上の段に出すので、幅は「名前の方が広ければ名前」で決まります。
 */
function shiftNameEm(parts) {
  const name = shiftTextEm(parts.name) + (parts.full ? SHIFT_FULL_MARK_EM : 0);
  const time = parts.time ? shiftTextEm(parts.time) * SHIFT_TIME_SCALE : 0;
  return Math.max(name, time);
}

/* -------- 祝日と、肉の日 -------- */

/** '9/21(月)祝' のような書き方（祝はかっこの外に出します） */
function shiftDayLabel(dateStr, dowNames) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const dow = new Date(String(dateStr).replace(/-/g, '/')).getDay();
  return `${m}/${d}（${dowNames[dow]}）` + (isHoliday(y, m, d) ? '祝' : '');
}


/**
 * 日本の祝日かどうか
 *
 *  表に「祝」と出すためだけのものなので、名前は持ちません。
 *  ・日付が決まっているもの（元日・建国記念の日 …）
 *  ・第◯月曜のもの（成人の日・海の日・敬老の日・スポーツの日）
 *  ・春分・秋分（年で動くので、計算で出します）
 *  ・振替休日（日曜と重なった祝日の次の平日）
 *  ・国民の休日（祝日にはさまれた平日。9月に出ることがあります）
 *
 *  ★2099年までの決まりで作っています。法律が変わったら直してください。
 */
function isHoliday(y, m, d) {
  const set = holidaysOf(y);
  return set.has(`${m}-${d}`);
}

const holidayMemo = {};

function holidaysOf(y) {
  if (holidayMemo[y]) return holidayMemo[y];

  const fixed = [
    [1, 1], [2, 11], [2, 23], [4, 29], [5, 3], [5, 4], [5, 5],
    [8, 11], [11, 3], [11, 23],
  ];
  // 第◯月曜のもの  [月, 何番目]
  const mondays = [[1, 2], [7, 3], [9, 3], [10, 2]];

  const days = new Set();
  fixed.forEach(([mm, dd]) => days.add(`${mm}-${dd}`));
  mondays.forEach(([mm, nth]) => days.add(`${mm}-${nthMonday(y, mm, nth)}`));
  days.add(`3-${equinox(y, 20.8431)}`);   // 春分の日
  days.add(`9-${equinox(y, 23.2488)}`);   // 秋分の日

  const has = (dt) => days.has(`${dt.getMonth() + 1}-${dt.getDate()}`);

  // 国民の休日（前後を祝日にはさまれた平日）
  [...days].forEach((k) => {
    const [mm, dd] = k.split('-').map(Number);
    const next = new Date(y, mm - 1, dd + 2);
    const between = new Date(y, mm - 1, dd + 1);
    if (has(next) && !has(between) && between.getDay() !== 0) {
      days.add(`${between.getMonth() + 1}-${between.getDate()}`);
    }
  });

  // 振替休日（日曜と重なったら、次の祝日でない日）
  [...days].forEach((k) => {
    const [mm, dd] = k.split('-').map(Number);
    const dt = new Date(y, mm - 1, dd);
    if (dt.getDay() !== 0) return;
    const nx = new Date(y, mm - 1, dd);
    do { nx.setDate(nx.getDate() + 1); } while (has(nx));
    days.add(`${nx.getMonth() + 1}-${nx.getDate()}`);
  });

  holidayMemo[y] = days;
  return days;
}

/** その月の第 nth 月曜の日にち */
function nthMonday(y, m, nth) {
  const first = new Date(y, m - 1, 1).getDay();      // 0=日
  return 1 + ((8 - first) % 7) + (nth - 1) * 7;
}

/** 春分・秋分の日（1980〜2099年） */
function equinox(y, base) {
  return Math.floor(base + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
}

/**
 * その日にはじめから入れておくメモ
 *
 *  毎月29日と、2月9日は「肉の日」。シフト表に前もって出しておきます。
 *  ★ほかにも決まった日があれば、ここに足してください。
 *  ★アルバイトの提出ページには出しません（組む側の覚え書きなので）。
 */
function shiftDefaultMemo(dateStr) {
  const [, m, d] = String(dateStr || '').split('-').map(Number);
  if (d === 29 || (m === 2 && d === 9)) return '肉の日';
  return '';
}

/* -------- 半月のあつかい -------- */

/** その日が前半(1)か後半(2)か */
function shiftHalfOf(day) {
  return day <= 15 ? 1 : 2;
}

/** その半月の入れ先（'baguru', 2026, 9, 1 → baguru-2026-09-1） */
function shiftKey(storeId, y, m, half) {
  return `${storeId}-${y}-${String(m).padStart(2, '0')}-${half}`;
}

/** その半月に入る日（'YYYY-MM-DD' の配列） */
function shiftDays(y, m, half) {
  const last = new Date(y, m, 0).getDate();
  const from = half === 1 ? 1 : 16;
  const to = half === 1 ? Math.min(15, last) : last;
  const out = [];
  for (let d = from; d <= to; d += 1) out.push(dateToStr(new Date(y, m - 1, d)));
  return out;
}

/** 「9/1〜9/15」のような見出し */
function shiftRangeLabel(y, m, half) {
  const days = shiftDays(y, m, half);
  const first = days[0].split('-').map(Number);
  const last = days[days.length - 1].split('-').map(Number);
  return `${first[1]}/${first[2]}〜${last[1]}/${last[2]}`;
}

/** 半月を前後に動かす（step は +1 / -1）。{ y, m, half } を返します */
function shiftStep(y, m, half, step) {
  let n = y * 24 + (m - 1) * 2 + (half - 1) + step;
  const yy = Math.floor(n / 24);
  n -= yy * 24;
  return { y: yy, m: Math.floor(n / 2) + 1, half: (n % 2) + 1 };
}

/* -------- 希望の入れ先（★人ごとに別の行です） -------- */

/**
 * 出してもらった希望は、**人ごとに別の行**にします。
 *
 * ★なぜ分けたか
 *   前は半月分をまるごと1行にまとめていました。1行に入るのは5万文字までです。
 *   実際の形のまま数え直すと、30人で35,178文字、40人で **54,930文字**
 *   ＝もう書けません。1行の中で一番大きいのが希望（40人で28,635文字）、
 *   次が取り込みずみの控え（16,537文字）で、組んだ結果は9,550文字しか
 *   ありません。**大きいのは希望の方**でした。
 *   人ごとに出すと、1人分は多くても846文字（上限の59分の1）で頭打ちになり、
 *   何人増えても当たりません。教育の記録を人ごとに分けたのと同じ手です
 *   （→ trainDayKey）。
 *
 * ★分けると、同時に出しても消し合わなくなります。
 *   1行にまとめていたころは、締切ぎわに2人が同時に出すと
 *   「読む→足す→書く」のあいだに割り込まれて片方が消えるので、
 *   Apps Script の側で鍵をかけて1人ずつ通していました。
 *   人ごとの行なら、書く先がそもそも重なりません。
 *
 * 入れ先は  _shiftw/baguru-2026-09-1-xxxxxx  の形です（xxxxxx が配る番号）。
 * ★例に**本物になりうる6桁の数を書かないでください。**番号は 100000〜999999 の
 *   ただの乱数なので、例に書いた数が、誰かの番号と同じことがありえます。
 *   このファイルは公開されるので、読んだ人がその番号で入れてしまいます。
 * うしろはマネージで振られた、その人の番号です。
 * **名前ではなく番号にしてあります。**名前を書き直しても、
 * 出したものが行方不明にならないようにするためです
 * （名前は行の中に一緒に書いておきます）。
 *
 * ★入れ先を `_shift` と分けてあるのは、Apps Script の側で
 *   「その店舗の半月」を数えるときに `_shift/店舗id-` で拾っているためです。
 *   同じ入れ先に置くと、1人分の行まで半月として数えてしまいます。
 */
const SHIFT_WISH_STORE = '_shiftw';

/** 希望の行の中で、中身を入れておく名前（1行に1つだけです） */
const SHIFT_WISH_ITEM = 'wish';

/** その人の、その半月の希望の入れ先（'baguru-2026-09-1-xxxxxx'） */
function shiftWishRowKey(storeId, y, m, half, code) {
  return `${shiftKey(storeId, y, m, half)}-${code}`;
}

/** その半月の、希望の行だけを拾うための頭（'baguru-2026-09-1-'） */
function shiftWishRowHead(storeId, y, m, half) {
  return `${shiftKey(storeId, y, m, half)}-`;
}

/* -------- 記録の中の名前 -------- */

/**
 * 古い、希望の入れ先（組んだ行の中に `w:名前` で入っていたころのもの）
 *
 * ★もう書きません。前に出してもらった分を**読むためだけ**に残しています。
 */
function shiftWishKey(name) {
  return `w:${name}`;
}

/** 組んだ結果（1日分）の入れ先 */
function shiftDayKey(dateStr) {
  return `d:${dateStr}`;
}

/**
 * 募集の状態を入れるところ
 *
 *  シフトは「募集をはじめる → 出してもらう → 組む → 確定する」の順で進みます。
 *  アルバイトの提出ページに出るのは、**募集中の半月ひとつだけ**です。
 *  こちらが募集をはじめるまで、先の月は出ませんし、
 *  確定したあとは、次の募集をはじめるまで新しい期間が出ません。
 */
const SHIFT_PHASE_KEY = 'phase';

/** 募集中 */
const SHIFT_OPEN = 'open';
/** 確定ずみ */
const SHIFT_BUILT = 'built';

/**
 * その募集の提出期限（'YYYY-MM-DD'。決めていなければ空）
 */
function shiftDueOf(rec) {
  const v = (rec.items || {})[SHIFT_PHASE_KEY];
  const d = v && v.due;
  return /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : '';
}

/**
 * 提出期限の初期値
 *
 * その半月が始まる5日前にします。組む時間を数日残すためです。
 * それがもう過ぎているときは、あしたにします。
 */
function shiftDueDefault(y, m, half) {
  const first = shiftDays(y, m, half)[0];
  const [fy, fm, fd] = first.split('-').map(Number);
  const due = new Date(fy, fm - 1, fd - 5);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateToStr(due > tomorrow ? due : tomorrow);
}

/** 「8月27日（木）まで」のような書き方 */
function shiftDueLabel(dateStr, dowNames) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(dateStr.replace(/-/g, '/')).getDay();
  return `${m}月${d}日（${dowNames[dow]}）まで`;
}

/** その半月がどこまで進んだか（'' = まだ募集していない） */
function shiftPhaseOf(rec) {
  const v = (rec.items || {})[SHIFT_PHASE_KEY];
  const now = v && v.v;
  return now === SHIFT_OPEN || now === SHIFT_BUILT ? now : '';
}

/** 画面に出す言い方 */
function shiftPhaseText(phase) {
  if (phase === SHIFT_OPEN) return '募集中';
  if (phase === SHIFT_BUILT) return '確定ずみ';
  return 'まだ募集していません';
}

/**
 * 一度取り込んだ組み合わせを控えておく入れ先
 *
 *   { by: { 'なまえ1': ['3|d', '4|l'], … } }
 *
 * ★これがあるので「希望を取り込む」を何度押しても、
 *   いちど外した人が戻ってきません。
 *
 * ★昔は  { list: ['2026-09-03|dinner|なまえ', …] }  でした。
 *   ★例に本物の名前を書かないこと。ここは GitHub Pages で誰でも読めます。
 *   1つで20文字あり、40人の半月で16,537文字＝**1行の3分の1**を
 *   これだけで使っていました。いまは
 *     ・年と月は書きません（行のキーで決まっています）
 *     ・枠は1文字（o/l/d/f）にします
 *     ・名前は人ごとに1回だけにします
 *   ので、1つ6文字ほどになります。
 *   **古い形もそのまま読めます**（下の shiftTakenRead）。
 */
const SHIFT_TAKEN_KEY = 'taken';

/** 枠の名前と1文字の行き来（記録を短くするため。読み書きの両方でここを通します） */
const SHIFT_SLOT_LETTER = { open: 'o', lunch: 'l', dinner: 'd', full: 'f' };

/** 控えの1つ分（'2026-09-03' と 'dinner' → '3|d'） */
function shiftTakenMark(dateStr, slotId) {
  const day = Number(String(dateStr).slice(8, 10));
  return `${day}|${SHIFT_SLOT_LETTER[slotId] || slotId}`;
}

/**
 * 控えの見分け（名前と、日と枠）
 *
 * ★1つの Set で見られるように、改行でつないだ1本の文字列にします。
 *   改行は名前にも枠にも入らないので、区切りとして安全です。
 */
function shiftTakenId(name, dateStr, slotId) {
  return `${name}\n${shiftTakenMark(dateStr, slotId)}`;
}

/**
 * 控えを読む（新しい形も、古い形も読めます）
 *
 * ★古い形が残っている半月は、次に取り込んだときに新しい形で書き直されます。
 *   読むときに両方を足しているので、書き直す前でも取りこぼしません。
 */
function shiftTakenRead(v) {
  const out = new Set();
  if (!v || typeof v !== 'object') return out;

  // 新しい形 { by: { 名前: ['3|d', …] } }
  if (v.by && typeof v.by === 'object') {
    Object.keys(v.by).forEach((name) => {
      const marks = Array.isArray(v.by[name]) ? v.by[name] : [];
      marks.forEach((mk) => out.add(`${name}\n${mk}`));
    });
  }

  // 古い形 { list: ['2026-09-03|dinner|なまえ', …] }
  // ★名前に | が入っていても切れないよう、3つ目から後ろを全部名前とします
  if (Array.isArray(v.list)) {
    v.list.forEach((one) => {
      const p = String(one).split('|');
      if (p.length < 3) return;
      out.add(shiftTakenId(p.slice(2).join('|'), p[0], p[1]));
    });
  }
  return out;
}

/**
 * 控えを書く形にする
 *
 * ★`list: []` を付けているのは、古い形を**消すため**です。
 *   Store.setItem は項目を混ぜて書くので、`{ by }` だけを渡すと
 *   古い `list` がそのまま残り、いつまでも縮みません。
 *   読むときに古い形も足してから書き直しているので、取りこぼしはありません。
 */
function shiftTakenWrite(set) {
  const by = {};
  set.forEach((one) => {
    const i = String(one).indexOf('\n');
    if (i < 0) return;
    const name = one.slice(0, i);
    if (!by[name]) by[name] = [];
    by[name].push(one.slice(i + 1));
  });
  return { by, list: [] };
}

/**
 * 提出ページ
 *
 * アルバイトに配るURLは  …/shift/  です。全員に同じURLを配って構いません。
 *
 * ★入るときは「自分の番号」を入れます。番号は1人に1つで、
 *   マネージの「シフトに入る人」で作ります。
 *   番号で誰なのかが決まるので、**他の人の名前では出せません**。
 *   名前の一覧も出しません（誰が働いているかを見せないため）。
 *
 * 番号でできるのは、その人自身の希望を出すことと、出したものを読み返すことだけです。
 * ほかの人の希望も、クローズや立替金の記録も、いっさい読めません。
 */
const SHIFT_SUBMIT_PATH = 'shift/';

/**
 * 提出ページのURL（アプリがどの階層にあっても、同じ場所を指します）
 *
 * ★`SHIFT_SUBMIT_PATH` をそのまま `location.href` に重ねてはいけません。
 *   アプリは階層がちがいます。
 *
 *     /T3Works/            ワークス   → /T3Works/shift/        ○
 *     /T3Works/mine/       マイン     → /T3Works/mine/shift/   ★404
 *     /T3Works/manage/     マネージ   → /T3Works/manage/shift/ ★404
 *
 *   2026-09-07、マインの「アルバイトの画面を見る」が404になりました。
 *   マネージだけ `'../' +` と手で書いてあり、**同じ判断が2か所にありました。**
 *   ここ1か所にして、どの画面からも同じものを使います。
 *
 * ★`code` を渡すと、見本で入るURLになります。
 */
const SHIFT_APP_DIRS = ['mine', 'manage', 'drive', 'owner', 'story'];

function shiftSubmitUrl(code) {
  const 上へ = new RegExp('/(' + SHIFT_APP_DIRS.join('|') + ')/[^/]*$')
    .test(location.pathname) ? '../' : '';
  const u = new URL(上へ + SHIFT_SUBMIT_PATH, location.href);
  if (code) u.search = '見本=' + encodeURIComponent(code);
  return u.href;
}

/** 番号の桁数。増やすと当てにくくなりますが、打つのが手間になります */
const SHIFT_CODE_LENGTH = 6;

/**
 * 誰とも重ならない番号を作る
 *
 * ★店舗をまたいで重ならないようにします。番号だけで「どの店舗の誰か」が
 *   決まる作りなので、重なると別の人として入ってしまいます。
 */
function makeShiftCode(used) {
  const taken = new Set(used || []);
  const top = 10 ** SHIFT_CODE_LENGTH;
  const low = 10 ** (SHIFT_CODE_LENGTH - 1);
  for (let i = 0; i < 5000; i += 1) {
    const n = String(low + Math.floor(Math.random() * (top - low)));
    if (!taken.has(n)) return n;
  }
  return '';   // ここまで来ることはありませんが、念のため
}

/* ------------------------------------------------------------
 *  日報からの取り込み
 *
 *  各店舗の日報は「年月_店舗名_日報」という名前で、店舗ごとの日報フォルダに
 *  入っています。今年の分はフォルダの直下、去年より前は中の年フォルダの中です。
 *  フォルダのURLはマネージで登録します（NippouFolders）。
 *
 *  読むのは日報の「まとめ」ページの5か所だけ。残り（客単価・原価率・F/L・
 *  累計）は、この5つからアプリが計算します。光熱費は日報に無いので手入力です。
 *
 *  ★原価は F列と G列の足し算です。まとめの3行目に
 *    「仕入先 ｜ 現金 ｜ 掛仕入」と出ています。F が現金仕入、G が掛仕入で、
 *    日報自身も 原材料費率 = (F24+G24)/B24 と計算しています。
 *    2026年9月5日まで G だけを読んでいて、現金仕入が丸ごと抜けていました。
 *
 *  ★日報の様式は途中で変わります。バグるは2026年8月まで6行上にずれていて
 *    （店舗で項目が違うため）、9月からほかの店舗と同じ行になりました。
 *
 *  ★取り込みでは、去年の同じ月も一緒に読みます。様式が変わった年は
 *    「今年は新しい配置・去年は古い配置」になるので、配置は店舗ごとに
 *    「この年月から」を並べて持ち、読む年月で選び分けます。
 *    様式が変わったら NIPPOU_LAYOUTS に1つ足して、アプリを入れ直せば直ります
 *    （Apps Script は「言われたマスを読むだけ」なので、貼り直しは要りません）。
 * ---------------------------------------------------------- */

/**
 * 原価のマス（現金仕入 F ＋ 掛仕入 G）
 *
 * まとめの仕入明細は「3行が見出し、4行目から下が仕入先、その下が累計」です。
 * ところが**累計の式が、仕入先の行を全部おおっていません。**
 *
 *     仕入先   4〜23行（19〜23行はいま空。23行は買い出し）
 *     累計     24行  =SUM(F4:F18) ← 19〜23行が入っていない
 *
 * 日別ページの当日総合計は `SUM(F4:F23)` で、そちらは足しています。
 * まとめだけがこぼしているので、**こぼれた行はアプリが1つずつ読んで足します**
 * （ko-dai の指示・2026年9月5日。日報側の式は直さない方針です）。
 *
 *   sumRow … 累計の行
 *   covers … 累計の式がおおっている行 [はじめ, おわり]（`SUM(F4:F18)` なら [4, 18]）
 *   block  … 仕入先の行 [はじめ, おわり]（4〜23行なら [4, 23]）
 *
 * ★数え上げではなく範囲で書いています。**いま空いている行に業者が入っても読みます。**
 *   仕入先の行が増えたら block のおわりを、累計の式が伸びたら covers のおわりを
 *   直すだけです。**落とすことも、二重に数えることもありません**
 *   （おおわれている行はここでは足さないので、式が `SUM(F4:F23)` に直れば
 *     covers を [4, 23] にするだけで、足す行がひとりでに無くなります）。
 *
 * ★まとめの行に SUM の式そのものが無いと、業者を登録しても0のままです
 *   （バグるの古い様式の14〜16行がそうでした）。それはシート側の話なので、
 *   仕入先を増やしたら、まとめの F列・G列に式が入っているか見てください。
 */
function nippouCostCells(sumRow, covers, block) {
  const cells = [`F${sumRow}`, `G${sumRow}`];
  for (let r = covers[1] + 1; r <= block[1]; r += 1) cells.push(`F${r}`, `G${r}`);
  return cells;
}

/**
 * 日報の「まとめ」の、どこを読むか
 *
 *   from  … この年月（YYYYMM）から、この配置になります。0 は「ずっと前から」
 *   cells … 読むところ。1つのマスなら文字列、足すなら配列で書きます
 *
 * 下の配置は、2026年8月と9月の「まとめ」を実際に読み出して確かめたものです
 * （こじゃれ8月・こじゃれ9月・バグる8月）。
 */
const NIPPOU_LAYOUTS_DEFAULT = [
  {
    from: 0,
    cells: {
      inc: 'B24',      // 売上の税込累計
      ex: 'B25',       // 売上の税抜累計
      guests: 'B28',   // 客数累計
      // 原価＝24行の累計（4〜18行）＋こぼれている19〜23行
      cost: nippouCostCells(24, [4, 18], [4, 23]),
      labor: 'G32',    // 人件費の当月累計
    },
  },
];

const NIPPOU_LAYOUTS = {
  baguru: [
    // 2026年8月まで。ほかの店舗より6行上にずれていました。
    // このころの仕入先は4〜17行で、累計 SUM(F4:F17) が全部おおっています
    {
      from: 0,
      cells: {
        inc: 'B18', ex: 'B19', guests: 'B22',
        // 累計 SUM(F4:F17) が仕入先の行を全部おおっているので、足す行はありません
        cost: nippouCostCells(18, [4, 17], [4, 17]),
        labor: 'G26',
      },
    },
    // 2026年9月から。行がほかの店舗と同じになりました（19〜23行のこぼれも同じ）
    {
      from: 202609,
      cells: {
        inc: 'B24', ex: 'B25', guests: 'B28',
        cost: nippouCostCells(24, [4, 18], [4, 23]),
        labor: 'G32',
      },
    },
  ],
};
/** 日報から取り込む項目（光熱費とキャッチは入りません） */
const NIPPOU_FIELDS = ['inc', 'ex', 'guests', 'cost', 'labor'];
/**
 * 手で入れる光熱費
 *
 *   key  … 金額の入れ先
 *   use  … 使用量の入れ先
 *   unit … 使用量の単位。★検針票と違っていたら、ここだけ直してください
 *          （入れる画面にも、会議の表にも同じものが出ます）
 */
const MEETING_UTIL_ROWS = [
  { key: 'gas',   name: 'ガス', use: 'gasUse',   unit: '㎥' },
  { key: 'water', name: '水道', use: 'waterUse', unit: '㎥' },
  { key: 'power', name: '電気', use: 'powerUse', unit: 'kWh' },
];

/** 手で入れる項目（金額と使用量の両方） */
const MEETING_UTIL_FIELDS = MEETING_UTIL_ROWS
  .reduce((a, r) => a.concat([r.key, r.use]), []);

/** 年と月を YYYYMM の数にします */
function nippouYm(y, m) {
  return (Number(y) || 0) * 100 + (Number(m) || 0);
}

/** その年月（YYYYMM）の日報を読むときの配置 */
function nippouCells(storeId, ym) {
  const list = NIPPOU_LAYOUTS[storeId] || NIPPOU_LAYOUTS_DEFAULT;
  const n = Number(ym) || 0;
  let hit = list[0];
  list.forEach((l) => { if (n >= l.from && l.from >= hit.from) hit = l; });
  return hit.cells;
}

/**
 * GAS に「読んでほしいマス」を渡す形にします
 *
 * ★キーをマスの名前そのものにしています。こうしておくと、今年と去年で
 *   様式が違っても、GAS は言われたマスを読んで同じ名前で返すだけで済みます
 *   （どちらの年の配置なのかは、返ってきてからアプリが組み立てます）。
 */
function nippouAsk(storeId, y, m) {
  const want = {};
  [y, y - 1].forEach((year) => {
    const cells = nippouCells(storeId, nippouYm(year, m));
    NIPPOU_FIELDS.forEach((f) => {
      [].concat(cells[f] || []).forEach((a) => { want[a] = a; });
    });
  });
  return want;
}

/** 読んだ数（マスの名前で入っています）から、その年月の5項目を組み立てます */
function nippouPick(storeId, ym, got) {
  const cells = nippouCells(storeId, ym);
  const out = {};
  NIPPOU_FIELDS.forEach((f) => {
    let sum = 0;
    let ok = false;
    [].concat(cells[f] || []).forEach((a) => {
      if (typeof got[a] === 'number') { sum += got[a]; ok = true; }
    });
    if (ok) out[f] = sum;
  });
  return out;
}

/**
 * 読んだ数が、日報としてありえる形かを見ます
 *
 * ★様式が変わったのに配置が古いままだと、まるで別のマスを読みます。
 *   0 になるとは限らず、それらしい数が入ってしまうことがあります。
 *   まちがった数を会議資料に入れるくらいなら、入れずに知らせます。
 *
 * 返すのは、おかしいときだけ理由の文です。問題なければ空です。
 */
function nippouCheck(o) {
  const yen = (n) => '¥' + Math.round(Number(n) || 0).toLocaleString('ja-JP');
  const inc = o.inc || 0;
  const ex = o.ex || 0;
  if (inc <= 0 || ex <= 0) return '売上が読めません';
  if (ex > inc) return `税抜 ${yen(ex)} が税込 ${yen(inc)} より大きいです`;
  if (ex < inc * 0.8) return `税抜 ${yen(ex)} が税込 ${yen(inc)} に対して小さすぎます`;
  const guests = o.guests || 0;
  if (guests <= 0) return '客数が読めません';
  const per = ex / guests;
  if (per < 500 || per > 20000) return `客単価が ${yen(per)} になります`;
  // ★上限は見ません。開店した月は、仕入が売上より多いことが実際にあります
  //   （おいでんテラス 2026年4月：売上 ¥1,360,984 に対して原価 ¥1,508,810）
  if ((o.cost || 0) <= 0) return '原価が読めません';
  if ((o.labor || 0) <= 0) return '人件費が読めません';
  return '';
}

/** 店舗ごとの日報フォルダ（マネージで登録するまでは空） */
const NIPPOU_FOLDERS = {};

/* ------------------------------------------------------------
 *  日報の「日ごとのページ」の入れ先
 *
 *  ページの名前は日にちそのもの（"1" 〜 "31"）です。
 *  ★2026年9月から様式が変わりました。ここは9月からの形です。
 *    様式が変わったときは、ここを直してアプリを入れ直せば直ります
 *    （Apps Script は「言われたセルに書くだけ」なので、貼り直しは要りません）。
 * ---------------------------------------------------------- */
const NIPPOU_DAY_CELLS_DEFAULT = {
  cash:   'B3',    // 現金売上
  card:   'B4',    // クレジット
  emoney: 'B10',   // 電子マネー
  net:    'B26',   // 純売上（税抜）
  guests: 'B30',   // 当日客数
};
/** 様式が違う店舗だけ、ここに書きます */
const NIPPOU_DAY_CELLS = {};

/**
 *  出前館とウーバーも書くかどうか
 *
 *  ★書きます（2026年9月4日にそう決めました）。
 *  アプリでもう入れてもらっているので、日報に手で打つ欄が無くなります。
 *  そして【当日総合計が、いつもジャーナルの売上とぴったり合う】ようになり、
 *  書いたあとに機械で確かめられます。手入力分が抜けていると、これができません。
 *  手で入れる形に戻したくなったら false にしてください。
 */
const NIPPOU_WRITE_DELIVERY = true;
const NIPPOU_DELIVERY_CELLS = {
  demaeCash: 'B5',   // 出前館現金
  demaeCard: 'B6',   // 出前館クレジット
  uberCash:  'B11',  // ウーバー現金
  uberCard:  'B12',  // ウーバークレジット
};

function nippouDayCells(storeId) {
  return NIPPOU_DAY_CELLS[storeId] || NIPPOU_DAY_CELLS_DEFAULT;
}

/* ------------------------------------------------------------
 *  ミスの記録（クローズの提出記録から入れます）
 *
 *  「提出はしたけれど、じつは できていなかった」を残しておくためのものです。
 *      _miss/2026-08 の items['m…'] = {
 *        d: '2026-08-03', store: 'kojare', text: 'ミスの内容', by: '入れた人'
 *      }
 *
 *  ★入れ先が日付の形（YYYY-MM-DD）ではないので、クローズの提出記録シートには
 *    出ません。Apps Script（バックエンド）を直さなくても、そのまま同期に乗ります
 *    （現金支払い管理表・会議資料と同じ手です）。
 * ---------------------------------------------------------- */
const MISS_STORE = '_miss';

/** 「ミスした人」のプルダウンで、リストに無い人を書くときの目印 */
const MISS_OTHER = '__other__';

/** その月のミスの入れ先（'2026-08' → _miss/2026-08） */
function missMonthKey(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

/* ------------------------------------------------------------
 *  年間の売上目標（税抜）
 *
 *  会議資料の円グラフは、1月からの税抜累計売上をこの金額で割って出します。
 * ---------------------------------------------------------- */
const SALES_TARGETS = {
  // ★ここは**空にしてあります**（2026-09-05）。
  //
  //   前は**6店舗の年間売上目標が金額で**書いてありました。このファイルは
  //   GitHub Pages で**誰でも読めます**。会社名も店舗名も同じ場所にあるので、
  //   **どの店舗がいくらを目指しているか**、さらに足し合わせれば
  //   **年商の目標**まで、誰にでも読める状態でした。
  //
  //   金額は**マネージの「年間の売上目標」で登録**します。
  //   登録したものは設定として同期され、**スプレッドシート側（非公開）**に入ります。
  //
  //   ★ここに書き戻さないでください。書いた瞬間に、また公開されます。
  //
  //   1つも登録が無いときは、円グラフを黙って消さずに
  //   「年間の売上目標がまだ登録されていません（マネージで登録します）」と出します
  //   （`renderMeetingGoals()`）。消えたのか、まだ入れていないのかが
  //   分からないのが一番こまるためです。
};

/**
 * おいでんテラスを除いた5店舗の合計目標
 *
 * ★数字では持ちません。5店舗の目標を足して出します。
 *   5店舗の目標を足した額と、もとの合計はぴったり一致しました（2026年9月5日に確認）。
 *   持たせると二重管理になるので、数字では持ちません。
 *   足し算にしておけば、店舗の目標を直したときに合計だけ古い、が起きません。
 */
function salesTargetFive() {
  const map = SalesTargets.all();
  return SALES_TARGET_FIVE_STORES.reduce((t, id) => t + (Number(map[id]) || 0), 0);
}

/** 5店舗の合計目標に数える店舗（おいでんテラスは2026年4月からなので入れません） */
const SALES_TARGET_FIVE_STORES = ['kojare', 'sumimaro', 'chacoru', 'baguru', 'popo'];

/* ------------------------------------------------------------
 *  交通費（配達記録）… バグる専用。別アプリ（drive/）で使います
 *
 *  デリバリーに行ったアルバイトが「お店から配達先までの距離（片道）」を
 *  入れると、往復分に直して足していきます。
 *  支払う金額は、日ごとの金額を足すのではなく
 *  「その月の合計距離」から一度だけ計算します。
 *
 *  記録の入れ先は  _drive/2026-08  のような形です。
 *  （店舗idではないので、提出記録シートには出ません）
 *
 *  1日に何回行っても大丈夫です。1回＝1件として並べて残します。
 *
 *  1件分の中身
 *    d    : 走った日（'YYYY-MM-DD'）
 *    by   : 走った人
 *    one  : 片道の距離（km）… 入力した数字そのもの
 *    km   : 往復の距離（km）… one の2倍。合計はこちらで足します
 * ---------------------------------------------------------- */
const DRIVE_STORE = '_drive';

/** この機能を使う店舗（マネージの設定ページもこの店舗にだけ出ます） */
const DRIVE_SHOP = 'baguru';

/** 交通費の単価。5km ごとに 100円 */
const DRIVE_RATE = { km: 5, yen: 100 };

/** 配達する人の初期値（マネージの「交通費」で追加・削除できます） */
const DRIVERS = [
  // ★ここは**空にしてあります**（2026-09-05）。
  //   前は15人の**フルネーム**が書いてありました。このファイルは
  //   GitHub Pages で**誰でも読めます**。
  //   名前は**マネージの「交通費 ― 配達する人」で登録**します
  //   （スプレッドシート側＝非公開に入ります）。
  //   ★ここに名前を書き戻さないでください。書いた瞬間、また公開されます。
];

/** その月の記録の入れ先（'2026-08' → _drive/2026-08） */
function driveMonthKey(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * 距離の足し算
 *
 * 0.1km 単位で入れるので、そのまま足すと
 * 12.6 + 45.8 が 58.400000000000006 のようになります。
 * 表示にも計算にも響くので、必ず小数第1位に丸めてから返します。
 */
function driveKm(...values) {
  const sum = values.reduce((t, v) => t + (Number(v) || 0), 0);
  return Math.round(sum * 10) / 10;
}

/** 片道 → 往復 */
function driveRound(oneway) {
  return driveKm((Number(oneway) || 0) * 2);
}

/**
 * 合計距離から支払う金額を出す
 *
 * 5km ごとに 100円。100円に満たない端数は切り上げます
 * （例：116.8km → 23.36 → 24 → ¥2,400）。
 * ★四捨五入に変えたい場合は Math.ceil を Math.round にしてください。
 */
function driveYen(totalKm) {
  const units = (Number(totalKm) || 0) / DRIVE_RATE.km;
  // 60 ÷ 5 が 12.000000000000002 になることがあるので、先に誤差を落とします
  const n = Math.ceil(Number(units.toFixed(6)));
  return Math.max(n, 0) * DRIVE_RATE.yen;
}

const TASKS = [
  { id: 'day',   name: 'クローズ', sub: '閉店時の確認作業',         icon: '🌙' },
  { id: 'cash',  name: 'ジャーナル', sub: '撮って読み取り、日報へ入れる', icon: '💴' },
  { id: 'train', name: '教育',     sub: 'アルバイトの教育マニュアル', icon: '🎓' },
  // 随時掃除（決まった間隔がない掃除）は、週間掃除ページの下に出します
  { id: 'week',  name: '週間掃除', sub: '2週間ごとに行う掃除リスト', icon: '🧹' },
  // シフトは現場アプリにも Mine にも、同じように出します。
  // 組むのは現場スタッフなので、どちらからでも同じことができます。
  // アルバイトが希望を出すのは、別に配る提出ページ（…/shift/）です
  { id: 'shift', name: 'シフト',   sub: '希望を集めて組む',           icon: '🗓',
      // ★出す条件はシフトの見出しの中（shiftTaskShows）で決めています。
      //   名簿は全店舗、組むのは SHIFT_STORES だけ、という分け方です
      when: (storeId) => shiftTaskShows(storeId) },
  { id: 'month', name: '月間表',   sub: '1か月の一覧',               icon: '📅', when: () => APP.showMonthView !== false },
];

/**
 * 管理者用（T3 Works Mine）で開いているか
 *
 * 現場アプリと Mine は同じ index.html から作られていて、
 * Mine の方だけ body に data-mode="mine" が付きます
 * （公開用を作る.py の make_mine が付けています）。
 */
function isMine() {
  return !!(document.body && document.body.dataset.mode === 'mine');
}

/** いま使える業務だけ（店舗によって出る・出ないが変わるものがあります） */
function taskList(storeId) {
  return TASKS.filter((t) => typeof t.when !== 'function' || t.when(storeId));
}

/** id から業務を引く */
function getTask(id) {
  return TASKS.find((t) => t.id === id) || null;
}

/* ------------------------------------------------------------
 *  6) 未提出の通知時刻（★共有版で使います。現時点では未接続★）
 *
 *  「その営業日の分を、いつ判定して通知するか」を店舗ごと・曜日ごとに指定します。
 *
 *    default … 全曜日の既定値
 *    0〜6    … 曜日ごとの上書き（0=日 1=月 2=火 3=水 4=木 5=金 6=土）
 *    null    … その曜日は通知しない
 *
 *  時刻は営業日基準。24時を超える書き方ができます。
 *    '26:00' → 翌日の 2:00 に、前日の営業分を判定
 *    '29:00' → 翌日の 5:00 に、前日の営業分を判定
 *
 *  定休日は自動で対象外になるため、ここに書く必要はありません。
 * ---------------------------------------------------------- */
const NOTIFY_TIMES = {
  kojare:   { default: '26:00' },
  sumimaro: { default: '26:00' },
  chacoru:  { default: '26:00' },
  baguru:   { default: '23:30' },
  popo:     { default: '26:00', 5: '29:00', 6: '29:00' }, // 金・土は27時閉店のため翌5時
  oiden:    { default: '25:00' },
};

/** 通知の判定を何分おきに走らせるか（設定時刻から最大この分数だけ遅れます） */
const NOTIFY_INTERVAL_MINUTES = 15;

/** その店舗・その曜日の通知時刻を取得（通知しない場合は null） */
function notifyTimeFor(storeId, dow) {
  const conf = NOTIFY_TIMES[storeId];
  if (!conf) return null;
  const v = conf[dow] !== undefined ? conf[dow] : conf.default;
  return v || null;
}

/** このファイルに書いてある初期値。管理アプリで一度も編集していない店舗で使われます */
function defaultChecklist(storeId) {
  return CHECKLIST_OVERRIDES[storeId] || CHECKLIST;
}

/** 店舗の確認項目を取得（管理アプリで変更された内容が優先されます） */
function getChecklist(storeId) {
  return typeof Checklists !== 'undefined' ? Checklists.sections(storeId) : defaultChecklist(storeId);
}

/* ------------------------------------------------------------
 *  週間掃除
 *
 *  週は「日曜はじまり・土曜おわり」です。
 *  1つの週は 'YYYY-MM-DD'（その週の日曜の日付）で表します。
 *  月をまたぐ週は、両方の月の表に同じものとして出ます
 *  （記録は1つなので、どちらでチェックしても同じです）。
 * ---------------------------------------------------------- */

/** Date を 'YYYY-MM-DD' にする */
function dateToStr(dt) {
  const p2 = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`;
}

/** その日が属する週の日曜（'YYYY-MM-DD'） */
function weekStartOf(y, m, d) {
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - dt.getDay());
  return dateToStr(dt);
}

/** 週の日曜から、その週の土曜（'YYYY-MM-DD'） */
function weekEndOf(startStr) {
  const [y, m, d] = startStr.split('-').map(Number);
  return dateToStr(new Date(y, m - 1, d + 6));
}

/** 表の見出し用。'8/2' のような短い表記 */
function weekShortLabel(startStr) {
  const [, m, d] = startStr.split('-').map(Number);
  return `${m}/${d}`;
}

/** 「8/2（日）〜8/8（土）」のような表記 */
function weekRangeLabel(startStr) {
  const e = weekEndOf(startStr);
  const [, sm, sd] = startStr.split('-').map(Number);
  const [, em, ed] = e.split('-').map(Number);
  return `${sm}/${sd}（日）〜${em}/${ed}（土）`;
}

/** このファイルに書いてある初期値。管理アプリで一度も編集していない店舗で使われます */
function defaultWeekly(storeId) {
  return WEEKLY_OVERRIDES[storeId] || WEEKLY_DEFAULT;
}

/** 店舗の週間掃除の項目を取得（管理アプリで変更された内容が優先されます） */
function getWeekly(storeId) {
  return typeof Weeklies !== 'undefined' ? Weeklies.items(storeId) : defaultWeekly(storeId);
}

/**
 * その項目が、その週の対象かどうか
 *
 * 追加した日を含む週から出て、削除した日を含む週まで残ります
 * （日別のチェックと同じで、過去の記録は当時のまま残します）。
 *
 * ★現場（ワークス・マイン）に出さないものが2つあります（2026-09-07）。
 *
 *   ・マネージで足しただけで、まだ名前を付けていない項目（`draft`）
 *   ・**消した項目のうち、その週に記録が1つも残っていないもの**
 *
 *   消した項目を残すのは「やった記録を守るため」です。だれも触っていない週には
 *   守るものがありません。押せるマスを残すと、もう無い掃除をやらせてしまいます。
 *
 *   バグるで「新しい項目」2つと「まな板漂白」が、マネージには無いのに
 *   現場の表にだけ残っていました。マネージは今までどおり全部見えます。
 */
function weeklyAppliesTo(item, startStr, storeId) {
  const endStr = weekEndOf(startStr);
  if (item.draft) return false;
  if (item.addedAt && endStr < item.addedAt) return false;
  if (item.retiredAt) {
    if (startStr >= item.retiredAt) return false;
    if (!weeklyHasRecord(storeId, item, startStr)) return false;
  }
  return true;
}

/**
 * その週に、その項目の記録が残っているか
 *
 * 「やった」だけでなく、いちど付けて消した記録（done: false）も残っていると数えます。
 * だれかが触った週は、そのまま見せたいためです。
 *
 * ★確かめられないときは true（＝今までどおり出す）を返します。
 *   見えなくする方へは倒しません。
 */
function weeklyHasRecord(storeId, item, startStr) {
  if (!storeId || typeof Store === 'undefined') return true;
  const rec = Store.getDay(storeId, weekRecKey(startStr));
  return !!(rec && rec.items && rec.items[item.id]);
}

/** 週間掃除の記録キー。日別の記録（storeId/YYYY-MM-DD）とぶつからないよう W を付けます */
function weekRecKey(startStr) {
  return `W${startStr}`;
}

/* ------------------------------------------------------------
 *  2週間の区切り（期）
 *
 *  PERIOD_ANCHOR の日曜から2週間ずつ。提出と達成率はこの単位です。
 *  期は「その期の1週目の日曜」で表します。
 * ---------------------------------------------------------- */

/** 2つの日付（'YYYY-MM-DD'）が何日離れているか */
function daysBetween(aStr, bStr) {
  const [ay, am, ad] = aStr.split('-').map(Number);
  const [by, bm, bd] = bStr.split('-').map(Number);
  return Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000);
}

/** その週が属する期の1週目（'YYYY-MM-DD'） */
function periodStartOf(weekStartStr) {
  const weeks = daysBetween(PERIOD_ANCHOR, weekStartStr) / 7;
  // 起点より前（マイナス）でも正しく区切れるよう floor を使います
  const back = ((Math.floor(weeks) % 2) + 2) % 2;
  return addDaysStr(weekStartStr, -back * 7);
}

/** その日が属する期の1週目 */
function periodOfDate(y, m, d) {
  return periodStartOf(weekStartOf(y, m, d));
}

/** 期に含まれる2つの週（日曜の日付） */
function periodWeeks(periodStart) {
  return [periodStart, addDaysStr(periodStart, 7)];
}

/** 期の最終日（2週目の土曜） */
function periodEndOf(periodStart) {
  return addDaysStr(periodStart, 13);
}

/** 'YYYY-MM-DD' に日数を足す */
function addDaysStr(str, n) {
  const [y, m, d] = str.split('-').map(Number);
  return dateToStr(new Date(y, m - 1, d + n));
}

/** 「8/9（日）〜8/22（土）」のような表記 */
function periodRangeLabel(periodStart) {
  const e = periodEndOf(periodStart);
  const [, sm, sd] = periodStart.split('-').map(Number);
  const [, em, ed] = e.split('-').map(Number);
  return `${sm}/${sd}（日）〜${em}/${ed}（土）`;
}

/** その項目は「2週間に1回」か */
function isBiweekly(item) {
  return item.every === 'biweek';
}

/** その項目の見出し（決まっていなければ「その他」） */
function weeklyGroupOf(item) {
  const g = (item.group || '').trim();
  return g || WEEKLY_GROUP_OTHER;
}

/**
 * 週間掃除の項目を見出しごとにまとめる
 *
 * 並びは WEEKLY_GROUPS の順。そこに無い見出しは後ろへ、
 * 見出しの決まっていないもの（その他）は一番最後に置きます。
 * 中身が0件の見出しは返しません。
 *
 *   戻り値 … [{ name: 'ホール', items: [...] }, ...]
 */
function groupWeekly(items) {
  const bag = new Map();
  WEEKLY_GROUPS.forEach((g) => bag.set(g, []));
  items.forEach((it) => {
    const g = weeklyGroupOf(it);
    if (!bag.has(g)) bag.set(g, []);
    bag.get(g).push(it);
  });
  // 「その他」は最後にまわす
  const other = bag.get(WEEKLY_GROUP_OTHER);
  if (other) { bag.delete(WEEKLY_GROUP_OTHER); bag.set(WEEKLY_GROUP_OTHER, other); }

  const out = [];
  bag.forEach((list, name) => { if (list.length) out.push({ name, items: list }); });
  return out;
}

/**
 * その期にやるべきことを1つずつ並べる（達成率の分母になります）
 *
 *   毎週の項目     … 1週目と2週目で1つずつ（2つ）
 *   2週に1回の項目 … 期に1つだけ。記録は1週目のところに入れます
 */
function periodSlots(storeId, periodStart) {
  const weeks = periodWeeks(periodStart);
  const out = [];
  getWeekly(storeId).forEach((item) => {
    if (isBiweekly(item)) {
      if (weeks.some((w) => weeklyAppliesTo(item, w, storeId))) {
        out.push({ item, week: periodStart, span: 2 });
      }
      return;
    }
    weeks.forEach((w) => {
      if (weeklyAppliesTo(item, w, storeId)) out.push({ item, week: w, span: 1 });
    });
  });
  return out;
}

/** その1マスが済んでいるか */
function slotDone(storeId, slot) {
  const rec = Store.getDay(storeId, weekRecKey(slot.week));
  return !!(rec.items && rec.items[slot.item.id] && rec.items[slot.item.id].done);
}

/** 期の達成状況 { total, done, rate, submittedAt, submittedBy } */
function periodStatus(storeId, periodStart) {
  const slots = periodSlots(storeId, periodStart);
  const done = slots.filter((s) => slotDone(storeId, s)).length;
  const rec = Store.getDay(storeId, weekRecKey(periodStart));
  return {
    total: slots.length,
    done,
    rate: slots.length ? Math.round((done / slots.length) * 100) : 0,
    submittedAt: rec.submittedAt || null,
    submittedBy: rec.submittedBy || '',
    staff: rec.staff || '',
  };
}


/* 定休日の判定は storage.js の Closed（管理アプリの内容を反映）が持っています */

/**
 * 休止期間の判定
 *
 *   pauses: [{ from: '2026-12-29', to: '2027-01-03' }, ...]
 *
 * 年末年始などで一時的に外したいときに使います。
 * 「やめる（retiredAt）」と違い、期間が過ぎれば自動で戻ります。
 */
function isPaused(target, dateStr) {
  const list = target && target.pauses;
  if (!Array.isArray(list) || !list.length) return false;
  return list.some((p) => p && p.from && p.to && dateStr >= p.from && dateStr <= p.to);
}

/**
 * その項目がその日の対象かどうか
 *
 *   onlyDays   … その日付だけ出す（肉の日POPの [28] など）
 *   onlyDows   … その曜日だけ出す（0=日 … 6=土）
 *   hideOnDows … その曜日は出さない
 *   addedAt / retiredAt … 管理アプリで追加・削除した日（過去の記録を守るため）
 *
 * section を渡すと、区分に付いた曜日の指定も一緒に効きます
 * （「二階（金土のみ）」のように、区分ごと曜日で出し分けるため）。
 */
function appliesTo(item, store, y, m, d, section) {
  const p2 = (n) => String(n).padStart(2, '0');
  const dateStr = `${y}-${p2(m)}-${p2(d)}`;
  const dow = new Date(y, m - 1, d).getDay();

  if (section) {
    if (section.onlyDows && !section.onlyDows.includes(dow)) return false;
    if (section.addedAt && dateStr < section.addedAt) return false;
    if (section.retiredAt && dateStr >= section.retiredAt) return false;
    if (isPaused(section, dateStr)) return false;
  }
  // 長期休みなど、期間を決めて一時的に外している項目
  if (isPaused(item, dateStr)) return false;
  // 追加した日より前にはさかのぼらせない／やめた日以降は出さない
  if (item.addedAt && dateStr < item.addedAt) return false;
  if (item.retiredAt && dateStr >= item.retiredAt) return false;
  if (item.onlyDays && !item.onlyDays.includes(d)) return false;
  if (item.onlyDows && !item.onlyDows.includes(dow)) return false;
  // その月だけ出す（暖房など季節もののため）。例）onlyMonths: [11,12,1,2,3]
  if (item.onlyMonths && !item.onlyMonths.includes(m)) return false;
  if (item.hideOnDows && item.hideOnDows.includes(dow)) return false;
  return true;
}

/** 店舗を取得（キャッチだけの行き先＝まいと なども引けます） */
function getStore(storeId) {
  return allStores().find((s) => s.id === storeId) || STORES[0];
}
