/* ============================================================
 *  T3 Works Manage
 *
 *  現場アプリ（../index.html）と同じ config.js / storage.js / sync.js を
 *  そのまま使います。違うのは次の2点だけです。
 *
 *    ・管理用PINで開く（現場用PINとは別に覚えます）
 *    ・チェック項目・担当者・定休日を「書き換える」側になる
 *
 *  項目の追加・削除は、過去の記録を壊さないよう次のように扱います。
 *    追加 … その項目に addedAt（今日）を付ける   → 過去の日には出ません
 *    削除 … その項目に retiredAt（明日）を付ける → 過去の日には残ります
 * ============================================================ */

/* 管理アプリは「送信箱」も「PIN」も現場アプリと別の場所を使います。
 *
 * 同じ端末で両方を開くと保存領域を共有するため、分けておかないと
 * 管理アプリの変更（管理用PINが要る）を現場アプリが横取りして送ってしまい、
 * 「権限がありません」で弾かれて同期が止まります。 */
Sync._pinKey = APP.storageKey + ':adminPin';
Sync._outboxKey = APP.storageKey + ':adminOutbox';
Sync._sinceKey = APP.storageKey + ':adminSince';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

const state = {
  view: 'stores',            // 'stores'（店舗選択）か 'store'（店舗ごとの設定）
  storeId: STORES[0].id,
};

const el = {};
[
  'appLogo', 'homeBtn', 'storeTabs', 'syncChip',
  'viewStores', 'storeGrid',
  'viewMenu', 'menuTitle', 'menuGrid', 'menuBackBtn',
  'pageBar', 'pageBarName', 'pageBarRow', 'pageBarHome',
  'viewItems', 'viewWeekly', 'viewClosed', 'viewDrive',
  'itemsStoreName', 'itemsCount', 'checklistEditor', 'addSection', 'importDefaults',
  'undoImport', 'importNote',
  'weeklyStoreName', 'weeklyCount', 'weeklyEditor',
  'staffInput', 'saveStaff', 'staffCount', 'staffSaved',
  'driversInput', 'saveDrivers', 'driversCount', 'driversSaved',
  'catchStaffFields', 'saveCatchStaff', 'catchStaffCount', 'catchStaffSaved',
  'shiftStaffInput', 'saveShiftStaff', 'shiftStaffCount', 'shiftStaffSaved',
  'shiftSlotList', 'saveShiftSlots', 'resetShiftSlots', 'shiftSlotCount', 'shiftSlotSaved',
  'shiftCodeList', 'shiftSubmitUrl', 'viewShift',
  'viewTrain', 'trainStoreName', 'trainCount', 'trainInput', 'saveTrain', 'trainSaved',
  'trainItemsStore', 'trainItemsCount', 'trainEditor', 'trainAddSection',
  'targetFields', 'saveTargets', 'targetCount', 'targetsSaved',
  'nippouFields', 'saveNippou', 'nippouCount', 'nippouSaved',
  'nippouTest', 'saveNippouTest', 'nippouTestSaved',
  'expImport', 'expImportLast', 'expImportNote',
  'closedStoreName', 'dowToggles', 'exFrom', 'exKind', 'exAdd', 'exHint', 'exList',
  'exportBtn', 'importFile',
  'pauseModal', 'pauseItem', 'pauseFrom', 'pauseTo', 'pauseAdd', 'pauseHint', 'pauseList',
  'dowModal', 'dowItem', 'dowPick', 'dowHint', 'dowEveryday',
  'confirmDialog', 'confirmItem', 'confirmMessage', 'confirmOk',
  'pinModal', 'pinInput', 'pinReveal', 'pinError', 'pinOk',
  'settingsBtn', 'modal', 'syncInfo', 'syncNow', 'pinChange', 'syncLegend',
  'appVersionText', 'forceUpdate',
].forEach((id) => { el[id] = document.getElementById(id); });

/* ============================================================
 *  小さな道具
 * ============================================================ */
