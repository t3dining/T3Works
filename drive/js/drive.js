/* ============================================================
 *  配達記録（バグるの交通費）
 *
 *  作り
 *    ・お店ではなく「人」と「月」でまとめます。1件＝1配達です
 *    ・入れるのは片道の距離だけ。往復分（2倍）にして足していきます
 *    ・支払う金額は、1件ごとではなく「その月の合計距離」から出します
 *      （5kmごとに100円・100円未満は切り上げ）
 *
 *  記録の入れ先は  _drive/2026-08  なので、同期の仕組み
 *  （スプレッドシート）はそのまま使えます。設定の追加もいりません。
 *
 *  名前の追加・削除は T3 Works Manage（バグる → 交通費）で行います。
 * ============================================================ */

const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();

/* 「今日」は業務上の今日。朝6時（APP.dayStartHour）より前は前の日あつかいです。
   夜中に帰ってきて入れても、その日の営業分として入ります */
const today = businessDate();
const TODAY = { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() };

const state = { y: TODAY.y, m: TODAY.m };

const $ = (id) => document.getElementById(id);
const el = {
  driveLogo: $('driveLogo'),
  driveMonth: $('driveMonth'), driveSummary: $('driveSummary'),
  driveTotalYen: $('driveTotalYen'),
  driveTotalWrap: $('driveTotalWrap'), driveTotals: $('driveTotals'),
  driveFoot: $('driveFoot'), driveList: $('driveList'), driveListHead: $('driveListHead'),
  driveModal: $('driveModal'), driveError: $('driveError'),
  drvDate: $('drvDate'), drvNames: $('drvNames'), drvNoNames: $('drvNoNames'),
  drvLegs: $('drvLegs'), drvAddLeg: $('drvAddLeg'), drvHint: $('drvHint'), drvWarn: $('drvWarn'),
  driveFormTitle: $('driveFormTitle'), driveSave: $('driveSave'),
  modal: $('modal'), syncChip: $('syncChip'), syncInfo: $('syncInfo'), syncLegend: $('syncLegend'),
  syncWarn: $('syncWarn'),
  pinModal: $('pinModal'), pinInput: $('pinInput'), pinError: $('pinError'),
  appVersionText: $('appVersionText'),
  confirmDialog: $('confirmDialog'), confirmItem: $('confirmItem'),
  confirmMessage: $('confirmMessage'), confirmOk: $('confirmOk'),
  toOwnerBtn: $('toOwnerBtn'),
};

/* 画像の置き場所（drive/ は1つ下の階層なので ../ が付きます） */
const ASSET_BASE = document.body.dataset.assets || '';

/* ヘッダーに出す絵。ホーム画面のアイコンと同じものにして、
   「いま開いているのはこのアプリ」がひと目で分かるようにします */
const DRIVE_ICON = 'img/drive-icon-180.png';

/* ============================================================
 *  記録の読み書き
 * ============================================================ */
/** いま見ている月の記録 */
function driveRec() {
  return Store.getDay(DRIVE_STORE, driveMonthKey(state.y, state.m));
}

/** 1件分の明細だけ取り出す（消したもの＝距離0 は除く） */
function driveEntries(rec) {
  const items = rec.items || {};
  return Object.keys(items)
    .filter((id) => items[id] && Number(items[id].km) > 0)
    .map((id) => ({ id, ...items[id] }))
    .sort((a, b) => (a.d || '').localeCompare(b.d || '') || (a.at || '').localeCompare(b.at || ''));
}

/**
 * 人ごとにまとめる
 *
 * 登録されている人は、記録が無くても行を出します（Numbersの表と同じ）。
 * 名前を消したあとに過去の記録が残っている場合も、下に足して出します。
 */
function driveByPerson(rec) {
  const map = new Map();
  const add = (name) => {
    if (!map.has(name)) map.set(name, { name, list: [], km: 0, yen: 0 });
    return map.get(name);
  };
  Drivers.list().forEach(add);
  driveEntries(rec).forEach((e) => {
    const row = add(e.by || '（名前なし）');
    row.list.push(e);
    row.km = driveKm(row.km, e.km);
  });
  map.forEach((row) => { row.yen = driveYen(row.km); });
  return [...map.values()];
}

/**
 * その人の記録を「日ごと」にまとめる
 *
 * 1日に何回も配達に行くので、一覧は1日1行にして、
 * その日の合計距離を出します。中身（1回ずつの距離）は
 * 「編集」を押したときにまとめて開きます。
 */
