/* ============================================================
 *  配達記録（バグるの交通費）
 *
 *  作り
 *    ・お店ではなく「人」と「月」でまとめます。1件＝1配達です
 *    ・入れるのは片道の距離だけ。往復分（2倍）にして足していきます
 *    ・支払う金額は、1件ごとではなく「その月の合計距離」から出します
 *      （5kmごとに100円・100円未満は切り上げ）
 *
 *  記録の入れ先は  _drive/2026-08  なので、他の分野と同じ同期の仕組みを
 *  そのまま使えます。設定の追加もいりません。
 *  （★2026-09-19 から、同期の本体は Cloudflare です。スプレッドシートは5分ごとの写しです）
 *
 *  名前の追加・削除は T3 Works Manage（バグる → 交通費）で行います。
 * ============================================================ */

const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();

/* 「今日」は業務上の今日。朝6時（APP.dayStartHour）より前は前の日あつかいです。
   夜中に帰ってきて入れても、その日の営業分として入ります。
   ★使うたびに出し直します。前は開いたときに1回だけ決めていたので、
     タブレットを開いたままにすると、朝6時や月をまたいでも
     「走った日」の初めの値と「今月」が前のままでした（2026-09-19、マニュアルの指摘） */
function 今日() {
  const t = businessDate();
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
}

const state = (() => { const t = 今日(); return { y: t.y, m: t.m }; })();

/* 画面に戻ってきたとき、「今月」を見ていたのに月が変わっていたら、新しい月へ移ります。
   ★自分で前の月・次の月を開いていたときは動かしません。
   ★入れる画面の「走った日」は書きかえません。日付を手で直している最中に、
     画面に戻っただけで変わると困るためです（初めの値は開いたときに決めます） */
let 見ていた今月 = { y: state.y, m: state.m };
function 月が変わったら追う() {
  const t = 今日();
  const 前 = 見ていた今月;
  見ていた今月 = { y: t.y, m: t.m };
  if (前.y === t.y && 前.m === t.m) return;          // 月は変わっていません
  if (state.y !== 前.y || state.m !== 前.m) return;  // 自分で別の月を見ています
  state.y = t.y;
  state.m = t.m;
  render();
}

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
  changeModal: $('changeModal'), chgOrders: $('chgOrders'), chgAddOrder: $('chgAddOrder'),
  chgHint: $('chgHint'), chgBills: $('chgBills'), chgBillNote: $('chgBillNote'),
  chgTotal: $('chgTotal'), chgPieces: $('chgPieces'), chgRows: $('chgRows'),
  chgFoot: $('chgFoot'), chgCheck: $('chgCheck'), chgError: $('chgError'), chgWhy: $('chgWhy'),
  modal: $('modal'), syncChip: $('syncChip'), syncInfo: $('syncInfo'), syncLegend: $('syncLegend'),
  syncWarn: $('syncWarn'), syncLog: $('syncLog'), syncLogClear: $('syncLogClear'),
  pinModal: $('pinModal'), pinInput: $('pinInput'), pinError: $('pinError'),
  pinMessage: $('pinMessage'), codeInput: $('codeInput'), codeLater: $('codeLater'),
  codeInfo: $('codeInfo'), codeField: $('codeField'), pinCancel: $('pinCancel'),
  helpLink: $('helpLink'), helpNote: $('helpNote'),
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
 * 登録されている人は、記録がなくても行を出します（Numbersの表と同じ）。
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
  const t = 今日();   // ★開いたときに出し直します（開いたままの日またぎで古くならないように）
  el.drvDate.value = drvEditing ? drvEditing.d : ymd(t.y, t.m, t.d);
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
  開いたときの中身 = フォームの中身();
  el.driveModal.classList.remove('is-hidden');
}

/* ------------------------------------------------------------
 *  閉じる
 *
 *  ★外の暗い所（と Esc）で閉じるときは、入れた内容があれば聞きます。
 *    前は聞かずに閉じて、入れた距離や名前が消えていました
 *    （2026-09-19、マニュアルの指摘）。指が外に触れただけで起きます。
 *  ★「やめる」ボタンは、はっきり押したものなので、今までどおりすぐ閉じます。
 * ------------------------------------------------------------ */
let 開いたときの中身 = '';

/** いまの入れる画面の中身（日・名前・欄の文字）。開いたときと見くらべるためのものです */
function フォームの中身() {
  return JSON.stringify({
    d: el.drvDate.value,
    name: drvName,
    rows: [...el.drvLegs.children].map((row) => [row.dataset.id || '',
      ...[...row.querySelectorAll('.drive-route__input')].map((x) => x.value)]),
  });
}

function フォームを閉じる() {
  el.driveModal.classList.add('is-hidden');
}

async function 聞いてから閉じる() {
  if (el.driveModal.classList.contains('is-hidden')) return;
  if (フォームの中身() !== 開いたときの中身) {
    const ok = await askConfirm({
      item: '入れた内容は、まだ記録されていません',
      message: '閉じると、入れた距離や名前は消えます。',
      okLabel: '消して閉じる',
      danger: true,
    });
    if (!ok) return;
  }
  フォームを閉じる();
}

/**
 * 記録から「区間の距離の並び」を取り出す
 *   経由地なし … [片道]         （保存時に2倍します）
 *   経由地あり … [区間1, 区間2, …]（そのまま足します）
 * legs がない古い記録は、往復として入れてあるので片道に戻します。
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

/**
 * 1回分ずつ、欄の埋まり方を見ます
 *
 *   全部空   … 何も入れていない回（「＋ もう1回分入れる」を押したまま、など）
 *   全部よい … どの欄にも 0 より大きい数が入っている回。記録できるのはこれだけです
 *   一部だけ … 空の欄・0・読めない数がまざっている回
 *
 * ★前は「全部よい」回だけを拾って、他は**黙って外していました。**
 *   直すときに経由地を足して空のまま「直す」を押すと、その回が元の月から消えていました
 *   （交通費の記録が黙って消える。2026-09-19、マニュアルの指摘）。
 *   いまは記録する前に止めます（`止める回`）。
 */