const p2 = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${p2(m)}-${p2(d)}`;

/* 現場アプリと同じ「業務上の今日」を使います（朝6時で切り替わる）。
   深夜に項目を足しても、その日のページにちゃんと出ます */
function todayStr() {
  const t = businessDate();
  return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate());
}
function tomorrowStr() {
  const t = businessDate();
  t.setDate(t.getDate() + 1);
  return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate());
}
/** 重複しない項目ID。過去の記録と紐づくので、一度作ったら変えません */
function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
}

/** ¥1,234 の形にする（現場アプリの yenText と同じ） */
function yenText(n) {
  return '¥' + (Number(n) || 0).toLocaleString('ja-JP');
}

/**
 * 誤操作を防ぐための確認。OKなら true が返ります
 *
 *   askConfirm({ item: '駐車場代', message: '…', okLabel: '取り込む' })
 *
 * ★現場アプリ（js/app.js）の askConfirm と同じ書き方にそろえてあります。
 * ---------------------------------------------------------- */
function askConfirm({ item, message, okLabel }) {
  return new Promise((resolve) => {
    el.confirmItem.textContent = item;
    el.confirmMessage.textContent = message;
    el.confirmOk.textContent = okLabel || 'はい';
    el.confirmDialog.classList.remove('is-hidden');

    const close = (answer) => {
      el.confirmDialog.classList.add('is-hidden');
      el.confirmOk.removeEventListener('click', onOk);
      cancels.forEach((c) => c.removeEventListener('click', onCancel));
      resolve(answer);
    };
    const onOk = () => close(true);
    const onCancel = () => close(false);
    const cancels = [...el.confirmDialog.querySelectorAll('[data-confirm-cancel]')];

    el.confirmOk.addEventListener('click', onOk);
    cancels.forEach((c) => c.addEventListener('click', onCancel));
  });
}

/* ============================================================
 *  チェック項目の編集
 * ============================================================ */

/**
 * 足したばかりで、まだ名前を入れていない項目に付けておく名前
 *
 * ★この名前のあいだは、名前の欄を**空**で開きます。
 *   「新しい項目」が入ったまま開くと、消してから打つことになるためです。
 */
const NEW_ITEM = '新しい項目';

/** 足したばかりの区分・大カテゴリーに付けておく名前 */
const NEW_SECTION = '新しい区分';
const NEW_SECTION_TRAIN = '新しい大カテゴリー';

/**
 * いま直しているのは「教育の項目」か（そうでなければクローズの項目）
 *
 * ★区分と項目の編集は、クローズも教育もまったく同じ作りです。
 *   同じ道具を使い回して、しまう先だけをここで切りかえます。
 */
function editingTrain() {
  return state.view === 'train';
}

/** いま編集中の区分を入れる場所 */
function editorBox() {
  return editingTrain() ? el.trainEditor : el.checklistEditor;
}

/** いま編集中の店舗の区分一覧（保存されていなければ config.js の初期値を複製） */
function currentSections() {
  const list = editingTrain()
    ? Trainings.sections(state.storeId)
    : Checklists.sections(state.storeId);
  return JSON.parse(JSON.stringify(list));
}

/** 書き換えた内容を保存して、全端末へ送る */
function saveSections(sections) {
  // 追加した当日に削除された項目は、どの日にも出ないので残さない
  const cleaned = sections.map((sec) => ({
    ...sec,
    items: sec.items.filter((it) => !(it.addedAt && it.retiredAt && it.addedAt >= it.retiredAt)),
  }));
  if (editingTrain()) Trainings.save(state.storeId, cleaned);
  else Checklists.save(state.storeId, cleaned);
  renderChecklistEditor();
}

/** 表示するもの＝まだやめていない区分・項目 */
const alive = (x) => !x.retiredAt;

function renderChecklistEditor() {
  const sections = currentSections();
  const train = editingTrain();
  const box = editorBox();
  const store = getStore(state.storeId).name;

  const liveSections = sections.filter(alive);
  const total = liveSections.reduce((n, sec) => n + sec.items.filter(alive).length, 0);

  if (train) {
    el.trainItemsStore.textContent = store;
    el.trainItemsCount.textContent = `${liveSections.length}カテゴリー / ${total}項目`;
  } else {
    el.itemsStoreName.textContent = store;
    el.itemsCount.textContent = `${liveSections.length}区分 / ${total}項目`;
  }

  box.innerHTML = '';

  if (!liveSections.length) {
    const p = document.createElement('p');
    p.className = 'admin-empty';
    p.textContent = train
      ? '大カテゴリーがありません。下の「＋ 大カテゴリーを追加」から作ってください。'
      : '区分がありません。下の「＋ 区分を追加」から作ってください。';
    box.appendChild(p);
    return;
  }

  liveSections.forEach((sec) => {
    box.appendChild(buildSectionCard(sec, sections, liveSections));
  });
}

function buildSectionCard(sec, sections, liveSections) {
  const card = document.createElement('div');
  card.className = 'sec-card';
  card.dataset.secId = sec.id;

  /* --- 区分の見出し --- */
  const head = document.createElement('div');
  head.className = 'sec-card__head';

  const name = document.createElement('input');
  name.type = 'text';
  name.className = 'sec-card__name';
  name.value = sec.title;
  name.setAttribute('aria-label', '区分の名前');
  name.addEventListener('change', () => {
    const text = name.value.trim();
    if (!text || text === sec.title) { name.value = sec.title; return; }
    const next = currentSections();
    next.find((s) => s.id === sec.id).title = text;
    saveSections(next);
  });
  head.appendChild(name);

  // 区分ごと曜日で出し分けている場合は、それが分かるようにしておく
  if (sec.onlyDows) {
    const tag = document.createElement('span');
    tag.className = 'item-row__tag';
    tag.textContent = sec.onlyDows.map((d) => DOW[d]).join('') + 'のみ';
    head.appendChild(tag);
  }

  const secPos = liveSections.indexOf(sec);
  head.appendChild(moveButton('↑', secPos > 0, () => moveSection(sec.id, -1)));
  head.appendChild(moveButton('↓', secPos < liveSections.length - 1, () => moveSection(sec.id, 1)));

  const delSec = document.createElement('button');
  delSec.type = 'button';
  delSec.className = 'icon-btn icon-btn--danger';
  delSec.textContent = '×';
  delSec.title = '区分ごと削除';
  delSec.addEventListener('click', () => removeSection(sec));
  head.appendChild(delSec);

  card.appendChild(head);

  /* --- 項目 --- */
  const liveItems = sec.items.filter(alive);
  if (!liveItems.length) {
    const p = document.createElement('p');
    p.className = 'admin-empty';
    p.textContent = '項目がありません';
    card.appendChild(p);
  }
  liveItems.forEach((item, i) => {
    card.appendChild(buildItemRow(sec, item, i, liveItems.length));
  });

  /* --- 項目を追加 --- */
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'sec-card__add';
  add.textContent = '＋ 項目を追加';
  add.addEventListener('click', () => addItem(sec.id));
  card.appendChild(add);

  return card;
}

function buildItemRow(sec, item, index, count) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.dataset.itemId = item.id;
  row.addEventListener('pointerdown', (e) => startLongPress(e, row));

  // ★つまむ場所。ここからなら待たずにすぐ持ち上がります。
  //   長押しでも並べ替えられますが、それだけだと誰にも気づかれませんでした
  row.appendChild(dragHandle(row));

  row.appendChild(buildNameCell(sec, item));

  /* 特殊な条件が付いている項目は、それと分かるようにしておく */
  specialTags(item).forEach((text) => {
    const span = document.createElement('span');
    span.className = 'item-row__tag' + (text.startsWith('休止') ? ' item-row__tag--pause' : '');
    span.textContent = text;
    row.appendChild(span);
  });

  // ★教育の項目には、曜日も休止もありません（毎日出るものではないので）
  if (!editingTrain()) {
    const dow = document.createElement('button');
    dow.type = 'button';
    dow.className = 'icon-btn' + (item.onlyDows ? ' icon-btn--on' : '');
    dow.textContent = '曜';
    dow.title = '出す曜日の設定';
    dow.addEventListener('click', () => openDow(sec.id, item.id));
    row.appendChild(dow);

    const pause = document.createElement('button');
    pause.type = 'button';
    pause.className = 'icon-btn' + (item.pauses && item.pauses.length ? ' icon-btn--on' : '');
    pause.textContent = '休';
    pause.title = '休止期間の設定';
    pause.addEventListener('click', () => openPause(sec.id, item.id));
    row.appendChild(pause);
  }

  row.appendChild(moveButton('↑', index > 0, () => moveItem(sec.id, item.id, -1)));
  row.appendChild(moveButton('↓', index < count - 1, () => moveItem(sec.id, item.id, 1)));

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'icon-btn icon-btn--danger';
  del.textContent = '×';
  del.title = '削除';
  del.addEventListener('click', () => removeItem(sec, item));
  row.appendChild(del);

  return row;
}

/* ---- 項目名 ----
 *
 *  iPhone では入力欄を長押しすると文字選択が始まってしまい、
 *  長押しでの並べ替えができません。そこで普段はただの文字として置き、
 *  タップしたときだけ入力欄に差し替えます。
 */
function buildNameCell(sec, item) {
  const cell = document.createElement('div');
  cell.className = 'item-row__name';
  cell.textContent = item.label;
  cell.dataset.secId = sec.id;
  cell.dataset.itemId = item.id;
  cell.setAttribute('role', 'button');
  cell.setAttribute('tabindex', '0');
  cell.setAttribute('aria-label', `${item.label}（タップで名前を変更）`);

  cell.addEventListener('click', () => {
    if (justDragged) return; // 並べ替えた直後は編集に入らない
    startNameEdit(cell);
  });
  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startNameEdit(cell); }
  });
  return cell;
}

/** 名前のところをタップしたとき、その場を入力欄に差し替える */
function startNameEdit(cell) {
  const before = cell.textContent;
  const { secId, itemId } = cell.dataset;
  // まだ名前を入れていない項目は、空の欄で開きます（消す手間をなくすため）
  const yet = before === NEW_ITEM;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'item-row__name item-row__name--edit';
  input.value = yet ? '' : before;
  if (yet) input.placeholder = '項目名';
  input.setAttribute('aria-label', '項目の名前');
  cell.replaceWith(input);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  let closed = false;
  const finish = (keep) => {
    if (closed) return;
    closed = true;
    const text = input.value.trim();
    if (keep && text && text !== before) {
      if (secId === WEEKLY_SEC) {
        const next = currentWeekly();
        next.find((it) => it.id === itemId).label = text;
        saveWeekly(next); // 画面はまるごと描き直されます
        return;
      }
      const next = currentSections();
      next.find((s) => s.id === secId).items.find((it) => it.id === itemId).label = text;
      saveSections(next); // 画面はまるごと描き直されます
      return;
    }
    input.replaceWith(cell);
  };

  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (e) => {
    // ★変換を決めるエンターでは終わらせません（言葉が途中で切れるため）
    if (e.key === 'Enter' && !imeEnter(e)) { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = before; input.blur(); }
  });
}

/**
 * つまんで並べ替えるための取っ手
 *
 * 行のどこでも長押しすれば並べ替えられますが、それでは
 * 「動かせる」ことが誰にも伝わりませんでした。目に見える取っ手を置き、
 * ここからは**待たずにすぐ**持ち上がるようにします。
 */
function dragHandle(row) {
  const grip = document.createElement('span');
  grip.className = 'item-row__grip';
  grip.textContent = '⠿';
  grip.title = 'つまんで上下に動かすと、順番が変わります';
  grip.setAttribute('aria-label', '並べ替え');
  grip.addEventListener('pointerdown', (e) => {
    e.preventDefault();          // 指で押したときに文字選択が始まらないように
    startLongPress(e, row, true);
  });
  return grip;
}

/** 「28日だけ」「金土のみ」「休止中」など、その項目に付いている条件をすべて返す */
function specialTags(item) {
  const tags = [];
  if (item.onlyDays) tags.push(item.onlyDays.join('・') + '日だけ');
  if (item.onlyDows) tags.push(item.onlyDows.map((d) => DOW[d]).join('') + 'のみ');
  if (item.onlyMonths) tags.push(item.onlyMonths.join('・') + '月のみ');
  if (item.hideOnDows) tags.push(item.hideOnDows.map((d) => DOW[d]).join('') + 'は非表示');
  if (item.type === 'number') tags.push('数値' + (item.unit ? `（${item.unit}）` : ''));
  if (item.pauses && item.pauses.length) {
    tags.push(isPaused(item, todayStr()) ? '休止中' : `休止${item.pauses.length}件`);
  }
  return tags;
}

function moveButton(label, enabled, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon-btn';
  b.textContent = label;
  b.disabled = !enabled;
  if (enabled) b.addEventListener('click', onClick);
  return b;
}

/* -------- 追加・削除・並べ替え -------- */

function addItem(secId) {
  const next = currentSections();
  const sec = next.find((s) => s.id === secId);
  sec.items.push({
    id: newId('it'),
    label: NEW_ITEM,
    type: 'check',
    addedAt: todayStr(), // 今日から出す（過去の日にはさかのぼらせない）
  });
  saveSections(next);

  // 追加した項目にすぐ名前を入れられるようにしておく
  const cells = [...editorBox().querySelectorAll('.item-row__name')];
  const last = cells.reverse().find((c) => c.textContent === NEW_ITEM);
  if (last) startNameEdit(last);
}

async function removeItem(sec, item) {
  const ok = await askConfirm({
    item: item.label,
    message: editingTrain()
      ? 'この項目を一覧から外します。それまでの進み具合はそのまま残ります。'
      : 'この項目を明日から出さないようにします。過去の記録はそのまま残ります。',
  });
  if (!ok) return;
  const next = currentSections();
  const target = next.find((s) => s.id === sec.id).items.find((it) => it.id === item.id);
  target.retiredAt = tomorrowStr();
  saveSections(next);
}

/* ============================================================
 *  週間掃除の編集
 *
 *  毎日のチェック項目と違って区分がなく、ただの項目の並びです。
 *  並べ替え・名前の変更・削除の仕組みは上と同じものを使いたいので、
 *  見た目だけ「区分がひとつだけある」形にして、その区分IDを
 *  WEEKLY_SEC という決まった文字にしています。
 * ============================================================ */
const WEEKLY_SEC = '__weekly__';

/** いま編集中の店舗の週間掃除の項目（保存されていなければ config.js の初期値を複製） */
function currentWeekly() {
  return JSON.parse(JSON.stringify(Weeklies.items(state.storeId)));
}

/** 書き換えた内容を保存して、全端末へ送る */
function saveWeekly(items) {
  // 追加したその週に削除された項目は、どの週にも出ないので残さない
  const cleaned = items.filter((it) => !(it.addedAt && it.retiredAt && it.addedAt >= it.retiredAt));
  Weeklies.save(state.storeId, cleaned);
  renderWeeklyEditor();
}

function renderWeeklyEditor() {
  const items = currentWeekly();
  const live = items.filter(alive);
  const bi = live.filter(isBiweekly).length;

  el.weeklyStoreName.textContent = getStore(state.storeId).name;
  el.weeklyCount.textContent =
    `${live.length}項目` + (bi ? `（うち2週に1回 ${bi}）` : '');

  el.weeklyEditor.innerHTML = '';

  /* 掃除する場所ごとに1枚のカード。
     まだ項目が無い場所（トイレなど）も、足せるように空のまま出します */
  const found = groupWeekly(live);
  const names = WEEKLY_GROUPS.slice();
  found.forEach((g) => { if (!names.includes(g.name)) names.push(g.name); });

  names.forEach((name) => {
    const list = (found.find((g) => g.name === name) || { items: [] }).items;

    const card = document.createElement('div');
    card.className = 'sec-card';
    card.dataset.secId = WEEKLY_SEC;

    const head = document.createElement('div');
    head.className = 'sec-card__head';
    const title = document.createElement('span');
    title.className = 'sec-card__name sec-card__name--fixed';
    title.textContent = name;
    head.appendChild(title);
    const count = document.createElement('span');
    count.className = 'admin-count';
    count.textContent = `${list.length}項目`;
    head.appendChild(count);
    card.appendChild(head);

    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'admin-empty';
      p.textContent = 'まだ項目がありません。';
      card.appendChild(p);
    }

    list.forEach((item, i) => {
      card.appendChild(buildWeeklyRow(item, i, list.length));
    });

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'sec-card__add';
    add.textContent = '＋ 項目を追加';
    add.addEventListener('click', () => addWeeklyItem(name));
    card.appendChild(add);

    el.weeklyEditor.appendChild(card);
  });
}

function buildWeeklyRow(item, index, count) {
  const row = document.createElement('div');
  row.className = 'item-row item-row--weekly';
  row.dataset.itemId = item.id;
  row.addEventListener('pointerdown', (e) => startLongPress(e, row));

  row.appendChild(buildNameCell({ id: WEEKLY_SEC }, item));

  /* 掃除する場所の入れ替え。押すたびに次の場所へ移ります */
  const group = document.createElement('button');
  group.type = 'button';
  group.className = 'every-btn every-btn--group';
  group.textContent = weeklyGroupOf(item);
  group.title = '掃除する場所を変えます（押すたびに次の場所へ移ります）';
  group.addEventListener('click', () => cycleWeeklyGroup(item.id));
  row.appendChild(group);

  /* 毎週／2週に1回 の切り替え。押すたびに入れ替わります */
  const every = document.createElement('button');
  every.type = 'button';
  every.className = 'every-btn' + (isBiweekly(item) ? ' every-btn--bi' : '');
  every.textContent = isBiweekly(item) ? '2週' : '毎週';
  every.title = isBiweekly(item)
    ? '2週間に1回でよい項目です（押すと毎週に戻ります）'
    : '毎週やる項目です（押すと2週に1回になります）';
  every.addEventListener('click', () => toggleWeeklyEvery(item.id));
  row.appendChild(every);

  row.appendChild(moveButton('↑', index > 0, () => moveItem(WEEKLY_SEC, item.id, -1)));
  row.appendChild(moveButton('↓', index < count - 1, () => moveItem(WEEKLY_SEC, item.id, 1)));

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'icon-btn icon-btn--danger';
  del.textContent = '×';
  del.title = '削除';
  del.addEventListener('click', () => removeWeeklyItem(item));
  row.appendChild(del);

  return row;
}

function addWeeklyItem(group) {
  const next = currentWeekly();
  next.push({
    id: newId('wk'),
    label: NEW_ITEM,
    group: group || WEEKLY_GROUPS[0], // 押したカードの場所に入れる
    addedAt: todayStr(),              // 今週から出す（過ぎた週にはさかのぼらせない）
  });
  saveWeekly(next);

  // 追加した項目にすぐ名前を入れられるようにしておく
  const cells = [...el.weeklyEditor.querySelectorAll('.item-row__name')];
  const last = cells.reverse().find((c) => c.textContent === NEW_ITEM);
  if (last) startNameEdit(last);
}

/** 掃除する場所を次のものへ移す（ホール→キッチン→トイレ→ホール…） */
function cycleWeeklyGroup(itemId) {
  const next = currentWeekly();
  const item = next.find((it) => it.id === itemId);
  if (!item) return;
  const at = WEEKLY_GROUPS.indexOf(weeklyGroupOf(item));
  // 一覧に無い場所（その他など）だったときは、先頭の場所へ入れます
  item.group = WEEKLY_GROUPS[(at + 1) % WEEKLY_GROUPS.length] || WEEKLY_GROUPS[0];
  saveWeekly(next);
}

/** 毎週 ⇄ 2週に1回 を入れ替える */
function toggleWeeklyEvery(itemId) {
  const next = currentWeekly();
  const item = next.find((it) => it.id === itemId);
  if (!item) return;
  if (isBiweekly(item)) delete item.every;
  else item.every = 'biweek';
  saveWeekly(next);
}

async function removeWeeklyItem(item) {
  const ok = await askConfirm({
    item: item.label,
    message: 'この項目を来週から出さないようにします。今週までの記録はそのまま残ります。',
  });
  if (!ok) return;
  const next = currentWeekly();
  next.find((it) => it.id === item.id).retiredAt = tomorrowStr();
  saveWeekly(next);
}

function addSection() {
  const next = currentSections();
  next.push({
    id: newId('sec'),
    title: editingTrain() ? NEW_SECTION_TRAIN : NEW_SECTION,
    items: [],
  });
  saveSections(next);

  const boxes = editorBox().querySelectorAll('.sec-card__name');
  const want = editingTrain() ? NEW_SECTION_TRAIN : NEW_SECTION;
  const last = [...boxes].reverse().find((b) => b.value === want);
  if (last) { last.focus(); last.select(); }
}

async function removeSection(sec) {
  const n = sec.items.filter(alive).length;
  const ok = await askConfirm({
    item: sec.title,
    message: editingTrain()
      ? `この大カテゴリーと、中の${n}項目をまとめて一覧から外します。それまでの進み具合はそのまま残ります。`
      : `この区分と、中の${n}項目をまとめて明日から出さないようにします。過去の記録はそのまま残ります。`,
  });
  if (!ok) return;
  const next = currentSections();
  const target = next.find((s) => s.id === sec.id);
  const at = tomorrowStr();
  target.retiredAt = at;
  target.items.forEach((it) => { if (!it.retiredAt) it.retiredAt = at; });
  saveSections(next);
}

/* ============================================================
 *  長押しして並べ替え
 *
 *  ・0.35秒押し続けると持ち上がります（すぐ動かした場合は画面のスクロール）
 *  ・指を動かすと、その位置に行が移動します
 *  ・離した時点の並びで保存します
 *  ・同じ区分の中だけで動かせます（別の区分へは移せません）
 *  矢印ボタンでの移動も今までどおり使えます。
 * ============================================================ */
const drag = { row: null, card: null, timer: null, y: 0, active: false, raf: 0 };
let justDragged = false; // 並べ替え直後の click で編集に入らないようにする

function startLongPress(e, row, atOnce) {
  // ボタンを押したとき、名前を編集中のときは並べ替えを始めない
  if (!atOnce && e.target.closest('.icon-btn, .every-btn')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  cancelLongPress();
  drag.row = row;
  drag.card = row.closest('.sec-card');
  drag.y = e.clientY;
  // 取っ手からは待ちません。行のどこかを押したときだけ0.35秒待ちます
  // （すぐ持ち上げると、画面をスクロールしたいときに邪魔になるためです）
  if (atOnce) beginDrag(e);
  else drag.timer = setTimeout(() => beginDrag(e), 350);

  document.addEventListener('pointermove', onPointerMove, { passive: false });
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  document.addEventListener('touchmove', blockScroll, { passive: false });
}

function beginDrag(e) {
  drag.active = true;
  drag.timer = null;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  drag.row.classList.add('is-drag');
  document.body.classList.add('is-dragging');
  if (navigator.vibrate) navigator.vibrate(15); // 持ち上がったことを指に伝える
}

/** 並べ替え中は画面が動かないようにする */
function blockScroll(e) {
  if (drag.active) e.preventDefault();
}

function onPointerMove(e) {
  if (!drag.active) {
    // 持ち上がる前に動かしたときは、スクロールとみなして中止
    if (Math.abs(e.clientY - drag.y) > 8) cancelLongPress();
    return;
  }
  e.preventDefault();
  moveRowTo(e.clientY);
  autoScroll(e.clientY);
}

/** 指の位置に合わせて、行を差し込む場所を決める */
function moveRowTo(y) {
  const others = [...drag.card.querySelectorAll('.item-row')].filter((r) => r !== drag.row);
  const after = others.find((r) => {
    const box = r.getBoundingClientRect();
    return y < box.top + box.height / 2;
  });
  if (after) {
    if (after.previousElementSibling !== drag.row) drag.card.insertBefore(drag.row, after);
  } else {
    const addBtn = drag.card.querySelector('.sec-card__add');
    if (addBtn && addBtn.previousElementSibling !== drag.row) drag.card.insertBefore(drag.row, addBtn);
  }
}

/** 画面の端まで持っていったら、ゆっくりスクロールする */
function autoScroll(y) {
  cancelAnimationFrame(drag.raf);
  const margin = 70;
  const step = y < margin ? -9 : y > window.innerHeight - margin ? 9 : 0;
  if (!step) return;
  const tick = () => {
    if (!drag.active) return;
    window.scrollBy(0, step);
    drag.raf = requestAnimationFrame(tick);
  };
  drag.raf = requestAnimationFrame(tick);
}

function endDrag() {
  const wasActive = drag.active;
  const card = drag.card;
  const row = drag.row;
  cancelLongPress();
  if (!wasActive || !card) return;

  row.classList.remove('is-drag');
  document.body.classList.remove('is-dragging');
  justDragged = true;
  setTimeout(() => { justDragged = false; }, 400);

  // 画面の並びをそのまま保存する
  const order = [...card.querySelectorAll('.item-row')].map((r) => r.dataset.itemId);
  applyItemOrder(card.dataset.secId, order);
}

function cancelLongPress() {
  clearTimeout(drag.timer);
  cancelAnimationFrame(drag.raf);
  if (drag.row) drag.row.classList.remove('is-drag');
  document.body.classList.remove('is-dragging');
  drag.timer = null;
  drag.active = false;
  drag.row = null;
  drag.card = null;
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', endDrag);
  document.removeEventListener('pointercancel', endDrag);
  document.removeEventListener('touchmove', blockScroll);
}

/** 画面の並び（表示中の項目のID順）を保存する。やめた項目は後ろにまとめます */
function applyItemOrder(secId, orderedIds) {
  if (secId === WEEKLY_SEC) {
    const next = currentWeekly();
    const sorted = sortByOrder(next, orderedIds);
    if (sorted) saveWeekly(sorted);
    return;
  }

  const next = currentSections();
  const sec = next.find((s) => s.id === secId);
  if (!sec) return;

  const sorted = sortByOrder(sec.items, orderedIds);
  if (!sorted) return; // 並びが変わっていなければ保存しない
  sec.items = sorted;
  saveSections(next);
}

/** 画面の並びどおりに並べ替えた配列。変化がなければ null */
function sortByOrder(items, orderedIds) {
  const byId = {};
  items.forEach((it) => { byId[it.id] = it; });
  const live = orderedIds.map((id) => byId[id]).filter(Boolean);
  const rest = items.filter((it) => !orderedIds.includes(it.id));

  const next = live.concat(rest);
  if (next.map((it) => it.id).join(',') === items.map((it) => it.id).join(',')) return null;
  return next;
}

/** 表示されている並びの中で、上下を入れ替える */
function swapWithin(list, isLive, id, dir) {
  const liveIdx = list.map((x, i) => (isLive(x) ? i : -1)).filter((i) => i >= 0);
  const at = liveIdx.findIndex((i) => list[i].id === id);
  const to = at + dir;
  if (at < 0 || to < 0 || to >= liveIdx.length) return false;
  const a = liveIdx[at];
  const b = liveIdx[to];
  [list[a], list[b]] = [list[b], list[a]];
  return true;
}

function moveSection(secId, dir) {
  const next = currentSections();
  if (swapWithin(next, alive, secId, dir)) saveSections(next);
}

function moveItem(secId, itemId, dir) {
  if (secId === WEEKLY_SEC) {
    const next = currentWeekly();
    // 同じ場所（ホールならホール）の中だけで入れ替えます
    const item = next.find((it) => it.id === itemId);
    if (!item) return;
    const g = weeklyGroupOf(item);
    const sameGroup = (it) => alive(it) && weeklyGroupOf(it) === g;
    if (swapWithin(next, sameGroup, itemId, dir)) saveWeekly(next);
    return;
  }
  const next = currentSections();
  const items = next.find((s) => s.id === secId).items;
  if (swapWithin(items, alive, itemId, dir)) saveSections(next);
}

/* ============================================================
 *  用意された内容（config.js）を取り込む
 *
 *  一度この画面で編集すると、以降は保存された内容が使われます。
 *  そのため、あとから config.js 側で表記や並びを整えても届きません。
 *  この取り込みは、項目IDを目印にして次のように合わせます。
 *
 *    ・両方にある項目 … 名前・並び順・曜日の設定を config.js に合わせる
 *                      （休止期間・削除・追加日は、いまの設定を残す）
 *    ・config.js だけにある項目 … 今日から出る項目として足す
 *    ・この画面で追加した項目 … 消さずに区分の最後へ残す
 * ============================================================ */
/** 取り込んだら何が変わるかを、先に数えておく */
function importDiff(before, after) {
  const oldById = {};
  before.forEach((s) => s.items.forEach((i) => { oldById[i.id] = { label: i.label, sec: s.title }; }));

  let renamed = 0;
  let added = 0;
  let moved = false;

  after.forEach((s) => s.items.forEach((i) => {
    const o = oldById[i.id];
    if (!o) { added += 1; return; }
    if (o.label !== i.label) renamed += 1;
  }));

  const seq = (list) => list.map((s) => s.title + ':' + s.items.map((i) => i.id).join(',')).join('|');
  moved = seq(before) !== seq(after);

  return { renamed, added, moved, none: !renamed && !added && !moved };
}

async function importDefaults() {
  const store = getStore(state.storeId);
  const before = currentSections();
  const after = buildImported();
  const diff = importDiff(before, after);

  if (diff.none) {
    el.importNote.textContent = `${store.name} は用意された内容と同じです。変わるところはありません。`;
    return;
  }

  const lines = [];
  if (diff.renamed) lines.push(`名前が変わる項目：${diff.renamed}件`);
  if (diff.added) lines.push(`新しく増える項目：${diff.added}件（今日から表示）`);
  if (diff.moved) lines.push('並び順が変わります');
  lines.push('この画面で追加した項目は消えず、区分の最後に残ります。');
  lines.push('取り込んだあとでも「取り込みを取り消す」で元に戻せます。');

  const ok = await askConfirm({ item: store.name, message: lines.join('\n') });
  if (!ok) return;

  // 元に戻せるよう、直前の状態を控えておく
  localStorage.setItem(UNDO_KEY, JSON.stringify({ storeId: state.storeId, sections: before }));
  saveSections(after);
  el.importNote.textContent =
    `取り込みました（名前${diff.renamed}件 / 追加${diff.added}件）。元に戻す場合は右のボタンを押してください。`;
  renderUndo();
}

/** 取り込みを取り消して、直前の状態に戻す */
async function undoImport() {
  const saved = readUndo();
  if (!saved) return;
  const ok = await askConfirm({
    item: getStore(saved.storeId).name,
    message: '取り込む前の状態に戻します。よろしいですか？',
  });
  if (!ok) return;
  Checklists.save(saved.storeId, saved.sections);
  localStorage.removeItem(UNDO_KEY);
  el.importNote.textContent = '取り込む前の状態に戻しました。';
  renderChecklistEditor();
  renderUndo();
}

const UNDO_KEY = APP.storageKey + ':importUndo';

function readUndo() {
  try {
    const v = JSON.parse(localStorage.getItem(UNDO_KEY) || 'null');
    return v && v.storeId === state.storeId ? v : null;
  } catch (e) {
    return null;
  }
}

function renderUndo() {
  el.undoImport.classList.toggle('is-hidden', !readUndo());
}

/** 取り込んだ結果を作る（保存はしません） */
function buildImported() {
  const today = todayStr();
  const rest = {};
  currentSections().forEach((s) => { rest[s.id] = s; });

  const merged = defaultChecklist(state.storeId).map((ds) => {
    const cs = rest[ds.id];
    delete rest[ds.id];

    const leftover = {};
    (cs ? cs.items : []).forEach((it) => { leftover[it.id] = it; });

    const items = ds.items.map((di) => {
      const ci = leftover[di.id];
      delete leftover[di.id];
      if (!ci) return { ...di, addedAt: today }; // 新しく増えた項目は今日から
      const next = { ...di };                    // 名前は用意された内容
      if (ci.addedAt) next.addedAt = ci.addedAt; // いつからか・いつまでかは今の設定を残す
      if (ci.retiredAt) next.retiredAt = ci.retiredAt;
      if (ci.pauses) next.pauses = ci.pauses;
      // ★出す曜日も、この画面で決めたものを残します。
      //   取り込みで毎日に戻ってしまうと、決めたことが黙って消えるためです
      if (ci.onlyDows) next.onlyDows = ci.onlyDows;
      else delete next.onlyDows;
      return next;
    });
    Object.keys(leftover).forEach((id) => items.push(leftover[id]));

    const sec = { ...ds, items };
    if (cs && cs.retiredAt) sec.retiredAt = cs.retiredAt;
    return sec;
  });

  Object.keys(rest).forEach((id) => merged.push(rest[id]));
  return merged;
}

/* ============================================================
 *  休止期間（長期休みなどで一時的に外す）
 * ============================================================ */
const pauseTarget = { secId: null, itemId: null };

function pauseItemOf() {
  return currentSections()
    .find((s) => s.id === pauseTarget.secId)
    .items.find((i) => i.id === pauseTarget.itemId);
}

function openPause(secId, itemId) {
  pauseTarget.secId = secId;
  pauseTarget.itemId = itemId;
  el.pauseItem.textContent = pauseItemOf().label;
  el.pauseFrom.value = '';
  el.pauseTo.value = '';
  el.pauseHint.textContent = '';
  renderPauseList();
  el.pauseModal.classList.remove('is-hidden');
}

function renderPauseList() {
  const item = pauseItemOf();
  const list = (item.pauses || []).slice().sort((a, b) => (a.from < b.from ? -1 : 1));
  el.pauseList.innerHTML = '';

  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'ex-list__empty';
    li.textContent = '登録なし';
    el.pauseList.appendChild(li);
    return;
  }

  const today = todayStr();
  list.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'ex-list__item';
    const now = today >= p.from && today <= p.to;
    const done = today > p.to;
    li.innerHTML =
      `<span class="ex-list__date">${p.from.replace(/-/g, '/')} 〜 ${p.to.replace(/-/g, '/')}</span>` +
      `<span class="ex-list__kind ${now ? 'ex-list__kind--closed' : ''}">` +
      `${now ? '休止中' : done ? '終了' : 'この先'}</span>`;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'ex-list__del';
    del.textContent = '削除';
    del.addEventListener('click', () => {
      updatePauses((cur) => cur.filter((x) => !(x.from === p.from && x.to === p.to)));
    });
    li.appendChild(del);
    el.pauseList.appendChild(li);
  });
}

/** 休止期間を書き換えて保存する */
function updatePauses(fn) {
  const next = currentSections();
  const item = next.find((s) => s.id === pauseTarget.secId).items.find((i) => i.id === pauseTarget.itemId);
  const list = fn((item.pauses || []).slice());
  if (list.length) item.pauses = list;
  else delete item.pauses;
  saveSections(next);
  renderPauseList();
}

function addPause() {
  const from = el.pauseFrom.value;
  const to = el.pauseTo.value || from;
  el.pauseHint.textContent = '';

  if (!from) { el.pauseHint.textContent = '開始日を選んでください。'; return; }
  if (to < from) { el.pauseHint.textContent = '終了日は開始日より後にしてください。'; return; }

  updatePauses((cur) => {
    if (cur.some((p) => p.from === from && p.to === to)) return cur;
    return cur.concat([{ from, to }]);
  });

  const days = Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000) + 1;
  el.pauseHint.textContent = `${days}日分を休止にしました。`;
  el.pauseFrom.value = '';
  el.pauseTo.value = '';
}

/* ============================================================
 *  出す曜日（この曜日だけ出す）
 *
 *  ★「休止」と違って、期間ではなく毎週くり返す決まりです。
 *    まな板漂白のように「月曜だけやる」ものに使います。
 *  ★1つも押していない状態＝毎日出す（onlyDows を持たせません）。
 *    7つ全部を押したときも同じなので、毎日に戻します。
 * ============================================================ */
const dowTarget = { secId: null, itemId: null };

function dowItemOf() {
  return currentSections()
    .find((s) => s.id === dowTarget.secId)
    .items.find((i) => i.id === dowTarget.itemId);
}

function openDow(secId, itemId) {
  dowTarget.secId = secId;
  dowTarget.itemId = itemId;
  el.dowItem.textContent = dowItemOf().label;
  renderDowPick();
  el.dowModal.classList.remove('is-hidden');
}

function renderDowPick() {
  const item = dowItemOf();
  const on = item.onlyDows || [];
  el.dowPick.innerHTML = '';

  DOW.forEach((name, d) => {
    const b = document.createElement('button');
    b.type = 'button';
    // 定休日の曜日選びと同じ見た目を使い回します（覚えることを増やさない）
    b.className = 'dow-toggle' + (on.includes(d) ? ' is-on' : '')
      + (d === 0 ? ' is-sun' : d === 6 ? ' is-sat' : '');
    b.textContent = name;
    b.setAttribute('aria-pressed', on.includes(d) ? 'true' : 'false');
    b.addEventListener('click', () => toggleDow(d));
    el.dowPick.appendChild(b);
  });

  el.dowHint.textContent = on.length
    ? `いまは ${on.map((d) => DOW[d]).join('・')}曜だけ出ます`
    : 'いまは毎日出ます';
}

/** 出す曜日を書き換えて保存する */
function updateDows(fn) {
  const next = currentSections();
  const item = next.find((s) => s.id === dowTarget.secId).items.find((i) => i.id === dowTarget.itemId);
  const list = fn((item.onlyDows || []).slice()).sort((a, b) => a - b);
  // 1つも無い／7つ全部＝毎日。どちらも「決まりなし」にそろえます
  if (list.length && list.length < DOW.length) item.onlyDows = list;
  else delete item.onlyDows;
  saveSections(next);
  renderDowPick();
}

function toggleDow(d) {
  updateDows((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : cur.concat([d])));
}

/* ============================================================
 *  教育を受ける人（店舗ごと）
 *
 *  ★ワークス（現場のアプリ）からも足せます。ここは、まとめて直すとき用です。
 *  ★行の順番はそのままにしてください。1行が1人に結びついていて、
 *    入れかえると進み具合が別の人のものになってしまいます。
 * ============================================================ */
function renderTrainees() {
  const people = Trainees.list(state.storeId);
  el.trainStoreName.textContent = getStore(state.storeId).name;
  el.trainCount.textContent = `${people.length}人`;
  el.trainInput.value = people.map((p) => p.n).join('\n');
}

function saveTrainees() {
  const names = el.trainInput.value.split('\n').map((t) => t.trim()).filter(Boolean);
  const before = Trainees.list(state.storeId);

  // 上から順に、いまの人と付き合わせます。
  // 同じところにいる人は id をそのまま引き継ぐので、名前を直しても進み具合が続きます
  const after = names.map((n, i) => (
    before[i]
      ? { ...before[i], n }
      : { id: newTraineeId(), n, at: new Date().toISOString() }
  ));
  Trainees.save(state.storeId, after);

  renderTrainees();
  el.trainSaved.classList.remove('is-hidden');
  setTimeout(() => el.trainSaved.classList.add('is-hidden'), 2500);
}

/* ============================================================
 *  担当者
 * ============================================================ */
function renderStaff() {
  const names = Staff.list();
  el.staffInput.value = names.join('\n');
  el.staffCount.textContent = `${names.length}人`;
}

function saveStaff() {
  const names = Staff.saveFromText(el.staffInput.value);
  renderStaff();
  el.staffSaved.classList.remove('is-hidden');
  setTimeout(() => el.staffSaved.classList.add('is-hidden'), 2500);
  return names;
}

/* ============================================================
 *  交通費（配達記録アプリ）
 * ============================================================ */
function renderDrivers() {
  const names = Drivers.list();
  el.driversInput.value = names.join('\n');
  el.driversCount.textContent = `${names.length}人`;
}

function renderCatchStaff() {
  const map = CatchStaff.all();
  const n = CatchStaff.count();
  el.catchStaffCount.textContent = n ? `${n}人` : 'まだ登録なし';

  el.catchStaffFields.innerHTML = '';
  // キャッチだけの行き先（まいとなど）もキャッチをするので、ここには出します。
  // ただし保留中（off）のものは出しません
  pickableStores().forEach((s) => {
    const wrap = document.createElement('label');
    wrap.className = 'field';
    const label = document.createElement('span');
    label.className = 'field__label';
    const names = map[s.id] || [];
    label.textContent = `${s.name}（${names.length}人）`;
    const area = document.createElement('textarea');
    area.className = 'field__input field__input--area';
    area.rows = 6;
    area.dataset.store = s.id;
    area.placeholder = '1行に1人ずつ';
    area.value = names.join('\n');
    wrap.append(label, area);
    el.catchStaffFields.appendChild(wrap);
  });
}

function saveCatchStaff() {
  const map = {};
  [...el.catchStaffFields.querySelectorAll('textarea[data-store]')].forEach((a) => {
    map[a.dataset.store] = a.value.split('\n');
  });
  CatchStaff.save(map);
  renderCatchStaff();
  el.catchStaffSaved.classList.remove('is-hidden');
  setTimeout(() => el.catchStaffSaved.classList.add('is-hidden'), 2500);
}

/* -------- シフトに入る人 --------
 *
 *  提出ページ（…/shift/）の名前選びに出る人です。
 *  シフトを組む店舗（config.js の SHIFT_STORES）だけを並べます。
 */
/**
 * 名簿を出している店舗（空なら出していません）
 *
 * ★名前も番号も、**ふだんは出しません。**開きっぱなしの端末で
 *   誰でも読めてしまわないようにするためです。押したときだけ出します。
 * ★店舗を変えたら閉じます。アプリを裏に回したときも閉じます。
 */
/** 「他店舗にも所属」を開いている人の番号 */
let shiftLinkOpen = '';

/**
 * ★マネージは、名前も番号も**はじめから出します**（ko-dai の指示・2026-09-05）。
 *   管理用PINの内側で、ko-dai さんが使う画面だからです。
 *   押したときだけ出すのは**ワークスとマインだけ**にしてあります
 *   （あちらはお店の端末で開きっぱなしになるため）。
 */
function renderShiftStaff() {
  const store = getStore(state.storeId);
  const people = ShiftStaff.people(store.id);
  el.shiftStaffCount.textContent = people.length ? `${people.length}人` : 'まだ登録なし';
  el.shiftStaffInput.value = people.map((p) => p.n).join('\n');
  renderShiftCodes();
}

/**
 * 配る番号の一覧
 *
 * 番号は1人に1つで、これが提出ページの入口になります。
 * 「コピー」で番号だけが取れます（URLは全員おなじなので、上に1つ出しています）。
 */
function renderShiftCodes() {
  const storeId = state.storeId;
  const people = ShiftStaff.people(storeId);
  el.shiftCodeList.innerHTML = '';
  // 提出ページのURL。マネージは1つ下の階層にあるので ../ で戻ります
  el.shiftSubmitUrl.textContent = new URL('../' + SHIFT_SUBMIT_PATH, location.href).href;

  if (!people.length) {
    el.shiftCodeList.innerHTML = '<p class="admin-note">名前を保存すると、ここに番号が出ます。</p>';
    return;
  }

  const 送りずみ = people.filter((p) => p.s).length;
  const 持ち場なし = people.filter((p) => !p.p).length;
  const count = document.createElement('p');
  count.className = 'admin-note';
  count.textContent = (送りずみ === people.length
    ? `全員に送りました（${people.length}人）`
    : `送りずみ ${送りずみ} / ${people.length}人`)
    + (持ち場なし ? `　／　持ち場がまだ ${持ち場なし}人` : '');
  el.shiftCodeList.appendChild(count);

  const box = document.createElement('div');
  box.className = 'shift-codes';
  people.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'shift-code' + (p.s ? ' is-sent' : '');

    // ★番号をその人に送ったか。25人にLINEで配るので、
    //   どこまで送ったか見失わないための印です
    const sent = document.createElement('label');
    sent.className = 'shift-code__sent';
    sent.title = p.s ? '送りずみ（押すと外れます）' : '送ったら押してください';
    const box2 = document.createElement('input');
    box2.type = 'checkbox';
    box2.checked = !!p.s;
    box2.addEventListener('change', () => {
      ShiftStaff.setSent(storeId, p.n, box2.checked);
      renderShiftStaff();
    });
    sent.appendChild(box2);

    const name = document.createElement('span');
    name.className = 'shift-code__name';
    name.textContent = p.n;

    // ★ふだんの持ち場。希望を取り込むと、ここで決めた側に入ります
    const lanes = document.createElement('span');
    lanes.className = 'shift-code__lanes';
    SHIFT_LANES.forEach((lane) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lane-btn' + (p.p === lane.id ? ' is-on' : '');
      b.textContent = lane.name;
      b.title = p.p === lane.id ? 'もう一度押すと、決めていない状態に戻ります' : `${lane.name}にする`;
      b.addEventListener('click', () => {
        ShiftStaff.setLane(storeId, p.n, p.p === lane.id ? '' : lane.id);
        renderShiftStaff();
      });
      lanes.appendChild(b);
    });

    const code = document.createElement('span');
    code.className = 'shift-code__num';
    code.textContent = p.c || '—';

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn btn--small';
    copy.textContent = 'コピー';
    copy.addEventListener('click', () => copyShiftCode(p, copy));

    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'btn btn--small';
    again.textContent = '作り直す';
    again.addEventListener('click', () => {
      if (!window.confirm(`${p.n}さんの番号を作り直します。\n前の番号では入れなくなります。`)) return;
      ShiftStaff.reissue(storeId, p.n);
      renderShiftStaff();
    });

    // ★他店舗にも所属。ワークスの名簿と同じものです。
    //   押して選ぶと、向こうの店舗の名簿にも同じ番号で入ります
    const よそ = shiftLinkedStores(p.c).filter((id) => id !== storeId);
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'shift-code__btn' + (よそ.length ? ' is-on' : '');
    link.textContent = よそ.length
      ? `他店舗にも所属：${よそ.map((id) => (getStore(id) || {}).short || id).join('・')}`
      : '他店舗にも所属';
    link.addEventListener('click', () => {
      shiftLinkOpen = shiftLinkOpen === p.c ? '' : p.c;
      renderShiftStaff();
    });

    row.append(sent, name, lanes, code, copy, again, link);
    box.appendChild(row);

    if (shiftLinkOpen === p.c) box.appendChild(shiftLinkPicker(storeId, p));
  });
  el.shiftCodeList.appendChild(box);
}

/**
 * その人が入る店舗を選ぶところ
 *
 * ★選ぶと、その店舗の名簿にも**同じ名前・同じ番号**で入ります。
 *   なので**向こうの店舗から見ても、このボタンが押された状態**になり、
 *   同じ人を二重に登録する手間が消えます。
 */
function shiftLinkPicker(storeId, person) {
  const wrap = document.createElement('div');
  wrap.className = 'shift-link';

  const cap = document.createElement('p');
  cap.className = 'admin-note';
  cap.textContent = `${person.n} さんが入っている店舗を選んでください`
    + '（選ぶと、向こうの名簿にも同じ番号で入ります）';
  wrap.appendChild(cap);

  const いま = new Set(shiftLinkedStores(person.c));
  STORES.forEach((st) => {
    const b = document.createElement('button');
    b.type = 'button';
    const on = いま.has(st.id);
    const ここ = st.id === storeId;
    b.className = 'shift-code__btn' + (on ? ' is-on' : '');
    b.textContent = st.short + (ここ ? '（ここ）' : '');
    // ★いまいる店舗は外せません。外すと、押している本人が消えてしまいます
    b.disabled = ここ;
    b.addEventListener('click', () => {
      const next = new Set(いま);
      if (on) next.delete(st.id); else next.add(st.id);
      shiftSetLinked(storeId, person.n, person.c, [...next]);
      renderShiftStaff();
    });
    wrap.appendChild(b);
  });
  return wrap;
}

/**
 * 配る番号をコピーする
 *
 * ★番号だけをコピーします。前は案内の文もいっしょに入れていましたが、
 *   その人のLINEに貼るときに要らない文まで付いてくるので、番号だけにしました。
 */
function copyShiftCode(p, btn) {
  const text = String(p.c || '');
  navigator.clipboard.writeText(text).then(
    () => {
      btn.textContent = 'コピーした';
      setTimeout(() => { btn.textContent = 'コピー'; }, 2000);
    },
    () => { window.prompt('コピーしてください', text); }
  );
}

function saveShiftStaff() {
  ShiftStaff.saveFromText(state.storeId, el.shiftStaffInput.value);
  renderShiftStaff();
  el.shiftStaffSaved.classList.remove('is-hidden');
  setTimeout(() => el.shiftStaffSaved.classList.add('is-hidden'), 2500);
}

/* -------- シフトの枠と時刻 --------
 *
 *  店舗ごとの時間帯です。入れ先は `_shiftset/店舗id` の1行で、
 *  中身は**初めの形（config.js の SHIFT_SLOTS_DEFAULT）からの直しだけ**です。
 *
 *  ★記録に残る id（open / lunch / dinner）は、ここでは変えられません。
 *    変えると、それまでに組んだシフトが読めなくなるためです。
 *    変えられるのは「使うかどうか・画面に出る名前・説明・時刻」です。
 *    夜だけのお店は、ランチを外して open を「仕込み」、dinner を「営業」にします。
 */

/** '17,17.5, 18' → ['17','17.5','18']（数でないものは落とします） */
function shiftTimesFromText(text) {
  return String(text || '')
    .split(/[,、\s]+/)
    .map((v) => v.trim())
    .filter((v) => v !== '' && isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 24);
}

function renderShiftSlots() {
  const storeId = state.storeId;
  const 時刻で入れる = shiftUsesRange(storeId);
  const saved = Store.getDay(SHIFT_SET_STORE, storeId).items || {};
  const now = shiftSlotsOf(storeId);
  el.shiftSlotCount.textContent = `${now.length}つ`;
  el.shiftSlotList.innerHTML = '';

  SHIFT_SLOTS_DEFAULT.forEach((base) => {
    const v = saved[shiftSlotSetKey(base.id)] || {};
    const on = v.use !== false;
    const row = document.createElement('div');
    row.className = 'shift-slot';
    row.dataset.slot = base.id;

    const head = document.createElement('label');
    head.className = 'shift-slot__use';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = on;
    box.dataset.k = 'use';
    const who = document.createElement('b');
    // ★id も出します。記録に残っているのはこちらなので、
    //   名前を変えたあとに「どの枠を直しているのか」が分かるようにします
    who.textContent = `使う（${base.id}）`;
    head.append(box, who);
    row.appendChild(head);

    const add = (label, key, value, ph) => {
      const wrap = document.createElement('label');
      wrap.className = 'field';
      const cap = document.createElement('span');
      cap.className = 'field__label';
      cap.textContent = label;
      const inp = document.createElement('input');
      inp.className = 'field__input';
      inp.type = 'text';
      inp.value = value;
      inp.placeholder = ph;
      inp.dataset.k = key;
      wrap.append(cap, inp);
      row.appendChild(wrap);
    };
    add('画面に出る名前', 'name', v.name || base.name, base.name);
    add('説明（提出ページ）', 'hint', v.hint === undefined ? base.hint : v.hint, base.hint);
    // ★時刻を入れる店舗（popo）では、枠ごとの時刻は使いません。
    //   アルバイトが出した出勤・退勤がそのまま入り、どの行に入るかは
    //   出勤時刻で決まるためです。出すと「ここで決まる」と読めてしまいます
    if (!時刻で入れる) {
      add('選べる時刻', 'times',
        (Array.isArray(v.times) && v.times.length ? v.times : base.times).join(','),
        base.times.join(','));
      add('ふだんの時刻', 'pick', v.pick || base.pick, base.pick);
    }

    el.shiftSlotList.appendChild(row);
  });

  if (時刻で入れる) renderShiftRangeNote(storeId);
}

/**
 * 時刻を入れる店舗（popo）だけに出す説明と、Fの境目
 *
 * ★ランチタイムの時間帯は、**アルバイトには出しません**（お店の中の決めごと）。
 *   ここで決めた時刻より前に出て、あとまで残る人を「通し」とみなし、
 *   シフト表で名前を灰色に塗ります。バグると違って「F」の字は出しません。
 */
function renderShiftRangeNote(storeId) {
  const st = shiftStyleOf(storeId);
  const box = document.createElement('div');
  box.className = 'shift-slot';

  const p1 = document.createElement('p');
  p1.className = 'admin-note';
  p1.innerHTML = 'この店舗は<b>出勤〜退勤の時刻を入れる</b>やり方です。'
    + 'アルバイトは枠を選ばず、時刻だけを出します。<br>'
    + 'どの行に入るかは<b>出勤時刻</b>で決まります'
    + '（11:00より前＝立ち上げ、11:00〜16:30＝ランチ、17:00以降＝ディナー）。<br>'
    + '出してもらった時刻が<b>そのままシフト表に入り</b>、あとから名前を押して直せます。';
  box.appendChild(p1);

  const wrap = document.createElement('label');
  wrap.className = 'field';
  const cap = document.createElement('span');
  cap.className = 'field__label';
  cap.textContent = '通し（灰色）の境目';
  const inp = document.createElement('input');
  inp.className = 'field__input';
  inp.type = 'text';
  inp.id = 'shiftLunchTo';
  inp.value = st.lunchTo;
  inp.placeholder = '17';
  wrap.append(cap, inp);
  box.appendChild(wrap);

  const p2 = document.createElement('p');
  p2.className = 'admin-note';
  p2.innerHTML = 'この時刻<b>より前</b>に出勤して、この時刻<b>より後</b>まで残る人を'
    + '通しとみなし、シフト表で<b>名前を灰色に塗ります</b>。'
    + '<b>17</b> なら 17:00、<b>17.5</b> なら 17:30 です。<br>'
    + 'アルバイトの画面には出ません。';
  box.appendChild(p2);

  el.shiftSlotList.appendChild(box);
}

function saveShiftSlots() {
  const storeId = state.storeId;
  el.shiftSlotList.querySelectorAll('.shift-slot').forEach((row) => {
    const get = (k) => {
      const f = row.querySelector(`[data-k="${k}"]`);
      return f ? (f.type === 'checkbox' ? f.checked : f.value.trim()) : '';
    };
    const 直す = { use: !!get('use'), name: get('name'), hint: get('hint') };
    // ★時刻の欄は、時刻を入れる店舗では出していません。
    //   出していない欄を空で書くと、前に入れてあった時刻を消してしまいます
    if (row.querySelector('[data-k="times"]')) {
      const times = shiftTimesFromText(get('times'));
      const pick = get('pick');
      直す.times = times;
      // ★ふだんの時刻は、選べる時刻の中から選びます。
      //   外れていると「選べない時刻で入っている人」ができてしまいます
      直す.pick = times.includes(pick) ? pick : (times[0] || '');
    }
    Store.setItem(SHIFT_SET_STORE, storeId, shiftSlotSetKey(row.dataset.slot), 直す);
  });

  // 通し（灰色）の境目
  const 境目 = document.getElementById('shiftLunchTo');
  if (境目) {
    const v = 境目.value.trim();
    if (/^\d{1,2}(\.5)?$/.test(v)) {
      Store.setItem(SHIFT_SET_STORE, storeId, SHIFT_STYLE_KEY, { lunchTo: v });
    }
  }
  renderShiftSlots();
  el.shiftSlotSaved.classList.remove('is-hidden');
  setTimeout(() => el.shiftSlotSaved.classList.add('is-hidden'), 2500);
}

function resetShiftSlots() {
  if (!window.confirm(`${getStore(state.storeId).name} の枠をはじめの形に戻します。\n`
    + '立ち上げ／ランチ／ディナーの3つに戻ります。\n'
    + '組みおわったシフトは変わりません。')) return;
  // ★消すのではなく「直していない」状態に戻します。記録は消しません
  SHIFT_SLOTS_DEFAULT.forEach((base) => {
    Store.setItem(SHIFT_SET_STORE, state.storeId, shiftSlotSetKey(base.id), {
      use: true, name: '', hint: undefined, times: [], pick: '',
    });
  });
  renderShiftSlots();
}

/* -------- 年間の売上目標 --------
 *
 *  会議資料の円グラフが使います。1月からの税抜累計売上を、この金額で割ります。
 *
 *  ★もとは js/config.js に直接書いてありましたが、あのファイルは GitHub Pages で
 *    誰でも読めるので、会社の売上目標が店舗別に公開されていました。
 *    ここへ移して、設定（スプレッドシート側）で持つようにしました。
 *
 *  ★5店舗の合計は入れません。入れた5つを足して出します
 *    （二重に持つと、片方だけ古くなります）。
 */
function renderSalesTargets() {
  const map = SalesTargets.all();
  const n = STORES.filter((s) => map[s.id]).length;
  const five = SALES_TARGET_FIVE_STORES
    .reduce((t, id) => t + (Number(map[id]) || 0), 0);
  el.targetCount.textContent = n
    ? `${n}店舗　5店舗の合計 ¥${five.toLocaleString('ja-JP')}`
    : 'まだ登録なし';

  el.targetFields.innerHTML = '';
  STORES.forEach((s) => {
    const wrap = document.createElement('label');
    wrap.className = 'field';
    const label = document.createElement('span');
    label.className = 'field__label';
    label.textContent = s.name + (SALES_TARGET_FIVE_STORES.includes(s.id) ? '（5店舗に数える）' : '');
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.className = 'field__input';
    input.dataset.store = s.id;
    input.autocomplete = 'off';
    input.placeholder = '例：205000000';
    input.value = map[s.id] ? String(map[s.id]) : '';
    // 打っている途中でも、5店舗の合計がその場で分かるようにします
    input.addEventListener('input', updateTargetTotal);
    wrap.append(label, input);
    el.targetFields.appendChild(wrap);
  });
}

/** いま画面に入っている数字を読みます */
function targetInputs() {
  const map = {};
  [...el.targetFields.querySelectorAll('input[data-store]')].forEach((i) => {
    map[i.dataset.store] = Math.max(Math.round(Number(String(i.value).replace(/[,\s]/g, '')) || 0), 0);
  });
  return map;
}

/** 打っている途中の合計を出します（保存はしません） */
function updateTargetTotal() {
  const map = targetInputs();
  const n = STORES.filter((s) => map[s.id]).length;
  const five = SALES_TARGET_FIVE_STORES.reduce((t, id) => t + (map[id] || 0), 0);
  el.targetCount.textContent = n
    ? `${n}店舗　5店舗の合計 ¥${five.toLocaleString('ja-JP')}`
    : 'まだ登録なし';
}

function saveSalesTargets() {
  SalesTargets.save(targetInputs());
  renderSalesTargets();
  el.targetsSaved.classList.remove('is-hidden');
  setTimeout(() => el.targetsSaved.classList.add('is-hidden'), 2500);
}

/* -------- 日報フォルダ --------
 *
 *  会議資料の「日報から取り込む」が見に行く、店舗ごとのGoogleドライブの
 *  フォルダです。URLをそのまま貼れば、IDは NippouFolders が取り出します。
 *
 *  ★ここは「お店」だけです。まいと（キャッチだけの行き先）には日報が
 *    ないので出しません。
 */
function renderNippouFolders() {
  el.nippouTest.value = NippouTest.get();
  const map = NippouFolders.all();
  const n = STORES.filter((s) => map[s.id]).length;
  el.nippouCount.textContent = n ? `${n}店舗` : 'まだ登録なし';

  el.nippouFields.innerHTML = '';
  STORES.forEach((s) => {
    const wrap = document.createElement('label');
    wrap.className = 'field';
    const label = document.createElement('span');
    label.className = 'field__label';
    label.textContent = s.name;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'field__input';
    input.dataset.store = s.id;
    input.autocomplete = 'off';
    input.placeholder = 'https://drive.google.com/drive/folders/…';
    input.value = map[s.id] || '';
    wrap.append(label, input);
    el.nippouFields.appendChild(wrap);
  });
}

/** テスト用の日報の書き先（この端末の中だけ） */
function saveNippouTest() {
  NippouTest.save(el.nippouTest.value);
  el.nippouTestSaved.textContent = NippouTest.get()
    ? '保存しました（テスト用に書きます）' : '空にしました（本番に書きます）';
  el.nippouTestSaved.classList.remove('is-hidden');
  setTimeout(() => el.nippouTestSaved.classList.add('is-hidden'), 3000);
}

function saveNippouFolders() {
  const map = {};
  [...el.nippouFields.querySelectorAll('input[data-store]')].forEach((i) => {
    map[i.dataset.store] = i.value;
  });
  NippouFolders.save(map);
  renderNippouFolders();
  el.nippouSaved.classList.remove('is-hidden');
  setTimeout(() => el.nippouSaved.classList.add('is-hidden'), 2500);
}

function saveDrivers() {
  Drivers.saveFromText(el.driversInput.value);
  renderDrivers();
  el.driversSaved.classList.remove('is-hidden');
  setTimeout(() => el.driversSaved.classList.add('is-hidden'), 2500);
}

/**
 * スプレッドシート「00＿2026__支払い金額管理表」の2026年分を取り込む
 *
 * 配達記録の取り込みと同じ考え方です。項目の番号を
 * 「exp-2026-01-0」のように決め打ちにしてあるので、
 * 何度押しても同じところに上書きされ、二重には増えません。
 */
async function importExpenseRecords(only) {
  // ★取り込み用のファイルは**公開していません**（中身が業務データのためです）。
  //   公開先のマネージには入っていないので、ここで止めます
  if (typeof EXPENSE_IMPORT === 'undefined') {
    el.expImportNote.textContent =
      '取り込み用のファイルは、この画面では使えません。'
      + 'Mac の手元からマネージを開いてください（中身に氏名と金額が入るため、公開していません）。';
    return;
  }
  const all = Object.keys(EXPENSE_IMPORT);
  const months = only ? [all[all.length - 1]] : all;
  const rows = months.reduce((list, m) => list.concat(EXPENSE_IMPORT[m]), []);
  const yen = rows.reduce((t, r) => t + r[6], 0);

  const ok = await askConfirm({
    item: months.length === 1
      ? `${months[0]}　${rows.length}件　${yenText(yen)}`
      : `${months[0]} 〜 ${months[months.length - 1]}　${rows.length}件　${yenText(yen)}`,
    message: 'スプレッドシートに入っていた立替金の記録を、現金支払い管理表に入れます。よろしいですか？',
    okLabel: '取り込む',
  });
  if (!ok) return;

  months.forEach((month) => {
    EXPENSE_IMPORT[month].forEach((row, i) => {
      const [d, by, kind, store, people, label, y, receipt] = row;
      Store.setItem(EXPENSE_STORE, month, `exp-${month}-${i}`, {
        done: true, d, by, kind, store, people, label,
        yen: y, receipt: !!receipt,
      });
    });
  });

  // ★担当者リストには足しません。辞めた人の名前が
  //   新しい記録のプルダウンに戻ってきてしまうためです。
  //   過去の記録は e.by の名前で出るので、リストに無くても正しく並びます
  const gone = [...new Set(rows.map((r) => r[1]))].filter((n) => !Staff.list().includes(n));

  el.expImportNote.textContent =
    `${rows.length}件（${months.length}か月分・合計 ${yenText(yen)}）を取り込みました。`
    + (gone.length ? `${gone.join('・')} は担当者リストに無い名前ですが、過去の記録はそのまま出ます。` : '')
    + 'アプリの現金支払い管理表で確かめてください。';
  renderSyncStatus();
}

/* ============================================================
 *  定休日
 * ============================================================ */
function renderClosed() {
  const storeId = state.storeId;
  el.closedStoreName.textContent = getStore(storeId).name;

  const dows = Closed.dows(storeId);
  el.dowToggles.innerHTML = '';
  DOW.forEach((name, dow) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dow-toggle' + (dows.includes(dow) ? ' is-on' : '')
      + (dow === 0 ? ' is-sun' : dow === 6 ? ' is-sat' : '');
    b.textContent = name;
    b.setAttribute('aria-pressed', dows.includes(dow) ? 'true' : 'false');
    b.addEventListener('click', () => {
      const now = Closed.dows(storeId);
      Closed.setDows(storeId, now.includes(dow) ? now.filter((n) => n !== dow) : [...now, dow]);
      renderClosed();
    });
    el.dowToggles.appendChild(b);
  });

  const ex = Closed.exceptions(storeId);
  const dates = Object.keys(ex).sort();
  el.exList.innerHTML = '';
  if (!dates.length) {
    const li = document.createElement('li');
    li.className = 'ex-list__empty';
    li.textContent = '登録なし';
    el.exList.appendChild(li);
  }
  dates.forEach((dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const li = document.createElement('li');
    li.className = 'ex-list__item';
    li.innerHTML =
      `<span class="ex-list__date">${y}/${m}/${d}（${DOW[new Date(y, m - 1, d).getDay()]}）</span>` +
      `<span class="ex-list__kind ex-list__kind--${ex[dateStr]}">${ex[dateStr] === 'closed' ? '休業' : '営業'}</span>`;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'ex-list__del';
    del.textContent = '削除';
    del.addEventListener('click', () => {
      Closed.setException(storeId, dateStr, null);
      renderClosed();
    });
    li.appendChild(del);
    el.exList.appendChild(li);
  });
}

/**
 * 臨時の休業・営業を1日だけ登録する
 *
 * ★もとは「1/1〜1/3」のように期間で入れる作りでしたが、
 *   まとめて登録することが無く、1日ずつしか使わないため、
 *   日付を1つだけにしました（入れまちがいも減ります）。
 *   続けて休むときは、その日数だけ押してください。
 */
function addClosedException() {
  const day = el.exFrom.value;
  el.exHint.textContent = '';
  if (!day) { el.exHint.textContent = '日付を選んでください。'; return; }

  const kind = el.exKind.value;
  const before = Closed.exceptionOn(state.storeId, day);
  Closed.setException(state.storeId, day, kind);

  const [, m, d] = day.split('-').map(Number);
  const name = kind === 'closed' ? '休業' : '営業';
  el.exHint.textContent = before === kind
    ? `${m}/${d} は、すでに「${name}」で登録ずみです。`
    : `${m}/${d} を「${name}」で登録しました。`;

  el.exFrom.value = '';
  renderClosed();
}

/* ============================================================
 *  店舗選択（最初の画面）
 * ============================================================ */
/** その店舗の「◯区分 / ◯項目」と、週間掃除の項目数を数える */
function countOf(storeId) {
  const secs = Checklists.sections(storeId).filter(alive);
  return {
    sections: secs.length,
    items: secs.reduce((n, s) => n + s.items.filter(alive).length, 0),
    weekly: Weeklies.items(storeId).filter(alive).length,
  };
}

function renderStorePicker() {
  el.storeGrid.innerHTML = '';
  STORES.forEach((store) => {
    const n = countOf(store.id);
    const dows = Closed.dows(store.id);

    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'store-card store-card--admin';
    b.style.setProperty('--card-color', store.color);

    const chip = document.createElement('span');
    chip.className = 'logo-chip logo-chip--card';
    if (store.logo) {
      const img = document.createElement('img');
      img.src = '../' + store.logo;
      img.alt = '';
      chip.appendChild(img);
    } else {
      chip.classList.add('is-fallback');
      chip.style.setProperty('--chip-color', store.color);
    }

    const name = document.createElement('span');
    name.className = 'store-card__name';
    name.textContent = store.name;

    const status = document.createElement('span');
    status.className = 'store-card__status';
    status.textContent = `${n.sections}区分 / ${n.items}項目`;

    const sub = document.createElement('span');
    sub.className = 'store-card__sub';
    sub.textContent =
      (dows.length ? `毎週${dows.map((d) => DOW[d]).join('・')}曜定休` : '定休日なし') +
      `　週間掃除 ${n.weekly}項目`;

    b.append(chip, name, status, sub);
    b.addEventListener('click', () => openStore(store.id));
    li.appendChild(b);
    el.storeGrid.appendChild(li);
  });
}

function openStore(storeId) {
  state.storeId = storeId;
  // 店舗タブから切り替えたときは、同じ設定を開いたままにする
  if (!getPage(state.view)) state.view = 'menu';
  writeHash();
  renderAll();
  window.scrollTo(0, 0);
}

function goHome() {
  state.view = 'stores';
  writeHash();
  renderAll();
  window.scrollTo(0, 0);
}

/* -------- URLと画面を合わせる（端末の「戻る」で一覧へ戻れます） --------
 *
 *   #/stores            店舗を選ぶ
 *   #/{店舗}            設定を選ぶ
 *   #/{店舗}/{設定}     その設定の画面
 *
 * 現場アプリと同じ3段の作りです。設定を増やすときは ADMIN_PAGES に足します。
 */
/* 現場側のページ名（config.js の TASKS）と同じ呼び方にそろえます */
const ADMIN_PAGES = [
  { id: 'items',  name: 'クローズ', sub: '閉店時の確認項目',   icon: '🌙' },
  { id: 'weekly', name: '週間掃除', sub: '2週間ごとの掃除項目', icon: '🧹' },
  { id: 'closed', name: '定休日',   sub: '曜日と臨時の休業',   icon: '🗓' },
  // 交通費（配達記録アプリ）は、デリバリーをやっているバグるだけに出します
  {
    id: 'drive', name: '交通費', sub: '配達記録アプリの名前', icon: '🛵',
    when: (storeId) => storeId === DRIVE_SHOP,
  },
  // シフトは、シフトを組んでいる店舗にだけ出します（config.js の SHIFT_STORES）
  {
    id: 'shift', name: 'シフト', sub: 'シフトに入る人と番号', icon: '👥',
    when: (storeId) => SHIFT_STORES.includes(storeId),
  },
  // 教育の名前。ワークスからも足せますが、まとめて直すときはこちらです
  { id: 'train', name: '教育', sub: '教える項目と、受ける人', icon: '🎓' },
];

/** その店舗で使えるページだけ */
function pageList(storeId) {
  return ADMIN_PAGES.filter((p) => typeof p.when !== 'function' || p.when(storeId));
}

function getPage(id, storeId) {
  const page = ADMIN_PAGES.find((p) => p.id === id) || null;
  if (!page) return null;
  // 使えない店舗のURLを直接開かれた場合は、無いものとして扱います
  if (storeId && typeof page.when === 'function' && !page.when(storeId)) return null;
  return page;
}

function writeHash() {
  let want = '#/stores';
  if (state.view === 'menu') want = `#/${state.storeId}`;
  else if (state.view !== 'stores') want = `#/${state.storeId}/${state.view}`;
  if (location.hash !== want) location.hash = want;
}

function readHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter((s) => s !== '');
  const [id, page] = parts;
  if (!id || id === 'stores' || !STORES.some((s) => s.id === id)) {
    state.view = 'stores';
    return;
  }
  state.storeId = id;
  state.view = getPage(page, id) ? page : 'menu';
}

/* ============================================================
 *  店舗タブ
 * ============================================================ */
function renderStoreTabs() {
  el.storeTabs.innerHTML = '';
  STORES.forEach((store) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'store-tab' + (store.id === state.storeId ? ' is-active' : '');
    b.style.setProperty('--tab-color', store.color);

    const chip = document.createElement('span');
    chip.className = 'logo-chip logo-chip--tab';
    if (store.logo) {
      const img = document.createElement('img');
      img.src = '../' + store.logo;
      img.alt = '';
      chip.appendChild(img);
    } else {
      chip.classList.add('is-fallback');
      chip.style.setProperty('--chip-color', store.color);
    }
    const label = document.createElement('span');
    label.textContent = store.short;
    b.appendChild(chip);
    b.appendChild(label);

    b.addEventListener('click', () => openStore(store.id));
    el.storeTabs.appendChild(b);
  });
}

/** その設定のいまの状態（メニューに出す短い文字） */
function pageStatus(pageId, storeId) {
  if (pageId === 'items') {
    const secs = Checklists.sections(storeId).filter(alive);
    const n = secs.reduce((t, s) => t + s.items.filter(alive).length, 0);
    return `${secs.length}区分 / ${n}項目`;
  }
  if (pageId === 'weekly') {
    const items = Weeklies.items(storeId).filter(alive);
    const bi = items.filter(isBiweekly).length;
    return `${items.length}項目` + (bi ? `（2週 ${bi}）` : '');
  }
  if (pageId === 'closed') {
    const dows = Closed.dows(storeId);
    const ex = Object.keys(Closed.exceptions(storeId)).length;
    return (dows.length ? `毎週${dows.map((d) => DOW[d]).join('・')}曜` : '定休日なし')
      + (ex ? ` / 臨時${ex}日` : '');
  }
  if (pageId === 'drive') return `${Drivers.list().length}人`;
  if (pageId === 'shift') {
    const n = ShiftStaff.count(storeId);
    return n ? `${n}人` : 'まだ登録なし';
  }
  if (pageId === 'train') {
    const secs = Trainings.sections(storeId).filter(alive);
    const items = secs.reduce((t, s) => t + s.items.filter(alive).length, 0);
    const n = Trainees.list(storeId).length;
    if (!items) return '項目がまだ';
    return `${items}項目 / ${n}人`;
  }
  return '';
}