function driveByDay(list) {
  const map = new Map();
  list.forEach((e) => {
    if (!map.has(e.d)) map.set(e.d, { d: e.d, by: e.by, list: [] });
    map.get(e.d).list.push(e);
  });
  return [...map.values()].map((g) => ({ ...g, km: driveKm(...g.list.map((e) => e.km)) }));
}

function kmText(km) {
  return (Math.round((Number(km) || 0) * 10) / 10).toFixed(1) + 'km';
}

function yenText(n) {
  return '¥' + (Number(n) || 0).toLocaleString('ja-JP');
}

/* ============================================================
 *  画面
 * ============================================================ */
function render() {
  const rec = driveRec();
  const people = driveByPerson(rec);
  const ran = people.filter((p) => p.list.length);
  const totalKm = driveKm(...people.map((p) => p.km));
  // 金額は人ごとに出したものを足します
  // （全員分の距離をまとめてから計算すると、切り上げが1回だけになり合いません）
  const totalYen = people.reduce((t, p) => t + p.yen, 0);

  const count = ran.reduce((n, p) => n + p.list.length, 0);
  el.driveMonth.textContent = `${state.y}年${state.m}月`;
  el.driveTotalYen.textContent = yenText(totalYen);
  el.driveSummary.textContent = ran.length
    ? `${kmText(totalKm)}　${ran.length}人が配達　${count}回`
    : 'この月の記録はまだありません';

  /* ---- 上の表：名前・合計距離・合計金額 ---- */
  // 一番走っている人を基準に、名前の下の帯の長さを決めます
  const maxKm = Math.max(...people.map((p) => p.km), 0);
  el.driveTotals.innerHTML = '';
  people.forEach((p) => {
    const tr = document.createElement('tr');
    if (!p.list.length) tr.className = 'is-zero';   // 走っていない人は色を落とす

    const name = document.createElement('td');
    name.className = 'exp-total__name';
    name.textContent = p.name;
    if (p.km > 0 && maxKm > 0) {
      const bar = document.createElement('span');
      bar.className = 'drive-table__bar';
      // 8%〜72% の幅。一番短い人でも見えるように下限を付けています
      bar.style.width = `${8 + (p.km / maxKm) * 64}%`;
      name.appendChild(bar);
    }

    // 走っていない人も 0.0km / ¥0 で出します（Numbers の表と同じ見え方）
    const km = document.createElement('td');
    km.className = 'exp-total__yen';
    km.textContent = kmText(p.km);

    const yen = document.createElement('td');
    yen.className = 'exp-total__yen';
    yen.textContent = yenText(p.yen);

    tr.append(name, km, yen);
    el.driveTotals.appendChild(tr);
  });

  el.driveFoot.innerHTML = '';
  if (ran.length) {
    const tr = document.createElement('tr');
    tr.className = 'drive-foot';
    const name = document.createElement('td');
    name.className = 'exp-total__name';
    name.textContent = '合計';
    const km = document.createElement('td');
    km.className = 'exp-total__yen';
    km.textContent = kmText(totalKm);
    const yen = document.createElement('td');
    yen.className = 'exp-total__yen';
    yen.textContent = yenText(totalYen);
    tr.append(name, km, yen);
    el.driveFoot.appendChild(tr);
  }

  /* ---- 下：人ごとの明細（走った人だけ） ---- */
  el.driveListHead.classList.toggle('is-hidden', !ran.length);
  el.driveList.innerHTML = '';
  ran.forEach((p) => {
    const card = document.createElement('section');
    card.className = 'exp-card exp-card--drive';

    const head = document.createElement('div');
    head.className = 'exp-card__head';
    head.innerHTML =
      '<span class="exp-card__name"></span>' +
      `<span class="drive-card__count">${p.list.length}回</span>` +
      `<span class="exp-card__total">${kmText(p.km)}　${yenText(p.yen)}</span>`;
    head.querySelector('.exp-card__name').textContent = p.name;
    card.appendChild(head);

    const list = document.createElement('ul');
    list.className = 'exp-rows';
    // 1日に何回行っても1行。出すのはその日の合計距離です
    driveByDay(p.list).forEach((g) => {
      const li = document.createElement('li');
      li.className = 'exp-row';
      const [, m, d] = (g.d || '').split('-');
      // 経由地でつないだ記録が混ざっている日は、あとから見て分かるように印を出します
      const plain = g.list.filter((e) => e.round === false).length;
      li.innerHTML =
        `<span class="exp-row__date">${m ? `${+m}/${+d}` : '—'}</span>` +
        // 2回以上行った日だけ、回数を出します
        (g.list.length > 1 ? `<span class="drive-row__times">${g.list.length}回</span>` : '') +
        (plain ? '<span class="drive-row__plain" title="経由地でつないだ記録が入っています">経由地</span>' : '') +
        `<span class="exp-row__yen drive-row__km">${kmText(g.km)}</span>`;

      // 入れ間違いは後から直せます（消してから入れ直す必要はありません）
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'row-edit';
      edit.textContent = '編集';
      edit.title = g.list.length > 1 ? 'この日の記録をまとめて直す' : 'この記録を直す';
      edit.addEventListener('click', () => openForm(g));
      li.appendChild(edit);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'exp-row__del';
      del.textContent = '×';
      del.title = g.list.length > 1 ? 'この日の記録をまとめて消す' : 'この記録を消す';
      del.addEventListener('click', () => removeDay(g));
      li.appendChild(del);

      list.appendChild(li);
    });
    card.appendChild(list);
    el.driveList.appendChild(card);
  });

  renderSyncStatus();
}

