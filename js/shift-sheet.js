/* ============================================================
 *  シフト表を、A4横1枚の絵に描く
 *
 *  なぜ別のファイルにしてあるか
 *    同じ絵を2つの画面で使うためです。
 *      ・T3 Works（Mine）の「JPEGで保存」「PDFで保存」「印刷」
 *      ・アルバイトの提出ページの「画像で保存する」
 *    同じ表を2か所で別々に描くと、片方を直したときにもう片方と
 *    見た目が食い違います。描くところは1つにしてあります。
 *
 *  使い方
 *    渡すのは「モデル」だけです（どこからデータを持ってくるかは、
 *    呼ぶ側それぞれの都合にまかせます）。
 *      { title, slots:[…], blocks: [ { head:[…], rows:[…], memo:[…] } ] }
 *    drawShiftSheet(canvas, model) で canvas に描きます。
 * ============================================================ */

/**
 * この表の枠（立ち上げ・ランチ・ディナー…）
 *
 * ★店舗ごとに枠が違うので、**呼ぶ側がモデルに入れて渡します**。
 *   この絵を描くところは店舗を知りません（提出ページからも呼ばれ、
 *   そちらは Store を持たないためです）。
 *   入っていなければ、行の数から数えます（古い呼び方への備えです）。
 */
function sheetSlots(model) {
  if (model && Array.isArray(model.slots) && model.slots.length) return model.slots;
  const rows = (model && model.blocks && model.blocks[0] && model.blocks[0].rows) || [];
  return rows.map((r, i) => ({ id: i === 0 ? 'open' : `row${i}`, name: r.label || '' }));
}

/**
 * 名前1人分の幅を、実際の字で測ります（名前の大きさの何倍か）
 *
 * ★はじめは文字数から見当をつけていましたが、数字や漢字が思ったより広く、
 *   F の人だけマスからはみ出していました。字の形で測れば食い違いません。
 *   測れないときは、config.js の数え方（shiftNameEm）に戻します。
 */
const shiftMeasureText = (() => {
  let cx = null;
  return (text, family, size, bold) => {
    if (!text) return 0;
    if (!cx) {
      const c = document.createElement('canvas');
      cx = c && c.getContext ? c.getContext('2d') : null;
    }
    if (!cx) return 0;
    cx.font = `${bold ? '700 ' : ''}${size}px ${family}`;
    return cx.measureText(text).width;
  };
})();

function shiftNameEmAt(parts, family) {
  const R = 100;
  const name = shiftMeasureText(parts.name, family, R, false);
  if (!name) return shiftNameEm(parts);
  // F の印は太字で、名前の0.8倍の大きさで出します
  const full = parts.full ? shiftMeasureText(' F', family, R, true) * 0.8 : 0;
  const time = parts.time ? shiftMeasureText(parts.time, family, R, false) : 0;
  // 時刻は名前の上の段なので、広い方の段で決まります
  return Math.max(name + full, time * SHIFT_TIME_SCALE) / R;
}

/** 絵（JPEG・PDF）で、一番幅のいる1人分 */
function shiftCanvasEm(model, family) {
  let em = 0;
  model.blocks.forEach((b) => b.rows.forEach((r) => r.cells.forEach((c) => {
    c.names.forEach((n) => { em = Math.max(em, shiftNameEmAt(n.parts, family)); });
  })));
  return em;
}

/** 1人分のかたまり（時刻＋名前）。表を組むときと、幅を測るときで同じ形にします */
function shiftNameSpan(n) {
  const one = document.createElement('span');
  one.className = 'shift-sheet__name'
    + (n.full ? ' is-full' : '') + (n.early ? ' is-early' : '');
  if (n.parts.time) {
    const t = document.createElement('i');
    t.className = 'shift-sheet__at';
    t.textContent = n.parts.time;
    one.appendChild(t);
  }
  const who = document.createElement('b');
  who.className = 'shift-sheet__who';
  who.textContent = n.parts.name;
  one.appendChild(who);
  return one;
}

/**
 * 紙で、一番幅のいる1人分（名前の大きさの何倍か）
 *
 * ★字の形から計算するのではなく、見えないところに本物と同じ形で並べて測ります。
 *   計算だと「F」の印やすき間の分が合わず、その人だけはみ出していました。
 *   .shift-sheet-measure は、紙とおなじ組み方になるようにしてあります。
 */
function shiftPrintEm(model) {
  const box = document.createElement('div');
  box.className = 'shift-sheet-measure';
  const spans = [];
  const seen = {};
  model.blocks.forEach((b) => b.rows.forEach((r) => r.cells.forEach((c) => {
    c.names.forEach((n) => {
      const key = n.text + (n.full ? '|F' : '');
      if (seen[key]) return;
      seen[key] = true;
      const line = document.createElement('div');
      const span = shiftNameSpan(n);
      line.appendChild(span);
      box.appendChild(line);
      spans.push(span);
    });
  })));
  if (!spans.length) return 0;
  // ★body に置きます。表の中に置くと、まだ隠れているモーダルの中なので
  //   幅が全部0で返ってきます（前にそれで名前が大きくなりすぎました）
  box.style.fontFamily = getComputedStyle(document.body).fontFamily;
  document.body.appendChild(box);
  let w = 0;
  spans.forEach((sp) => { w = Math.max(w, sp.getBoundingClientRect().width); });
  box.remove();
  // 測るときの大きさは css で 100px にしてあります
  return w / 100;
}

/**
 * 印刷したときに、名前が1行で収まる文字の大きさ（ポイント）
 *
 * ★A4横の紙の幅は297mm。左右の余白3mmずつと、枠名の列7mmを引いた残りを、
 *   日数×2（キッチンとホール）で割ったのが1マスの幅です。
 *   1段8日だと17.8mmしかないので、一番長い名前に合わせて小さくします。
 */
/**
 * その表で、一番人が入っているマスの人数（枠ごと）
 *
 * ★足りない印の赤いあきも、1人分の場所を取るので数に入れます。
 */
function shiftSlotNeed(model) {
  return sheetSlots(model).map((slot, si) => {
    let n = 0;
    model.blocks.forEach((b) => {
      const row = b.rows[si];
      if (row) row.cells.forEach((c) => { n = Math.max(n, c.names.length + c.short); });
    });
    return n;
  });
}

/**
 * 紙（パソコンの印刷）で、1人分の高さが名前の大きさの何倍か
 *
 * ★時刻の段（1.0）＋名前の段（1.1）＝2.1。**人と人のあいだの空きは、紙にはありません。**
 *   前は 2.45（空き .35 を足した数）で数えていましたが、紙の実物は 2.1 でした（css/style.css の紙の指定が、
 *   空きを0にしています。PDF にして測ると 2.07〜2.08）。多めに数えていた分だけ、人数の多いマスの字が
 *   入るはずの大きさより小さく、「入らない」と早く決めていました（2026-10-09 に合わせました）。
 * ★この数は、紙の組み方と**必ず同じ**にします。組み方は js/app.js の shiftExtraStyle が、紙のときだけ
 *   「時刻の段の行送り1・名前の段の行送り1.1・下の空き0」と決め直しています（css/style.css が変わっても、ここは動きません）。
 * ★絵（iPhone・iPad の PDF／JPEG）は別の数え方です（drawShiftSheet の中。空きを描くので 2.45）。
 */
const SHIFT_ROW_EM = SHIFT_TIME_SCALE * 1.0 + 1.1;

/**
 * 紙で、名前の行（立ち上げ・ランチなど）の一番低い高さ（ミリ）
 *
 * ★行は、左の縦書きの枠名より低くできません（枠名は 6pt。「立ち上げ」「ディナー」の4文字で約10mm）。
 *   これより低く決めても、紙では枠名の高さまで伸びて、その分だけ表が長くなります
 *   （PDF にして測ると、9mm と決めた立ち上げの行が 9.4mm ほどで出ていました）。
 */
const SHIFT_ROW_MIN_MM = 9;
function shiftRowMinMm(label) {
  return Math.max(SHIFT_ROW_MIN_MM, String(label || '').length * (6 / 2.8346) + 1.6);
}

/**
 * 紙のメモ：1行分の高さと、メモの行の一番低い高さ（ミリ）
 * ★字は 6pt・行送り 1.3（css/style.css の紙の指定と同じ。shiftExtraStyle でも同じ数に決め直しています）
 */