function renderMenu() {
  const store = getStore(state.storeId);
  el.menuTitle.textContent = store.name;
  el.menuGrid.innerHTML = '';

  pageList(store.id).forEach((page) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'task-card';
    b.style.setProperty('--card-color', store.color);

    // 現場アプリの業務選びと同じ見た目にそろえます
    const icon = document.createElement('span');
    icon.className = 'task-card__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = page.icon || '';

    const main = document.createElement('span');
    main.className = 'task-card__main';
    const name = document.createElement('span');
    name.className = 'task-card__name';
    name.textContent = page.name;
    const sub = document.createElement('span');
    sub.className = 'task-card__sub';
    sub.textContent = page.sub;
    main.append(name, sub);

    const status = document.createElement('span');
    status.className = 'task-card__status';
    status.textContent = pageStatus(page.id, store.id);

    b.append(icon, main, status);
    b.addEventListener('click', () => openPage(page.id));
    li.appendChild(b);
    el.menuGrid.appendChild(li);
  });
}

function openPage(pageId) {
  state.view = pageId;
  writeHash();
  renderAll();
  window.scrollTo(0, 0);
}

function goMenu() {
  state.view = 'menu';
  writeHash();
  renderAll();
  window.scrollTo(0, 0);
}

function renderAll() {
  const isStores = state.view === 'stores';
  const isMenu = state.view === 'menu';
  const page = getPage(state.view, state.storeId);

  el.viewStores.classList.toggle('is-hidden', !isStores);
  el.viewMenu.classList.toggle('is-hidden', !isMenu);
  el.storeTabs.classList.toggle('is-hidden', isStores);
  el.pageBarRow.classList.toggle('is-hidden', !page);
  el.viewItems.classList.toggle('is-hidden', state.view !== 'items');
  el.viewWeekly.classList.toggle('is-hidden', state.view !== 'weekly');
  el.viewClosed.classList.toggle('is-hidden', state.view !== 'closed');
  el.viewDrive.classList.toggle('is-hidden', state.view !== 'drive');
  el.viewShift.classList.toggle('is-hidden', state.view !== 'shift');
  el.viewTrain.classList.toggle('is-hidden', state.view !== 'train');

  if (isStores) {
    document.documentElement.style.setProperty('--store', '#2b7fd4');
    document.title = 'T3 Works Manage';
    renderStorePicker();
    renderStaff();
    renderCatchStaff();
    renderNippouFolders();
    renderSalesTargets();
    renderSyncStatus();
    return;
  }

  const store = getStore(state.storeId);
  document.documentElement.style.setProperty('--store', store.color);
  document.title = `${store.name}｜T3 Works Manage`;
  renderStoreTabs();
  renderSyncStatus();

  if (isMenu) { renderMenu(); return; }

  el.pageBarName.textContent = page.name;
  if (state.view === 'items') {
    renderChecklistEditor();
    el.importNote.textContent = '';
    renderUndo();
  } else if (state.view === 'weekly') {
    renderWeeklyEditor();
  } else if (state.view === 'closed') {
    renderClosed();
  } else if (state.view === 'drive') {
    renderDrivers();
  } else if (state.view === 'shift') {
    renderShiftStaff();
    renderShiftSlots();
  } else if (state.view === 'train') {
    renderChecklistEditor();
    renderTrainees();
  }
}