/** その日の記録をまとめて消す（1回だけの日は、その1件を消します） */
async function removeDay(g) {
  const [, m, d] = (g.d || '').split('-');
  const times = g.list.length > 1 ? `${g.list.length}回 ` : '';
  const ok = await askConfirm({
    item: `${g.by || ''}　${+m}/${+d}　${times}${kmText(g.km)}`,
    message: g.list.length > 1
      ? 'この日の記録をまとめて消します。よろしいですか？'
      : 'この記録を消します。よろしいですか？',
    okLabel: '消す',
    danger: true,
  });
  if (!ok) return;
  // 距離を0にすると一覧から外れます（消したことも同期で全端末に伝わります）
  const key = driveMonthKey(state.y, state.m);
  g.list.forEach((e) => {
    Store.setItem(DRIVE_STORE, key, e.id, { km: 0, one: 0, done: false });
  });
  render();
}

/* ============================================================
 *  入力画面
 *
 *  新しく入れるとき
 *    1日に何回も配達に行くので、1回分ずつ欄を増やせます。
 *    「＋ もう1回分入れる」で1回分増え、入れた分はそのまま残ります。
 *    記録するときは、1回分＝1件として別々に残します。
 *
 *  1回分の中には「経路」が入っています（地図アプリと同じ考え方）
 *    経由地なし … お店 → 配達先 → お店。片道を1つ入れれば、往復で2倍にします
 *    経由地あり … お店 → 1か所目 → 2か所目 → お店。区間ごとに入れて、そのまま足します
 *
 *  「＋ 経由地を追加」を押すと、その回だけ区間ごとの入力に変わります。
 *  切り替えスイッチではなく経路の形そのものが変わるので、
 *  「2倍にするか」を選び忘れて間違える、ということが起きません。
 *
 *  すでに入れたものを直すとき（一覧の「編集」）
 *    その日の記録をまとめて開きます。3回行った日なら3つ並び、
 *    1回ずつ直せます。経由地の有無もそのまま戻ります。
 * ============================================================ */
let drvName = '';
let drvEditing = null;   // 直しているとき、その日のかたまり（新しく入れるときは null）

/** 日のかたまりを渡すと「直す」画面、渡さなければ「新しく入れる」画面 */
function openForm(group) {
  drvEditing = group || null;
  el.driveError.textContent = '';
  el.drvDate.value = drvEditing ? drvEditing.d : ymd(TODAY.y, TODAY.m, TODAY.d);
  drvName = drvEditing ? (drvEditing.by || '') : '';

  el.drvNames.innerHTML = '';
  // 名前リストから消された人の記録を直すときも、その名前を残しておきます
  const names = Drivers.list();
  if (drvName && !names.includes(drvName)) names.push(drvName);
  names.forEach((name) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'doer-btn';
    b.dataset.name = name;
    b.textContent = name;
    b.addEventListener('click', () => { drvName = name; renderForm(); });
    el.drvNames.appendChild(b);
  });
  /* 1人もいないときは、なぜ空なのかを出します。
     名前は共有から届くだけになったので、届く前はここが本当に空になります。
     何も出さないと、押せないまま行き止まりになります */
  el.drvNoNames.classList.toggle('is-hidden', names.length > 0);

  /* 1回分の欄。直すときは、その日に入れた回数だけ並べます */
  el.drvLegs.innerHTML = '';
  if (drvEditing) drvEditing.list.forEach((e) => addTrip(false, e));
  else addTrip();

  el.driveFormTitle.textContent = drvEditing ? '記録を直す' : '走った距離を入れる';
  el.driveSave.textContent = drvEditing ? '直す' : '記録する';

  renderForm();
  el.driveModal.classList.remove('is-hidden');
}