function tripRows() {
  return [...el.drvLegs.children].map((row, i) => {
    const inputs = [...row.querySelectorAll('.drive-route__input')];
    // 全角で入っていても読めるよう、半角に直してから数字にします
    const raw = inputs.map((x) => toHalfWidthNumber(x.value));
    const legs = raw.map(Number);
    const よい = legs.map((v, k) => raw[k] !== '' && v > 0);
    const 形 = raw.every((v) => v === '') ? '全部空'
      : よい.every(Boolean) ? '全部よい' : '一部だけ';
    return {
      no: i + 1, id: row.dataset.id || '', legs, multi: legs.length > 1, 形,
      まだの欄: inputs.find((x, k) => !よい[k]) || null,   // 止めたとき、ここに合わせます
    };
  });
}

/** 記録できる回だけ（全部の欄に距離が入っている回）。id は元の記録の番号 */
function legValues() {
  return tripRows().filter((t) => t.形 === '全部よい');
}

/**
 * 記録する前に止める回（理由つき）。なければ空の配列
 *
 *   一部だけの回                 … そのまま記録すると、その回が消えます
 *   元の記録がある回を空にした   … 黙って消さず、消すのは回の「×」だけにします
 *                                  （1回しかない日は「走った距離を入れてください」で止まります）
 * 新しく足して何も入れていない回は止めません。消える記録がないためです。
 */
function 止める回(rows) {
  return rows.flatMap((t) => {
    if (t.形 === '一部だけ') {
      return [{ t, なぜ: t.multi
        ? `${t.no}回目の区間に、空いている欄（または0）があります。距離を入れるか、要らない経由地を「×」で消してください。`
        : `${t.no}回目の距離が読めません。0より大きい数を入れてください。` }];
    }
    if (t.形 === '全部空' && t.id && rows.length > 1) {
      return [{ t, なぜ: `${t.no}回目の距離が空になっています。入れ直してください。`
        + 'この回をやめるときは、その回の「×」で消してください。' }];
    }
    return [];
  });
}

/** 選んだ名前と、それぞれの回が何kmになるかを出します */
function renderForm() {
  [...el.drvNames.children].forEach((b) => b.classList.toggle('is-current', b.dataset.name === drvName));

  // 何回目かの番号を振り直し、その回が何kmになるかも出し直す
  const rows = tripRows();
  [...el.drvLegs.children].forEach((row, i) => {
    const t = rows[i];
    row.querySelector('.drive-trip__no').textContent = `${t.no}回目`;
    const ok = t.形 === '全部よい';
    const km = ok ? tripKm(t) : 0;
    // 帰り道の説明は、打っているそばから距離を出します
    const auto = row.querySelector('.drive-route__auto');
    if (auto) auto.textContent = '帰りも同じ' + (t.legs[0] > 0 ? ' ' + kmText(t.legs[0]) : '') + '（自動）';

    row.querySelector('.drive-trip__total').textContent = ok
      ? (t.multi
        ? `${t.legs.length}区間 ／ 合計 ${kmText(km)}`
        : `往復 ${kmText(km)}（入れた ${kmText(t.legs[0])} の2倍）`)
      : t.multi ? '区間の距離を全て入れてください'
        : t.形 === '一部だけ' ? '0より大きい数を入れてください' : '';
    row.querySelector('.drive-trip__total').classList.toggle('is-on', ok);
  });
  // 1回分しかないときは、回ごと消すボタンを出さない
  el.drvLegs.classList.toggle('is-single', el.drvLegs.children.length === 1);

  const list = rows.filter((t) => t.形 === '全部よい');
  const 止め = 止める回(rows);
  const total = driveKm(...list.map(tripKm));
  // ★止まる回があるときは、それを先に言います。合計だけ出すと「記録できる」ように見えるためです
  if (止め.length) el.drvHint.textContent = `${止め.map((x) => x.t.no).join('・')}回目に、まだ入っていない欄があります（このままでは記録できません）`;
  else if (!list.length) el.drvHint.textContent = '走った距離を入れてください';
  else if (drvEditing) el.drvHint.textContent = `この日は ${list.length}回 ／ 合計 ${kmText(total)} に直します`;
  else el.drvHint.textContent = `${list.length}回分 ／ 合計 ${kmText(total)} として記録します`;
  el.drvHint.classList.toggle('is-on', list.length > 0 && !止め.length);

  // 間違いが一番起きるのは「まとめて回ったのに、1回ずつに分けて入れた」とき。
  // 2回以上あって、どれにも経由地がないときだけ声をかけます
  el.drvWarn.classList.toggle('is-hidden', !allRoundMulti(list));
}

/** 2回以上あって、どれにも経由地がないか（分けて入れてしまった疑い） */
function allRoundMulti(list) {
  return list.length >= 2 && list.every((t) => !t.multi);
}