/* ============================================================
 *  共有の状態（ヘッダーのチップ）
 * ============================================================ */
function renderSyncStatus() {
  const s = Sync.status();
  if (s.kind === 'off') { el.syncChip.classList.add('is-hidden'); return; }
  el.syncChip.classList.remove('is-hidden');
  // 文字は出さず、形と色だけで見せます（現場アプリと同じしるしです）
  const text = s.text === '同期済み' ? '保存済み' : s.text;
  el.syncChip.className = `sync-chip sync-chip--${s.kind}`;
  el.syncChip.innerHTML = Sync.iconSvg(s.kind);
  el.syncChip.title = `${text}（タップで今すぐ保存）`;
  el.syncChip.setAttribute('aria-label', `保存の状態：${text}`);
}

/* ============================================================
 *  この端末の設定（ワークス・マインと同じ中身です）
 *
 *  ★アプリが最新の版かどうかを、ここで確かめられます。
 *    「画面が古いまま」というときの切り分けに使います。
 * ============================================================ */
/* ------------------------------------------------------------
 *  端末の保存の使い具合（設定の画面に出します）
 *
 *  なぜ出すか … 「保存できません」が起きるまで、誰も残りが分からないためです。
 *  数字が上限に近づいてきたら、古い月を落とす手当てをします。
 * ---------------------------------------------------------- */