const SHIFT_MEMO_PT = 6;
const SHIFT_MEMO_LINE_MM = (SHIFT_MEMO_PT * 1.3) / 2.8346;
const SHIFT_MEMO_MIN_MM = 5.5;

/**
 * 紙で、そのメモが何行になるか（**多めに**数えます）
 *
 * ★メモは長いと折り返して、行が増えます。その分だけ表が下へ伸びるので、前は
 *   長いメモが1つあるだけで、紙が2枚に分かれていました（2026-10-09、ko-dai さん
 *   「印刷時にはpopoは1週間で1枚、それ以外は2週間で1枚のシフト表に収まるように」）。
 *   行の数を先に数えて、その分を名前の行から引きます。
 * ★少なく数えると紙からはみ出すので、幅は 0.93 倍に見て、半角の字は 0.62 文字分と数えます
 *   （多く数えた分は、メモの下に少し空きができるだけです）。
 */
function shiftMemoLines(text, widthMm) {
  const t = String(text || '');
  if (!t) return 1;
  let n = 0;
  for (const ch of t) n += /[\u0020-\u007e\uff61-\uff9f]/.test(ch) ? 0.62 : 1;
  const perLine = Math.max(1, (widthMm / (SHIFT_MEMO_PT / 2.8346)) * 0.93);
  return Math.max(1, Math.ceil(n / perLine));
}

/** 紙で、その段のメモの行の高さ（ミリ）。その段で一番長いメモに合わせます */
function shiftMemoMm(block, perDay) {
  // 1日分の幅（キッチン＋ホール）から、内よ白とけい線の分（約1mm）を引いたものが、メモの字の入る幅です
  const dayMm = (297 - 3 * 2 - SHIFT_SHEET_LABEL_MM) / perDay - 1.0;
  let lines = 1;
  (block.memo || []).forEach((m) => { lines = Math.max(lines, shiftMemoLines(m, dayMm)); });
  return Math.max(SHIFT_MEMO_MIN_MM, lines * SHIFT_MEMO_LINE_MM + 1.1);
}

/** 1人分の高さ（ミリ）。名前の大きさ（ポイント）から出します */
function shiftPersonMm(pt) {
  return (pt * SHIFT_ROW_EM) / 2.8346;
}

/**
 * そのマスの名前の大きさ
 *
 * ★人がたくさん入っているマスだけ、そのマスの中で小さくします。
 *   前は「一番多いマス」に表全部を合わせていたので、
 *   7人入る日が1つあるだけで、他の日まで小さくなっていました。
 */
/**
 * 1マスの中で小さくするときの、一番小さい字（ポイント）
 * ★普段は 4.5pt より小さくしません。それでも紙に入りきらない半月だけ、3pt まで下げます
 *   （shiftSheetMetrics が minPt で渡します。紙を2枚に分けないためです）
 */
const SHIFT_CELL_PT_MIN = 4.5;
const SHIFT_CELL_PT_FLOOR = 3;

function shiftCellPt(pt, count, roomMm, minPt) {
  if (count <= 0) return pt;
  const fit = ((roomMm - 1.4) / count) * 2.8346 / SHIFT_ROW_EM;
  return Math.max(minPt > 0 ? minPt : SHIFT_CELL_PT_MIN, Math.min(pt, fit));
}

/**
 * 印刷したときの、名前の大きさ（ポイント）と行の高さ（ミリ）
 *
 * ★A4横1枚に必ず収めるため、使える高さから逆算します。
 *   ランチとディナーは**同じ高さ**にします（どちらにも同じ人数を
 *   入れられるように。前はディナーだけ背が高くなっていました）。
 */
function shiftSheetMetrics(model, perDay) {
  // 1マスの、字が入るところの幅（ミリ）。紙297mm − 余白3mm×2 − 枠名の列。
  // 1.05mm 引いているのは、マスの内よ白（0.3mm×2）とけい線（1px）の分です
  const cellMm = (297 - 3 * 2 - SHIFT_SHEET_LABEL_MM) / (perDay * SHIFT_LANES.length) - 1.05;

  // ★使える高さ。A4横204mmのうち196mmまでにして、8mm を念のために残します
  //   （メモの行の数は多めに数えていますが、端末や字の形で少し変わるためです）。
  //   ★この 8mm が**本当に残る**ように、紙のときだけ、画面用の下の空き（body の16px）と、最後の表の下の空き（3mm）を
  //     0にしています（js/app.js の shiftExtraStyle）。前はこの2つが 8mm のうち約7mmを使っていて、
  //     残りは こじゃれ で約3mm・popo の2枚目で約1mm しかありませんでした（PDF にして、行を少しずつ高くして測りました）
  // ★メモの行は、**その段で一番長いメモの行の数**だけ取ります（shiftMemoMm）。
  //   前は1行分（5.5mm）と決めていたので、長いメモがあると表が下へ伸びて、紙が2枚に分かれていました
  const blocks = model.blocks.length || 1;
  const memoMm = model.blocks.map((b) => shiftMemoMm(b, perDay));
  const fixed = memoMm.reduce((a, m) => a + 6.5 + 4 + m, 0);   // 日付・持ち場・メモ（段ごとに足します）
  const rowsMm = Math.max(30, (196 - 8.5 - 3 * blocks - fixed) / blocks);

  const need = shiftSlotNeed(model);
  const openNeed = Math.max(1, need[0] || 0);
  // ★ラストの行（popo だけ。js/config.js の「ラスト」の節）。立ち上げと同じく、入っている人数分だけ取ります
  const lastAt = sheetSlots(model).findIndex((sl) => sl.id === 'last');
  // ランチとディナーは、多い方に合わせてそろえます（ラストは数えません）
  const share = Math.max(3, ...need.filter((_, i) => i > 0 && i !== lastAt).map((n) => n || 0));
  // ★名前の大きさは「マスの幅」だけで決めます。高さでは減らしません。
  //   高さが足りないマスは、そのマスの中だけ小さくします（shiftCellPt）。
  const em = shiftPrintEm(model);
  // 1mm = 2.8346ポイント。0.97 は念のための余裕（けい線の太さと端末の丸め）
  // 大きくても12pt。マスの幅がゆるすかぎり大きくします
  const pt = Math.max(5, Math.floor(
    (em > 0 ? Math.min(12, (cellMm * 2.8346 / em) * 0.97) : 12) * 10,
  ) / 10);

  // 立ち上げの行は「入っている人数分」だけ取り、残りをランチとディナーで
  // 半分ずつ分けます（この2つは必ず同じ高さです）
  // ★どの行も、左の縦書きの枠名より低くはしません（shiftRowMinMm）
  const 枠 = sheetSlots(model);
  const 低さ = (i) => shiftRowMinMm((枠[i] || {}).name);
  const openMin = 低さ(0);
  const lastMin = lastAt >= 0 ? 低さ(lastAt) : 0;
  const slotMin = Math.max(SHIFT_ROW_MIN_MM, ...枠.map((_, i) => (i > 0 && i !== lastAt ? 低さ(i) : 0)));
  let openMm = Math.min(rowsMm * 0.3, Math.max(openMin, openNeed * shiftPersonMm(pt) + 1.4));
  // ★ラストの行があれば、その分を先に引きます。残りをランチとディナーで半分ずつ（今までと同じ分け方）
  const lastNeed = lastAt >= 0 ? Math.max(1, need[lastAt] || 0) : 0;
  let lastMm = lastAt >= 0
    ? Math.min(rowsMm * 0.25, Math.max(lastMin, lastNeed * shiftPersonMm(pt) + 1.4)) : 0;
  // ★残りは「枠の行の数」で分けます（立ち上げとラストを除いた行。バグる・popo は ランチ・ディナーの2つ、
  //   仕込み／営業の4店舗は 営業の1つ）。前はいつも2で割っていたので、4店舗では営業の行が残りの半分しか使わず、
  //   紙の下3分の1が空いたままでした（ko-dai さん「こじゃれは画面上部に偏っています」）。
  //   空いていた分を営業の行に回すので、人数の多い週末も字を小さくせずに済みます
  const 枠の行 = Math.max(1, sheetSlots(model).filter((sl, i) => i > 0 && i !== lastAt).length);
  let slotMm = (rowsMm - openMm - lastMm) / 枠の行;

  // ★ここまでの配り方で、**一番小さい字（4.5pt）でも入りきらない行があるときだけ**、配り直します
  //   （2026-10-09、ko-dai さん「印刷時にはpopoは1週間で1枚、それ以外は2週間で1枚のシフト表に収まるように」）。
  //   そのままだと、入りきらない行が下へ伸びて、紙が次の1枚へこぼれます（popo は、ランチかディナーの1マスに
  //   6人入ると3枚になっていました）。
  //   配り直すときは、**どの行も同じ大きさの字で入るように、人数の割合で**高さを分けます
  //   （絵の方 drawShiftSheet と同じ考え方。立ち上げだけ大きい字のまま・他は入らない、をやめます）。
  //   それでも 4.5pt で入らない半月は、字をもう少し小さくします（minPt。3pt まで）。
  //   ★普段の人数（どの行も 4.5pt 以上で入る）では、ここは通りません。配り方は上のままです
  const slotNeed = Math.max(1, ...need.filter((_, i) => i > 0 && i !== lastAt).map((n) => n || 0));
  const 要る = (n, 字, 低) => Math.max(低, n * shiftPersonMm(字) + 1.4);
  let minPt = SHIFT_CELL_PT_MIN;
  const 入る = openMm + 0.05 >= 要る(openNeed, minPt, openMin) && slotMm + 0.05 >= 要る(slotNeed, minPt, slotMin)
    && (lastAt < 0 || lastMm + 0.05 >= 要る(lastNeed, minPt, lastMin));
  if (!入る) {
    const 行 = [{ n: openNeed, 数: 1, 低: openMin }, { n: slotNeed, 数: 枠の行, 低: slotMin }]
      .concat(lastAt >= 0 ? [{ n: lastNeed, 数: 1, 低: lastMin }] : []);
    // 1人分の高さ p（ミリ）を、「どの行も 人数×p で入る」一番大きい数にします。
    // 行には低さの限り（枠名の高さ）があるので、式では解かずに、はさんで探します
    const 合計 = (p) => 行.reduce((a, r) => a + r.数 * Math.max(r.低, r.n * p + 1.4), 0);
    let lo = 0;
    let hi = shiftPersonMm(pt);
    for (let k = 0; k < 40; k += 1) {
      const mid = (lo + hi) / 2;
      if (合計(mid) <= rowsMm) lo = mid; else hi = mid;
    }
    const p = lo;
    openMm = Math.max(openMin, openNeed * p + 1.4);
    lastMm = lastAt >= 0 ? Math.max(lastMin, lastNeed * p + 1.4) : 0;
    // 残りは全部、枠の行へ（紙の高さを使い切ります）
    slotMm = Math.max(slotMin, (rowsMm - openMm - lastMm) / 枠の行);
    const 字 = Math.floor((p * 2.8346 / SHIFT_ROW_EM) * 10) / 10;
    minPt = Math.max(SHIFT_CELL_PT_FLOOR, Math.min(SHIFT_CELL_PT_MIN, 字));
  }

  return {
    pt,
    // その半月で一番多いマスの人数（何人まで入るかの目安に使います）
    share,
    openMm: Math.round(openMm * 10) / 10,
    slotMm: Math.round(slotMm * 10) / 10,
    lastMm: Math.round(lastMm * 10) / 10,
    // 段ごとのメモの行の高さ（ミリ）と、マスの中で小さくするときの一番小さい字
    memoMm: memoMm.map((m) => Math.round(m * 10) / 10),
    minPt,
  };
}