async function saveEntry() {
  const d = el.drvDate.value;
  const rows = tripRows();
  const list = rows.filter((t) => t.形 === '全部よい');

  if (!d) { el.driveError.textContent = '走った日を入れてください。'; return; }
  if (!drvName) { el.driveError.textContent = '名前を選んでください。'; return; }
  // ★空の欄がある回は、ここで止めます。通すと、その回は記録されず、
  //   直すときは元の月からも消えます（下の「欄から消したもの」に数えられるため）
  const 止め = 止める回(rows);
  if (止め.length) {
    el.driveError.textContent = 止め[0].なぜ;
    if (止め[0].t.まだの欄) 止め[0].t.まだの欄.focus();
    return;
  }
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
      round: !t.multi,          // 経由地がない＝往復として2倍にした
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
 *  お釣りの用意（現金で受け取る配達に出る前に）
 *
 *  守ること
 *    お客さまが、注文の金額以上の**どんな出し方をしても**、
 *    ちょうどのお釣りを作れる分だけ持っていきます。
 *
 *  ★なぜ「一番多いお釣り」を持つだけでは足りないか
 *    3850円の注文に1万円札なら、お釣りは 6150円です。
 *    でも 4000円を出されれば 150円、4350円なら 500円。
 *    小銭を混ぜて出されるので、**お釣りは刻みごとに動きます。**
 *    だから要るのは「6150円を作れること」ではなく、
 *    **「0円から6150円まで、刻みごとに全部作れること」**です。
 *
 *  ★1の位が0の注文は、10円刻み（2026-10-30、ko-dai さんの指示）
 *    3850円のような注文では、**1〜9円のお釣りは出ません。**
 *    1円玉や5円玉を足して出しても、その分がそのまま返るだけで、
 *    持ち帰る小銭は減りません。そういう出し方をする人はいないからです。
 *    なので1の位が0の注文では、10円玉より細かいお金を持ちません（20枚 → 15枚）。
 *    1の位が0でない注文（3851円など）は、今までどおり1円刻みです。
 *    ★刻みは**件ごと**に見ます。まとめて行く中に両方が混ざっていれば、
 *      1円刻みの件の分だけ1円玉と5円玉を持っていきます。
 *    ★10の位には広げていません。「10の位も0なら10〜90円も出ない」は
 *      同じ形で成り立ちますが、決まったのは1の位だけです。
 *      広げるときは ko-dai さんに聞いてください。
 *
 *  作り方
 *    いま 0〜R円を刻みごとに全部作れるとき、**R+刻み 以下**の金種を1枚足すと、
 *    作れる範囲は 0〜R+d円 に伸びます。あいだは飛びません
 *    （R より大きい v は、v−d が 0〜R に入るので、その作り方にその1枚を足せます）。
 *    R+刻み を超える金種を足すと、作れない金額ができます。
 *    なので「R+刻み 以下で一番大きい金種」を、届くまで足していきます。
 *    日本のお金では、1円刻みなら 1円4・5円1・10円4・50円1・100円4・500円1・1000円4・5000円1 の
 *    **20枚（9999円）**、10円刻みなら 10円4・50円1・100円4・500円1・1000円4・5000円1 の
 *    **15枚（9990円）**で、1万円未満の全部が作れます。
 *
 *  ★何件かまとめて行くときは、件ごとに1組ずつ
 *    受け取ったお金は当てにできません。一番まずいのは**全員が1万円札を出すとき**で、
 *    受け取るのは1万円札ばかり。それはお釣りには使えません。
 *
 *  ★この画面は記録を作りません。
 *    端末の保存にも同期にも触らないので、押しても送信箱には何も積まれません。
 * ============================================================ */

/* お釣りに使う金種。2千円札は出回りが少ないので入れていません */
const お釣りの金種 = [10000, 5000, 1000, 500, 100, 50, 10, 5, 1];

const お釣りの呼び名 = {
  10000: '1万円札', 5000: '5千円札', 1000: '千円札',
  500: '500円玉', 100: '100円玉', 50: '50円玉',
  10: '10円玉', 5: '5円玉', 1: '1円玉',
};

/* お客さまが出す一番大きいお金。画面で選びます */
const お釣りの選べる額 = [
  { 円: 10000, 名: '1万円札' },
  { 円: 5000, 名: '5千円札' },
  { 円: 1000, 名: '千円札' },
];
let お釣りの大きいお金 = 10000;

/* 1件の注文として、ありえない額で止める線。入れまちがいを拾うためです */
const 注文の上限 = 200000;

/**
 * その注文で、お釣りが一番多くなるとき
 *
 * お客さまは、足りる一番少ない枚数で出します。
 *   3850円  → 1万円札1枚        → 6150円
 *   12000円 → 1万円札2枚（2万円）→ 8000円
 *   10000円 → ちょうど           → 0円
 * ★割り算を使わず余りで出します（小数にすると、ちょうどの金額が1円ずれることがあります）
 */
function お釣りの上限(金額) {
  if (!(金額 > 0)) return 0;
  const 余り = 金額 % お釣りの大きいお金;
  return 余り === 0 ? 0 : お釣りの大きいお金 - 余り;
}

/**
 * ★その注文で、お釣りの1の位が動くか（刻み）
 *
 * 1の位が0の注文（3850円など）では、1〜9円のお釣りは出ません。
 * 1円玉や5円玉を足して出しても、その分がそのまま返るだけだからです。
 * 1の位が0でない注文（3851円など）は、1円刻みのままです。
 */
function お釣りの刻み(金額) {
  return 金額 % 10 === 0 ? 10 : 1;
}

/**
 * 0円から M円まで、**刻みごとに**どの金額も作れる組（金種 → 枚数）
 *
 * 刻みで割り切れない金種は使いません（10円刻みなら、1円玉と5円玉は持ちません）。
 */
function お釣りの組(M, 刻み) {
  const 刻 = 刻み || 1;
  const 使える金種 = お釣りの金種.filter((d) => d % 刻 === 0);
  const 枚 = {};
  let R = 0;   // いま 0〜R円 を、刻みごとに全部作れます
  while (R < M) {
    const d = 使える金種.find((x) => x <= R + 刻);
    枚[d] = (枚[d] || 0) + 1;
    R += d;
  }
  return 枚;
}

/**
 * ★検算。その組で 0円〜M円を全部作れるか、刻みごとに数えます
 *
 * 作り方が正しければ必ず通ります。**通らなくなったのは、作り方が壊れたときです。**
 * 画面にも出すので、足りない組を黙って持っていく、ということが起きません。
 * 返すのは作れなかった金額。全部作れたら -1 です。
 * ★数え方は、上の組み立てとわざと変えてあります（1枚ずつ、作れる金額に印を付けていきます）。
 *   同じ考え方で数えると、まちがいも一緒にすり抜けます。
 */
function お釣りの作れない金額(枚, M, 刻み) {
  const 刻 = 刻み || 1;
  const できる = new Uint8Array(M + 1);
  できる[0] = 1;
  お釣りの金種.forEach((d) => {
    for (let k = 0; k < (枚[d] || 0); k++) {
      for (let v = M; v >= d; v--) if (できる[v - d]) できる[v] = 1;
    }
  });
  for (let c = 0; c <= M; c += 刻) if (!できる[c]) return c;
  /* ★刻みで割り切れない上限は、上の数えが飛ばします。そこだけもう一度見ます */
  if (M % 刻 !== 0 && !できる[M]) return M;
  return -1;
}

/**
 * ★刻みの検算。刻みを決めた所とは**別の見方**で、刻みが正しいかを見ます
 *
 * 刻みが正しいとは、**注文の金額がその刻みで割り切れること**です。
 * 割り切れないのに刻みを大きくすると、作れないお釣りが出ます
 * （3851円を10円刻みにすると、1円のお釣りが作れません）。
 *
 * ★上の検算は「刻みごとに」数えるので、**刻みがまちがっていると、数える所は素通りします。**
 *   いまは上の検算の**最後の1行**（刻みで割り切れない上限を見る所）が拾えます。
 *   でも拾えるのは、お客さまが出す札がどれも10の倍数で、1の位が0でない注文だと
 *   上限も10円で割り切れなくなるからです。**決まりそのものを見ているのではありません。**
 *   ここは「金額が刻みで割り切れる」という決まりを、直に見ます。
 *
 * 返すのは、まちがっているときのその刻み。正しければ 0 です。
 */
function お釣りの刻みのまちがい(金額, 刻み) {
  const 刻 = 刻み || 1;
  return 金額 % 刻 === 0 ? 0 : 刻;
}

/** 注文の欄を1つ足す */
function お釣りの件を足す(focus) {
  const row = document.createElement('div');
  row.className = 'drive-trip';

  const head = document.createElement('div');
  head.className = 'drive-trip__head';
  const no = document.createElement('span');
  no.className = 'drive-trip__no';
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'drive-trip__del';
  del.textContent = '×';
  del.title = 'この件を消す';
  del.addEventListener('click', () => {
    // 最後の1つは消さずに空にします（欄がなくなると入れられなくなるため）
    if (el.chgOrders.children.length > 1) row.remove();
    else row.querySelector('.field__input').value = '';
    renderChange();
  });
  head.append(no, del);

  const input = document.createElement('input');
  // type="number" は全角の数字を弾いて空にしてしまうので text にします
  input.type = 'text';
  input.className = 'field__input';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.placeholder = '3850';
  bindNumericInput(input);
  input.addEventListener('input', renderChange);

  const sub = document.createElement('p');
  sub.className = 'drive-trip__total';

  row.append(head, input, sub);
  el.chgOrders.appendChild(row);
  if (focus) input.focus();
  return row;
}

/** 「お客さまが出す一番大きいお金」の3つのボタン */
function お釣りの額のボタンを描く() {
  el.chgBills.innerHTML = '';
  お釣りの選べる額.forEach((x) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'doer-btn';
    b.textContent = x.名;
    b.addEventListener('click', () => { お釣りの大きいお金 = x.円; renderChange(); });
    b.dataset.yen = String(x.円);
    el.chgBills.appendChild(b);
  });
}