function renderStoreUsage() {
  const box = document.getElementById('storeUsage');
  if (!box) return;
  const u = Store.usage();
  const mb = u.mb < 0.1 ? u.mb.toFixed(2) : u.mb.toFixed(1);
  const where = u.isOld
    ? `古い置き場所です。<b>${mb}MB / 目安5MB</b>`
    : `新しい置き場所（数百MBまで置けます）。<b>${mb}MB</b>`;
  const warn = u.isOld && u.mb > 3.5
    ? '<br><b>★上限に近づいています。</b>' : '';
  box.innerHTML = `${where}　記録 ${u.keys}件${warn}`;
}

function openSettings() {
  // 共有の様子
  const n = Sync.outbox().length;
  const t = Sync.lastSyncAt;
  const at = t ? `（最後に保存 ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}）` : '';
  el.syncInfo.textContent = !Sync.enabled()
    ? '（この端末では共有していません）'
    : Sync.lastError
      ? `${Sync.lastError}（未保存 ${n}件。つながり次第、自動で送られます）`
      : n
        ? `未保存 ${n}件。まもなく送られます。${at}`
        : `全店舗と同期できています。${at}`;
  el.syncLegend.innerHTML = Sync.legendHtml();

  // 版の番号。困ったときに「この番号を教えて」と聞くためのものです
  const v = Updater.current();
  el.appVersionText.innerHTML = v
    ? `いま入っているのは <b>${v}</b> です。`
    : '（手元で開いているため、版の番号はありません）';
  renderStoreUsage();

  el.modal.classList.remove('is-hidden');
}