/**
 * 記録から「区間の距離の並び」を取り出す
 *   経由地なし … [片道]         （保存時に2倍します）
 *   経由地あり … [区間1, 区間2, …]（そのまま足します）
 * legs が無い古い記録は、往復として入れてあるので片道に戻します。
 */
function legsOf(entry) {
  if (!entry) return [''];
  if (Array.isArray(entry.legs) && entry.legs.length > 1) return entry.legs.slice();
  if (entry.round === false) return [entry.one || entry.km];
  return [entry.one || driveKm(entry.km / 2)];
}

/**
 * 1回分の欄を増やす
 *
 * entry を渡すと「すでに入れてある記録の欄」になります。
 * その欄を直せば同じ記録が書き換わり、×で消せばその記録だけ消えます。
 */
function addTrip(focus, entry) {
  const row = document.createElement('div');
  row.className = 'drive-trip';
  if (entry && entry.id) row.dataset.id = entry.id;
  row._legs = legsOf(entry);   // 区間の距離。ここが1つなら往復あつかい

  /* 見出し（1回目・2回目…）と、この回ごと消すボタン */
  const head = document.createElement('div');
  head.className = 'drive-trip__head';
  const no = document.createElement('span');
  no.className = 'drive-trip__no';
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'drive-trip__del';
  del.textContent = '×';
  del.title = 'この回を消す';
  del.addEventListener('click', () => {
    // 最後の1つは消さずに空にします（欄がなくなると入れられなくなるため）
    if (el.drvLegs.children.length > 1) row.remove();
    else { row._legs = ['']; drawTrip(row); }
    renderForm();
  });
  head.append(no, del);

  const route = document.createElement('div');
  route.className = 'drive-route';

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'drive-route__add';
  add.textContent = '＋ 経由地を追加';
  add.addEventListener('click', () => {
    keepLegs(row);
    // 経由地なし（区間1つ＝往復）から足すときは、
    // 店→1か所目→2か所目→店 になるので区間は3つになります
    if (row._legs.length === 1) row._legs = [row._legs[0], '', ''];
    else row._legs.push('');
    drawTrip(row);
    renderForm();
    const inputs = row.querySelectorAll('.drive-route__input');
    inputs[inputs.length - 1].focus();
  });

  const total = document.createElement('p');
  total.className = 'drive-trip__total';

  row.append(head, route, add, total);
  el.drvLegs.appendChild(row);
  drawTrip(row);
  if (focus) row.querySelector('.drive-route__input').focus();
  return row;
}

/** 画面に出ている数字を row._legs に写し取る（描き直しで消えないように） */
function keepLegs(row) {
  const inputs = [...row.querySelectorAll('.drive-route__input')];
  if (inputs.length) row._legs = inputs.map((i) => i.value);
}

/**
 * 1回分の経路を描く
 *
 *   経由地なし（区間1つ）      経由地あり（区間3つ）
 *   🏠 バグる                  🏠 バグる
 *    ↓ [ 6.2 ]km               ↓ [ 4.1 ]km
 *   📍 配達先                  📍 1か所目  ×
 *    ↓ 帰りも同じ 6.2km         ↓ [ 2.8 ]km
 *   🏠 バグる                  📍 2か所目  ×
 *                              ↓ [ 5.2 ]km
 *                             🏠 バグる
 */