function お釣りの円(n) {
  return '¥' + (Number(n) || 0).toLocaleString('ja-JP');
}

/** 入れた金額を1件ずつ読みます（読めない欄は、黙って外さずに止めます） */
function お釣りの件を読む() {
  return [...el.chgOrders.children].map((row, i) => {
    const input = row.querySelector('.field__input');
    const 文字 = toHalfWidthNumber(input.value);
    const 数 = Number(文字);
    const 空 = 文字 === '';
    const よい = !空 && Number.isInteger(数) && 数 > 0 && 数 <= 注文の上限;
    let なぜ = '';
    if (!空 && !よい) {
      なぜ = 数 > 注文の上限
        ? `${i + 1}件目が${お釣りの円(注文の上限)}を超えています。入れまちがいではありませんか？`
        : `${i + 1}件目の金額が読めません。1円単位の数で入れてください。`;
    }
    return { no: i + 1, row, 空, よい, なぜ, 円: よい ? 数 : 0 };
  });
}

/**
 * 画面を出し直す
 *
 * ★入っているのに読めない欄があるときは、**結果を出しません。**
 *   出すと、その件を数えていない額を持っていくことになります
 *   （この画面と同じまちがいを、入れる画面で一度しています。2026-09-19）。
 *   何も入れていない空の欄は、数えないだけで止めません。
 */