function closeSettings() {
  el.modal.classList.add('is-hidden');
}

/* ============================================================
 *  管理用PIN
 * ============================================================ */
function openPinModal() {
  el.pinModal.classList.remove('is-hidden');
  el.pinError.textContent = '';
  el.pinInput.value = '';
  setTimeout(() => el.pinInput.focus(), 50);
}

async function submitPin() {
  // 全角で入れても通るように、半角に直してから確かめます
  const pin = toHalfWidth(el.pinInput.value).trim();
  if (!pin) { el.pinError.textContent = 'PINを入力してください。'; return; }

  el.pinError.textContent = '確認しています…';
  Sync.setPin(pin);
  await Sync.flush();

  if (!Sync.pin()) {
    el.pinError.textContent = Sync.lastError || 'PINが違います。もう一度入力してください。';
    return;
  }
  // 現場用PINで入られると設定を変えられないので、ここで弾いておく
  const check = await Sync.probeAdmin();
  if (!check.admin) {
    Sync.clearPin();
    el.pinError.textContent = check.error || 'これは現場用のPINです。管理用PINを入力してください。';
    return;
  }

  el.pinModal.classList.add('is-hidden');
  Sync.start();
  renderAll();
}

/* ============================================================
 *  あとから決まった項目を、全店舗に足す
 *
 *  項目は「マネージで直したもの」が優先されるので、config.js に
 *  書き足しても出てきません。ここで、保存されている中身に足します。
 *
 *  ★同期で最新を受け取ってから動かします。受け取る前に保存すると、
 *    ほかの端末で直した内容を、この端末の古い中身で上書きしてしまいます。
 *  ★同じ id があれば何もしません。消した項目は retiredAt が付いたまま
 *    残るので、「消したのに復活する」ことはありません。
 *  ★入れ先が見つからない店舗（おいでんテラスには日報入力がありません）は
 *    飛ばします。勝手に別の場所へ入れません。
 * ============================================================ */