function drawTrip(row) {
  const route = row.querySelector('.drive-route');
  const legs = row._legs.length ? row._legs : [''];
  const multi = legs.length > 1;
  route.innerHTML = '';
  row.classList.toggle('is-multi', multi);

  /* 立ち寄る場所 */
  const stop = (mark, text, onRemove) => {
    const li = document.createElement('div');
    li.className = 'drive-route__stop';
    li.innerHTML = `<span class="drive-route__mark">${mark}</span>`
      + `<span class="drive-route__name">${text}</span>`;
    if (onRemove) {
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'drive-route__drop';
      x.textContent = '×';
      x.title = 'この経由地を消す';
      x.addEventListener('click', onRemove);
      li.appendChild(x);
    }
    route.appendChild(li);
  };

  /* 区間（矢印＋距離を入れる欄） */
  const legField = (i) => {
    const wrap = document.createElement('div');
    wrap.className = 'drive-route__leg';
    wrap.innerHTML = '<span class="drive-route__arrow" aria-hidden="true">↓</span>';
    const input = document.createElement('input');
    // type="number" は全角数字（１２．６）を弾いて空にしてしまうので text にします
    input.type = 'text';
    input.className = 'field__input drive-route__input';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.placeholder = '6.2';
    input.value = legs[i] || '';
    bindNumericInput(input);
    input.addEventListener('input', () => { keepLegs(row); renderForm(); });
    wrap.appendChild(input);
    const unit = document.createElement('span');
    unit.className = 'drive-route__unit';
    unit.textContent = 'km';
    wrap.appendChild(unit);
    route.appendChild(wrap);
  };

  /* 経由地を1か所消す。区間が2つに減ったら、往復の形（区間1つ）に戻します */
  const dropStop = (i) => () => {
    keepLegs(row);
    row._legs.splice(i, 1);
    if (row._legs.length === 2) row._legs = [row._legs[0]];
    drawTrip(row);
    renderForm();
  };

  stop('🏠', 'バグる');

  if (!multi) {
    // 往復。行きの距離だけ入れてもらい、帰りは自動で同じ距離にします
    legField(0);
    stop('📍', '配達先');
    const back = document.createElement('div');
    back.className = 'drive-route__leg drive-route__leg--auto';
    const km = Number(toHalfWidthNumber(legs[0] || ''));
    back.innerHTML = '<span class="drive-route__arrow" aria-hidden="true">↓</span>'
      + `<span class="drive-route__auto">帰りも同じ${km > 0 ? ' ' + kmText(driveKm(km)) : ''}（自動）</span>`;
    route.appendChild(back);
  } else {
    // 経由地あり。区間の数だけ欄を出し、あいだに立ち寄り先を挟みます
    legs.forEach((v, i) => {
      legField(i);
      if (i < legs.length - 1) stop('📍', `${i + 1}か所目`, dropStop(i));
    });
  }

  stop('🏠', 'バグる');
}

/** 1回分の走った距離。経由地なしなら往復で2倍、ありなら区間の合計 */
function tripKm(t) {
  return t.multi ? driveKm(...t.legs) : driveRound(t.legs[0]);
}

/** いま欄に入っているもの（距離が入っている回だけ）。id は元の記録の番号 */
function legValues() {
  return [...el.drvLegs.children]
    .map((row) => {
      // 全角で入っていても読めるよう、半角に直してから数字にします
      const legs = [...row.querySelectorAll('.drive-route__input')]
        .map((i) => Number(toHalfWidthNumber(i.value)));
      return { id: row.dataset.id || '', legs, multi: legs.length > 1 };
    })
    .filter((t) => t.legs.length && t.legs.every((v) => v > 0));
}

/** 選んだ名前と、それぞれの回が何kmになるかを出します */
function renderForm() {
  [...el.drvNames.children].forEach((b) => b.classList.toggle('is-current', b.dataset.name === drvName));

  // 何回目かの番号を振り直し、その回が何kmになるかも出し直す
  [...el.drvLegs.children].forEach((row, i) => {
    row.querySelector('.drive-trip__no').textContent = `${i + 1}回目`;
    const legs = [...row.querySelectorAll('.drive-route__input')]
      .map((x) => Number(toHalfWidthNumber(x.value)));
    const multi = legs.length > 1;
    const ok = legs.length && legs.every((v) => v > 0);
    const km = ok ? tripKm({ legs, multi }) : 0;
    // 帰り道の説明は、打っているそばから距離を出します
    const auto = row.querySelector('.drive-route__auto');
    if (auto) auto.textContent = '帰りも同じ' + (legs[0] > 0 ? ' ' + kmText(legs[0]) : '') + '（自動）';

    row.querySelector('.drive-trip__total').textContent = !ok
      ? (multi ? '区間の距離をすべて入れてください' : '')
      : multi
        ? `${legs.length}区間 ／ 合計 ${kmText(km)}`
        : `往復 ${kmText(km)}（入れた ${kmText(legs[0])} の2倍）`;
    row.querySelector('.drive-trip__total').classList.toggle('is-on', ok);
  });
  // 1回分しかないときは、回ごと消すボタンを出さない
  el.drvLegs.classList.toggle('is-single', el.drvLegs.children.length === 1);

  const list = legValues();
  const total = driveKm(...list.map(tripKm));
  if (!list.length) el.drvHint.textContent = '走った距離を入れてください';
  else if (drvEditing) el.drvHint.textContent = `この日は ${list.length}回 ／ 合計 ${kmText(total)} に直します`;
  else el.drvHint.textContent = `${list.length}回分 ／ 合計 ${kmText(total)} として記録します`;
  el.drvHint.classList.toggle('is-on', list.length > 0);

  // 間違いが一番起きるのは「まとめて回ったのに、1回ずつに分けて入れた」とき。
  // 2回以上あって、どれにも経由地が無いときだけ声をかけます
  el.drvWarn.classList.toggle('is-hidden', !allRoundMulti(list));
}