function renderChange() {
  const 件 = お釣りの件を読む();
  [...el.chgOrders.children].forEach((row, i) => {
    row.querySelector('.drive-trip__no').textContent = `${i + 1}件目`;
  });
  [...el.chgBills.children].forEach((b) => {
    b.classList.toggle('is-current', Number(b.dataset.yen) === お釣りの大きいお金);
  });
  const 選んだ = お釣りの選べる額.find((x) => x.円 === お釣りの大きいお金);
  el.chgBillNote.textContent = お釣りの大きいお金 === 10000
    ? '1万円札を出されても足りる分を用意します。'
    : `★${選んだ.名}より大きいお金を出されたら足りません。出ないと分かっているときだけ選んでください。`;

  const 止め = 件.find((x) => x.なぜ);
  el.chgError.textContent = 止め ? 止め.なぜ : '';

  const 使う = 止め ? [] : 件.filter((x) => x.よい);
  const 合計枚 = {};
  let 一番多いとき = 0;
  let 数えた = 0;
  let 作れない = -1;
  let 作れない件 = 0;
  let 刻みが変 = 0;   // ★刻みそのものがまちがっていた件（上の検算では拾えません）

  使う.forEach((x) => {
    x.上限 = お釣りの上限(x.円);
    x.刻み = お釣りの刻み(x.円);
    x.枚 = お釣りの組(x.上限, x.刻み);
    一番多いとき += x.上限;
    /* ★割り算は、割り切れる形にしてから（余りを引いてから）使います */
    数えた += (x.上限 - x.上限 % x.刻み) / x.刻み + 1;
    const ng = お釣りの作れない金額(x.枚, x.上限, x.刻み);
    if (ng >= 0 && 作れない < 0) { 作れない = ng; 作れない件 = x.no; }
    if (お釣りの刻みのまちがい(x.円, x.刻み) && !刻みが変) 刻みが変 = x.no;
    Object.keys(x.枚).forEach((d) => { 合計枚[d] = (合計枚[d] || 0) + x.枚[d]; });
  });

  /* 1件ずつの行に「この件のお釣りは、いくらからいくらまで」を出します */
  件.forEach((x) => {
    const sub = x.row.querySelector('.drive-trip__total');
    if (!x.よい || 止め) { sub.textContent = ''; sub.classList.remove('is-on'); return; }
    if (x.上限 === 0) {
      sub.textContent = `${選んだ.名}でちょうどです。この件のお釣りは要りません`;
    } else if (x.刻み === 10) {
      sub.textContent = `お釣りは ${お釣りの円(0)}〜${お釣りの円(x.上限)} の10円刻みのどれかです`
        + '（1の位が0なので、1〜9円は出ません）';
    } else {
      sub.textContent = `お釣りは ${お釣りの円(0)}〜${お釣りの円(x.上限)} の1円刻みのどれかです`;
    }
    sub.classList.toggle('is-on', x.上限 > 0);
  });

  /* 持っていくお金の表 */
  let 合計金額 = 0;
  let 枚数 = 0;
  el.chgRows.innerHTML = '';
  お釣りの金種.forEach((d) => {
    const n = 合計枚[d] || 0;
    if (!n) return;
    合計金額 += d * n;
    枚数 += n;
    const tr = document.createElement('tr');
    const 名 = document.createElement('td');
    名.className = 'exp-total__name';
    名.textContent = お釣りの呼び名[d];
    const 枚 = document.createElement('td');
    枚.className = 'exp-total__yen';
    枚.textContent = `${n}枚`;
    const 額 = document.createElement('td');
    額.className = 'exp-total__yen';
    額.textContent = お釣りの円(d * n);
    tr.append(名, 枚, 額);
    el.chgRows.appendChild(tr);
  });

  el.chgFoot.innerHTML = '';
  if (枚数) {
    const tr = document.createElement('tr');
    tr.className = 'drive-foot';
    const 名 = document.createElement('td');
    名.className = 'exp-total__name';
    名.textContent = '合計';
    const 枚 = document.createElement('td');
    枚.className = 'exp-total__yen';
    枚.textContent = `${枚数}枚`;
    const 額 = document.createElement('td');
    額.className = 'exp-total__yen';
    額.textContent = お釣りの円(合計金額);
    tr.append(名, 枚, 額);
    el.chgFoot.appendChild(tr);
  }

  el.chgTotal.textContent = 枚数 ? お釣りの円(合計金額) : '—';
  el.chgPieces.textContent = 枚数 ? `${枚数}枚` : '';

  /* 上の1行。何件分を数えたか */
  if (止め) el.chgHint.textContent = '読めない欄があります。直すと、持っていくお金を出します';
  else if (!使う.length) el.chgHint.textContent = '注文の金額を入れてください';
  else el.chgHint.textContent = `${使う.length}件分。出ていくお釣りは、一番多いときで ${お釣りの円(一番多いとき)} です`;
  el.chgHint.classList.toggle('is-on', !!使う.length && !止め);

  /* ★検算の結果。黙らせないために、通ったときも数を出します */
  if (!使う.length) {
    el.chgCheck.textContent = '';
    el.chgCheck.classList.remove('is-on');
  } else if (刻みが変) {
    el.chgCheck.textContent = `★${刻みが変}件目の刻みがまちがっています`
      + '（金額が刻みで割り切れません）。'
      + 'この組はまちがっています。こうだいさんに、この文をそのまま伝えてください';
    el.chgCheck.classList.remove('is-on');
  } else if (作れない >= 0) {
    el.chgCheck.textContent = `★${作れない件}件目で ${お釣りの円(作れない)} が作れません。`
      + 'この組はまちがっています。こうだいさんに、この文をそのまま伝えてください';
    el.chgCheck.classList.remove('is-on');
  } else {
    const 刻み注 = 使う.every((x) => x.刻み === 10) ? '10円刻みで' : '';
    el.chgCheck.textContent = `どの出し方でも作れることを${刻み注}数えました`
      + `（${数えた.toLocaleString('ja-JP')}通り）`;
    el.chgCheck.classList.add('is-on');
  }

  /* 下の説明。刻みと、件ごとに1組ずつの理由を、入っているものに合わせて出します */
  const 文 = [];
  if (使う.length) {
    文.push('お釣りは、お客さまの出し方で0円から一番多いときまでの、どの金額にもなります。'
      + 'そのため「一番多い金額を作れる分」ではなく「その範囲を全部作れる分」を出しています。');
    const 十円刻み = 使う.filter((x) => x.刻み === 10).length;
    if (十円刻み === 使う.length) {
      文.push('注文の1の位が0なので、1〜9円のお釣りは出ません'
        + '（1円玉や5円玉を足して出しても、その分がそのまま返るだけです）。'
        + 'だから10円玉より細かいお金は持っていきません。');
    } else if (十円刻み) {
      文.push('1の位が0でない注文が混ざっています。その件は小銭を混ぜて出されると'
        + '1円単位で動くので、その件の分だけ1円玉と5円玉を持っていきます。');
    } else {
      文.push('1の位が0でない注文なので、小銭を混ぜて出されると1円単位で動きます。');
    }
    if (使う.length > 1) {
      文.push('件ごとに1組ずつ数えています。受け取ったお金は当てにできません'
        + '（全員が1万円札を出すと、受け取るのは1万円札ばかりで、お釣りには使えません）。');
    }
  }
  el.chgWhy.textContent = 文.join('');
}