/* -------- 画像にする --------
 *
 *  同じ中身を、A4の横向きに合わせた大きさで描きます。
 *  画面のHTMLを写し取るのではなく、数字から描き直しています。
 *  その方が、端末や字の設定で崩れません。
 */
const SHEET_PX = { w: 1754, h: 1240 };   // A4横 150dpi（組み立てるときの目盛り）
/**
 * 実際に描くときの倍率
 *
 * ★1倍（150dpi）だと、iPhone から刷ったときに字がぼやけていました。
 *   組み立ての数はそのままに、描くときだけ倍にします（＝300dpi）。
 */
const SHEET_SCALE = 2;

/**
 * その端末で、倍の細かさの絵が作れるか
 *
 * ★古い端末には「これ以上大きい絵は作れない」という上限があり、
 *   こえるとまっ白なまま返ってきます（何も言わずに失敗します）。
 *   すみに1点だけ描いて、読み返せるかで確かめます。1度だけ調べます。
 */
let bigSheetOk = null;
function canDrawBigSheet() {
  if (bigSheetOk !== null) return bigSheetOk;
  bigSheetOk = false;
  try {
    const c = document.createElement('canvas');
    c.width = SHEET_PX.w * SHEET_SCALE;
    c.height = SHEET_PX.h * SHEET_SCALE;
    const cx = c.getContext('2d');
    if (cx) {
      cx.fillStyle = '#123456';
      cx.fillRect(c.width - 2, c.height - 2, 2, 2);
      const d = cx.getImageData(c.width - 1, c.height - 1, 1, 1).data;
      bigSheetOk = d[0] === 0x12 && d[1] === 0x34 && d[2] === 0x56;
    }
  } catch (e) {
    bigSheetOk = false;
  }
  return bigSheetOk;
}
const SHEET_FONT = '-apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif';
/** 縦書きのときに、90度まわして書く字（のばす棒やかっこ） */
const VERT_TURN = 'ー－‐−–—〜~（）()［］[]｛｝{}「」『』〔〕【】＜＞<>';

