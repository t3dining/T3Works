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
 * 1人分の高さが、名前の大きさの何倍か
 *
 * ★two＝時刻を名前の上の段に出す（名前を大きくできる）
 *   one＝時刻と名前を1行に並べる（背が低いので、人の多い日に強い）
 */
const SHIFT_ROW_EM = 1.1 + SHIFT_TIME_SCALE * 1.0 + 0.35;

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
function shiftCellPt(pt, count, roomMm) {
  if (count <= 0) return pt;
  const fit = ((roomMm - 1.4) / count) * 2.8346 / SHIFT_ROW_EM;
  return Math.max(4.5, Math.min(pt, fit));
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

  // ★使える高さ。A4横204mmのうち196mmまでにして、
  //   メモが2行に伸びる分を残します
  const blocks = model.blocks.length || 1;
  const fixed = 6.5 + 4 + 5.5;              // 日付・持ち場・メモ
  const rowsMm = Math.max(30, (196 - 8.5 - 3 * blocks) / blocks - fixed);

  const need = shiftSlotNeed(model);
  const openNeed = Math.max(1, need[0] || 0);
  // ランチとディナーは、多い方に合わせてそろえます
  const share = Math.max(3, need[1] || 0, need[2] || 0);
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
  const openMm = Math.min(rowsMm * 0.3, Math.max(9, openNeed * shiftPersonMm(pt) + 1.4));
  const slotMm = (rowsMm - openMm) / 2;

  return {
    pt,
    // その半月で一番多いマスの人数（何人まで入るかの目安に使います）
    share,
    openMm: Math.round(openMm * 10) / 10,
    slotMm: Math.round(slotMm * 10) / 10,
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
  const memoH = 28;
  // 残りの高さを、枠の行に等しく配ります
  const blocks = model.blocks.length || 1;
  const fixed = (dateH + laneH + memoH) * blocks + gapBlocks * (blocks - 1);
  // ★元のスプレッドシートと同じ配分です。立ち上げは1人、
  //   ランチとディナーは3人分入る高さにします。
  //   それより多く入っている日（足りない人数の赤いあきも数に入れます）は、
  //   その日に合わせて広げます（そうしないと下が切れます）
  const need = shiftSlotNeed(model);
  // ★ランチとディナーは、多い方に合わせて同じ高さにします
  //   （どちらにも同じ人数を入れられるように）
  const share = Math.max(3, need[1] || 0, need[2] || 0);
  const weight = sheetSlots(model).map((slot, si) => (slot.id === 'open'
    // 立ち上げは1人分で足りますが、低すぎると縦書きの枠名が入らないので
    // 少しだけ多めに取ります
    ? Math.max(need[si] || 0, 1.6)
    : share));
  const unit = weight.reduce((a, b) => a + b, 0);
  const room = Math.max(unit * (lh + 8), H - y - pad - fixed);
  const slotH = sheetSlots(model).map((slot, i) => (room / blocks) * (weight[i] / unit));

  model.blocks.forEach((block, bi) => {
    const top = y;
    const x0 = pad + labelW;

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
      center(block.memo[i] || '', x, w, y + memoH / 2, 13, false, '#3d434b');
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