/** 画面を開く */
function openChange() {
  if (!el.chgOrders.children.length) お釣りの件を足す();
  renderChange();
  el.changeModal.classList.remove('is-hidden');
  const 初め = el.chgOrders.querySelector('.field__input');
  if (初め) setTimeout(() => 初め.focus(), 50);
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
    // ★静かに送り直している最中は空になります（Sync.shownError）。赤と同じ条件で出します
    el.syncInfo.textContent = Sync.shownError()
      ? `${Sync.shownError()}（未送信 ${n}件。つながり次第、自動で送られます）`
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
 * 赤の理由はいくつかあって、やることが全部ちがいます。ここに出して、
 * 見た人がそのまま伝えられるようにします。
 * ★理由の文そのものは js/sync.js の `この失敗はなにか()` が正です。
 *   ここに数や文を書き写さないこと（前に「3つ」と書き、増えたあと古くなりました）。
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
  // ★静かに送り直している最中は出しません（Sync.shownError）。ヘッダーの丸と同じ条件です
  if (Sync.shownError()) {
    el.syncWarn.className = 'sync-warn';
    // ★理由の文（js/sync.js）に足すのは、この画面でしか言えないことだけです。
    //   「入力は消えません」はあちらが言うので、ここでは重ねません
    el.syncWarn.textContent = Sync.shownError()
      + (未送信 ? `　未送信 ${未送信}件。` : '　')
      + 'ヘッダーの印を押すと、今すぐ送り直します';
    return;
  }
  if (未送信) {
    el.syncWarn.className = 'sync-warn is-waiting';
    el.syncWarn.textContent = `まだ送れていない記録が ${未送信}件 あります。`
      + '電波の届くところでアプリを開いたままにしてください。'
      + '送れるまで、他の人の画面には出ません';
    return;
  }
  el.syncWarn.className = 'sync-warn is-hidden';
}

/* ★番号まわりは、ワークス（js/app.js の openPinModal・submitPin）と同じ作りです。
     `js/sync.js` を共有しているので、マネージで「番号を必須にする」を押すと
     **配達記録もサーバーに止められます。**前は合言葉の画面しかなく、
     バグるのタブレットが赤いまま何もできなくなるところでした（2026-09-16、本部）。 */
/* ★「PINを入れ直す」から開いたときだけ true。
     前は同じ入口を通っていたので、PINが入っている端末では番号の欄しか出ず、
     PINを入れ直せませんでした（2026-09-19、マニュアルの指摘） */
let PINを入れ直す = false;

function openPinModal(message, opts = {}) {
  PINを入れ直す = !!opts.入れ直す;
  el.pinInput.value = '';
  el.pinError.textContent = message || '';
  // ★PINが入っているなら、聞くのは番号だけです（「PINを入れ直す」のときを除きます）
  const 番号だけ = !!Sync.pin() && !PINを入れ直す;
  el.pinInput.closest('.pin-row').classList.toggle('is-hidden', 番号だけ);
  // ★入れ直すときは番号の欄を出しません。番号は設定の「番号を入れる」から別に入れます
  el.codeField.classList.toggle('is-hidden', PINを入れ直す);
  $('pinTitle').textContent = PINを入れ直す ? '合言葉（PIN）を入れ直してください'
    : 番号だけ ? '番号を入れてください' : '合言葉（PIN）を入力してください';
  el.pinMessage.innerHTML = PINを入れ直す
    ? '新しい合言葉を入れて「開く」を押します。<br>まちがっていたときは、いまの合言葉のままにします。'
    : 番号だけ
      ? 'この端末から記録を送るための番号です。<br>一度入れれば、この端末では次回から不要です。'
      : '記録を全員で共有するために必要です。<br>一度入力すれば、この端末では次回から不要です。';
  el.codeInput.value = Sync.code();
  /* 「あとで」は、PINが通っていて、**サーバーがまだ番号を求めていない**あいだだけ出します。
     求められたあとに閉じても、同期できずに赤いままになるためです */
  el.codeLater.classList.toggle('is-hidden', !番号だけ || !!Sync.needStaffCode);
  // 「やめる」は入れ直すときだけです（はじめての合言葉は、入れるまで閉じません）
  el.pinCancel.classList.toggle('is-hidden', !PINを入れ直す);
  el.pinModal.classList.remove('is-hidden');
  setTimeout(() => (番号だけ ? el.codeInput : el.pinInput).focus(), 50);
}

/** 設定の「番号」の行 */
function renderCodeInfo() {
  const 名 = Sync.myName();
  el.codeInfo.textContent = 名
    ? `「${名}」の番号が入っています。`
    : Sync.code()
      ? '番号は入っていますが、まだ確かめられていません。「今すぐ同期」を押してください。'
      : '番号は入っていません。';
}