function drawShiftSheet(canvas, model, scale) {
  const cx = canvas.getContext('2d');
  const W = SHEET_PX.w;
  const H = SHEET_PX.h;
  const S = scale || (canDrawBigSheet() ? SHEET_SCALE : 1);
  canvas.width = W * S;
  canvas.height = H * S;
  // ここから先は 1754×1240 の目盛りのまま書けます
  cx.setTransform(S, 0, 0, S, 0, 0);

  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, W, H);
  cx.textBaseline = 'middle';
  const font = (size, bold) => `${bold ? '700 ' : ''}${size}px ${SHEET_FONT}`;

  // ★紙のふちぎりぎりまで使います。印刷に出ない程度の余白だけ残します
  const pad = 14;
  // 列の幅は「一番多い日数」で決めます。後ろの段が少なくても、
  // 前と同じ幅にそろえた方が、続きの表として読めるからです
  const perDay = model.blocks.reduce((n, b) => Math.max(n, b.head.length), 1);
  const cols = perDay * SHIFT_LANES.length;
  // 左の枠名は、紙と同じく縦書きにします。1文字分の幅で足りるので、
  // その分日付の列を広くできます
  const labelW = 28;
  const gridW = W - pad * 2 - labelW;
  const colW = gridW / cols;
  // 名前が1行に収まる大きさ。紙と同じ考え方です（shiftSheetNamePt）
  const nameEm = shiftCanvasEm(model, SHEET_FONT);
  const nameSize = Math.max(10, Math.min(21, nameEm ? ((colW - 12) / nameEm) * 0.98 : 21));
  // 1人分の高さ（時刻の段＋名前の段＋すきま）。紙と同じ配分です
  const person = (size) => size * (1.0 + 1.1 + 0.35);
  const lh = Math.round(person(nameSize));

  const center = (text, x, w, yy, size, bold, color) => {
    cx.fillStyle = color || '#111418';
    cx.font = font(size, bold);
    cx.textAlign = 'center';
    cx.fillText(text, x + w / 2, yy, w - 6);
    cx.textAlign = 'left';
  };
  /**
   * 1人分（時刻の段＋名前の段）
   *
   * ★1行に並べると名前が小さくなりすぎるので、時刻を上の段に小さく置きます。
   *   その分名前を大きくできて、どの時刻が誰のものかも上下で分かります。
   * ★左よせ。名前の長さがそろっていないので、真ん中ぞろえだと
   *   1日ごとに出だしがずれて、表がガタガタに見えます。
   */
  const drawName = (parts, x, w, top, size) => {
    const tx = x + 7;
    const room = w - 12;
    cx.textAlign = 'left';
    let base = top + size * 0.7;
    // 時刻は名前の上の段に、同じ大きさで（色だけうすく）
    if (parts.time) {
      cx.fillStyle = '#5b6169';
      cx.font = font(size, false);
      cx.fillText(parts.time, tx, top + size * 0.7, room);
      base = top + size * 1.0 + size * 0.6;
    }
    cx.fillStyle = '#111418';
    cx.font = font(size, false);
    cx.fillText(parts.name, tx, base, x + w - 5 - tx);
    // F（通し）の印。塗りだけでなく字でも分かるようにします（紙の表と同じ）
    if (parts.full) {
      const nw = cx.measureText(parts.name).width;
      // ★灰色の塗りの上に出るので、薄いと読めません。濃い色で書きます
      cx.fillStyle = '#111418';
      cx.font = font(size * 0.8, true);
      cx.fillText(' F', tx + nw, base);
    }
  };
  // 縦書き。紙の枠名（立ち上げ・ランチ・ディナー）と同じ形にします
  const centerV = (text, x, w, top, h, size, bold, color) => {
    const chars = String(text).split('');
    // ★行が低いときは小さくします。そのまま書くと下が切れます
    let s = size;
    let step = s + 2;
    const room = h - 4;
    if (chars.length * step > room) {
      step = Math.max(7, room / chars.length);
      s = Math.max(7, step - 2);
    }
    cx.fillStyle = color || '#111418';
    cx.font = font(s, bold);
    cx.textAlign = 'center';
    let yy = top + h / 2 - ((chars.length - 1) * step) / 2;
    chars.forEach((ch) => {
      // ★のばす棒やかっこは、縦書きでは向きが変わります。
      //   そのまま書くと「ディナー」の棒だけ横になってしまいます
      if (VERT_TURN.indexOf(ch) >= 0) {
        cx.save();
        cx.translate(x + w / 2, yy);
        cx.rotate(Math.PI / 2);
        cx.fillText(ch, 0, 0);
        cx.restore();
      } else {
        cx.fillText(ch, x + w / 2, yy);
      }
      yy += step;
    });
    cx.textAlign = 'left';
  };
  const line = (x1, y1, x2, y2, strong) => {
    cx.strokeStyle = strong ? '#8a9099' : '#c8ccd2';
    cx.lineWidth = strong ? 1.6 : 1;
    cx.beginPath();
    cx.moveTo(x1, y1);
    cx.lineTo(x2, y2);
    cx.stroke();
  };

  // 見出し
  center(model.title, 0, W, pad + 15, 28, true, '#111418');

  let y = pad + 34;
  const gapBlocks = 12;
  const dateH = 34;
  const laneH = 22;
  // ★メモは、マスの幅で折り返して**全文**出します（2026-10-09。前は1行に押しこんでいたので、長いメモは
  //   字が横につぶれて読めませんでした）。段ごとに、一番長いメモの行の数だけ高さを取ります
  const memoSize = 13;
  const memoLh = 17;
  const memoWrap = (text, w) => {
    cx.font = font(memoSize, false);
    const out = [];
    let cur = '';
    for (const ch of String(text || '')) {
      // ★行の頭に「。」「、」やかっこの閉じが来ないようにします（その字は、前の行の終わりに付けます）
      const 頭に置けない = '、。，．・：；！？）」』】〕｝〉》,.!?)]}'.indexOf(ch) >= 0;
      if (cur && !頭に置けない && cx.measureText(cur + ch).width > w) { out.push(cur); cur = ch; } else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  };
  const memoLines = model.blocks.map((b) => b.head.map((d, i) => (d.closed ? [] : memoWrap((b.memo || [])[i], colW * SHIFT_LANES.length - 12))));
  const memoHs = memoLines.map((days) => Math.max(28, Math.max(0, ...days.map((ls) => ls.length)) * memoLh + 10));
  // 残りの高さを、枠の行に等しく配ります
  const blocks = model.blocks.length || 1;
  const fixed = (dateH + laneH) * blocks + memoHs.reduce((a, h) => a + h, 0) + gapBlocks * (blocks - 1);
  // ★元のスプレッドシートと同じ配分です。立ち上げは1人、
  //   ランチとディナーは3人分入る高さにします。
  //   それより多く入っている日（足りない人数の赤いあきも数に入れます）は、
  //   その日に合わせて広げます（そうしないと下が切れます）
  const need = shiftSlotNeed(model);
  // ★ランチとディナーは、多い方に合わせて同じ高さにします
  //   （どちらにも同じ人数を入れられるように）
  // ★ラストの行（popo だけ）は、立ち上げと同じく「入っている人数分」です。そろえる数にも入れません
  const lastAt = sheetSlots(model).findIndex((sl) => sl.id === 'last');
  const share = Math.max(3, ...need.filter((_, i) => i > 0 && i !== lastAt).map((n) => n || 0));
  const weight = sheetSlots(model).map((slot, si) => (slot.id === 'open' || slot.id === 'last'
    // 立ち上げは1人分で足りますが、低すぎると縦書きの枠名が入らないので
    // 少しだけ多めに取ります（ラストは3文字なので、もう少し）
    ? Math.max(need[si] || 0, slot.id === 'last' ? 2 : 1.6)
    : share));
  const unit = weight.reduce((a, b) => a + b, 0);
  // ★行に配る高さは、**紙に残っている高さまで**です。前は「人数×1人分」の方が大きいとそちらを使っていたので、
  //   1マスに16人ほど入る半月では表が紙より長くなり、**下の段が切れて、人とメモが絵から消えていました**
  //   （何も言わずに欠けます）。入りきらない分は、下でマスごとに字を小さくして収めます
  const room = Math.max(0, H - y - pad - fixed);
  const slotH = sheetSlots(model).map((slot, i) => (room / blocks) * (weight[i] / unit));

  model.blocks.forEach((block, bi) => {
    const top = y;
    const x0 = pad + labelW;
    const memoH = memoHs[bi];   // この段のメモの行の高さ

    // 日付
    block.head.forEach((d, i) => {
      const x = x0 + colW * SHIFT_LANES.length * i;
      const w = colW * SHIFT_LANES.length;
      cx.fillStyle = '#f2f4f6';
      cx.fillRect(x, y, w, dateH);
      const color = d.sun ? '#c0392b' : d.sat ? '#33509a' : '#111418';
      center(`${d.label}${d.dow}`, x, w, y + dateH / 2, 19, true, color);
    });
    cx.fillStyle = '#f2f4f6';
    cx.fillRect(pad, y, labelW, dateH + laneH);
    y += dateH;

    // 持ち場
    block.head.forEach((d, i) => {
      SHIFT_LANES.forEach((lane, li) => {
        const x = x0 + colW * (SHIFT_LANES.length * i + li);
        cx.fillStyle = '#f8f9fa';
        cx.fillRect(x, y, colW, laneH);
        center(lane.name, x, colW, y + laneH / 2, 13, true, '#3d434b');
      });
    });
    y += laneH;

    // 枠ごとの行
    block.rows.forEach((row, ri) => {
      const rowH = slotH[ri];
      cx.fillStyle = '#fafbfc';
      cx.fillRect(pad, y, labelW, rowH);
      centerV(row.label, pad, labelW, y, rowH, 13, true, '#3d434b');

      let i = 0;
      block.head.forEach((d, di) => {
        if (d.closed) {
          i += SHIFT_LANES.length;
          return;
        }
        SHIFT_LANES.forEach((lane, li) => {
          const cell = row.cells[i];
          i += 1;
          const x = x0 + colW * (SHIFT_LANES.length * di + li);
          // パティの枠は、キッチンとホールをまたいで1つの四角で囲みます
          // （持ち場ごとに描くと、あいだに縦線が入ってしまいます）
          if (cell.patty && li === 0) {
            const w2 = colW * SHIFT_LANES.length;
            cx.strokeStyle = '#bf5480';
            cx.lineWidth = 2.5;
            cx.strokeRect(x + 1.5, y + 1.5, w2 - 3, rowH - 3);
          }
          // ★人がたくさん入っているマスだけ、そのマスの中で小さくします
          const count = cell.names.length + cell.short;
          const fit = count > 0 ? (rowH - 6) / count : lh;
          const cellSize = fit < lh ? Math.max(7, nameSize * (fit / lh)) : nameSize;
          const cellLh = fit < lh ? fit : lh;
          cell.names.forEach((n, ni) => {
            const top = y + 3 + ni * cellLh;
            if (top + cellLh > y + rowH + 1) return;   // 入りきらない分は出しません
            // ★塗りもふちも、マスの幅いっぱいに引きます。字のまわりだけだと
            //   橙のふちが時刻の数字にかぶります（紙の表と同じ考え方です）
            if (n.full) {
              cx.fillStyle = '#dcdfe3';
              cx.fillRect(x + 1, top, colW - 2, cellLh - 4);
            }
            // 早上がりは橙のふち。塗りの上から描くので、通しでも分かります
            if (n.early) {
              cx.strokeStyle = '#d98324';
              cx.lineWidth = 2;
              cx.strokeRect(x + 2, top + 1, colW - 4, cellLh - 6);
            }
            drawName(n.parts, x, colW, top + 2, cellSize);
          });
          // 足りない人数の分だけ、名前の下に赤いあきを描きます
          for (let k = 0; k < cell.short; k += 1) {
            const top = y + 3 + (cell.names.length + k) * cellLh;
            if (top + cellLh > y + rowH + 1) break;
            cx.fillStyle = '#f2c4c4';
            cx.fillRect(x + 1, top, colW - 2, cellLh - 4);
          }
        });
      });
      y += rowH;
    });

    // 定休日は、枠の行をまとめて塗ります
    block.head.forEach((d, i) => {
      if (!d.closed) return;
      const x = x0 + colW * SHIFT_LANES.length * i;
      const w = colW * SHIFT_LANES.length;
      const cy = top + dateH + laneH;
      const ch = slotH.reduce((a, b) => a + b, 0);
      cx.fillStyle = '#eceef1';
      cx.fillRect(x, cy, w, ch);
      center('定休日', x, w, cy + ch / 2, 17, false, '#6b7280');
    });

    // 連絡
    cx.fillStyle = '#fafbfc';
    cx.fillRect(pad, y, labelW, memoH);
    center('メモ', pad, labelW, y + memoH / 2, 13, true, '#3d434b');
    block.head.forEach((d, i) => {
      const x = x0 + colW * SHIFT_LANES.length * i;
      const w = colW * SHIFT_LANES.length;
      if (d.closed) {
        cx.fillStyle = '#eceef1';
        cx.fillRect(x, y, w, memoH);
        return;
      }
      const ls = memoLines[bi][i];
      ls.forEach((t, li) => center(t, x, w, y + memoH / 2 + (li - (ls.length - 1) / 2) * memoLh, memoSize, false, '#3d434b'));
    });
    y += memoH;

    // けい線。★その かたまり に入っている日数分だけ引きます
    //   （後半が7日のとき、8日目の空っぽの列を出さないため）
    const used = block.head.length * SHIFT_LANES.length;
    const right = x0 + colW * used;
    const bottom = y;
    for (let c = 0; c <= used; c += 1) {
      const x = x0 + colW * c;
      if (c % SHIFT_LANES.length === 0) {
        // 日と日のあいだ。上から下までまっすぐ引きます
        line(x, top, x, bottom, true);
      } else {
        // ★キッチンとホールのあいだ。日付の見出しとメモの行には引きません
        //   （どちらも2つの持ち場をまとめた1つのマスなので）。
        //   定休日の日も、まとめて1つのマスなので引きません
        const di = Math.floor(c / SHIFT_LANES.length);
        if (block.head[di] && block.head[di].closed) continue;
        line(x, top + dateH, x, bottom - memoH, false);
      }
    }
    line(pad, top, pad, bottom, true);
    let ry = top;
    [dateH, laneH].forEach((h) => { line(pad, ry, right, ry, true); ry += h; });
    line(pad, ry, right, ry, true);
    block.rows.forEach((_, ri) => { ry += slotH[ri]; line(pad, ry, right, ry, false); });
    ry += memoH;
    line(pad, ry, right, ry, true);

    y += gapBlocks;
  });

  return canvas;
}