/** 2回以上あって、どれにも経由地が無いか（分けて入れてしまった疑い） */
function allRoundMulti(list) {
  return list.length >= 2 && list.every((t) => !t.multi);
}

async function saveEntry() {
  const d = el.drvDate.value;
  const list = legValues();

  if (!d) { el.driveError.textContent = '走った日を入れてください。'; return; }
  if (!drvName) { el.driveError.textContent = '名前を選んでください。'; return; }
  if (!list.length) { el.driveError.textContent = '走った距離を入れてください。'; return; }
  if (list.some((t) => t.legs.some((v) => v > 200))) {
    el.driveError.textContent = '200kmを超えています。入れ間違いではありませんか？';
    return;
  }

  // 切り替え忘れの疑いがあるときは、記録する前に一度だけ確かめます。
  // （毎回聞くと読まずに押すようになるので、疑わしいときだけにしています）
  if (allRoundMulti(list)) {
    const ok = await askConfirm({
      item: `${list.length}回とも「経由地なし（往復）」になっています`,
      message: '1か所ずつ行って、そのつど店に戻ったのなら、このままでOKです。\n'
        + '1回でまとめて回ったのなら、「キャンセル」を押して「＋ 経由地を追加」でつないでください。',
      okLabel: '1か所ずつです',
    });
    if (!ok) return;
  }

  // 入れ先は「走った日の月」。前の月分を入れても、正しい月に入ります
  const [yy, mm] = d.split('-').map(Number);
  const key = driveMonthKey(yy, mm);
  const newId = (i) => 'd' + Date.now().toString(36) + i + Math.random().toString(36).slice(2, 6);

  if (drvEditing) {
    const from = driveMonthKey(state.y, state.m);
    const moved = from !== key;               // 日付を別の月へ動かしたか
    const keep = new Set(list.map((r) => r.id).filter(Boolean));

    // 欄から消したもの（と、別の月へ移すもの）を、元の月から取り除きます
    drvEditing.list.forEach((e) => {
      if (moved || !keep.has(e.id)) {
        Store.setItem(DRIVE_STORE, from, e.id, { km: 0, one: 0, done: false });
      }
    });
  }

  // 元からある欄は同じ番号に上書き、足した欄は新しい番号で入れます
  list.forEach((t, i) => {
    Store.setItem(DRIVE_STORE, key, t.id || newId(i), {
      done: true,
      d,
      by: drvName,
      one: driveKm(t.legs[0]),  // 入れた最初の数字（経由地なしなら片道）
      // driveKm は「いくつでも足す」道具なので、map に直接渡すと
      // 添字まで足されてしまいます。1つずつ包んで渡すこと
      legs: t.legs.map((v) => driveKm(v)),  // 区間ごとの距離（編集で開き直すときに使います）
      km: tripKm(t),            // 実際に走った距離（合計はこちらで足します）
      round: !t.multi,          // 経由地が無い＝往復として2倍にした
    });
  });

  state.y = yy;
  state.m = mm;
  el.driveModal.classList.add('is-hidden');
  render();
}

/* ============================================================
 *  月送り
 * ============================================================ */
function shiftMonth(diff) {
  const m = state.m + diff;
  if (m < 1) { state.y--; state.m = 12; }
  else if (m > 12) { state.y++; state.m = 1; }
  else state.m = m;
  render();
}

/* ============================================================
 *  確認ダイアログ
 * ============================================================ */
let confirmResolve = null;