/**
 * 「PINを入れ直す」
 *
 * ★確かめは `Sync.ping()` で1回だけします。
 *   ・同期（flush）は、まちがったPINを受け取ると**端末のPINを消します**（js/sync.js の bad_pin）。
 *     入れ直しをまちがえただけで、今まで動いていたPINまでなくなるので使いません。
 *     ping はPINを消しません。だめだったら、入れ直す前のPINに戻します
 *   ・まちがったPINの ping は、同期と同じ締め出しの数（pinFail）に数えられます。
 *     10分に10回で**全店舗が約10分締め出されます。**自動で送り直さないこと。
 *     二度押しで2回飛ばないよう、確かめ中は受け付けません（本部、2026-09-19）
 */
let PINを確かめ中 = false;

async function PINを入れ替える() {
  if (PINを確かめ中) return;
  const pin = toHalfWidth(el.pinInput.value).trim();
  if (!pin) { el.pinError.textContent = 'PINを入力してください。'; return; }
  const 前のPIN = Sync.pin();
  PINを確かめ中 = true;
  el.pinError.textContent = '確認中…';
  try {
    Sync.setPin(pin);
    const res = await Sync.ping();
    // ★need_staff_code は「PINは合っている。番号が要る」という返事です
    if (res.ok || res.code === 'need_staff_code') {
      PINを入れ直す = false;
      if (!res.ok) { openPinModal('合言葉は通りました。番号を入れてください。'); return; }
      el.pinModal.classList.add('is-hidden');
      Sync.start(); render();
      Sync.scheduleFlush(0);
      return;
    }
    // だめだったときは、入れ直す前のPINに戻します（消さずに残す）
    if (前のPIN) Sync.setPin(前のPIN); else Sync.clearPin();
    el.pinError.textContent = res.code === 'bad_pin'
      ? 'PINが違います。入れ直す前のPINのままにしてあります。'
      : res.code === 'locked'
        ? 'PINの入力を続けて間違えたため、しばらく受け付けません（約10分）。入れ直す前のPINのままにしてあります。'
        : `${res.error || '確かめられませんでした。'}（入れ直す前のPINのままにしてあります）`;
  } finally {
    PINを確かめ中 = false;
  }
}