/**
 * JPEG 1枚だけを入れた、1ページのPDFを作る
 *
 *  外の道具を使わずに書いています。PDFは「番号を振ったかたまり」を並べ、
 *  最後にそれぞれが何バイト目から始まるかの表（xref）を付ける形なので、
 *  作りながら位置を数えていけば、これだけで作れます。
 *  用紙はA4の横（842×595ポイント）です。
 */
function makePdf(jpegs, w, h) {
  // ★1枚だけ渡されたときも、これまでどおり動くようにします
  const 紙 = Array.isArray(jpegs) ? jpegs : [jpegs];

  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let len = 0;
  const put = (bytes) => { parts.push(bytes); len += bytes.length; };
  const putText = (t) => put(enc.encode(t));
  const mark = () => { offsets.push(len); };

  const PW = 842, PH = 595;   // A4横（ポイント）
  // ★紙のふちまで使うと、プリンタが刷れないところにかかって
  //   右と下が切れます。18ポイント（約6.4mm）あけます
  const M = 18;
  // 残りいっぱいに、縦横の比を保って入れます
  const scale = Math.min((PW - M * 2) / w, (PH - M * 2) / h);
  const dw = w * scale;
  const dh = h * scale;
  const dx = (PW - dw) / 2;
  const dy = (PH - dh) / 2;

  // 番号の割り当て。1=目次、2=ページの束、そのあと1枚につき3つずつ使います
  //   3+i*3 … ページ  4+i*3 … 絵  5+i*3 … 置き方
  const ページ番号 = (i) => 3 + i * 3;
  const 絵番号 = (i) => 4 + i * 3;
  const 置き方番号 = (i) => 5 + i * 3;

  putText('%PDF-1.4\n');

  mark();
  putText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  mark();
  const kids = 紙.map((_, i) => `${ページ番号(i)} 0 R`).join(' ');
  putText(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${紙.length} >>\nendobj\n`);

  const content = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm /Im0 Do Q\n`;

  紙.forEach((jpeg, i) => {
    mark();
    putText(`${ページ番号(i)} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}]`
      + ` /Resources << /XObject << /Im0 ${絵番号(i)} 0 R >> >>`
      + ` /Contents ${置き方番号(i)} 0 R >>\nendobj\n`);

    mark();
    putText(`${絵番号(i)} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h}`
      + ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`
      + ` /Length ${jpeg.length} >>\nstream\n`);
    put(jpeg);
    putText('\nendstream\nendobj\n');

    mark();
    putText(`${置き方番号(i)} 0 obj\n<< /Length ${enc.encode(content).length} >>`
      + `\nstream\n${content}endstream\nendobj\n`);
  });

  const xref = len;
  const 数 = offsets.length + 1;
  let table = `xref\n0 ${数}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { table += String(o).padStart(10, '0') + ' 00000 n \n'; });
  putText(table);
  putText(`trailer\n<< /Size ${数} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return new Blob(parts, { type: 'application/pdf' });
}


/* ============================================================
 *  今日のシフト（時刻の表）を描く（2026-10-11、ko-dai さんの指示）
 *
 *  なぜこのファイルにあるか
 *    同じ表を2つの画面で使うためです（上のシフト表の絵と同じ理由）。
 *      ・ワークス・マインの「今日のシフト」（js/app.js の shiftTodayDraw。本部の店舗選択の画面も、それを呼びます）
 *      ・アルバイトの提出ページの「今日のシフト」（shift/js/submit.js）
 *    提出ページは js/app.js を読まないので、描く部品はここに置きます。
 *
 *  使い方
 *    shiftTodayRender(入れ物, { storeId, dateStr, day, title, … }) で、入れ物の中に描きます。
 *    **どこから記録を持ってくるかは、呼ぶ側の都合です**（ワークスは端末の記録、提出ページはサーバーからもらった確定の表）。
 *    時刻の軸・帯の引き方・色の分け方は js/config.js の「今日のシフト」の節（shiftTableModel）が決めます。ここは描くだけです。
 *    ★時刻の表で出すのはバグると popo だけです。他の4店舗は、名前と出勤時刻だけの一覧（shiftTodayListBox。2026-10-12）。
 *
 *  ★見た目は shiftTodayStyle が自分で入れます。**決まりは全部 .shift-tt の中だけに効きます**
 *    （親の class に頼りません。ワークス・マイン・本部の画面・提出ページの、どこに置いても同じに見えます）。
 *    色は、ワークスの名前（--shift-lunch など）→ 提出ページの名前（--lunch など）→ 決め打ち、の順に読みます。
 *  ★.shift-tt__scroll と、shiftTodayStr・shiftTodayToNow は、本部の画面も使っています。名前を変えるときは、先に本部へ。
 *  ★検算は .claude/skills/t3works-shift/today-table.js。
 * ============================================================ */

/** 業務上の今日（'YYYY-MM-DD'。朝6時までは前の日 → js/config.js の businessDate） */
function shiftTodayStr() {
  return dateToStr(businessDate());
}

/**
 * 名前の列の幅と、1時間の列のこれより狭くしない幅（px）
 *
 * ★iPad やパソコン（幅が SHIFT_TODAY_NARROW より広い画面）の数です。1日分が1画面に収まります。
 *   万一収まらないときは、表だけが横に動きます（名前の列は左に残ります。→ shiftTodayToNow）。
 */
const SHIFT_TODAY_WHO_W = 88;
const SHIFT_TODAY_COL_W = 26;
/**
 * スマホの幅（画面の幅がここまで）では、**横に動かさずに1画面に収めます**
 *
 * ★2026-10-11、ko-dai さん「スマホ画面で横スクロールなしで収めることはできますか？」。
 *   名前の列を細く（SHIFT_TODAY_WHO_NARROW）、時刻は数字だけ（「時」を出さない）、「ラスト」は縦書きにして、
 *   1時間の列を画面の幅に合わせて縮めます。列が多い日（popo の金・土は18列）は、時刻の数字も列の幅に合わせて小さくなります。
 * ★見た目の決まり（shiftTodayStyle の @media）だけでやっています。描くときに幅を測りません
 *   （小窓は、隠れているあいだに描くので、測れません）。
 */
const SHIFT_TODAY_NARROW = 640;
const SHIFT_TODAY_WHO_NARROW = 62;

/** 表の見た目（1回だけ入れます。★全部 .shift-tt の中だけに効きます） */
function shiftTodayStyle() {
  if (document.getElementById('shiftTodayStyle')) return;
  const 薄く = (向き) => {
    const g = `linear-gradient(${向き})`;
    return `-webkit-mask-image:${g};mask-image:${g}`;
  };
  const st = document.createElement('style');
  st.id = 'shiftTodayStyle';
  st.textContent = [
    // ★F（通し）の色は紫（提出ページの F の色と同じ）。ワークスには F の色の名前がないので、暗い画面の分もここで決めます
    '.shift-tt{--tt-c:var(--accent);--tt-full:var(--full,#7a4b8f);color:var(--text);font-size:13px;line-height:1.5;text-align:left}',
    '@media (prefers-color-scheme: dark){.shift-tt{--tt-full:var(--full,#c197d6)}}',
    ':root[data-theme="dark"] .shift-tt{--tt-full:var(--full,#c197d6)}',
    ':root[data-theme="light"] .shift-tt{--tt-full:var(--full,#7a4b8f)}',
    '.shift-tt__day{margin:0 0 6px;font-size:15px;font-weight:700}',
    '.shift-tt__note{margin:0 0 8px;font-size:12.5px;line-height:1.6;color:var(--text-sub)}',
    '.shift-tt__note--warn{font-weight:700;color:var(--ng)}',
    '.shift-tt__scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:10px;background:var(--surface)}',
    '.shift-tt__table{border-collapse:separate;border-spacing:0;table-layout:fixed;width:100%;margin:0}',
    '.shift-tt__table th,.shift-tt__table td{margin:0;padding:0;border:0;font-weight:400;text-align:left;background:none}',
    '.shift-tt__table .shift-tt__corner,.shift-tt__table .shift-tt__who{position:sticky;left:0;z-index:2;background:var(--surface);border-right:1px solid var(--line)}',
    '.shift-tt__table .shift-tt__corner{background:var(--surface-2)}',
    '.shift-tt__table .shift-tt__hour{padding:6px 0 5px;text-align:center;font-size:12px;font-weight:700;line-height:1.2;color:var(--text);'
      + 'background:var(--surface-2);border-left:1px solid var(--line-2);white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.shift-tt__hour small{font-size:8.5px;font-weight:400;color:var(--text-sub)}',
    '.shift-tt__table .shift-tt__hour--last{font-size:9.5px;letter-spacing:-.4px}',
    '.shift-tt__table .shift-tt__lane{padding:4px 0;font-size:11.5px;font-weight:700;color:var(--text-sub);background:var(--surface-2);border-top:1px solid var(--line)}',
    '.shift-tt__lane span{position:sticky;left:8px;display:inline-block}',
    '.shift-tt__table .shift-tt__who{padding:5px 6px;border-top:1px solid var(--line-2);vertical-align:middle}',
    '.shift-tt__name{display:block;font-size:13px;font-weight:700;line-height:1.3;overflow-wrap:anywhere}',
    // 自分の行（提出ページ）。名前に色を付けます
    '.shift-tt__who.is-me .shift-tt__name{color:var(--accent)}',
    '.shift-tt__time{display:block;font-size:10.5px;line-height:1.35;color:var(--text-sub);font-variant-numeric:tabular-nums}',
    '.shift-tt__time span{display:inline-block;white-space:nowrap;margin-right:.35em}',
    // 「17:00〜」と「22:00」は、くっつけて出します（狭い列では、「〜」のうしろでだけ折れます）
    '.shift-tt__time span.shift-tt__t1{margin-right:0}',
    // 縦の線は、1時間ごと（マスの背景に引きます。列の数は --tt-cols）
    '.shift-tt__table .shift-tt__cell{border-top:1px solid var(--line-2);vertical-align:middle;'
      + 'background-image:linear-gradient(to right,var(--line-2) 1px,transparent 1px);background-size:calc(100% / var(--tt-cols)) 100%}',
    '.shift-tt__track{position:relative;height:36px}',
    '.shift-tt__bar{position:absolute;top:8px;bottom:8px;border-radius:5px;background:var(--tt-c);box-sizing:border-box}',
    // ★帯の色（→ js/config.js の shiftTableKind）。仕込み＝茶・ランチ＝緑・ディナー（営業）＝青・F＝紫・ラスト＝青緑。
    //   ランチ・ディナー・仕込み・ラストは、組む画面の枠の色と同じです
    '.shift-tt__bar--open,.shift-tt__key--open{--tt-c:var(--shift-open,var(--open,#b4631a))}',
    '.shift-tt__bar--lunch,.shift-tt__key--lunch{--tt-c:var(--shift-lunch,var(--lunch,#2d7a58))}',
    '.shift-tt__bar--dinner,.shift-tt__key--dinner{--tt-c:var(--shift-dinner,var(--dinner,#4a5fa8))}',
    '.shift-tt__bar--full,.shift-tt__key--full{--tt-c:var(--tt-full)}',
    '.shift-tt__bar--last,.shift-tt__key--last{--tt-c:var(--shift-last,var(--last,#1f7a8c))}',
    // ★記録に時刻が入っていない側を、薄くします（退勤が空＝右、出勤が空＝左）。
    //   薄くしはじめる所が決まっている帯（バグるのランチだけの人＝14:00）は、帯ごとに直に入れます（→ shiftTodayTable）
    `.shift-tt__bar.is-no-to,.shift-tt__key.is-no-to{${薄く('to right,#000 20%,rgba(0,0,0,.16)')}}`,
    `.shift-tt__bar.is-no-from{${薄く('to left,#000 20%,rgba(0,0,0,.16)')}}`,
    `.shift-tt__bar.is-no-from.is-no-to{${薄く('to right,rgba(0,0,0,.16),#000 35%,#000 65%,rgba(0,0,0,.16)')}}`,
    '.shift-tt__bar.is-early,.shift-tt__key.is-early{box-shadow:inset 0 0 0 2px #d98324}',
    '.shift-tt__legend{display:flex;flex-wrap:wrap;gap:4px 14px;margin:8px 0 0;font-size:11.5px;line-height:1.6;color:var(--text-sub)}',
    '.shift-tt__key{display:inline-block;width:20px;height:10px;margin-right:5px;border-radius:3px;vertical-align:-1px;background:var(--tt-c)}',
    '.shift-tt__memo{margin:8px 0 0;font-size:12.5px;line-height:1.6;overflow-wrap:anywhere}',
    // ★名前と出勤時刻だけの一覧（時刻の表を出さない店舗）。持ち場ごとの箱を、**いつも横に並べます**（キッチンが左・ホールが右）。
    //   2026-10-12、ko-dai さん「キッチンとホールを横並びにできますか？」。前は、スマホの幅では縦に並んでいました。
    //   列の数は持ち場の数（--tt-lanes。shiftTodayListBox が入れます）。minmax(0,…) で、長い名前が箱を押し広げないようにします
    '.shift-tt__list{display:grid;grid-template-columns:repeat(var(--tt-lanes,2),minmax(0,1fr));gap:10px 14px;align-items:start;max-width:600px}',
    '.shift-tt__group{border:1px solid var(--line);border-radius:10px;background:var(--surface);overflow:hidden}',
    '.shift-tt__ghead{margin:0;padding:5px 12px;font-size:11.5px;font-weight:700;color:var(--text-sub);background:var(--surface-2)}',
    '.shift-tt__row{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding:8px 12px;border-top:1px solid var(--line-2)}',
    '.shift-tt__rname{flex:1 1 auto;min-width:0;font-size:14px;font-weight:700;line-height:1.35;overflow-wrap:anywhere}',
    '.shift-tt__rfrom{font-size:11px;font-weight:400;color:var(--text-sub)}',
    '.shift-tt__rtime{flex:0 0 auto;font-size:14px;line-height:1.35;white-space:nowrap;font-variant-numeric:tabular-nums}',
    // 出勤の時刻が入っていない人（枠の名前を出します）
    '.shift-tt__rtime.is-none{font-size:12px;color:var(--text-sub)}',
    '.shift-tt__row.is-me .shift-tt__rname{color:var(--accent)}',
    // ★スマホの幅では、横に動かさずに1画面に収めます（→ SHIFT_TODAY_NARROW）。
    //   表のこれより狭くしない幅と、名前の列の幅は、部品に直に入れてあるので、ここで上書きします（!important）。
    //   時刻の数字は、列の幅の7割ほどの大きさ（列が多い日は小さく。cqw の使えない端末では 9px のまま）
    `@media (max-width: ${SHIFT_TODAY_NARROW}px){`
      + '.shift-tt__scroll{container-type:inline-size}'
      + '.shift-tt__table{min-width:0 !important}'
      + `.shift-tt__table col:first-child{width:${SHIFT_TODAY_WHO_NARROW}px !important}`
      + '.shift-tt__table .shift-tt__who{padding:4px 3px 4px 5px}'
      + '.shift-tt__name{font-size:12px}'
      + '.shift-tt__time{font-size:9px;letter-spacing:-.2px}'
      + '.shift-tt__time span{margin-right:.2em}'
      + '.shift-tt__table .shift-tt__hour{padding:5px 0 4px;letter-spacing:-.3px;font-size:9px;'
        + `font-size:clamp(7px,calc((100cqw - ${SHIFT_TODAY_WHO_NARROW}px) / var(--tt-cols) * .68),10.5px)}`
      + '.shift-tt__hour small{display:none}'
      + '.shift-tt__table .shift-tt__hour--last{font-size:8px;letter-spacing:0;vertical-align:middle}'
      + '.shift-tt__hour--last span{display:inline-block;writing-mode:vertical-rl;text-orientation:upright;line-height:1;letter-spacing:-1px}'
      + '.shift-tt__lane span{left:5px}'
      // 一覧：横に2つ並べるので、箱の中の空きと字を少し詰めます（長い名前は箱の中で折れます）
      + '.shift-tt__list{gap:8px}'
      + '.shift-tt__ghead{padding:5px 8px}'
      + '.shift-tt__row{gap:6px;padding:7px 8px}'
      + '.shift-tt__rname,.shift-tt__rtime{font-size:13px}'
      + '.shift-tt__rfrom{display:block;font-size:10px}'
      + '.shift-tt__rtime.is-none{font-size:11px}'
      + '}',
  ].join('');
  document.head.appendChild(st);
}

/**
 * その日のシフトの表を、入れ物の中に描く
 *
 *   box  … 描く先（中身は入れかえます）
 *   中身 … { storeId, dateStr, day, title, notes, draft, empty, memo, 名簿の順, me }
 *      storeId・dateStr … 店舗の id と 'YYYY-MM-DD'
 *      day      … 記録のままの1日（{ open, lunch, dinner }。なければ空として読みます）
 *      title    … 表の上に出す字（「10/11（日）　バグる」）
 *      notes    … 表の上に出す知らせ（[{ text, warn }]。定休日 など）
 *      draft    … true なら、人が入っているとき「まだ確定していません」と出します（組んでいる途中の表）
 *      empty    … 誰も入っていないときに出す字（渡さなければ「この日のシフトは、まだ入っていません。」）
 *      memo     … 表の下に出すメモ
 *      名簿の順 … 名前の並び（同じ時刻の人を、名簿の順に並べるため。渡さなくても動きます）
 *      me       … 自分の名前（提出ページ。その人の行の名前に色が付きます）
 *   返すもの … 描いた中身（js/config.js の shiftTableModel の形）
 */
function shiftTodayRender(box, 中身) {
  shiftTodayStyle();
  const v = 中身 || {};
  const model = shiftTableModel(v.storeId, v.dateStr, v.day || {}, v.名簿の順 || []);
  const 部品 = (tag, cls, text) => {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    if (text !== undefined) x.textContent = text;
    return x;
  };

  const root = 部品('div', 'shift-tt');
  root.dataset.store = v.storeId;
  root.dataset.date = v.dateStr;
  // 軸の初めの時と、列の数（→ shiftTodayToNow が、いまの時刻の位置を出すのに使います）
  root.dataset.from = String(model.axis.from);
  root.dataset.cols = String(model.axis.cols);
  if (v.title) root.appendChild(部品('p', 'shift-tt__day', v.title));
  (v.notes || []).forEach((n) => {
    if (n && n.text) root.appendChild(部品('p', 'shift-tt__note' + (n.warn ? ' shift-tt__note--warn' : ''), n.text));
  });
  if (!model.rows.length) {
    root.appendChild(部品('p', 'shift-tt__note', v.empty || 'この日のシフトは、まだ入っていません。'));
  } else {
    if (v.draft) {
      root.appendChild(部品('p', 'shift-tt__note shift-tt__note--warn', '★このシフトは、まだ確定していません（組んでいる途中の表です）。'));
    }
    if (shiftTodayUsesTable(v.storeId)) {
      root.appendChild(shiftTodayTable(model, v.me));
      root.appendChild(shiftTodayLegend(v.storeId, model));
    } else {
      // ★時刻の表を出さない店舗（こじゃれ・炭まろ・ちゃこる・おいでんテラス）は、名前と出勤時刻だけの一覧
      //   （2026-10-12、ko-dai さんの指示 → js/config.js の SHIFT_TODAY_TABLE_STORES）
      root.appendChild(shiftTodayListBox(v.storeId, model, v.me));
    }
  }
  if (v.memo) root.appendChild(部品('p', 'shift-tt__memo', `メモ：${v.memo}`));

  box.innerHTML = '';
  box.appendChild(root);
  return model;
}

/**
 * 名前と出勤時刻だけの一覧（時刻の表を出さない店舗。持ち場ごとに分けます）
 *
 * ★出すのは名前と出勤時刻だけです（退勤・帯・色の説明は出しません）。何を出すかは js/config.js の shiftTodayList が決めます。
 * ★持ち場（キッチン／ホール）ごとの箱に分けて、**いつも横に並べます**（左がキッチン・右がホール。スマホの幅でも横）。
 *   場所を動かさないように、誰もいない持ち場の箱も出します（「キッチン　0人」。中は空）。
 */
function shiftTodayListBox(storeId, model, 自分) {
  const 部品 = (tag, cls, text) => {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    if (text !== undefined) x.textContent = text;
    return x;
  };
  const box = 部品('div', 'shift-tt__list');
  box.style.setProperty('--tt-lanes', String(SHIFT_LANES.length));
  const 行たち = shiftTodayList(storeId, model);
  SHIFT_LANES.forEach((lane) => {
    const 人 = 行たち.filter((r) => r.lane === lane.id);
    // ★誰もいない持ち場の箱も出します（飛ばすと、ホールの箱が左に来て、場所が日によって変わります）
    const 組 = 部品('div', 'shift-tt__group');
    組.appendChild(部品('p', 'shift-tt__ghead', `${lane.name}　${人.length}人`));
    人.forEach((r) => {
      const 行 = 部品('div', 'shift-tt__row' + (自分 && r.n === 自分 && r.label === r.n ? ' is-me' : ''));
      const 名前 = 部品('span', 'shift-tt__rname', r.n);
      // ヘルプで来た人の「（店舗）」は、名前のうしろに小さく出します
      if (r.label !== r.n) 名前.appendChild(部品('span', 'shift-tt__rfrom', r.label.slice(r.n.length)));
      行.append(名前, 部品('span', 'shift-tt__rtime' + (r.noTime ? ' is-none' : ''), r.time));
      組.appendChild(行);
    });
    box.appendChild(組);
  });
  return box;
}

/** 表（1行目が時刻、左の列が名前。持ち場ごとに区切ります） */
function shiftTodayTable(model, 自分) {
  const { axis, rows } = model;
  const 部品 = (tag, cls, text) => {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    if (text !== undefined) x.textContent = text;
    return x;
  };
  const wrap = 部品('div', 'shift-tt__scroll');
  const table = 部品('table', 'shift-tt__table');
  table.style.setProperty('--tt-cols', String(axis.cols));
  table.style.minWidth = `${SHIFT_TODAY_WHO_W + axis.cols * SHIFT_TODAY_COL_W}px`;

  const cg = document.createElement('colgroup');
  const 名前の列 = document.createElement('col');
  名前の列.style.width = `${SHIFT_TODAY_WHO_W}px`;
  const 時の列 = document.createElement('col');
  時の列.span = axis.cols;
  cg.append(名前の列, 時の列);
  table.appendChild(cg);

  const thead = document.createElement('thead');
  const 見出し = document.createElement('tr');
  見出し.appendChild(部品('th', 'shift-tt__corner'));
  axis.hours.forEach((h) => {
    const th = 部品('th', 'shift-tt__hour', String(h));
    th.appendChild(部品('small', '', '時'));
    見出し.appendChild(th);
  });
  // ★最後の時の次の1列は「ラスト」（バグるなら、23時の代わり）。スマホの幅では縦書きにするので、字を部品で包みます
  const ラスト = 部品('th', 'shift-tt__hour shift-tt__hour--last');
  ラスト.appendChild(部品('span', '', SHIFT_END_LAST_NAME));
  見出し.appendChild(ラスト);
  thead.appendChild(見出し);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  SHIFT_LANES.forEach((lane) => {
    const 人 = rows.filter((r) => r.lane === lane.id);
    if (!人.length) return;
    const 区切り = document.createElement('tr');
    const th = 部品('th', 'shift-tt__lane');
    th.colSpan = axis.cols + 1;
    th.appendChild(部品('span', '', `${lane.name}　${人.length}人`));
    区切り.appendChild(th);
    tbody.appendChild(区切り);

    人.forEach((r) => {
      const tr = document.createElement('tr');
      const who = 部品('th', 'shift-tt__who' + (自分 && r.n === 自分 && r.label === r.n ? ' is-me' : ''));
      who.scope = 'row';
      who.appendChild(部品('span', 'shift-tt__name', r.n));
      // ヘルプで来た人の「（店舗）」は、名前の下に小さく出します（名前の列が狭く、続けて書くと途中で折れるため）
      if (r.label !== r.n) who.appendChild(部品('span', 'shift-tt__time', r.label.slice(r.n.length)));
      const td = 部品('td', 'shift-tt__cell');
      td.colSpan = axis.cols;
      const track = 部品('div', 'shift-tt__track');
      r.bars.forEach((b) => {
        // ★「11:30 F 早上がり」は、空白の所でだけ折ります（時刻や「早上がり」の途中では折りません）
        if (b.text) {
          const 字 = 部品('span', 'shift-tt__time');
          b.text.split(' ').filter(Boolean).forEach((w) => {
            // 「17:00〜22:00」は、「〜」のうしろでだけ折れるように、前とうしろを別の部品にします（名前の列が狭いスマホの幅のため）
            const i = w.indexOf('〜');
            if (i > 0 && i < w.length - 1) 字.append(部品('span', 'shift-tt__t1', w.slice(0, i + 1)), 部品('span', '', w.slice(i + 1)), ' ');
            else 字.append(部品('span', '', w), ' ');
          });
          who.appendChild(字);
        }
        const bar = 部品('span', `shift-tt__bar shift-tt__bar--${b.kind || b.slot}`
          + (b.noFrom ? ' is-no-from' : '') + (b.noTo ? ' is-no-to' : '') + (b.early ? ' is-early' : ''));
        bar.style.left = `${(b.x0 * 100).toFixed(3)}%`;
        bar.style.width = `${((b.x1 - b.x0) * 100).toFixed(3)}%`;
        // ★薄くしはじめる所が決まっている帯（バグるのランチだけの人：14:00 から 16:00 にかけて）は、
        //   その所まで濃いまま、そこから右端へ向かって薄くします
        if (b.noTo && !b.noFrom && b.fade !== null && b.fade !== undefined) {
          const g = `linear-gradient(to right,#000 ${(b.fade * 100).toFixed(1)}%,rgba(0,0,0,.16))`;
          bar.style.webkitMaskImage = g;
          bar.style.maskImage = g;
        }
        bar.title = `${r.label} ${b.text}`.trim();
        track.appendChild(bar);
      });
      td.appendChild(track);
      tr.append(who, td);
      tbody.appendChild(tr);
    });
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

/** 表の下の、色の説明（その日に出ているものだけ） */
function shiftTodayLegend(storeId, model) {
  const box = document.createElement('div');
  box.className = 'shift-tt__legend';
  const 足す = (cls, text) => {
    const row = document.createElement('span');
    const key = document.createElement('i');
    key.className = `shift-tt__key ${cls}`;
    row.append(key, document.createTextNode(text));
    box.appendChild(row);
  };
  const bars = [];
  model.rows.forEach((r) => r.bars.forEach((b) => bars.push(b)));
  // 色の種類（その日に出ているものだけ。→ js/config.js の shiftTableKind）
  SHIFT_TABLE_KINDS.forEach((kind) => {
    if (bars.some((b) => b.kind === kind)) 足す(`shift-tt__key--${kind}`, shiftTableKindName(storeId, kind));
  });
  if (bars.some((b) => b.early)) 足す('shift-tt__key--dinner is-early', 'オレンジの枠は早上がり');
  // ★薄くしはじめる時刻が決まっている帯（バグるのランチだけの人）は、その時刻を書きます
  const 幅 = SHIFT_TABLE_LUNCH_OUT[storeId];
  if (幅 && bars.some((b) => b.noTo && b.fade !== null && b.fade !== undefined)) {
    const 時 = (h) => shiftTimeText(shiftTimeKey(h));
    足す('shift-tt__key--lunch is-no-to', `${shiftTableKindName(storeId, 'lunch')}だけの人は、${時(幅.from)}から${時(幅.to)}にかけて薄くなります`);
  }
  if (bars.some((b) => (b.noFrom || b.noTo) && (b.fade === null || b.fade === undefined))) {
    // ★退勤を持たない店舗で、上がる時刻の幅を決めていないときは、どこまで出しているかを書きます
    const 昼まで = shiftUsesEnd(storeId) || 幅 ? ''
      : `（何時までかを決めていない人は、${shiftTimeText(shiftTimeKey(shiftTableNoon(storeId)))}まで出しています）`;
    足す('shift-tt__key--dinner is-no-to', `色が薄くなっていく側は、時刻が決まっていません${昼まで}`);
  }
  return box;
}

/** いまの時刻（時を小数で。★朝6時より前は、前の日の 24時〜 として数えます。businessDate と同じ境目） */
function shiftTodayNowHour() {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  return now.getHours() < (APP.dayStartHour || 0) ? h + 24 : h;
}

/**
 * 表が横に動くとき（スマホの縦持ち）、いまの時刻の1時間前から見える位置にする
 *
 * ★box は shiftTodayRender（ワークスでは shiftTodayDraw）に渡した入れ物。**画面に出したあと**に呼びます
 *   （隠れているあいだは幅が測れません）。1画面に収まっているとき・表がないときは、何もしません。
 */
function shiftTodayToNow(box) {
  const root = box && box.querySelector('.shift-tt');
  const sc = root && root.querySelector('.shift-tt__scroll');
  if (!sc || sc.scrollWidth <= sc.clientWidth + 1) return;
  const axis = { from: Number(root.dataset.from), cols: Number(root.dataset.cols) };
  if (!isFinite(axis.from) || !(axis.cols > 0)) return;
  sc.scrollLeft = Math.max(0, shiftTablePos(axis, shiftTodayNowHour() - 1) * (sc.scrollWidth - SHIFT_TODAY_WHO_W));
}