function askConfirm({ item, message, okLabel, danger }) {
  el.confirmItem.textContent = item || '';
  el.confirmMessage.textContent = message || '';
  el.confirmOk.textContent = okLabel || 'はい';
  el.confirmOk.classList.toggle('btn--danger', !!danger);
  el.confirmDialog.classList.remove('is-hidden');
  setTimeout(() => el.confirmOk.focus(), 50);

  return new Promise((resolve) => { confirmResolve = resolve; });
}

function closeConfirm(answer) {
  if (el.confirmDialog.classList.contains('is-hidden')) return;
  el.confirmDialog.classList.add('is-hidden');
  const resolve = confirmResolve;
  confirmResolve = null;
  if (resolve) resolve(answer);
}

/* ============================================================
 *  共有同期の状態表示・PIN
 * ============================================================ */
function renderSyncStatus() {
  const st = Sync.status();
  el.syncChip.classList.toggle('is-hidden', st.kind === 'off');
  if (st.kind !== 'off') {
    el.syncChip.className = 'sync-chip sync-chip--' + st.kind;
    el.syncChip.innerHTML = Sync.iconSvg(st.kind);
    el.syncChip.title = st.text + '（タップで今すぐ同期）';
    el.syncChip.setAttribute('aria-label', '同期の状態：' + st.text);
  }

  if (Sync.enabled()) {
    const n = Sync.outbox().length;
    const t = Sync.lastSyncAt;
    const at = t ? `（最終同期 ${t.getHours()}:${pad2(t.getMinutes())}）` : '';
    el.syncInfo.textContent = Sync.lastError
      ? `${Sync.lastError}（未送信 ${n}件。つながり次第、自動で送られます）`
      : n
        ? `未送信 ${n}件。まもなく送信されます。${at}`
        : `みんなの端末と同期できています。${at}`;
  } else {
    el.syncInfo.textContent = 'この端末の中だけで動いています。';
  }

  renderSyncWarn();
}

/**
 * 画面の上に出す帯
 *
 * ヘッダーの赤い丸は「何かおかしい」しか言いません。理由の文は title
 * （指では出ません）と設定の奥にしかなく、タブレットでは読めませんでした。
 * 赤の理由は3つあって、やることが全部ちがいます。ここに出して、
 * 見た人がそのまま伝えられるようにします。
 *
 * 出す順番は、直さないと records が欠ける方から先に出します。
 *   1. サーバーが受け取れなかった  … 送れたように見えて中身が入っていません
 *   2. まだ送れていない記録がある  … 橙。壊れてはいません
 *   3. 送れなかった理由            … 赤。電波か、混み合いか、不調か
 */
function renderSyncWarn() {
  if (!el.syncWarn) return;
  if (!Sync.enabled() || !Sync.pin()) {
    el.syncWarn.className = 'sync-warn is-hidden';
    return;
  }
  const 未送信 = Sync.outbox().length;

  if (Sync.serverWarn) {
    el.syncWarn.className = 'sync-warn';
    el.syncWarn.textContent = Sync.serverWarn;
    return;
  }
  if (Sync.lastError) {
    el.syncWarn.className = 'sync-warn';
    // ★理由の文（js/sync.js）に足すのは、この画面でしか言えないことだけです。
    //   「入力は消えません」はあちらが言うので、ここでは重ねません
    el.syncWarn.textContent = Sync.lastError
      + (未送信 ? `　未送信 ${未送信}件。` : '　')
      + 'ヘッダーのしるしを押すと、いま送り直します';
    return;
  }
  if (未送信) {
    el.syncWarn.className = 'sync-warn is-waiting';
    el.syncWarn.textContent = `まだ送れていない記録が ${未送信}件 あります。`
      + '電波の届くところでアプリを開いたままにしてください。'
      + '送れるまで、ほかの人の画面には出ません';
    return;
  }
  el.syncWarn.className = 'sync-warn is-hidden';
}

function openPinModal(message) {
  el.pinInput.value = '';
  el.pinError.textContent = message || '';
  el.pinModal.classList.remove('is-hidden');
  setTimeout(() => el.pinInput.focus(), 50);
}

async function submitPin() {
  // 全角で入れても通るように、半角に直してから確かめます
  const pin = toHalfWidth(el.pinInput.value).trim();
  if (!pin) { el.pinError.textContent = 'PINを入力してください。'; return; }
  el.pinError.textContent = '確認中…';
  Sync.setPin(pin);
  await Sync.flush();
  if (Sync.pin()) {
    el.pinModal.classList.add('is-hidden');
    Sync.start();
    render();
  } else {
    el.pinError.textContent = Sync.lastError || 'PINが違います。もう一度入力してください。';
  }
}