const LATER_ITEMS = [
  { id: 'tc01', label: '全員タイムカード切ってるかチェック', after: '日報入力' },
];

function addLaterItems() {
  // 同期で設定を受け取る前は、まだ動かしません
  if (Sync.enabled() && !localStorage.getItem(Checklists._key)) return;

  const done = [];
  LATER_ITEMS.forEach((add) => {
    STORES.forEach((store) => {
      const secs = Checklists.sections(store.id);

      // 入れ先（「日報入力」）と、その店舗の項目idの付け方を探します
      let sec = null;
      let at = -1;
      secs.forEach((sc) => {
        (sc.items || []).forEach((it, i) => {
          if (sec) return;
          if (it.label === add.after && !it.retiredAt) { sec = sc; at = i; }
        });
      });
      if (!sec) return;                       // 入れ先がない店舗は飛ばします

      const prefix = String(sec.items[at].id).split('-')[0];
      const newId = `${prefix}-${add.id}`;
      const exists = secs.some((sc) => (sc.items || []).some((it) => it.id === newId));
      if (exists) return;                     // すでにある／前に消した

      const next = JSON.parse(JSON.stringify(secs));
      const target = next.find((sc) => sc.id === sec.id);
      target.items.splice(at + 1, 0, { id: newId, label: add.label });
      Checklists.save(store.id, next);
      done.push(`${store.name}（${newId}）`);
    });
  });

  if (done.length) {
    console.log('項目を足しました: ' + done.join('、'));
    renderAll();
  }
}

/* ============================================================
 *  バックアップ
 * ============================================================ */
function exportJson() {
  const blob = new Blob([Store.exportJson()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `T3Works_バックアップ_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    const ok = await askConfirm({
      item: file.name,
      message: 'いまの内容に上書きします。よろしいですか？',
    });
    if (!ok) return;
    try {
      Store.importJson(String(reader.result));
      renderAll();
    } catch (e) {
      alert('読み込めませんでした。書き出したファイルを選んでください。');
    }
  };
  reader.readAsText(file);
}

/* ============================================================
 *  起動
 * ============================================================ */
function bindEvents() {
  el.homeBtn.addEventListener('click', goHome);
  el.menuBackBtn.addEventListener('click', goHome);
  el.pageBar.addEventListener('click', goMenu);
  // 設定のページから、店舗選択まで一気に戻る
  el.pageBarHome.addEventListener('click', goHome);
  window.addEventListener('hashchange', () => { readHash(); renderAll(); });

  el.addSection.addEventListener('click', addSection);
  el.importDefaults.addEventListener('click', importDefaults);
  el.undoImport.addEventListener('click', undoImport);
  el.pauseAdd.addEventListener('click', addPause);
  el.pauseModal.querySelectorAll('[data-pause-close]').forEach((n) =>
    n.addEventListener('click', () => el.pauseModal.classList.add('is-hidden')));

  el.dowEveryday.addEventListener('click', () => updateDows(() => []));
  el.dowModal.querySelectorAll('[data-dow-close]').forEach((n) =>
    n.addEventListener('click', () => el.dowModal.classList.add('is-hidden')));
  el.saveStaff.addEventListener('click', saveStaff);
  el.saveDrivers.addEventListener('click', saveDrivers);
  el.saveCatchStaff.addEventListener('click', saveCatchStaff);
  el.saveShiftStaff.addEventListener('click', saveShiftStaff);
  el.saveShiftSlots.addEventListener('click', saveShiftSlots);
  el.resetShiftSlots.addEventListener('click', resetShiftSlots);
  el.saveTrain.addEventListener('click', saveTrainees);
  el.trainAddSection.addEventListener('click', addSection);
  el.saveTargets.addEventListener('click', saveSalesTargets);
  el.saveNippou.addEventListener('click', saveNippouFolders);
  el.saveNippouTest.addEventListener('click', saveNippouTest);
  el.expImportLast.addEventListener('click', () => importExpenseRecords(true));
  el.expImport.addEventListener('click', () => importExpenseRecords(false));
  el.exAdd.addEventListener('click', addClosedException);
  el.exportBtn.addEventListener('click', exportJson);
  el.importFile.addEventListener('change', (e) => {
    if (e.target.files[0]) importJson(e.target.files[0]);
    e.target.value = '';
  });

  el.syncChip.addEventListener('click', () => Sync.flush());
  el.pinOk.addEventListener('click', submitPin);

  /* この端末の設定 */
  el.settingsBtn.addEventListener('click', openSettings);
  el.modal.querySelectorAll('[data-close]').forEach((n) => n.addEventListener('click', closeSettings));
  el.syncNow.addEventListener('click', () => { Sync.scheduleFlush(0); closeSettings(); });
  el.pinChange.addEventListener('click', () => {
    Sync.clearPin();
    closeSettings();
    openPinModal();
  });
  el.forceUpdate.addEventListener('click', () => {
    el.forceUpdate.disabled = true;
    el.forceUpdate.textContent = '読み直しています…';
    Updater.force();
  });
  el.pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !imeEnter(e)) submitPin(); });
  bindHalfWidthInput(el.pinInput, 'code');
  el.pinReveal.addEventListener('click', () => {
    const shown = el.pinInput.type === 'text';
    el.pinInput.type = shown ? 'password' : 'text';
    el.pinReveal.textContent = shown ? '表示' : '隠す';
  });
}

async function init() {
  if (APP.logo) el.appLogo.src = '../' + APP.logo;
  readHash();
  writeHash();
  bindEvents();

  // ★保存先を先に用意します（失敗しても、いままでの場所で動きます）
  await Store.boot();
  window.addEventListener('pagehide', () => Store.flushNow());

  renderAll();
  Updater.start();
  if (!Sync.enabled()) addLaterItems();

  if (!Sync.enabled()) {
    // 共有先が未設定のときは、この端末の中だけで編集できます
    return;
  }
  // 同期で最新を受け取ったら、あとから決まった項目を足します
  Sync.onChange = () => { renderSyncStatus(); addLaterItems(); };
  if (!Sync.pin()) openPinModal();
  else Sync.start();
}

init();