async function submitPin() {
  if (PINを入れ直す) return PINを入れ替える();
  // 全角で入れても通るように、半角に直してから確かめます
  if (Sync.pin()) {
    // PINは通っています。番号だけ確かめます
    const code = toHalfWidth(el.codeInput.value).trim();
    if (!code) { el.pinError.textContent = '番号を入れてください。'; return; }
    el.pinError.textContent = '確認中…';
    Sync.setCode(code);
    const res = await Sync.ping();
    if (res.ok && res.who) {
      el.pinModal.classList.add('is-hidden');
      Sync.start(); render();
      // ★番号が要ると言われて止まっていた分を、すぐ送ります
      Sync.scheduleFlush(0);
    } else if (res.ok) {
      // ★通ったのに「誰か」が返ってこない＝登録されていない番号です（必須にする前は止められません）
      Sync.clearCode();
      el.pinError.textContent = 'この番号は登録されていません。渡された6桁を確かめてください。';
    } else {
      // ★番号がまちがっていても、PINは消しません
      el.pinError.textContent = res.error || 'この番号は使えません。';
    }
    return;
  }
  const pin = toHalfWidth(el.pinInput.value).trim();
  if (!pin) { el.pinError.textContent = 'PINを入力してください。'; return; }
  el.pinError.textContent = '確認中…';
  Sync.setPin(pin);
  const code = toHalfWidth(el.codeInput.value).trim();
  if (code) Sync.setCode(code);
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
    const t = 今日();   // ★押したときの今日です（開いたままでも古くなりません）
    state.y = t.y; state.m = t.m; render();
  });
  // 画面に戻ってきたとき（タブレットの画面が点いたとき）に、月が変わっていないか見ます
  document.addEventListener('visibilitychange', () => { if (!document.hidden) 月が変わったら追う(); });
  window.addEventListener('pageshow', 月が変わったら追う);

  $('driveAddBtn').addEventListener('click', () => openForm());
  /* お釣りの用意。記録を作らない画面なので、閉じるときに聞きません */
  $('driveChangeBtn').addEventListener('click', openChange);
  el.chgAddOrder.addEventListener('click', () => お釣りの件を足す(true));
  document.querySelectorAll('[data-close-change]').forEach((n) => {
    n.addEventListener('click', () => el.changeModal.classList.add('is-hidden'));
  });
  el.driveSave.addEventListener('click', saveEntry);
  el.drvAddLeg.addEventListener('click', () => { addTrip(true); renderForm(); });
  /* 閉じる。外の暗い所は、入れた内容があれば聞いてから閉じます。
     「やめる」ボタンは、はっきり押したものなので、すぐ閉じます */
  document.querySelectorAll('[data-close-drive]').forEach((n) => {
    const 外 = n.classList.contains('modal__backdrop');
    n.addEventListener('click', () => (外 ? 聞いてから閉じる() : フォームを閉じる()));
  });

  /* 確認ダイアログ */
  el.confirmOk.addEventListener('click', () => closeConfirm(true));
  document.querySelectorAll('[data-confirm-cancel]').forEach((n) => {
    n.addEventListener('click', () => closeConfirm(false));
  });

  /* 設定 */
  $('settingsBtn').addEventListener('click', () => {
    renderSyncStatus();
    renderCodeInfo();
    // ヘッダーのしるしが何を表しているかの一覧（実物と同じ絵を並べます）
    el.syncLegend.innerHTML = Sync.legendHtml();
    /* ★赤くなった記録。**開いたときに書きます。**
         赤は次の同期が通った瞬間に消えるので、その場で見張らせるのではなく、
         あとから読める形にしてあります（ワークス・マネージと同じ Sync.logHtml()） */
    el.syncLog.innerHTML = Sync.logHtml();
    const v = Updater.current();
    el.appVersionText.innerHTML = v
      ? `今入っているのは <b>${v}</b> です。`
      : '（手元で開いているため、版の番号はありません）';
    el.modal.classList.remove('is-hidden');
  });
  document.querySelectorAll('[data-close]').forEach((n) => {
    n.addEventListener('click', () => el.modal.classList.add('is-hidden'));
  });
  $('syncNow').addEventListener('click', () => Sync.flush());
  /* ★赤くなった記録を消す。あとから読むためのものなので、消すと戻せません。
       ★聞く画面（confirmDialog）は、設定の画面より**あとに**置いてあります。
         `.modal` は同じ z-index なので、前にあると設定の下に隠れて押せません（index.html を見てください） */
  el.syncLogClear.addEventListener('click', async () => {
    const ok = await askConfirm({
      item: '赤くなった記録（この端末）',
      message: 'この端末に残っている記録を消します。消すと戻せません。',
      okLabel: '消す',
      danger: true,
    });
    if (!ok) return;
    Sync.clearLog();
    el.syncLog.innerHTML = Sync.logHtml();
  });
  $('pinChange').addEventListener('click', () => {
    el.modal.classList.add('is-hidden');
    openPinModal('', { 入れ直す: true });
  });
  // 入れ直すのをやめる。PINは入れ直す前のまま（まだ何も変えていません）
  el.pinCancel.addEventListener('click', () => {
    if (PINを確かめ中) return;
    PINを入れ直す = false;
    el.pinModal.classList.add('is-hidden');
  });
  /* 使い方（help/drive/）。アプリの画面ではなく別のページです。
     ★ホーム画面のアプリにはブラウザの「戻る」がありません。電波がなく、
       まだ一度も開いたことがないと、戻る道のない「開けません」の画面で止まります。
       そのときだけ開かずに、ここに理由を出します（開いたことがあれば控えで開けます） */
  el.helpLink.addEventListener('click', async (e) => {
    el.helpNote.textContent = '';
    if (navigator.onLine !== false) return;
    e.preventDefault();
    let 控え = null;
    try { 控え = await caches.match(el.helpLink.href, { ignoreSearch: true }); } catch (err) { /* 控えが使えない端末 */ }
    if (控え) { location.href = el.helpLink.href; return; }
    el.helpNote.textContent = '電波が届いていないので、使い方を開けません。電波のあるところで、もう一度押してください。';
  });
  $('codeChange').addEventListener('click', () => {
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
  el.codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !imeEnter(e)) submitPin(); });
  bindHalfWidthInput(el.codeInput, 'code');
  // ★「番号はあとで」。必須にする前だけの逃げ道です（必須のあとはサーバーが止めるので効きません）
  el.codeLater.addEventListener('click', () => {
    el.pinModal.classList.add('is-hidden');
    Sync.start(); render();
  });

  el.syncChip.addEventListener('click', () => Sync.flush());

  /* Esc … 上に出ているものから1つずつ閉じます。
     ★入れる画面は、外を押したときと同じく、入れた内容があれば聞きます */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!el.confirmDialog.classList.contains('is-hidden')) { closeConfirm(false); return; }
    if (!el.driveModal.classList.contains('is-hidden')) { 聞いてから閉じる(); return; }
    // お釣りの画面は、入れたものが記録になりません。聞かずに閉じます
    if (!el.changeModal.classList.contains('is-hidden')) {
      el.changeModal.classList.add('is-hidden');
      return;
    }
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

  /* ワークスから来たとき（?from=works）は、同じボタンを「ワークスに戻る」に変えて出します
     （2026-10-12・本部が足した。ko-dai さんの指示で、マネージで決めた人のワークスに、配達記録の入口を出したため）。
     戻り先は、ワークスのバグるの業務一覧です。
     ★管理側の印（fromMine）とは別に覚えます。URL に印が付いている方（いま来た方）に合わせます */
  const FROM_WORKS = 'fromWorks';
  try {
    if (/(^|[?&])from=works([&#]|$)/.test(location.search)) {
      sessionStorage.setItem(FROM_WORKS, '1');
      sessionStorage.removeItem(FROM_HUB);
    } else if (/(^|[?&])from=(mine|owner)([&#]|$)/.test(location.search)) {
      sessionStorage.removeItem(FROM_WORKS);
    }
    if (sessionStorage.getItem(FROM_WORKS) === '1') {
      el.toOwnerBtn.href = '../#/baguru';
      el.toOwnerBtn.title = 'ワークスに戻る';
      const 字 = el.toOwnerBtn.querySelectorAll('span');
      if (字.length >= 2) { 字[0].textContent = '←'; 字[1].textContent = 'ワークス'; }
      el.toOwnerBtn.classList.remove('is-hidden');
    }
  } catch (e) { /* 使えない端末もあります（そのときは、戻るボタンが出ないだけです） */ }

  bindEvents();
  お釣りの額のボタンを描く();
  お釣りの件を足す();
  render();

  Updater.start();
  /* ★使っている最中に「番号が要る」と言われたら、1回だけ番号を聞きます。
       何度も開くと入力の邪魔になるので、閉じたあとは設定の「番号を入れる」から開きます */
  let 番号を聞いた = false;
  Sync.onChange = () => {
    renderSyncStatus();
    if (Sync.needStaffCode && !番号を聞いた && el.pinModal.classList.contains('is-hidden')) {
      番号を聞いた = true;
      openPinModal(Sync.lastError || '番号を入れてください。');
    }
    if (!Sync.needStaffCode) 番号を聞いた = false;
  };
  if (Sync.enabled()) {
    if (!Sync.pin()) openPinModal();
    else Sync.start();
  }
})();