/* ============================================================
 *  イベント登録
 * ============================================================ */
function bindEvents() {
  $('drivePrev').addEventListener('click', () => shiftMonth(-1));
  $('driveNext').addEventListener('click', () => shiftMonth(1));
  $('driveThisMonth').addEventListener('click', () => {
    state.y = TODAY.y; state.m = TODAY.m; render();
  });

  $('driveAddBtn').addEventListener('click', () => openForm());
  el.driveSave.addEventListener('click', saveEntry);
  el.drvAddLeg.addEventListener('click', () => { addTrip(true); renderForm(); });
  document.querySelectorAll('[data-close-drive]').forEach((n) => {
    n.addEventListener('click', () => el.driveModal.classList.add('is-hidden'));
  });

  /* 確認ダイアログ */
  el.confirmOk.addEventListener('click', () => closeConfirm(true));
  document.querySelectorAll('[data-confirm-cancel]').forEach((n) => {
    n.addEventListener('click', () => closeConfirm(false));
  });

  /* 設定 */
  $('settingsBtn').addEventListener('click', () => {
    renderSyncStatus();
    // ヘッダーのしるしが何を表しているかの一覧（実物と同じ絵を並べます）
    el.syncLegend.innerHTML = Sync.legendHtml();
    const v = Updater.current();
    el.appVersionText.innerHTML = v
      ? `いま入っているのは <b>${v}</b> です。`
      : '（手元で開いているため、版の番号はありません）';
    el.modal.classList.remove('is-hidden');
  });
  document.querySelectorAll('[data-close]').forEach((n) => {
    n.addEventListener('click', () => el.modal.classList.add('is-hidden'));
  });
  $('syncNow').addEventListener('click', () => Sync.flush());
  $('pinChange').addEventListener('click', () => {
    el.modal.classList.add('is-hidden');
    openPinModal();
  });
  $('forceUpdate').addEventListener('click', () => Updater.force());

  /* PIN */
  $('pinOk').addEventListener('click', submitPin);
  $('pinReveal').addEventListener('click', () => {
    const show = el.pinInput.type === 'password';
    el.pinInput.type = show ? 'text' : 'password';
    $('pinReveal').textContent = show ? '隠す' : '表示';
  });
  el.pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitPin(); });
  bindHalfWidthInput(el.pinInput, 'code');

  el.syncChip.addEventListener('click', () => Sync.flush());

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeConfirm(false);
    el.driveModal.classList.add('is-hidden');
    el.modal.classList.add('is-hidden');
  });
}

/* ============================================================
 *  起動
 * ============================================================ */
(async function init() {
  // ★保存先を先に用意します（失敗しても、いままでの場所で動きます）
  await Store.boot();
  window.addEventListener('pagehide', () => Store.flushNow());

  /* ヘッダーの絵はホーム画面のアイコンと同じもの */
  const shop = getStore(DRIVE_SHOP);
  const img = document.createElement('img');
  img.alt = '配達記録';
  img.addEventListener('error', () => {
    el.driveLogo.classList.add('is-fallback');
    img.remove();
  });
  img.src = ASSET_BASE + DRIVE_ICON;
  el.driveLogo.appendChild(img);
  if (shop) el.driveLogo.style.setProperty('--chip-color', shop.color);

  /* 管理側（マイン ?from=mine ／ オーナー ?from=owner）から開いたときだけ、
     ホームに戻るボタンを出します。
     店舗のタブレットは配達記録だけを入れるので、戻り先がありません。

     いちど来たことは端末に覚えさせます。読み直しでURLの印が消えても
     ボタンが残るようにするためです（アプリを閉じると忘れます）。 */
  const FROM_HUB = 'fromMine';
  if (/(^|[?&])from=(mine|owner)([&#]|$)/.test(location.search)) {
    try { sessionStorage.setItem(FROM_HUB, '1'); } catch (e) { /* 使えない端末もあります */ }
  }
  let cameFromHub = false;
  try { cameFromHub = sessionStorage.getItem(FROM_HUB) === '1'; } catch (e) { /* 同上 */ }
  if (cameFromHub) el.toOwnerBtn.classList.remove('is-hidden');

  bindEvents();
  render();

  Updater.start();
  Sync.onChange = renderSyncStatus;
  if (Sync.enabled()) {
    if (!Sync.pin()) openPinModal();
    else Sync.start();
  }
})();
