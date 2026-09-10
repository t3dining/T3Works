/* ============================================================
 *  画面の組み立てと操作
 *  URL の形： #/店舗id/YYYY-MM-DD/表示(day|month)
 *  例：      #/kojare/2026-08-08/day
 *  → 店舗ごとにURLが分かれるので、店舗別のリンク共有もできます。
 * ============================================================ */

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();

/* 「今日」は業務上の今日です。朝6時（APP.dayStartHour）より前は前の日あつかい。
   締めが0時をまたいでも、開くページは前の日のままになります */
const today = businessDate();
const TODAY = { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() };
const TODAY_STR = ymd(TODAY.y, TODAY.m, TODAY.d);

/* ---------- 画面の状態 ---------- */
const state = {
  storeId: '', // 空 = まだ店舗を選んでいない（店舗選択画面を出す）
  y: TODAY.y,
  m: TODAY.m,
  d: TODAY.d,
  view: 'stores',
  /**
   * いま送っている提出の記録キー（送り終わるまで「送信中…」と出します）
   *
   * ★提出だけは、届いたのを見届けてから「提出済み」にします。
   *   押した直後に閉じてしまい、ほかの店舗の画面に出ていない、
   *   ということが起きていたためです。
   */
  sending: '',
  /** 送れなかったときの理由（提出のところに赤で出します） */
  sendError: '',
  /** その理由がどの提出のものか。別の日を開いたときに出しっぱなしにしないため */
  sendErrorKey: '',
};

/* ---------- 要素 ---------- */
const $ = (id) => document.getElementById(id);
const el = {
  appTitle: $('appTitle'), appCompany: $('appCompany'), appLogo: $('appLogo'),
  storeTabs: $('storeTabs'), storeName: $('storeNameLabel'), storeLogo: $('storeLogo'),
  storeClosedBadge: $('storeClosedBadge'),
  yearLabel: $('yearLabel'), monthTabs: $('monthTabs'), dayTabs: $('dayTabs'),
  viewDay: $('viewDay'), viewMonth: $('viewMonth'),
  viewTasks: $('viewTasks'), taskGrid: $('taskGrid'),
  tasksTitle: $('tasksTitle'), tasksDate: $('tasksDate'),
  taskBarName: $('taskBarName'),
  viewStores: $('viewStores'), storeGrid: $('storeGrid'), storesDate: $('storesDate'),
  viewReport: $('viewReport'), storeHead: $('storeHead'),
  reportMonth: $('reportMonth'), reportMonthSummary: $('reportMonthSummary'),
  calHead: $('calHead'), calGrid: $('calGrid'),
  missModal: $('missModal'), missFormTitle: $('missFormTitle'),
  missDate: $('missDate'), missStores: $('missStores'), missBy: $('missBy'),
  missWho: $('missWho'), missWhoFree: $('missWhoFree'),
  missText: $('missText'), missError: $('missError'), missSave: $('missSave'),
  missDeleteRow: $('missDeleteRow'),
  submitCard: $('submitCard'), submitStatus: $('submitStatus'),
  submitBtn: $('submitBtn'), unsubmitBtn: $('unsubmitBtn'), syncWarn: $('syncWarn'),
  reportDate: $('reportDate'), reportSummary: $('reportSummary'), reportList: $('reportList'),
  syncChip: $('syncChip'), syncInfo: $('syncInfo'), syncField: $('syncField'),
  syncLegend: $('syncLegend'),
  pinModal: $('pinModal'), pinInput: $('pinInput'), pinError: $('pinError'),
  dayNum: $('dayNum'), dayDow: $('dayDow'), dayRollover: $('dayRollover'),
  progressBar: $('dayProgressBar'), progressText: $('dayProgressText'),
  checklist: $('checklistArea'), note: $('dayNote'), updated: $('dayUpdated'),
  closedNotice: $('closedNotice'), noteCard: $('noteCard'), staffRow: $('staffRow'),
  overrideTag: $('overrideTag'), closedToggle: $('closedToggle'), overrideReset: $('overrideReset'),
  staffSelect: $('dayStaff'),
  monthSummary: $('monthSummary'), monthTable: $('monthTable'),
  viewWeek: $('viewWeek'), weekTable: $('weekTable'), weekTableWrap: $('weekTableWrap'),
  weekEmpty: $('weekEmpty'), weekNote: $('weekNote'), weekNoteCard: $('weekNoteCard'),
  weekNavMain: $('weekNavMain'), weekNavSub: $('weekNavSub'),
  periodCard: $('periodCard'), periodTitle: $('periodTitle'), periodRate: $('periodRate'),
  periodBar: $('periodBar'), periodCount: $('periodCount'), periodWhen: $('periodWhen'),
  viewTrain: $('viewTrain'), trainList: $('trainList'), trainPeople: $('trainPeople'),
  trainCount: $('trainCount'), trainNewName: $('trainNewName'), trainAdd: $('trainAdd'),
  trainAddMsg: $('trainAddMsg'), trainDoneHead: $('trainDoneHead'),
  trainDoneLabel: $('trainDoneLabel'), trainDoneMark: $('trainDoneMark'),
  trainDonePeople: $('trainDonePeople'), trainOne: $('trainOne'), trainBack: $('trainBack'),
  trainOneName: $('trainOneName'), trainOneBar: $('trainOneBar'), trainRemove: $('trainRemove'),
  trainOneCount: $('trainOneCount'), trainSections: $('trainSections'),
  viewCash: $('viewCash'), cashDate: $('cashDate'), cashShot: $('cashShot'),
  cashShotImg: $('cashShotImg'), cashShotEmpty: $('cashShotEmpty'),
  cashTake: $('cashTake'), cashTakeText: $('cashTakeText'), cashFile: $('cashFile'),
  cashMsg: $('cashMsg'), cashSales: $('cashSales'), cashStaff: $('cashStaff'),
  cashSave: $('cashSave'), cashWho: $('cashWho'),
  cashDone: $('cashDone'), cashRedo: $('cashRedo'),
  cashMonthTitle: $('cashMonthTitle'), cashMonthSum: $('cashMonthSum'), cashList: $('cashList'),
  cashOcrLink: $('cashOcrLink'), ocrModal: $('ocrModal'), ocrText: $('ocrText'), ocrCopy: $('ocrCopy'),
  cashTabDay: $('cashTabDay'), cashTabWeek: $('cashTabWeek'),
  cashPaneDay: $('cashPaneDay'), cashPaneWeek: $('cashPaneWeek'),
  cashWeekPrev: $('cashWeekPrev'), cashWeekNext: $('cashWeekNext'), cashWeekThis: $('cashWeekThis'),
  cashWeekLabel: $('cashWeekLabel'), cashWeekList: $('cashWeekList'),
  cashWeekMiss: $('cashWeekMiss'),
  shotModal: $('shotModal'), shotBig: $('shotBig'),
  weekSubmitCard: $('weekSubmitCard'), weekSubmitRange: $('weekSubmitRange'),
  weekSubmitRate: $('weekSubmitRate'), weekSubmitHint: $('weekSubmitHint'),
  periodSubmit: $('periodSubmit'), periodStaff: $('periodStaff'),
  periodSubmitBtn: $('periodSubmitBtn'), periodDone: $('periodDone'),
  periodDoneMeta: $('periodDoneMeta'),
  anytimeBlock: $('anytimeBlock'), anytimeList: $('anytimeList'),
  viewExpense: $('viewExpense'), expenseMonth: $('expenseMonth'),
  expenseSummary: $('expenseSummary'), expenseList: $('expenseList'),
  expenseSize: $('expenseSize'),
  expenseModal: $('expenseModal'), expDate: $('expDate'), expBy: $('expBy'),
  expLabel: $('expLabel'), expYen: $('expYen'), expChips: $('expChips'),
  expWhoNote: $('expWhoNote'),
  expenseTotals: $('expenseTotals'), expenseTotalWrap: $('expenseTotalWrap'),
  expenseFoot: $('expenseFoot'), expenseTotalYen: $('expenseTotalYen'),
  expenseUnpaidYen: $('expenseUnpaidYen'), expenseUnpaidBox: $('expenseUnpaidBox'),
  expensePeople: $('expensePeople'),
  viewCatch: $('viewCatch'), catchMonth: $('catchMonth'),
  catchSummary: $('catchSummary'), catchTotals: $('catchTotals'), catchList: $('catchList'),
  catchFoot: $('catchFoot'), catchPeopleTotal: $('catchPeopleTotal'),
  catchYenTotal: $('catchYenTotal'),
  rankCount: $('rankCount'), rankFilter: $('rankFilter'),
  rankRows: $('rankRows'), rankFoot: $('rankFoot'), rankNote: $('rankNote'),
  rankPie: $('rankPie'), rankPieBox: $('rankPieBox'),
  catchDetailModal: $('catchDetailModal'), catchDetailHead: $('catchDetailHead'),
  catchDetailList: $('catchDetailList'), catchDetailFoot: $('catchDetailFoot'),
  catchDetailNote: $('catchDetailNote'),
  viewSettle: $('viewSettle'), settleYear: $('settleYear'), settleSummary: $('settleSummary'),
  settleLockBtn: $('settleLockBtn'),
  settleRows: $('settleRows'), settleFoot: $('settleFoot'),
  settleModal: $('settleModal'), settleFormTitle: $('settleFormTitle'),
  settleFormYen: $('settleFormYen'), settleDate: $('settleDate'),
  settleAccounts: $('settleAccounts'), settleAccount: $('settleAccount'),
  settleError: $('settleError'), settleSave: $('settleSave'), settleClear: $('settleClear'),
  viewMeeting: $('viewMeeting'), meetingMonth: $('meetingMonth'),
  meetingSummary: $('meetingSummary'), meetingMonths: $('meetingMonths'),
  meetingLast: $('meetingLast'), meetingLastTitle: $('meetingLastTitle'),
  meetingNotesOf: $('meetingNotesOf'),
  meetingLastList: $('meetingLastList'),
  meetingBar: $('meetingBar'), meetingModeSeg: $('meetingMode'),
  nippouBox: $('nippouBox'), nippouPull: $('nippouPull'),
  nippouNote: $('nippouNote'), nippouResult: $('nippouResult'),
  utilEdit: $('utilEdit'), utilModal: $('utilModal'), utilYear: $('utilYear'),
  utilRows: $('utilRows'), utilSave: $('utilSave'),
  meetingTableWrap: $('meetingTableWrap'), meetingScrollHint: $('meetingScrollHint'),
  meetingCatchWarn: $('meetingCatchWarn'),
  meetingHead: $('meetingHead'), meetingBody: $('meetingBody'),
  meetingCumWrap: $('meetingCumWrap'), meetingCumBody: $('meetingCumBody'),
  meetingCumFoot: $('meetingCumFoot'), meetingCumTitle: $('meetingCumTitle'),
  meetingCumYearHead: $('meetingCumYearHead'),
  meetingGoals: $('meetingGoals'), meetingGoalPace: $('meetingGoalPace'),
  meetingGoalNote: $('meetingGoalNote'),
  meetingNotes: $('meetingNotes'), meetingNoteCount: $('meetingNoteCount'),
  expStoreField: $('expStoreField'), expStores: $('expStores'),
  expWhoField: $('expWhoField'), expWho: $('expWho'), expWhoFree: $('expWhoFree'),
  expPeopleField: $('expPeopleField'), expPeople: $('expPeople'),
  expFreeField: $('expFreeField'),
  expReceiptSeg: $('expReceipt'), expenseError: $('expenseError'),
  expenseFormTitle: $('expenseFormTitle'), expenseSave: $('expenseSave'),
  viewWeekAll: $('viewWeekAll'), weekAllRange: $('weekAllRange'),
  weekAllYear: $('weekAllYear'), weekAllGrid: $('weekAllGrid'),
  weekAllYearSummary: $('weekAllYearSummary'),
  weekAllSummary: $('weekAllSummary'), weekAllList: $('weekAllList'),
  viewShift: $('viewShift'), shiftPrev: $('shiftPrev'), shiftNext: $('shiftNext'),
  shiftToday: $('shiftToday'), shiftNavMain: $('shiftNavMain'), shiftNavSub: $('shiftNavSub'),
  shiftWishCount: $('shiftWishCount'), shiftWishNote: $('shiftWishNote'),
  shiftWishBtn: $('shiftWishBtn'), shiftTakeBtn: $('shiftTakeBtn'),
  shiftPhase: $('shiftPhase'), shiftOpenBtn: $('shiftOpenBtn'),
  shiftOpenModal: $('shiftOpenModal'), shiftOpenWhen: $('shiftOpenWhen'),
  shiftOpenDue: $('shiftOpenDue'), shiftOpenNote: $('shiftOpenNote'),
  shiftOpenGo: $('shiftOpenGo'),
  shiftBuildBtn: $('shiftBuildBtn2'),
  shiftDays: $('shiftDays'), shiftSheetBtn: $('shiftSheetBtn'),
  shiftPickModal: $('shiftPickModal'), shiftPickTitle: $('shiftPickTitle'),
  shiftPickWhen: $('shiftPickWhen'), shiftPickTimeField: $('shiftPickTimeField'),
  shiftPickTimes: $('shiftPickTimes'), shiftPickTimeLabel: $('shiftPickTimeLabel'),
  shiftPickLanes: $('shiftPickLanes'),
  shiftPickFreeField: $('shiftPickFreeField'), shiftPickFree: $('shiftPickFree'),
  shiftPickFreeGo: $('shiftPickFreeGo'),
  shiftPickFullField: $('shiftPickFullField'), shiftPickFullLabel: $('shiftPickFullLabel'),
  shiftPickEarlyField: $('shiftPickEarlyField'),
  shiftPickEarlyOn: $('shiftPickEarlyOn'), shiftPickEarlyOff: $('shiftPickEarlyOff'),
  shiftPickFullOn: $('shiftPickFullOn'), shiftPickFullOff: $('shiftPickFullOff'),
  shiftPickShortField: $('shiftPickShortField'),
  shiftPickShort: $('shiftPickShort'), shiftPickShortGo: $('shiftPickShortGo'),
  shiftPickNameField: $('shiftPickNameField'),
  shiftPickNames: $('shiftPickNames'), shiftPickRemove: $('shiftPickRemove'),
  shiftWishModal: $('shiftWishModal'), shiftWishWhen: $('shiftWishWhen'),
  shiftWishList: $('shiftWishList'),
  shiftSheetModal: $('shiftSheetModal'), shiftSheetTitle: $('shiftSheetTitle'),
  shiftPastBtn: $('shiftPastBtn'),
  shiftPastModal: $('shiftPastModal'),
  shiftPastList: $('shiftPastList'),
  shiftSheet: $('shiftSheet'), shiftPrintBtn: $('shiftPrintBtn'),
  shiftPrintNote: $('shiftPrintNote'),
  shiftPdfBtn: $('shiftPdfBtn'), shiftJpegBtn: $('shiftJpegBtn'),
  doerModal: $('doerModal'), doerItem: $('doerItem'), doerWeek: $('doerWeek'),
  doerGrid: $('doerGrid'), doerClear: $('doerClear'),
  settingsBtn: $('settingsBtn'), modal: $('modal'),
  appVersionText: $('appVersionText'), forceUpdate: $('forceUpdate'),
  cashNippouBox: $('cashNippouBox'), cashCheckMark: $('cashCheckMark'),
  cashToNippou: $('cashToNippou'), cashNippouMsg: $('cashNippouMsg'),
  cashMinus: $('cashMinus'), cashNippou: $('cashNippou'), cashChecks: $('cashChecks'),
  confirmDialog: $('confirmDialog'), confirmItem: $('confirmItem'),
  confirmMessage: $('confirmMessage'), confirmOk: $('confirmOk'),
};

/* ============================================================
 *  URL（ハッシュ）の読み書き
 * ============================================================ */
/* URLの形
 *   #/                          店舗を選ぶ
 *   #/{店舗}                    業務を選ぶ
 *   #/{店舗}/{業務}             その業務の画面（日付は今日）
 *   #/{店舗}/{業務}/{YYYY-MM-DD} 日付つき
 *   #/report/{YYYY-MM-DD}       全店舗の提出記録（店舗に属さない）
 *   #/weekall/{YYYY-MM-DD}      全店舗の週間掃除 達成状況
 */
const ALL_STORE_VIEWS = ['report', 'weekall', 'expense', 'catch', 'settle', 'meeting'];

/**
 * いま出さない画面。URLを直に叩かれても入れないようにします
 * （ブックマークや履歴から古いURLで来ることがあるため）
 */
function viewIsOff(view) {
  return view === 'settle' && !SETTLE_PAGE_ON;
}

function readHash() {
  const parts = (location.hash || '').replace(/^#\/?/, '').split('/').filter((s) => s !== '');
  const [first, second, third] = parts;

  const setDate = (str) => {
    const md = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
    if (!md) return;
    const y = +md[1], m = +md[2], d = +md[3];
    if (m < 1 || m > 12) return;
    state.y = y;
    state.m = m;
    state.d = Math.min(Math.max(d, 1), daysInMonth(y, m));
  };

  /* 全店舗の画面（店舗に属さない） */
  if (ALL_STORE_VIEWS.includes(first)) {
    state.storeId = '';
    // 出さないことにした画面は、現金支払い管理表へ回します
    state.view = viewIsOff(first) ? 'expense' : first;
    setDate(second);
    return;
  }

  state.storeId = STORES.some((s) => s.id === first) ? first : '';
  if (!state.storeId) {
    state.view = 'stores';
    return;
  }

  setDate(third);
  const task = getTask(second);
  if (!task || (typeof task.when === 'function' && !task.when(state.storeId))) {
    // 業務が指定されていない／使えない業務なら、業務を選ぶ画面
    state.view = 'tasks';
    return;
  }
  state.view = task.id;
  // シフトは半月ずつの画面。URLに日付が書いてあればそこを、
  // 書いていなければ「募集中の半月」を開きます
  if (task.id === 'shift') {
    if (third) {
      shiftHalf = shiftHalfOf(state.d);
    } else {
      const p = shiftFirstPeriod(state.storeId);
      state.y = p.y;
      state.m = p.m;
      state.d = p.half === 1 ? 1 : 16;
      shiftHalf = p.half;
    }
  }
}


function writeHash(replace = false) {
  let hash = '#/';
  if (ALL_STORE_VIEWS.includes(state.view)) {
    hash = `#/${state.view}/${ymd(state.y, state.m, state.d)}`;
  } else if (state.storeId && state.view === 'tasks') {
    hash = `#/${state.storeId}`;
  } else if (state.storeId) {
    hash = `#/${state.storeId}/${state.view}/${ymd(state.y, state.m, state.d)}`;
  }
  if (location.hash === hash) return;
  if (replace) history.replaceState(null, '', hash);
  else location.hash = hash;
}

/* ============================================================
 *  集計ヘルパー
 * ============================================================ */
function allItems(storeId) {
  return getChecklist(storeId).flatMap((sec) => sec.items);
}

/** その日が定休日か（表示中の年月の d 日）。設定画面の内容と個別の例外を反映 */
function closedOn(storeId, d) {
  return Closed.isClosed(storeId, state.y, state.m, d);
}

/** その日に確認すべき項目だけ。定休日は 0 件（ignoreClosed=true なら定休日でも中身を返す） */
function itemsForDay(storeId, d, ignoreClosed = false) {
  const store = getStore(storeId);
  if (!ignoreClosed && closedOn(storeId, d)) return [];
  // 区分に付いた曜日の指定も効かせるため、区分ごとに絞り込む
  return getChecklist(storeId).flatMap((sec) =>
    sec.items.filter((it) => appliesTo(it, store, state.y, state.m, d, sec)));
}

/** セクション内で、その日に確認すべき項目だけ */
function sectionItemsForDay(sec, storeId, d, ignoreClosed = false) {
  const store = getStore(storeId);
  if (!ignoreClosed && closedOn(storeId, d)) return [];
  return sec.items.filter((it) => appliesTo(it, store, state.y, state.m, d, sec));
}

/**
 * 下の日タブや「今日へ」で日を選んだときの行き先
 *
 * ★ふだんはクローズを開きます。ただし**現金売上を見ているあいだは、
 *   その日の現金売上**を開きます。日を選ぶたびにクローズへ飛ばされると、
 *   何日分かをまとめて見るときに戻る手間がかかるためです。
 */
function goToDay() {
  if (state.view === 'cash') {
    cashTab = 'day';    // 週を見ていても、選んだ日の中身を出します
    return;
  }
  state.view = 'day';
}

/** その日に何か入力されているか（定休日でもデータがあれば隠さない） */
function hasAnyData(rec) {
  return !!rec && (Object.keys(rec.items || {}).length > 0 || !!rec.note || !!rec.staff);
}

/** いま表示している日の対象項目（定休日でも入力済みなら中身を出す） */
function selectedDayItems() {
  const rec = Store.getDay(state.storeId, ymd(state.y, state.m, state.d));
  const ignoreClosed = closedOn(state.storeId, state.d) && hasAnyData(rec);
  return itemsForDay(state.storeId, state.d, ignoreClosed);
}

/** レコードの完了数 */
function countDone(record, items) {
  if (!record) return 0;
  return items.reduce((n, it) => n + (record.items?.[it.id]?.done ? 1 : 0), 0);
}

/* ============================================================
 *  描画：店舗タブ
 * ============================================================ */
function renderStoreTabs() {
  el.storeTabs.innerHTML = '';
  STORES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'store-tab' + (s.id === state.storeId ? ' is-active' : '');
    b.style.setProperty('--tab-color', s.color);

    const chip = document.createElement('span');
    chip.className = 'logo-chip logo-chip--tab';
    fillLogo(chip, s);

    const name = document.createElement('span');
    name.textContent = s.name;

    b.appendChild(chip);
    b.appendChild(name);
    b.addEventListener('click', () => {
      state.storeId = s.id;
      writeHash();
      render();
    });
    el.storeTabs.appendChild(b);
  });
}

/* ------------------------------------------------------------
 *  ロゴ表示
 *  画像が用意できていない店舗は、店舗カラーの丸印にそのまま戻します
 * ---------------------------------------------------------- */
/* 画像の置き場所。
   mine/ のように1つ下の階層に置いた版では、公開用を作る.py が
   body に data-assets="../" を付けるので、その分だけ前に足します */
const ASSET_BASE = document.body.dataset.assets || '';

/* 画面に出すアプリ名。
   管理者用（mine/）は「T3 Works Mine」、スタッフ用は「T3 Works」 */
const APP_NAME = APP.title + (document.body.dataset.mode === 'mine' ? ' Mine' : '');

function fillLogo(chip, store) {
  chip.innerHTML = '';
  chip.style.setProperty('--chip-color', store.color);

  if (!store.logo) {
    chip.classList.add('is-fallback');
    return;
  }
  const img = document.createElement('img');
  img.alt = store.name;
  img.addEventListener('error', () => {
    // img フォルダに画像が無い／読めない場合
    chip.classList.add('is-fallback');
    img.remove();
  });
  img.src = ASSET_BASE + store.logo;
  chip.appendChild(img);
}

/* ============================================================
 *  描画：月タブ・年
 * ============================================================ */
function renderMonthTabs() {
  el.yearLabel.textContent = `${state.y}年`;
  el.monthTabs.innerHTML = '';
  for (let m = 1; m <= 12; m++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'month-tab' + (m === state.m ? ' is-active' : '');
    b.textContent = `${m}月`;
    b.addEventListener('click', () => {
      state.m = m;
      state.d = Math.min(state.d, daysInMonth(state.y, m));
      writeHash();
      render();
    });
    el.monthTabs.appendChild(b);
  }
}

/* ============================================================
 *  描画：日タブ（画面下・スプレッドシートのシートタブ相当）
 * ============================================================ */
function renderDayTabs(scrollToActive = true) {
  const month = Store.getMonth(state.storeId, `${state.y}-${pad2(state.m)}`);
  const last = daysInMonth(state.y, state.m);

  el.dayTabs.innerHTML = '';
  let activeBtn = null;

  for (let d = 1; d <= last; d++) {
    const dow = new Date(state.y, state.m - 1, d).getDay();
    const rec = month[pad2(d)];
    const items = itemsForDay(state.storeId, d);
    const done = countDone(rec, items);

    const closed = closedOn(state.storeId, d);

    const b = document.createElement('button');
    b.type = 'button';
    let cls = 'day-tab';
    if (dow === 0) cls += ' is-sun';
    if (dow === 6) cls += ' is-sat';
    if (closed) cls += ' day-tab--closed';
    else if (done > 0) cls += done >= items.length ? ' day-tab--full' : ' day-tab--partial';
    if (d === state.d) { cls += ' is-active'; }
    if (ymd(state.y, state.m, d) === TODAY_STR) cls += ' is-today';
    b.className = cls;
    b.innerHTML = `<span class="day-tab__state"></span>${d}<span class="day-tab__dow">${closed ? '休' : DOW[dow]}</span>`;
    b.title = closed
      ? `${state.m}月${d}日（${DOW[dow]}）　定休日`
      : `${state.m}月${d}日（${DOW[dow]}）　${done}/${items.length}`;
    b.addEventListener('click', () => {
      state.d = d;
      goToDay();
      writeHash();
      render();
    });
    if (d === state.d) activeBtn = b;
    el.dayTabs.appendChild(b);
  }

  // チェック操作のたびに日タブが勝手に動くのを防ぐため、日付が変わったときだけ寄せる
  if (activeBtn && scrollToActive) activeBtn.scrollIntoView({ block: 'nearest', inline: 'center' });
}

/* ============================================================
 *  描画：クローズ（閉店時の確認作業）
 * ============================================================ */
function renderDayView() {
  const storeId = state.storeId;
  const dateStr = ymd(state.y, state.m, state.d);
  const rec = Store.getDay(storeId, dateStr);
  const dow = new Date(state.y, state.m - 1, state.d).getDay();

  el.dayNum.textContent = state.d;
  el.dayDow.textContent = `（${DOW[dow]}）`;
  el.dayDow.className = 'day-head__dow' + (dow === 0 ? ' is-sun' : dow === 6 ? ' is-sat' : '');

  /* --- 0時を過ぎたときの案内 ---
     カレンダーの日付と、業務上の今日がズレているあいだだけ出します */
  const real = new Date();
  const realStr = ymd(real.getFullYear(), real.getMonth() + 1, real.getDate());
  const rollover = dateStr === TODAY_STR && realStr !== TODAY_STR;
  el.dayRollover.classList.toggle('is-hidden', !rollover);
  if (rollover) {
    el.dayRollover.textContent =
      `日付は変わりましたが、朝${APP.dayStartHour}時までは ${state.m}/${state.d} の分として開いています。`;
  }

  /* --- 定休日 --- */
  // 定休日は確認不要。ただし過去に入力があった日は隠さずそのまま出す
  const closed = closedOn(storeId, state.d);
  const showList = !closed || hasAnyData(rec);
  el.viewDay.classList.toggle('is-closed', closed);
  el.closedNotice.classList.toggle('is-hidden', !closed);
  const closedLabel = Closed.exceptionOn(storeId, dateStr) === 'closed'
    ? '臨時休業'
    : `定休日（毎週${DOW[dow]}曜）`;
  el.closedNotice.textContent = showList && closed
    ? `${closedLabel}です。確認は不要ですが、この日は入力があるので表示しています。`
    : `${closedLabel}です。確認作業はありません。`;
  el.checklist.classList.toggle('is-hidden', !showList);
  el.noteCard.classList.toggle('is-hidden', !showList);
  el.staffRow.classList.toggle('is-hidden', !showList); // 確認不要な日は担当者も選ばせない
  renderDayFlags(closed, dateStr);

  /* --- その日の担当者 --- */
  renderStaffSelect(rec.staff || '');

  /* --- 項目一覧 --- */
  el.checklist.innerHTML = '';
  getChecklist(storeId).forEach((sec) => {
    const secItems = sectionItemsForDay(sec, storeId, state.d, closed && showList);
    if (!secItems.length) return; // その日は対象項目なし
    const doneInSec = countDone(rec, secItems);

    const card = document.createElement('section');
    card.className = 'section' + (isFolded(sec.id) ? ' is-folded' : '');

    // 見出しをタップで折りたたみ（項目が多い店舗でも見やすくするため）
    const head = document.createElement('div');
    head.className = 'section__head';
    head.tabIndex = 0;
    head.setAttribute('role', 'button');
    head.innerHTML =
      `<span class="section__chevron" aria-hidden="true"></span>` +
      `<h2 class="section__title">${sec.title}</h2>` +
      `<span class="section__count${doneInSec === secItems.length ? ' is-done' : ''}" data-section-id="${sec.id}">${doneInSec} / ${secItems.length}</span>`;
    const toggle = () => setFolded(sec.id, card.classList.toggle('is-folded'));
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    card.appendChild(head);

    secItems.forEach((it) => {
      card.appendChild(buildItemRow(storeId, dateStr, it, rec.items[it.id]));
    });
    el.checklist.appendChild(card);
  });

  /* --- 進捗 --- */
  const items = selectedDayItems();
  const done = countDone(rec, items);
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  el.progressBar.style.width = pct + '%';
  el.progressBar.classList.toggle('is-done', done === items.length && items.length > 0);
  el.progressText.textContent = closed && !items.length ? '定休日' : `${done} / ${items.length}`;

  /* --- 申し送り --- */
  el.note.value = rec.note || '';

  /* --- 提出（クローズと、2週間に1回の週間掃除） --- */
  renderSubmit(closed, showList, dateStr, rec, items, done);
  renderWeekSubmit(dateStr);

  /* --- 更新情報 --- */
  el.updated.textContent = rec.updatedAt
    ? `最終更新：${new Date(rec.updatedAt).toLocaleString('ja-JP')}${rec.updatedBy ? '（' + rec.updatedBy + '）' : ''}`
    : '';
}


/* ============================================================
 *  現金売上（ジャーナルの写真から）
 *
 *  流れ
 *    1. レジの「精算」の紙を撮る
 *    2. 写真をドライブに残して、Google のOCRで文字を読み取る
 *    3. 読み取った文字から現金売上を拾って、欄に入れておく
 *    4. 人が見て、違っていれば直す。封筒に入れた金額も入れる
 *    5. 記録する（ほかの端末にも配られます）
 *
 *  ★読み取りはいつも当たるとは限りません（感熱紙のOCRは完璧ではありません）。
 *    だから「読み取った金額をそのまま記録する」のではなく、
 *    かならず人が見て確定する作りにしてあります。
 *  ★記録はその日のクローズと同じ場所（項目 __cash）に入れているので、
 *    Apps Script 側を直さなくても、いつもの同期でそのまま配られます。
 * ============================================================ */

/** いま画面で編集している内容（記録するまでは、ここだけにあります） */
const cashEdit = {
  key: '',        // いま開いている 店舗/日
  photo: '',      // ドライブに残っている写真のID
  pending: '',    // 撮ったばかりで、まだドライブに残していない写真
  ocr: null, how: '', busy: false, text: '',
  ms: 0, saveMs: 0, size: 0,   // 何秒かかったか・何KB送ったか（速さを確かめるためのもの）
  gas: '',                     // サーバー（現金売上.gs）の版の印
};

/**
 * 記録したあと「記録し直す」を押したか
 *
 * ★記録が済んだ日は、ボタンを「✓ 記録済み」に変えて、金額の欄も
 *   さわれないようにします。押しまちがえて上書きしてしまわないためです。
 *   直したいときだけ「記録し直す」を押してもらいます。
 */
let cashUnlocked = false;

/** 「日ごと」と「1週間」のどちらを見ているか */
let cashTab = 'day';
/** 1週間の画面で見ている週（その週の月曜）。空なら、いま選んでいる日の週 */
let cashWeek = '';

/* ------------------------------------------------------------
 *  作業中のものを控えておく（アプリを閉じても続きから）
 *
 *  ★写真の読み取りも、日報への転送も、何秒かかかります。
 *    そのあいだにアプリを閉じたり、ほかのページへ移ったりすると、
 *    通信が切られて途中で終わってしまいます。
 *    なので、始める前に「いま何をしているか」を端末に控えておき、
 *    戻ってきたときに続きからやり直します。
 *
 *  ★控えは【端末の中だけ】に置きます（Store.setMeta）。
 *    写真は300KBほどあるので、共有のシートへ送ってはいけません。
 * ---------------------------------------------------------- */
const CASH_JOB = 'cashJob';

function cashJobSave(job) {
  try { Store.setMeta(CASH_JOB, JSON.stringify(job)); } catch (e) { /* 入らなくても先へ進みます */ }
}
function cashJobLoad() {
  try { return JSON.parse(Store.meta(CASH_JOB) || 'null'); } catch (e) { return null; }
}
function cashJobClear() {
  try { Store.setMeta(CASH_JOB, null); } catch (e) { /* 同上 */ }
}

/** 続きからやり直す。起動したときと、画面に戻ってきたときに呼びます */
let cashResuming = false;
async function cashResume() {
  if (cashResuming || cashEdit.busy) return;
  const job = cashJobLoad();
  if (!job || !job.kind) return;
  // ★古い控えの掃除が先です。合言葉の確認を先にすると、
  //   合言葉が入っていない端末で、古い控えが残り続けます
  if (job.at && Date.now() - Date.parse(job.at) > 3 * 24 * 60 * 60 * 1000) { cashJobClear(); return; }
  // 合言葉が入っていないと送れません。入れたあとにまた呼ばれます
  if (!Sync.enabled() || !Sync.pin()) return;

  cashResuming = true;
  try {
    // その日の画面に合わせます（別の日を見ていることがあります）
    const [y, m, d] = String(job.date || '').split('-').map(Number);
    if (y && m && d) { state.storeId = job.store || state.storeId; state.y = y; state.m = m; state.d = d; }
    state.view = 'cash';
    cashTab = 'day';
    render();

    if (job.kind === 'read' && job.image) {
      cashEdit.pending = job.image;
      el.cashShotImg.src = job.image;
      el.cashShotImg.classList.remove('is-hidden');
      el.cashShotEmpty.classList.add('is-hidden');
      el.cashShot.classList.remove('is-empty');
      setCashMsg('前の読み取りが途中でした。続きからやり直します…');
      await cashReadPhoto(job.image, job.date);
    } else if (job.kind === 'send') {
      if (job.sales !== undefined && job.sales !== null) el.cashSales.value = cashText(job.sales);
      if (job.by) fillStaffOptions(el.cashStaff, job.by);
      cashEdit.j = job.j || cashEdit.j;
      cashEdit.m = job.m || cashEdit.m;
      cashEdit.sure = job.sure || cashEdit.sure;
      cashEdit.jok = true;
      render();
      setNippouMsg('前の書き込みが途中でした。続きからやり直します…');
      await nippouSendNow(job.values, job.date, job.test, job.folder, job.extra, job.calc);
    }
  } finally {
    cashResuming = false;
  }
}

/* ------------------------------------------------------------
 *  手で入れた分の「書きかけ」を、その場で残します
 *
 *  ★出前館・仕入・人件費は、写真より先に入れることがあります。
 *    入れたあとほかのページを見に行っても消えないように、
 *    打つたびに残します（記録するを押していなくても残ります）。
 *  ★打つたびに同期へ流すと重いので、少し待ってからまとめて書きます。
 * ---------------------------------------------------------- */

/* ------------------------------------------------------------
 *  計算テンキー（スマホ用）
 *
 *  ★なぜ自前で作るか。
 *    ① iPhone の数字キーボードには「＝」も「＋」もありません。
 *    ② はじめは数字キーボードの上に記号バーを出しましたが、
 *       **iOS自身のバー（∧ ∨ ✓）が上に重なって隠れました。**
 *       あれはOSが出すもので、ウェブ側からは消せません。
 *    ③ 端末ごとにキーボードの設定がちがうと、出るものも変わります。
 *
 *    そこで **システムのキーボードを出さず**（inputmode="none"）、
 *    数字も記号も入ったテンキーを自分で出します。
 *    重なるものが無く、どの端末でも同じものが出ます。
 *
 *  ★指で使う端末だけです。パソコンは本物のキーボードで打てるので、
 *    そのままにします。
 *  ★もしテンキーで困ったときのために「キーボード」で元に戻せます。
 * ---------------------------------------------------------- */

/** 指で使う端末か（パソコンでは出しません） */
function calcTouch() {
  try {
    return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  } catch (e) { return false; }
}

let calcPad = null;
let calcPadFor = null;      // いま打っている入力欄

/** テンキーを作ります（1つだけ作って、使い回します） */
function calcPadMake() {
  // ★DOMに付いているかまで見ます。変数だけを見ていると、
  //   何かの拍子に外れたとき、二度と出てこなくなります
  if (calcPad && document.body && document.body.contains(calcPad)) return calcPad;
  calcPad = null;

  const pad = document.createElement('div');
  pad.id = 'calcPad';
  pad.style.cssText = [
    'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:99999',
    'display:none', 'grid-template-columns:repeat(5,1fr)', 'gap:6px',
    'padding:8px 8px calc(8px + env(safe-area-inset-bottom))',
    'background:#2b2b2b', 'box-shadow:0 -2px 12px rgba(0,0,0,.35)',
  ].join(';');

  const キー = (label, どうする, 色) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = [
      'height:46px', 'font-size:20px', 'font-weight:700', 'color:#fff',
      `background:${色 || '#4a4a4a'}`, 'border:0', 'border-radius:8px',
      'touch-action:manipulation', '-webkit-user-select:none', 'user-select:none',
    ].join(';');
    // ★押しても入力欄から離れないように、既定の動きを止めます
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); });
    b.addEventListener('click', (e) => { e.preventDefault(); どうする(); });
    return b;
  };

  const 数 = '#555';
  const 記号 = '#3d5a80';
  [
    ['7', 数], ['8', 数], ['9', 数], ['⌫', '#8a4a4a'], ['=', 記号],
    ['4', 数], ['5', 数], ['6', 数], ['(', 記号], ['+', 記号],
    ['1', 数], ['2', 数], ['3', 数], [')', 記号], ['-', 記号],
    ['0', 数], ['00', 数], ['.', 数], ['*', 記号], ['/', 記号],
  ].forEach(([c, 色]) => {
    pad.appendChild(c === '⌫' ? キー(c, calcPadBack, 色) : キー(c, () => calcPadInsert(c), 色));
  });

  // 下の段：全部消す ／ 閉じる ／ 確定（右下）
  const 消 = キー('全部消す', calcPadClear, '#5a3a3a');
  消.style.fontSize = '13px';
  消.style.gridColumn = 'span 2';
  pad.appendChild(消);

  const 閉 = キー('閉じる', calcPadClose, '#3a3a3a');
  閉.style.fontSize = '13px';
  閉.style.gridColumn = 'span 1';
  pad.appendChild(閉);

  // ★確定は右下です。押すと、その場で残して次の欄へ進みます。
  //   仕入先が20行あるので、1つ入れるたびに閉じずに進めるようにしました
  const 確 = キー('確定', calcPadDone, '#2f6b3f');
  確.style.fontSize = '15px';
  確.style.gridColumn = 'span 2';
  pad.appendChild(確);

  document.body.appendChild(pad);
  calcPad = pad;
  return pad;
}

/** カーソルのところに字を入れます */
function calcPadInsert(c) {
  const i = calcPadFor;
  if (!i || i.readOnly) return;
  let at = i.selectionStart;
  let to = i.selectionEnd;
  if (at === null || at === undefined) { at = i.value.length; to = at; }
  i.value = i.value.slice(0, at) + c + i.value.slice(to);
  const 次 = at + c.length;
  try { i.setSelectionRange(次, 次); } catch (e) { /* 効かない欄もあります */ }
  i.dispatchEvent(new Event('input', { bubbles: true }));
}

/** 1文字消します */
function calcPadBack() {
  const i = calcPadFor;
  if (!i || i.readOnly) return;
  let at = i.selectionStart;
  let to = i.selectionEnd;
  if (at === null || at === undefined) { at = i.value.length; to = at; }
  if (at === to) {
    if (at === 0) return;
    i.value = i.value.slice(0, at - 1) + i.value.slice(to);
    try { i.setSelectionRange(at - 1, at - 1); } catch (e) { /* 同上 */ }
  } else {
    i.value = i.value.slice(0, at) + i.value.slice(to);
    try { i.setSelectionRange(at, at); } catch (e) { /* 同上 */ }
  }
  i.dispatchEvent(new Event('input', { bubbles: true }));
}

/** 全部消します */
function calcPadClear() {
  const i = calcPadFor;
  if (!i || i.readOnly) return;
  i.value = '';
  i.dispatchEvent(new Event('input', { bubbles: true }));
}

/** 閉じる … その場で残して、テンキーを引っこめます */
function calcPadClose() {
  const i = calcPadFor;
  calcPadFor = null;
  calcPadHide();
  if (i) i.blur();          // blur で、待たずにその場で残ります
}

/**
 * 確定 … その場で残して、次の欄へ進みます
 *
 * ★仕入先は20行あります。1つ入れるたびに閉じて開いて、では手間なので、
 *   そのまま次の欄へ送ります。最後の欄まで来たら、閉じます。
 */
function calcPadDone() {
  const i = calcPadFor;
  if (!i) { calcPadClose(); return; }
  const 次 = calcPadNext(i);
  if (!次) { calcPadClose(); return; }
  i.blur();                 // いまの欄を、その場で残します
  calcPadFor = 次;
  次.focus();
  calcPadShow(次);
}

/**
 * 「確定」で進む先
 *
 * ★仕入と人件費は**同じ列の下**へ進みます。
 *   当日現金を入れているなら次の仕入先の当日現金へ、
 *   掛仕入なら次の掛仕入へ。横に飛ぶと、
 *   当日現金だけを上から順に入れたいときに困ります。
 * ★出前館などの5つは、そのまま下の欄へ進みます（列が1つしかありません）。
 */
function calcPadNext(i) {
  const 使える = (e) => e.offsetParent && !e.readOnly;
  if (i.dataset.grid) {
    // 同じ節・同じ列だけを、上から順に並べます
    const 同じ列 = [...document.querySelectorAll(
      `input[data-grid="${i.dataset.grid}"][data-col="${i.dataset.col}"]`)].filter(使える);
    const at = 同じ列.indexOf(i);
    if (at >= 0 && at + 1 < 同じ列.length) return 同じ列[at + 1];
    // その列の一番下まで来たら、もう片方の列の先頭へ移ります
    const 相手 = i.dataset.col === 'f' ? 'g' : 'f';
    const 次の列 = [...document.querySelectorAll(
      `input[data-grid="${i.dataset.grid}"][data-col="${相手}"]`)].filter(使える);
    return 次の列.length ? 次の列[0] : null;
  }
  const 並び = [...document.querySelectorAll('input[data-k]')].filter(使える);
  const at = 並び.indexOf(i);
  return (at >= 0 && at + 1 < 並び.length) ? 並び[at + 1] : null;
}

/**
 * 打っている欄が、テンキーに隠れないようにします
 *
 * ★ページの下に、テンキーの分だけ余白を足します。
 *   これが無いと、**一番下の欄はもう送れません**（送る先が無いため）。
 *   実際、人件費の最後の欄が隠れたままになりました。
 */
function calcPadShow(input) {
  const pad = calcPadMake();
  pad.style.display = 'grid';
  setTimeout(() => {
    try {
      const 高さ = pad.getBoundingClientRect().height;
      document.body.style.paddingBottom = `${Math.round(高さ) + 24}px`;
      const 下 = input.getBoundingClientRect().bottom;
      const 上 = pad.getBoundingClientRect().top;
      if (下 > 上 - 8) {
        // ★滑らか送り（behavior:'smooth'）は使いません。効かない場面がありました。
        //   すぐ動く形なら、どこでも確実に寄ってくれます。
        //   余白を足した直後なので、送り先はできています
        input.scrollIntoView({ block: 'center' });
      }
    } catch (e) { /* 位置が取れなくても、打つのに困りません */ }
  }, 30);
}

/** テンキーを引っこめます（足した余白も戻します） */
function calcPadHide() {
  if (calcPad) calcPad.style.display = 'none';
  document.body.style.paddingBottom = '';
}

/**
 * テンキー以外のところを触ったら、閉じます
 *
 * ★入力欄は inputmode="none" なので、よそを触っても
 *   ブラウザが勝手に外してくれないことがあります。
 *   自分で見て、閉じます。
 * ★テンキーの中と、テンキーを使うほかの欄は、閉じません
 *   （ほかの欄に移るときは、そのまま続けて打てるようにするためです）。
 */
function calcPadOutside(e) {
  if (!calcPad || calcPad.style.display === 'none') return;
  const t = e.target;
  if (calcPad.contains(t)) return;                 // テンキーの中
  if (t && t.dataset && (t.dataset.k || t.dataset.grid)) return;   // ほかの入力欄
  calcPadClose();
}
document.addEventListener('pointerdown', calcPadOutside, true);

/** その入力欄に、テンキーを付けます */
function calcPadBind(input) {
  if (!calcTouch()) return;                 // パソコンは本物のキーボードで
  input.inputMode = 'none';                 // ★システムのキーボードを出しません
  input.addEventListener('focus', () => {
    calcPadFor = input;
    calcPadShow(input);
  });
  input.addEventListener('blur', () => {
    // ほかの欄へ移っただけなら、出したままにします
    setTimeout(() => {
      if (calcPadFor === input) { calcPadFor = null; calcPadHide(); }
    }, 120);
  });
}

/** その日の書きかけ（無ければ空） */
function cashHandOf(storeId, dateStr) {
  const v = (Store.getDay(storeId, dateStr).items || {})[CASH_HAND];
  return (v && v.value && typeof v.value === 'object') ? v.value : {};
}

let cashHandTimer = null;

/** 書きかけを残します（少し待ってからまとめて書きます） */
function cashHandSave(now) {
  const storeId = state.storeId;
  const dateStr = ymd(state.y, state.m, state.d);
  const put = () => {
    cashHandTimer = null;
    Store.setItem(storeId, dateStr, CASH_HAND, {
      value: {
        m: cashEdit.m || {},
        shiire: cashEdit.shiire || {},
        jinken: cashEdit.jinken || {},
      },
    });
  };
  if (cashHandTimer) clearTimeout(cashHandTimer);
  if (now) put();
  else cashHandTimer = setTimeout(put, 700);
}

/* ------------------------------------------------------------
 *  日報で直された数を、アプリに取り込みます
 *
 *  ★考え方。**「アプリが最後に書いた数」を覚えておきます。**
 *    日報がそれと違っていたら、人が日報側で直したということなので、
 *    そちらを正として取り込みます。同じなら、何もしません。
 *
 *    こうしないと「アプリで打ちかけていた数」まで日報の数で
 *    上書きしてしまいます。書いた覚えのある欄だけを見るのが肝心です。
 * ---------------------------------------------------------- */

/** 仕入・人件費の覚え書きのキー（'仕入先A|G'） */
function cashWroteKey(name, col) { return `${name}|${col}`; }

/** その日、アプリが最後に書いた数 */
function cashWroteOf(storeId, dateStr) {
  return cashHandOf(storeId, dateStr).wrote || {};
}

/** 書いたものを覚えます（日報の数と見くらべるため） */
function cashWroteSave(dateStr, values, extra) {
  const 前 = cashWroteOf(state.storeId, dateStr);
  const 次 = { ...前 };
  Object.keys(values || {}).forEach((name) => {
    const n = cashMinusNum(values[name]);
    if (n !== null) 次[name] = n;
  });
  (extra || []).forEach((x) => {
    const n = cashMinusNum(x.value);
    if (n !== null) 次[cashWroteKey(x.name, x.col)] = n;
  });
  const 手 = cashHandOf(state.storeId, dateStr);
  Store.setItem(state.storeId, dateStr, CASH_HAND, {
    value: { ...手, m: cashEdit.m || {}, shiire: cashEdit.shiire || {}, jinken: cashEdit.jinken || {}, wrote: 次 },
  });
}

/** この画面を開いてから、日報を読みにいった日 */
const cashPulled = {};

/**
 * 日報を見に行って、直されていた数を取り込みます
 *
 * ★書いた覚えのある欄だけを見ます。打ちかけの欄は触りません。
 * ★静かに動きます。取り込むものがあったときだけ、画面に出します。
 */
async function cashPullFromNippou(しずかに) {
  const dateStr = ymd(state.y, state.m, state.d);
  const wrote = cashWroteOf(state.storeId, dateStr);
  if (!Object.keys(wrote).length) {
    if (!しずかに) setNippouMsg('この日は、まだアプリから書いていません', 'warn');
    return;
  }
  const test = NippouTest.get();
  const folder = test ? '' : NippouFolders.get(state.storeId);
  if (!test && !folder) {
    if (!しずかに) setNippouMsg('日報フォルダが登録されていません', 'warn');
    return;
  }
  // ★B列の数を返してもらうため、見たい行の名前を渡します（見るだけなので書きません）
  const values = {};
  CASH_MINUS_ROWS.forEach((k) => { values[NIPPOU_LABELS[k]] = 0; });

  try {
    const res = await Sync.ask('nippouWrite',
      { mode: '見る', file: test, folder, day: dateStr, values, extra: [], calc: {} });
    if (!res.ok && !res.grid) { if (!しずかに) setNippouMsg(res.error || '日報を開けませんでした', 'warn'); return; }
    if (!res.v || res.v !== NIPPOU_GAS_VERSION) { if (!しずかに) nippouGasOk(res); return; }

    const 取り込み = [];
    const 次wrote = { ...wrote };

    // ① デリバリー（B列）
    const 名から = {};
    CASH_MINUS_ROWS.forEach((k) => { 名から[NIPPOU_LABELS[k]] = k; });
    (res.rows || []).forEach((r) => {
      const k = 名から[r.name];
      if (!k || wrote[r.name] === undefined) return;      // 書いた覚えのない欄は触りません
      const 日報 = cashMinusNum(r.before);
      if (日報 === null || 日報 === wrote[r.name]) return; // 直されていません
      cashEdit.m[k] = String(日報);
      次wrote[r.name] = 日報;
      取り込み.push(`${r.name} ${日報.toLocaleString('ja-JP')}`);
    });

    // ② 仕入・人件費（F列・G列）
    const w = res.grid ? nippouGridSplit(res.grid) : null;
    if (w) {
      [['shiire', w.shiire], ['jinken', w.jinken]].forEach(([入れ先, 行]) => {
        行.forEach((r) => {
          [['f', 'F', r.f], ['g', 'G', r.g]].forEach(([c, 大, 値]) => {
            const key = cashWroteKey(r.name, 大);
            if (wrote[key] === undefined) return;
            const 日報 = cashMinusNum(値);
            if (日報 === null || 日報 === wrote[key]) return;
            if (!cashEdit[入れ先][r.name]) cashEdit[入れ先][r.name] = {};
            cashEdit[入れ先][r.name][c] = String(日報);
            次wrote[key] = 日報;
            取り込み.push(`${r.name} ${日報.toLocaleString('ja-JP')}`);
          });
        });
      });
      GridCache.save(state.storeId, state.y, state.m, res.grid);
    }

    if (!取り込み.length) {
      if (!しずかに) setNippouMsg('日報と同じでした（直されたものはありません）', 'ok');
      return;
    }
    const 手 = cashHandOf(state.storeId, dateStr);
    Store.setItem(state.storeId, dateStr, CASH_HAND, {
      value: { ...手, m: cashEdit.m, shiire: cashEdit.shiire, jinken: cashEdit.jinken, wrote: 次wrote },
    });
    // ★先に描き直します。render の中で知らせが消えるためです
    render();
    setNippouMsg(`日報で直されていた数を取り込みました：${取り込み.join('、')}`, 'ok');
  } catch (e) {
    if (!しずかに) setNippouMsg(String(e && e.message || e), 'warn');
  }
}

/** その日を開いたとき、1回だけ静かに読みにいきます */
function cashPullAuto() {
  const key = `${state.storeId}/${ymd(state.y, state.m, state.d)}`;
  if (cashPulled[key]) return;
  if (!Object.keys(cashWroteOf(state.storeId, ymd(state.y, state.m, state.d))).length) return;
  if (!Sync.enabled || !Sync.enabled() || !Sync.pin()) return;
  const test = NippouTest.get();
  if (!test && !NippouFolders.get(state.storeId)) return;
  cashPulled[key] = true;
  cashPullFromNippou(true);
}

/** その日の現金売上の記録（無ければ null） */
function cashOf(storeId, dateStr) {
  const v = (Store.getDay(storeId, dateStr).items || {})[CASH_ITEM];
  return v && v.value && typeof v.value === 'object' ? v.value : null;
}

/** いま見ている週（月曜）。まだ決めていなければ、選んでいる日の週にします */
function cashWeekNow() {
  if (!cashWeek) cashWeek = cashWeekStart(state.y, state.m, state.d);
  return cashWeek;
}

/** 数字だけ取り出す（全角で入れても通ります。空なら null） */
function cashYen(text) {
  const t = toHalfWidthNumber(String(text || '')).replace(/[^\d-]/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function cashText(n) {
  return n === null || n === undefined ? '' : Number(n).toLocaleString('ja-JP');
}

/**
 * 数でも計算式でも、そのまま人に見せます
 *
 * ★確かめの画面で使います。計算式のときは「=1000+2000（6,000）」と、
 *   式と答えの両方を出します。答えだけだと内わけが見えず、
 *   式だけだと合っているか確かめられないためです。
 */
function cashShow(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return cashText(v);
  const s = String(v);
  if (!cashIsFormula(s)) return s;
  const n = cashMinusNum(s);
  return n === null ? s : `${cashFormulaPlain(s)}（${n.toLocaleString('ja-JP')}）`;
}

function renderCash() {
  const dateStr = ymd(state.y, state.m, state.d);
  const key = `${state.storeId}/${dateStr}`;
  const saved = cashOf(state.storeId, dateStr);

  // 日を移ったら、打ちかけの内容は持ち越しません
  if (cashEdit.key !== key) {
    cashEdit.key = key;
    cashEdit.photo = saved ? (saved.photo || '') : '';
    cashEdit.ocr = saved ? (saved.ocr === undefined ? null : saved.ocr) : null;
    cashEdit.how = '';
    cashEdit.busy = false;
    cashEdit.text = '';
    cashEdit.pending = '';
    cashEdit.ms = 0;
    cashEdit.saveMs = 0;
    cashEdit.size = 0;
    // ジャーナルから読めた5つと、手で入れる引き算の分
    cashEdit.j = (saved && saved.j) ? { ...saved.j } : null;
    // ★記録ずみならその中身を、まだなら書きかけを出します。
    //   書きかけは「入れたけれど、まだ記録していない」分です
    const 書きかけ = cashHandOf(state.storeId, dateStr);
    // ★書きかけがあれば、そちらを出します。
    //   記録した中身を先に見ていたころは、**記録したあとに直しても
    //   次に開くと元に戻って**いました。書きかけの方が新しいので、こちらが正です。
    //   （書きかけが無い古い日は、記録した中身から出します）
    cashEdit.m = (書きかけ.m && Object.keys(書きかけ.m).length)
      ? { ...書きかけ.m }
      : { ...((saved && saved.m) || {}) };
    cashEdit.shiire = { ...(書きかけ.shiire || {}) };
    cashEdit.jinken = { ...(書きかけ.jinken || {}) };
    cashEdit.checks = [];
    cashEdit.sure = saved && saved.j ? Object.keys(saved.j).reduce((o, k) => { o[k] = true; return o; }, {}) : {};
    cashEdit.jok = !!(saved && saved.j);
    cashEdit.jwhy = '';
    cashUnlocked = false;
    el.cashOcrLink.classList.add('is-hidden');
    el.cashSales.value = saved ? cashText(saved.sales) : '';
    // ★記録した人が残っていればその人。まだなら空のままにします。
    //   クローズの担当者を先に入れていましたが、クローズをやった人と
    //   ジャーナルを記録する人がちがう日があるので、入れないようにしました
    //   （先に入っていると、そのまま押してしまいます）
    fillStaffOptions(el.cashStaff, (saved && saved.by) || '');
    // ★16px 未満だと、iOS が触ったときに画面を勝手に拡大します。
    //   .staff-row__select はクローズの担当者欄でも使う共通の見た目（本部のもの）なので、
    //   そちらは触らず、ジャーナルのこの1つだけを大きくします
    el.cashStaff.style.fontSize = '16px';
    setCashMsg('');
    showCashPhoto();
  }

  el.cashTabDay.classList.toggle('is-on', cashTab === 'day');
  el.cashTabWeek.classList.toggle('is-on', cashTab === 'week');
  el.cashPaneDay.classList.toggle('is-hidden', cashTab !== 'day');
  el.cashPaneWeek.classList.toggle('is-hidden', cashTab !== 'week');

  el.cashDate.textContent = `${state.m}/${state.d}（${DOW[new Date(state.y, state.m - 1, state.d).getDay()]}）`;
  el.cashTakeText.textContent = (cashEdit.photo || cashEdit.pending) ? '📷 撮り直す' : '📷 ジャーナルを撮る';

  // 記録が済んでいる日は、ボタンを「✓ 記録済み」に入れかえます
  const done = !!saved && !cashUnlocked;
  el.cashDone.classList.toggle('is-hidden', !done);
  el.cashSave.classList.toggle('is-hidden', done);
  el.cashRedo.classList.toggle('is-hidden', !done);
  el.cashSales.readOnly = done;
  el.cashStaff.disabled = done;

  if (saved && saved.at) {
    const t = new Date(saved.at);
    el.cashWho.textContent = `${t.getMonth() + 1}/${t.getDate()} `
      + `${pad2(t.getHours())}:${pad2(t.getMinutes())}`
      + (saved.by ? `　${saved.by}` : '');
  } else {
    el.cashWho.textContent = '';
  }

  renderNippouBox(done);
  renderCashList();
  renderCashWeek();
}

/* ------------------------------------------------------------
 *  日報に入れる5つ
 *
 *  ★読んだ数をそのまま信じません。レシート自身が持っている計算式で
 *    検算し、通らなかった数は使いません（空欄の方が安全です）。
 *  ★出前館・ウーバー・ロケットナウはジャーナルに出ないので、
 *    手で入れてもらって引きます（日報でやっている式と同じです）。
 * ---------------------------------------------------------- */
const CASH_NIPPOU_ROWS = [
  { key: 'cash', name: '現金売上' },
  { key: 'credit', name: 'クレジット' },
  { key: 'emoney', name: '電子マネー' },
  { key: 'net', name: '純売上' },
  { key: 'guests', name: '当日客数', plain: true },
];
const CASH_MINUS_ROWS = ['demaeCash', 'demaeCard', 'uberCash', 'uberCard', 'rocket'];

function renderNippouBox(done) {
  // ★箱は、日報に書ける店舗なら**写真の前から**出します。
  //   出前館・ウーバー・ロケットナウは紙に出ない数なので、
  //   ジャーナルを撮る前・撮っている間に入れておけるようにするためです。
  const on = JOURNAL_STORES.includes(state.storeId);
  // 読み取りの5つの表と検算は、写真を読んでからです
  const yomi = !!cashEdit.j;
  el.cashNippouBox.classList.toggle('is-hidden', !on);
  if (!on) {
    // ★隠すときは中身も消します。残しておくと、次に出たときに
    //   前の日の数字が一瞬でも見えてしまいます
    el.cashNippou.innerHTML = '';
    el.cashChecks.textContent = '';
    el.cashCheckMark.textContent = '';
    setNippouMsg('');
    return;
  }

  // 手で入れる分（無い日は空のまま）
  if (el.cashMinus.childElementCount !== CASH_MINUS_ROWS.length) {
    el.cashMinus.innerHTML = '';
    CASH_MINUS_ROWS.forEach((k) => {
      const wrap = document.createElement('label');
      wrap.className = 'cash-minus__row';
      const name = document.createElement('span');
      name.className = 'cash-minus__label';
      name.textContent = NIPPOU_LABELS[k];
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.autocomplete = 'off';
      input.className = 'cash-minus__input';
      // ★16px 未満だと、iOS が触ったときに画面を勝手に拡大します。
      //   css は本部のファイル（14px）なので、ここで16pxにします
      input.style.fontSize = '16px';
      input.dataset.k = k;
      // ★入れた文字を、そのまま覚えます（数に直しません）。
      //   「=1000+2000+3000」と入れたら、日報のマスにも計算式のまま入れるためです。
      //   数に直してしまうと、あとから日報を開いても内わけが分かりません。
      input.addEventListener('input', () => {
        cashEdit.m[k] = input.value;
        cashHandSave();               // ★ほかのページへ行っても消えないように残します
        renderNippouMinusNote();
        renderNippouTable();          // 表だけ描き直します（入力の位置が飛ばないように）
      });
      // 欄から離れたら、待たずにその場で残します
      input.addEventListener('blur', () => cashHandSave(true));
      calcPadBind(input);       // ★自前のテンキーを出します（＝や＋も打てます）
      wrap.append(name, input);
      el.cashMinus.appendChild(wrap);
    });
  }
  [...el.cashMinus.querySelectorAll('input[data-k]')].forEach((i) => {
    const v = cashEdit.m[i.dataset.k];
    // ★入れた文字をそのまま戻します。計算式は計算式のまま見えます
    if (document.activeElement !== i) {
      i.value = (v === undefined || v === null || v === '' || v === 0) ? '' : String(v);
    }
    // ★記録しても固めません。仕入・人件費と同じで、これらは
    //   現金売上の記録とは別のもの（日報の別のマスへ書くもの）です。
    //   固めると、記録したあと直せなくなります（実際に9月6日でそうなりました）。
    i.readOnly = false;
  });

  renderNippouMinusNote();
  renderGridBox();
  cashPullAuto();          // ★日報で直されていたら、取り込みます

  // ★写真をまだ読んでいないときは、読み取りの表と検算は出しません。
  //   手で入れる欄だけが出ている状態です（先に入れておけます）。
  //   ★入れ物は index.html ではなく、ここで出し入れします
  const 表 = el.cashNippou.parentNode;          // <table class="cash-nippou">
  if (表) 表.classList.toggle('is-hidden', !yomi);
  if (!yomi) {
    el.cashNippou.innerHTML = '';
    el.cashChecks.textContent = '';
    el.cashCheckMark.textContent = '';
    el.cashToNippou.classList.add('is-hidden');
    setNippouMsg('');
    return;
  }

  renderNippouTable();

  // 5つとも使えるときだけ、日報へ書けます
  el.cashToNippou.classList.toggle('is-hidden', !cashEdit.jok);
  // ★テスト用の書き先が入っているときは、ひと目で分かるようにします。
  //   本番に書いたつもりでテストに入っていた、が一番こわいためです
  const test = NippouTest.get();
  el.cashToNippou.textContent = test
    ? '★テスト用の日報に ジャーナルの5つを書く' : 'ジャーナルの5つを日報に書く';
  el.cashToNippou.classList.toggle('btn--danger', !!test);

  // 検算の結果。★通らなかったときこそ、何が起きたかを出します
  const checks = cashEdit.checks || [];
  const bad = checks.filter((c) => !c.ok);
  const ok = cashEdit.jok;
  el.cashCheckMark.className = 'cash-box__date ' + (ok ? 'is-ok' : 'is-bad');
  el.cashCheckMark.textContent = ok ? `検算 ${checks.length}つOK` : '★日報には入れません';

  const say = [];
  if (ok) {
    say.push(checks.map((c) => c.name).join('　'));
  } else {
    if (cashEdit.jwhy) say.push(cashEdit.jwhy);
    // 写真が切れているだけなら、撮り直せば済みます。式の中身までは出しません
    if (!cashEdit.jcut) {
      bad.forEach((c) => say.push(`${c.name}（${c.left} / ${c.right}）`));
      say.push('下の「読み取った文字を見る」を送っていただければ、読み方を直します');
    }
  }
  el.cashChecks.textContent = say.join('　');
}

/* ------------------------------------------------------------
 *  仕入明細と人件費（日報のE列 → F列・G列）
 *
 *  ★仕入先はアプリに持ちません。日報から読んで、そのまま欄にします。
 *    読んだ並びは店舗・月ごとに覚えておくので、毎回読みに行きません。
 * ---------------------------------------------------------- */

/** 読んだ並びの覚え書き（店舗と年月ごと。端末の中だけ） */
const GridCache = {
  _key(storeId, y, m) { return `t3works.grid.${storeId}.${y}${String(m).padStart(2, '0')}`; },
  get(storeId, y, m) {
    try { return JSON.parse(localStorage.getItem(this._key(storeId, y, m)) || 'null'); }
    catch (e) { return null; }
  },
  save(storeId, y, m, grid) {
    try { localStorage.setItem(this._key(storeId, y, m), JSON.stringify(grid || [])); }
    catch (e) { /* 入らなくても、読み直せば済みます */ }
  },
};

/**
 * いま見ている日の、仕入先と人件費の並び
 *
 * ★その月のものが無ければ、**前の月のものを使います。**
 *   仕入先は月をまたいでもほとんど変わらないので、
 *   月が替わるたびに6店舗分押してもらうのは手間だからです。
 *   ずれていても危なくありません。書くときはA列・E列の**名前で探す**ので、
 *   無い名前は「行が見つかりません」と出て**書かれません**。
 *   新しく増えた仕入先を出したいときは「読み直す」を押してもらいます。
 */
function cashGridNow() {
  const g = GridCache.get(state.storeId, state.y, state.m);
  if (g) return nippouGridSplit(g);
  // 前の月をさかのぼって探します（12か月分まで）
  let y = state.y;
  let m = state.m;
  for (let i = 0; i < 12; i++) {
    m -= 1;
    if (m < 1) { m = 12; y -= 1; }
    const old = GridCache.get(state.storeId, y, m);
    if (old) return nippouGridSplit(old);
  }
  return null;
}

/** 日報から、仕入先と人件費の並びを読んできます（書きません） */
async function cashGridLoad(しずかに) {
  const 言 = (t, k) => { if (!しずかに) setNippouMsg(t, k); };
  const store = state.storeId;
  const y = state.y;
  const m = state.m;
  const test = NippouTest.get();
  const folder = test ? '' : NippouFolders.get(store);
  if (!test && !folder) {
    言('日報フォルダが登録されていません。マネージの店舗一覧で登録してください', 'warn');
    return;
  }
  言('日報から仕入先を読んでいます…');
  try {
    const res = await Sync.ask('nippouWrite', {
      mode: '見る', file: test, folder, day: ymd(y, m, state.d), values: {},
    });
    if (!res.ok && !res.grid) { 言(res.error || '日報を開けませんでした', 'warn'); return; }
    // ★静かに読んでいるときは、版が古くても画面に出しません。
    //   日報へ書こうとしたときに、あらためて出ます
    if (!res.v || res.v !== NIPPOU_GAS_VERSION) { if (!しずかに) nippouGasOk(res); return; }
    if (!res.grid || !res.grid.length) {
      言('日報のE列に、仕入先が見つかりませんでした', 'warn'); return;
    }
    // ★読んでいるあいだに別の日・別の店舗へ移っているかもしれません。
    //   そのときは、読んだときの店舗と月に入れます（いまの画面には混ぜません）
    GridCache.save(store, y, m, res.grid);
    const w = nippouGridSplit(res.grid);
    言(`日報から読みました（仕入先 ${w.shiire.length}件・人件費 ${w.jinken.length}件）`, 'ok');
    render();
  } catch (e) {
    言(String(e && e.message || e), 'warn');
  }
}

/** この画面を開いてから、自動で読みにいった店舗と月 */
const gridAuto = {};

/**
 * 仕入先を、自動で読み直します
 *
 * ★押さなくてもよくするためのものです。
 *   その月分をまだ読んでいないときだけ、裏で1回だけ読みにいきます
 *   （前の月の並びを出したまま読むので、待たされません。
 *     読めたら、増えた仕入先がそのまま欄に出ます）。
 * ★合言葉が入っていない・日報フォルダが未登録・通信できない、
 *   のときは**黙って何もしません**。押すボタンは残してあります。
 */
function cashGridAuto() {
  const key = `${state.storeId}/${state.y}-${state.m}`;
  if (gridAuto[key]) return;                                  // この画面では1回だけ
  if (GridCache.get(state.storeId, state.y, state.m)) return; // その月分は、もうある
  if (!Sync.enabled || !Sync.enabled() || !Sync.pin()) return;
  const test = NippouTest.get();
  if (!test && !NippouFolders.get(state.storeId)) return;
  gridAuto[key] = true;
  cashGridLoad(true);
}

/**
 * 仕入・人件費の入力欄を作ります
 *
 * ★ここは「現金売上を記録したか」では固めません。
 *   仕入と人件費は現金売上の記録とは別のもので、書き先も別のマスです。
 *   記録したとたんに直せなくなると、**同じ日に入れ直せません**
 *   （実際にそうなっていました）。
 *   固めるのは「日報がそのマスを計算しているとき」だけです。
 */
function renderGridBox() {
  if (!el.cashGrid) {
    // ★入れ物は index.html ではなく、ここで作って差し込みます
    const box = document.createElement('div');
    box.id = 'cashGrid';
    // ★出前館の欄・一言・その書き込みボタン、の**あと**に置きます。
    //   el.cashMinus のすぐ後ろに入れると、あいだに割りこんで
    //   デリバリーのボタンが仕入より下へ回ってしまいます（実際にそうなりました）
    const 前 = el.cashMinusGo || el.cashMinusNote || el.cashMinus;
    前.insertAdjacentElement('afterend', box);
    el.cashGrid = box;
  }
  const w = cashGridNow();

  /* ★作り直すのは、並びが変わったときだけです。
     打つたびに作り直すと、**打っている最中の欄が消えて作られ、
     スマホのキーボードが閉じます**（実際にそうなりました）。
     同期が終わるたびに render() が呼ばれる（js/sync.js）ので、
     打っているあいだにも何度も通ります。
     出前館の欄が平気なのは、そちらが作り直していないからです。 */
  const 印 = !w ? 'なし'
    : `${state.storeId}/${ymd(state.y, state.m, state.d)}/`
      + w.shiire.map((r) => r.name).join(',') + '|' + w.jinken.map((r) => r.name).join(',');
  if (el.cashGrid.dataset.sign === 印) { renderGridFill(); cashGridAuto(); return; }
  // ★打っている最中は作り直しません（キーボードが閉じます）。
  //   印を覚えないので、欄から離れたときに作り直されます
  if (el.cashGrid.contains(document.activeElement)) { renderGridFill(); return; }
  el.cashGrid.dataset.sign = 印;
  el.cashGrid.innerHTML = '';

  if (!w) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn--sub';
    b.textContent = '日報から仕入先を読む';
    b.addEventListener('click', () => cashGridLoad());
    el.cashGrid.appendChild(b);
    cashGridAuto();          // ★はじめての店舗でも、裏で読みにいきます
    return;
  }

  const 節 = (見出し, 行, 入れ先, F名, G名) => {
    if (!行.length) return;
    // ★節ごとに入れ物を作ります。ボタンをその節の下に置くためです
    const sec = document.createElement('div');
    sec.className = 'cash-grid__sec';
    sec.dataset.part = 入れ先;
    const h = document.createElement('p');
    h.className = 'cash-minus__head';
    h.style.margin = '14px 0 8px';
    h.style.fontWeight = '700';
    h.textContent = `${見出し}（${F名} ／ ${G名}）`;
    sec.appendChild(h);

    const wrap = document.createElement('div');
    // ★1行に1件です。
    //   はじめ 'cash-minus'（2列のグリッド）を使い回したところ、
    //   1行に「名前＋入力2つ」が入るのに2列並べたため画面からはみ出し、
    //   仕入先の名前が縦書きになりました。ここは横に1件だけ並べます。
    //   ★css/style.css は本部のファイルなので、見た目はここで指定します。
    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = '1fr';
    wrap.style.gap = '8px';
    wrap.style.marginBottom = '14px';
    行.forEach((r) => {
      const row = document.createElement('label');
      row.className = 'cash-minus__row';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      const name = document.createElement('span');
      name.className = 'cash-minus__label';
      name.textContent = r.name;
      // 名前は幅を決めて折り返します。長い仕入先（〇〇食品（米）など）でも
      // 入力欄を押しつぶさないようにします
      name.style.flex = '0 0 6.5em';
      name.style.whiteSpace = 'normal';
      name.style.wordBreak = 'break-word';
      row.appendChild(name);
      [['f', r.fx, F名], ['g', r.gx, G名]].forEach(([which, 式か, ラベル]) => {
        const i = document.createElement('input');
        i.type = 'text';
        i.inputMode = 'numeric';
        i.autocomplete = 'off';
        i.className = 'cash-minus__input';
        // ★16px 未満だと、iOS が触ったときに画面を勝手に拡大します
        i.style.fontSize = '16px';
        i.placeholder = ラベル;
        // ★min-width:0 が肝心です。これが無いと、入力欄が縮まずに
        //   親からはみ出します（flex の初期値は min-width:auto のため）
        i.style.flex = '1 1 0';
        i.style.minWidth = '0';
        i.dataset.grid = 入れ先;
        i.dataset.name = r.name;
        i.dataset.col = which;
        const 持ち = (cashEdit[入れ先] || {})[r.name] || {};
        if (document.activeElement !== i) i.value = 持ち[which] === undefined ? '' : String(持ち[which]);
        // ★日報が計算しているマスには入れられません（式を壊さないため）
        i.readOnly = !!式か;
        if (式か) { i.placeholder = '日報が計算'; i.title = 'ここは日報の計算式です'; }
        i.addEventListener('input', () => {
          if (!cashEdit[入れ先][r.name]) cashEdit[入れ先][r.name] = {};
          cashEdit[入れ先][r.name][which] = i.value;
          cashHandSave();
          renderGridNote();
          renderGridButton();
        });
        i.addEventListener('blur', () => cashHandSave(true));
        calcPadBind(i);         // ★自前のテンキーを出します（＝や＋も打てます）
        row.appendChild(i);
      });
      wrap.appendChild(row);
    });
    sec.appendChild(wrap);
    el.cashGrid.appendChild(sec);
  };

  節('④仕入明細', w.shiire, 'shiire', '当日現金', '掛仕入');
  節('⑤人件費', w.jinken, 'jinken', '人数', '金額');

  // ★仕入先が増えたときのために、読み直せるようにしておきます。
  //   これが無いと、増えた業者が**いつまでも出てきません**
  const 再 = document.createElement('button');
  再.type = 'button';
  再.className = 'btn btn--sub';
  再.style.fontSize = '12px';
  再.style.padding = '6px 12px';
  再.textContent = '日報から読み直す（仕入先が増えたとき）';
  再.addEventListener('click', () => cashGridLoad());
  el.cashGrid.appendChild(再);

  // ★日報側で直された数を、手でも取り込めるようにします
  const 取 = document.createElement('button');
  取.type = 'button';
  取.className = 'btn btn--sub';
  取.style.fontSize = '12px';
  取.style.padding = '6px 12px';
  取.style.marginLeft = '8px';
  取.textContent = '日報の数を取り込む';
  取.addEventListener('click', () => cashPullFromNippou(false));
  el.cashGrid.appendChild(取);

  renderGridNote();

  renderGridButton();
  cashGridAuto();
}

/**
 * 作り直さずに、欄の中身と固まり具合だけを入れ直します
 *
 * ★打っている最中の欄には触りません。触ると入力の位置が飛びます。
 */
function renderGridFill() {
  if (!el.cashGrid) return;
  [...el.cashGrid.querySelectorAll('input[data-grid]')].forEach((i) => {
    if (document.activeElement === i) return;      // ★打っている欄は、そのまま
    const 持ち = (cashEdit[i.dataset.grid] || {})[i.dataset.name] || {};
    const v = 持ち[i.dataset.col];
    i.value = (v === undefined || v === null) ? '' : String(v);
  });
  renderGridNote();
  renderGridButton();
}

/**
 * 区分ごとの「日報に書く」ボタンを、その場に出し入れします
 *
 * ★入力のたびに呼びます。1つでも入っていれば出て、全部消せば引っ込みます。
 *   ここで欄ごと作り直すと、打っている途中で入力の位置が飛ぶので、
 *   ボタンだけを出し入れします。
 * ★区分ごとに分けているのは、書く先がそれぞれ別のマスだからです。
 *   仕入と人件費は写真と関係ないので、読み取りが通らなかった日でも書けます。
 */
function nippouPartButton(親, part, 文) {
  if (!親) return;
  let b = 親.querySelector(`.nippou-go[data-part="${part}"]`);
  const 出す = part === 'delivery'
    ? Object.keys(nippouPartData('delivery').values).length > 0
    : cashGridSend(part).length > 0;
  if (!出す) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn--sub nippou-go';
    b.dataset.part = part;
    b.style.marginBottom = '14px';
    b.addEventListener('click', () => nippouWritePart(part, b));
    親.appendChild(b);
  }
  const test = NippouTest.get();
  b.textContent = (test ? '★テスト用の日報に ' : '') + 文;
  b.classList.toggle('btn--danger', !!test);
  return b;
}

/** 仕入・人件費のボタン（それぞれの節の下に置きます） */
function renderGridButton() {
  if (!el.cashGrid) return;
  const 節 = (part) => el.cashGrid.querySelector(`.cash-grid__sec[data-part="${part}"]`);
  nippouPartButton(節('shiire'), 'shiire', '仕入明細を日報に書く');
  nippouPartButton(節('jinken'), 'jinken', '人件費を日報に書く');
}

/** 仕入・人件費の下に出す一言（計算式の答えと、計算できない式） */
function renderGridNote() {
  if (!el.cashGrid) return;
  let note = el.cashGrid.querySelector('.cash-grid__note');
  if (!note) {
    note = document.createElement('p');
    note.className = 'cash-msg cash-grid__note';
    el.cashGrid.appendChild(note);
  }
  const だめ = cashGridBad();
  const よい = [];
  ['shiire', 'jinken'].forEach((入れ先) => {
    Object.keys(cashEdit[入れ先] || {}).forEach((name) => {
      ['f', 'g'].forEach((c) => {
        const v = (cashEdit[入れ先][name] || {})[c];
        if (!cashIsFormula(v)) return;
        const n = cashMinusNum(v);
        if (n !== null) よい.push(`${name} ${n.toLocaleString('ja-JP')}`);
      });
    });
  });
  const 言 = [];
  if (よい.length) 言.push('計算式：' + よい.join('　'));
  if (だめ.length) 言.push(`★${だめ.join('、')} の式が計算できません`);
  note.textContent = 言.join('　');
  note.className = 'cash-msg cash-grid__note'
    + (だめ.length ? ' is-warn' : ' is-ok') + (言.length ? '' : ' is-hidden');
}

/** 仕入・人件費に、計算できない式が残っていないか */
function cashGridBad(だけ) {
  const out = [];
  (だけ ? [だけ] : ['shiire', 'jinken']).forEach((入れ先) => {
    Object.keys(cashEdit[入れ先] || {}).forEach((name) => {
      ['f', 'g'].forEach((c) => {
        const v = (cashEdit[入れ先][name] || {})[c];
        if (v === undefined || v === null || String(v).trim() === '') return;
        if (cashMinusNum(v) === null) out.push(`${name}`);
      });
    });
  });
  return [...new Set(out)];
}

/** 仕入・人件費を、日報へ渡す形にします */
function cashGridSend(だけ) {
  const out = [];
  const 列 = { f: 'F', g: 'G' };
  (だけ ? [だけ] : ['shiire', 'jinken']).forEach((入れ先) => {
    Object.keys(cashEdit[入れ先] || {}).forEach((name) => {
      ['f', 'g'].forEach((c) => {
        const v = (cashEdit[入れ先][name] || {})[c];
        if (v === undefined || v === null || String(v).trim() === '') return;
        const n = cashMinusNum(v);
        if (n === null) return;                       // 読めないものは送りません
        out.push({
          name,
          col: 列[c],
          value: (cashIsFormula(v) ? cashFormulaPlain(v) : n),
        });
      });
    });
  });
  return out;
}

/**
 *  手で入れた分の下に出す一言
 *
 *  ★計算式を入れたときは、その場で答えを出します。
 *    「=1000+2000+3000」と入れて、6,000円になっていることを
 *    書く前に目で確かめられるようにするためです。
 *  ★計算できない式は、はっきり赤で知らせます。**黙って0円にしません。**
 */
function renderNippouMinusNote() {
  // ★入れ物は index.html ではなく、ここで作って差し込みます
  //   （index.html は本部のファイルなので、部署からは触りません）
  if (!el.cashMinusNote) {
    const p = document.createElement('p');
    p.className = 'cash-msg is-hidden';
    p.id = 'cashMinusNote';
    el.cashMinus.insertAdjacentElement('afterend', p);
    el.cashMinusNote = p;
  }
  const よい = [];
  const だめ = [];
  CASH_MINUS_ROWS.forEach((k) => {
    const v = cashEdit.m[k];
    if (v === undefined || v === null || String(v).trim() === '') return;
    if (!cashIsFormula(v)) return;              // ふつうの数は、そのまま見えています
    const n = cashMinusNum(v);
    if (n === null) だめ.push(NIPPOU_LABELS[k]);
    else よい.push(`${NIPPOU_LABELS[k]} ${n.toLocaleString('ja-JP')}円`);
  });
  // ★計算できない欄は、その欄自身も赤くします。
  //   一言だけだと、欄がいくつもあるときにどれのことか分かりません。
  //   ここは入力のたびに通るので、打ちながら赤くなります
  //   （css/style.css は本部のファイルなので、クラスを足さずに色を付けます）
  [...el.cashMinus.querySelectorAll('input[data-k]')].forEach((i) => {
    const s = String(i.value).trim();
    const ng = s !== '' && cashMinusNum(s) === null;
    i.style.borderColor = ng ? '#c0392b' : '';
    i.style.color = ng ? '#c0392b' : '';
  });

  const 言 = [];
  if (よい.length) 言.push('計算式：' + よい.join('　'));
  if (だめ.length) 言.push(`★${だめ.join('、')} の式が計算できません。数字と ＋−×÷ かっこ だけが使えます`);
  el.cashMinusNote.textContent = 言.join('　');
  el.cashMinusNote.className = 'cash-msg'
    + (だめ.length ? ' is-warn' : ' is-ok') + (言.length ? '' : ' is-hidden');

  // ★デリバリーの「日報に書く」は、その5つの欄のすぐ下に置きます。
  //   入れ物は index.html ではなく、ここで作って差し込みます
  if (!el.cashMinusGo) {
    const w = document.createElement('div');
    w.id = 'cashMinusGo';
    el.cashMinusNote.insertAdjacentElement('afterend', w);
    el.cashMinusGo = w;
  }
  nippouPartButton(el.cashMinusGo, 'delivery', '出前館・ウーバー・ロケットナウを日報に書く');
}

/* ------------------------------------------------------------
 *  日報へ書く
 *
 *  ★かならず「見る → 確かめる → 書く → 検算」の順に通します。
 *    書き込みは戻せないので、先に今の中身を見て、並べて確かめてもらいます。
 *  ★書いたあと、日報の「当日総合計」がジャーナルの売上（税込）と
 *    合うかを見ます。出前館・ウーバー・ロケットナウも書くので、
 *    ぴったり合うはずです。合わなければ、その場で知らせます。
 * ---------------------------------------------------------- */
function nippouSend() {
  const n = nippouValues(cashEdit.j || {}, cashEdit.m);
  const values = {};
  CASH_NIPPOU_ROWS.forEach((r) => {
    // ★引くものがある行（現金売上・クレジット）は、答えではなく
    //   **引き算の式**を入れます。nippouCalc() の方で作ります
    if ((NIPPOU_MINUS[r.key] || []).length) return;
    if (n[r.key] !== null && n[r.key] !== undefined) values[NIPPOU_LABELS[r.key]] = n[r.key];
  });
  if (NIPPOU_WRITE_DELIVERY) {
    // ★計算式で入れたものは、計算式のまま日報へ渡します。
    //   日報のマスにも「=1000+2000+3000」と入るので、あとから開いたときに
    //   何件でいくらだったかが残ります。ふつうの数はそのまま数で渡します。
    CASH_MINUS_ROWS.forEach((k) => {
      const v = cashEdit.m[k];
      // ★空の欄は、書きません。
      //   0 を書くと、日報に先に入れてあった数字を消してしまいます
      //   （実際にそうなりました）。0 にしたいときは 0 と入れてもらいます。
      if (v === undefined || v === null || String(v).trim() === '') return;
      if (cashIsFormula(v) && cashMinusNum(v) !== null) {
        values[NIPPOU_LABELS[k]] = cashFormulaPlain(v);   // 「=1000+2000」の形
      } else {
        values[NIPPOU_LABELS[k]] = cashMinusOr0(v);
      }
    });
  }
  return values;
}

/**
 *  現金売上とクレジットは、答えではなく「引き算の式」で入れます
 *
 *      B3（現金売上）  =130000-B5-B11
 *      B4（クレジット）=45000-B6-B12-B18
 *
 *  ★なぜ式にするか。ko-dai さんが日報でやっている計算そのものだからです。
 *    あとから出前館の数字を直せば、現金売上も日報の中でひとりでに直ります。
 *    答えだけ入れると、直したときに food が合わなくなります。
 *  ★行番号（B5・B11）はここでは決めません。**Apps Script がA列の名前から引きます。**
 *    ロケットナウはバグるが17行、popo が18行と、店舗でずれているためです。
 */
function nippouCalc() {
  const j = cashEdit.j || {};
  const calc = {};
  CASH_NIPPOU_ROWS.forEach((r) => {
    const 引く = NIPPOU_MINUS[r.key] || [];
    if (!引く.length) return;
    if (j[r.key] === null || j[r.key] === undefined) return;
    calc[NIPPOU_LABELS[r.key]] = {
      base: j[r.key],                                   // ジャーナルから読めた数
      minus: 引く.map((k) => NIPPOU_LABELS[k]),          // 引く行の「名前」
    };
  });
  return calc;
}

/**
 * 日報にすでに入っている数と、アプリが入れようとしている数が食いちがう所
 *
 * ★「日報にはあるが、アプリでは入れていない」は、ここに出ません。
 *   そういう欄は、そもそも**書きません**（nippouSend で外しています）。
 *   ですからここに出るのは「**両方に入っていて、数がちがう**」だけです。
 */
function nippouClash(rows) {
  return (rows || []).filter((r) => {
    if (r.before === null || r.before === undefined || r.before === '') return false;
    // 見た目がちがっても、同じ数なら食いちがいではありません
    //（「3000」と 3000、式とその答え、など）
    const a = cashMinusNum(r.before);
    const b = cashMinusNum(r.after);
    if (a !== null && b !== null) return a !== b;
    return String(r.before) !== String(r.after);
  });
}

/** 食いちがいを、そのまま読める文にします */
function nippouClashText(食いちがい) {
  if (!食いちがい.length) return '';
  return '　★日報とアプリで数がちがいます：'
    + 食いちがい.map((r) => `${r.name}（日報 ${cashShow(r.before)} → アプリ ${cashShow(r.after)}）`).join('、')
    + '。このまま書くと、日報の数がアプリの数に上書きされます';
}

function setNippouMsg(text, kind) {
  el.cashNippouMsg.textContent = text || '';
  el.cashNippouMsg.className = 'cash-msg' + (kind ? ` is-${kind}` : '') + (text ? '' : ' is-hidden');
}

/**
 * サーバー（日報に書く.gs）が新しい版かどうか
 *
 * ★現金売上.gs の cashGasOk と同じ考え方です。
 *   食いちがっていたら、その場で何をすればよいかを出して**書かせません**。
 */
function nippouGasOk(res) {
  const now = res && res.v ? String(res.v) : '';
  if (now === NIPPOU_GAS_VERSION) return true;
  const how = '★コードを貼っただけでは切り替わりません。'
    + 'Apps Script の右上「デプロイ」→「デプロイを管理」→ '
    + 'いま使っているデプロイの鉛筆 → バージョンを「新バージョン」→「デプロイ」';
  setNippouMsg(now
    ? `日報に書く.gs が古いままです（サーバー ${now} ／ アプリ ${NIPPOU_GAS_VERSION}）。${how}`
    : `日報に書く.gs が古いままです（版が分かりません）。${how}`, 'warn');
  return false;
}

/** 手で入れた分に、計算できない式が残っていないか */
function cashMinusBad() {
  return CASH_MINUS_ROWS.filter((k) => {
    const v = cashEdit.m[k];
    return v !== undefined && v !== null && String(v).trim() !== '' && cashMinusNum(v) === null;
  }).map((k) => NIPPOU_LABELS[k]);
}

/* ------------------------------------------------------------
 *  日報へ書く（4つに分けています）
 *
 *      ジャーナル … 現金売上・クレジット（引き算の式）・電子マネー・純売上・当日客数
 *      デリバリー … 出前館・ウーバー・ロケットナウ
 *      仕入明細   … ④の仕入先ごとの 当日現金／掛仕入
 *      人件費     … ⑤の区分ごとの 人数／金額
 *
 *  ★分けても順番を気にしなくてよいのは、現金売上とクレジットが
 *    **式**（=130000-B5-B11）で入るからです。あとからデリバリーを書けば、
 *    日報の中で現金売上がひとりでに直ります。
 *  ★どれも「見る → 確かめる → 書く」を通ります。空の欄は書きません。
 * ---------------------------------------------------------- */

const NIPPOU_PARTS = {
  journal:  { name: 'ジャーナルの5つ', 記録も: true },
  delivery: { name: '出前館・ウーバー・ロケットナウ' },
  shiire:   { name: '仕入明細' },
  jinken:   { name: '人件費' },
};

/** その区分で、日報へ渡すものを作ります */
function nippouPartData(part) {
  if (part === 'journal') {
    const n = nippouValues(cashEdit.j || {}, cashEdit.m);
    const values = {};
    CASH_NIPPOU_ROWS.forEach((r) => {
      if ((NIPPOU_MINUS[r.key] || []).length) return;      // 式で入れる分は calc へ
      if (n[r.key] !== null && n[r.key] !== undefined) values[NIPPOU_LABELS[r.key]] = n[r.key];
    });
    return { values, calc: nippouCalc(), extra: [] };
  }
  if (part === 'delivery') {
    const values = {};
    CASH_MINUS_ROWS.forEach((k) => {
      const v = cashEdit.m[k];
      // ★空の欄は書きません。0を書くと、日報に先に入れてあった数字を消します
      if (v === undefined || v === null || String(v).trim() === '') return;
      values[NIPPOU_LABELS[k]] = (cashIsFormula(v) && cashMinusNum(v) !== null)
        ? cashFormulaPlain(v) : cashMinusOr0(v);
    });
    return { values, calc: {}, extra: [] };
  }
  // 仕入明細・人件費
  return { values: {}, calc: {}, extra: cashGridSend(part) };
}

/** その区分で、計算できない式が残っていないか */
function nippouPartBad(part) {
  if (part === 'delivery') return cashMinusBad();
  if (part === 'shiire' || part === 'jinken') return cashGridBad(part);
  return [];
}

/**
 * 日報へ書きます（区分ごと）
 *
 * ★ジャーナルの5つだけは、先に現金売上を記録します。
 *   書いてから記録に失敗すると、日報にだけ数字が入って手元に証拠が残りません。
 */
async function nippouWritePart(part, btn) {
  const 決 = NIPPOU_PARTS[part];
  if (!決) return;
  if (part === 'journal' && !cashEdit.jok) return;

  const だめ = nippouPartBad(part);
  if (だめ.length) {
    setNippouMsg(`${だめ.join('、')} の計算式が計算できません。`
      + '直すか、空にしてから書いてください（数字と ＋−×÷ かっこ だけが使えます）', 'warn');
    return;
  }

  // ★テスト用の書き先が入っていれば、そちらへ書きます（この端末の中だけの設定です）
  const test = NippouTest.get();
  const folder = test ? '' : NippouFolders.get(state.storeId);
  if (!test && !folder) {
    setNippouMsg('日報フォルダが登録されていません。マネージの店舗一覧で登録してください', 'warn');
    return;
  }

  const { values, calc, extra } = nippouPartData(part);
  if (!Object.keys(values).length && !Object.keys(calc).length && !extra.length) {
    setNippouMsg(`${決.name}に、入れたものがありません`, 'warn');
    return;
  }

  const dateStr = ymd(state.y, state.m, state.d);
  if (btn) btn.disabled = true;
  try {
    // ① まず、今の中身を見に行きます（書きません）
    setNippouMsg(`日報を見に行っています…（${決.name}）`);
    const look = await Sync.ask('nippouWrite',
      { mode: '見る', file: test, folder, day: dateStr, values, extra, calc });
    if (!look.ok) { setNippouMsg(look.error || '日報を開けませんでした', 'warn'); return; }
    // ★書く前に、Apps Script が新しい版かを見ます
    if (!nippouGasOk(look)) return;

    // ② 並べて確かめてもらいます
    const rows = look.rows || [];
    const 食いちがい = nippouClash(rows);
    const ok = await askConfirm({
      item: `${look.file}　${look.sheet}日のページ（${決.name}）`,
      message: rows.map((r) => `${r.name} ${cashShow(r.after)}`).join('／')
        + nippouClashText(食いちがい),
      okLabel: '書く',
      danger: 食いちがい.length > 0,
    });
    if (!ok) { setNippouMsg(''); return; }

    if (決.記録も) {
      // ★ここから先は何秒かかかります。控えておいて、
      //   途中でアプリを閉じられても続きからやり直せるようにします
      cashJobSave({
        kind: 'send', store: state.storeId, date: dateStr, values, test, folder,
        sales: cashYen(el.cashSales.value), by: el.cashStaff.value,
        j: cashEdit.j, m: cashEdit.m, sure: cashEdit.sure, extra, calc,
        at: new Date().toISOString(),
      });
      await nippouSendNow(values, dateStr, test, folder, extra, calc);
      return;
    }

    // ③ 書きます（ジャーナル以外は、現金売上の記録は要りません）
    setNippouMsg(`日報に書いています…（${決.name}）`);
    const res = await Sync.ask('nippouWrite',
      { mode: '書く', file: test, folder, day: dateStr, values, extra, calc });
    if (!res.ok) { setNippouMsg(res.error || '書けませんでした', 'warn'); return; }
    cashWroteSave(dateStr, values, extra);   // ★日報で直されたかを見くらべるため
    setNippouMsg(`${決.name}を日報に書きました（${res.sheet}日・${(res.rows || []).length}か所）`, 'ok');
  } catch (e) {
    setNippouMsg(String(e && e.message || e), 'warn');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/** 「日報に書く」＝ジャーナルの5つ（前からのボタン） */
async function writeNippou() {
  return nippouWritePart('journal', el.cashToNippou);
}

/**
 *  記録して、日報へ書いて、検算します
 *
 *  ★writeNippou からも、続きからやり直すとき（cashResume）からも呼びます。
 *    最後まで行けたら控えを消します。
 */
async function nippouSendNow(values, dateStr, test, folder, extra, calc) {
  // ① ★先に現金売上を確定させます（写真もドライブへ）。
  //    こちらが失敗したら日報には書きません。書いてから記録に失敗すると、
  //    日報にだけ数字が入って、手元に証拠が残らない形になってしまいます
  setNippouMsg('現金売上を記録しています…');
  const kept = await saveCash();
  if (!kept) {
    setNippouMsg('先に現金売上の記録ができませんでした。上の知らせを見てください', 'warn');
    return;
  }

  // ② 書きます
  setNippouMsg('日報に書いています…');
  const res = await Sync.ask('nippouWrite',
    { mode: '書く', file: test, folder, day: dateStr, values, extra: extra || [], calc: calc || {} });
  if (!res.ok) {
    // ★控えは消しません。通信が切れただけなら、次に開いたときに続きからやり直します
    setNippouMsg((res.error || '書けませんでした') + '　アプリを開き直すと、続きからやり直します', 'warn');
    return;
  }

  cashJobClear();            // ここまで来たら、やり直す必要はありません
  cashWroteSave(dateStr, values, extra);   // ★日報で直されたかを見くらべるため

  // ③ 書いたあとの検算
  const want = (cashEdit.j || {}).gross;
  if (res.total === null || res.total === undefined || want === null || want === undefined) {
    setNippouMsg(`記録して、日報に書きました（${res.sheet}日）`, 'ok');
  } else if (res.total === want) {
    setNippouMsg(`記録して、日報に書きました（${res.sheet}日）　`
      + `検算OK：当日総合計 ${cashText(res.total)} ＝ ジャーナルの売上`, 'ok');
  } else {
    setNippouMsg('日報には書きましたが、★検算が合いません。'
      + `当日総合計 ${cashText(res.total)} ／ ジャーナルの売上 ${cashText(want)}。`
      + '日報を開いて確かめてください', 'warn');
  }
  render();
}

/** 検算の通った数だけを取り出します（通らなかった数は残しません） */
function cashSureValues() {
  if (!cashEdit.j) return null;
  const out = {};
  Object.keys(cashEdit.j).forEach((key) => {
    if ((cashEdit.sure || {})[key] && cashEdit.j[key] !== null) out[key] = cashEdit.j[key];
  });
  return Object.keys(out).length ? out : null;
}

function renderNippouTable() {
  const j = cashEdit.j || {};
  const n = nippouValues(j, cashEdit.m);
  el.cashNippou.innerHTML = '';
  CASH_NIPPOU_ROWS.forEach((row) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = row.name;
    const from = document.createElement('td');
    const minus = document.createElement('td');
    const to = document.createElement('td');
    to.className = 'is-to';

    const raw = j[row.key];
    const cut = (NIPPOU_MINUS[row.key] || []).reduce((a, k) => a + cashMinusOr0(cashEdit.m[k]), 0);
    const fmt = (v) => (v === null || v === undefined ? '—'
      : row.plain ? String(v) : Number(v).toLocaleString('ja-JP'));
    const usable = !!(cashEdit.sure || {})[row.key];
    from.textContent = fmt(raw);
    minus.textContent = cut ? `− ${cut.toLocaleString('ja-JP')}` : '';
    to.textContent = usable ? fmt(n[row.key]) : '—';
    if (!usable) to.classList.add('is-ng');
    tr.append(th, from, minus, to);
    el.cashNippou.appendChild(tr);
  });
}

/** 「日ごと」と「1週間」を切り替える */
function setCashTab(tab) {
  cashTab = tab;
  if (tab === 'week') cashWeek = cashWeekStart(state.y, state.m, state.d);
  render();
}

/** その週の、ジャーナルの合計と「まだ撮っていない日」 */
function cashWeekTotal(startStr) {
  let total = 0;
  const miss = [];
  cashWeekDays(startStr).forEach((dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const cash = cashOf(state.storeId, dateStr);
    if (cash) { total += Number(cash.sales) || 0; return; }
    // 定休日と、これから来る日は「まだ」に数えません
    if (Closed.isClosed(state.storeId, y, m, d)) return;
    if (dateStr > ymd(TODAY.y, TODAY.m, TODAY.d)) return;
    miss.push(`${m}/${d}`);
  });
  return { total, miss };
}

function setCashMsg(text, kind) {
  clearInterval(cashTick);
  el.cashMsg.textContent = text || '';
  el.cashMsg.className = 'cash-msg' + (text ? '' : ' is-hidden') + (kind ? ` is-${kind}` : '');
}

/**
 * 待っているあいだ、経過の秒数を出します
 *
 * ★何秒かかるか分からないまま待つのが一番長く感じます。
 *   数字が動いていれば「止まっていない」ことも分かります。
 *   あとから「読み取りに何秒かかったか」を教えてもらう手がかりにもなります。
 */
let cashTick = null;
function setCashWait(text) {
  clearInterval(cashTick);
  const from = Date.now();
  const show = () => {
    const sec = Math.round((Date.now() - from) / 1000);
    el.cashMsg.textContent = sec ? `${text}（${sec}秒）` : text;
    el.cashMsg.className = 'cash-msg is-busy';
  };
  show();
  cashTick = setInterval(show, 1000);
}

/* -------- 写真 -------- */

/**
 * 写真の中で「紙が写っている四角」をさがします
 *
 * レシートは白い紙で、まわりは机や床です。明るいところだけを拾って、
 * その外側（机）を落とすための四角を返します。
 *
 * ★見つからない・怪しいときは null を返して、切らずにそのまま送ります。
 *   紙の一部を切ってしまうと、金額の行ごと消えてしまうためです。
 * ★まわりに少し余白（3%）を残します。ふちで切れないようにするためです。
 */
function cashPaperBox(data, w, h) {
  // 明るさの目安を作ります（一番暗いところと明るいところの真ん中）
  let lo = 255;
  let hi = 0;
  for (let i = 0; i < data.length; i += 4 * 17) {   // 間引いて見ます（速さのため）
    const v = data[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (hi - lo < 40) return null;          // 明暗の差がない＝紙と机が見分けられません
  const line = lo + (hi - lo) * 0.55;

  const rows = new Int32Array(h);
  const cols = new Int32Array(w);
  for (let y = 0; y < h; y++) {
    const base = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (data[base + x * 4] > line) { rows[y] += 1; cols[x] += 1; }
    }
  }

  const edge = (arr, len, need) => {
    let a = -1;
    let b = -1;
    for (let i = 0; i < len; i++) if (arr[i] >= need) { a = i; break; }
    for (let i = len - 1; i >= 0; i--) if (arr[i] >= need) { b = i; break; }
    return [a, b];
  };
  // ★縦は切りません。上から下まで、そのまま残します。
  //   紙の下の方が影で暗くなると机と見分けがつかず、
  //   実際に「ポイントから下が切れて読めない」ことが起きました。
  //   長いレシートで無駄なのは左右の机だけなので、横だけ切れば足ります。
  //   数字を失うくらいなら、少し大きいまま送る方がましです。
  const [x0, x1] = edge(cols, w, h * 0.08);
  if (x0 < 0) return null;

  const pad = Math.round(w * 0.04);
  const x = Math.max(0, x0 - pad);
  const bw = Math.min(w, x1 + pad) - x;

  // 細すぎる（紙を切ってしまう）／ほとんど変わらない（切る意味がない）ときは、やめます
  if (bw < w * 0.3) return null;
  if (bw > w * 0.95) return null;
  return { x, y: 0, w: bw, h };
}

/**
 * 撮った写真を、送れる大きさまで小さくします
 *
 * ★大きさ（ピクセル）は減らしません。字の形が崩れると読み取れなくなるためです。
 * ★色は捨てて白黒にします。レシートは白地に黒の字なので、色は要りません。
 *   捨てるとファイルが小さくなり、送る時間が短くなります。
 */
function cashShrink(file, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, CASH_PHOTO_MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      // 白黒にする（色の分だけ小さくなります）
      let box = null;
      try {
        const px = ctx.getImageData(0, 0, w, h);
        const d = px.data;
        for (let i = 0; i < d.length; i += 4) {
          const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
          d[i] = g; d[i + 1] = g; d[i + 2] = g;
        }
        ctx.putImageData(px, 0, 0);
        box = cashPaperBox(d, w, h);
      } catch (e) {
        // 端末によっては読み出せないことがあります。そのときは色のまま送ります
      }

      // ★紙のまわりの机が写っている分を落とします。
      //   紙は切りません（上の日付から下まで、そのまま残ります）。
      //   同じ大きさの中に紙だけが入るので、字が大きくなり、
      //   読み取りが速く・確かになります。ファイルも小さくなります。
      if (box) {
        const cut = document.createElement('canvas');
        // 元の写真での、紙の大きさ
        const back = img.width / w;
        const ow = box.w * back;
        const oh = box.h * back;
        // ★元の写真を基準に縮めます。縮めた絵の四角をそのまま使うと、
        //   せっかく机を落としたのに、字まで小さいままになります
        // 大きく落とせたときだけ、字に余裕を回します
        // ★横だけ切るので、落とせた「幅の割合」で見ます。
        //   大きく落とせた日は、その分を字の大きさに回します
        const share = ow / img.width;
        const cap = share < CASH_CROP_SHARE ? CASH_PHOTO_MAX_CROP : CASH_PHOTO_MAX;
        const s2 = Math.min(1, cap / Math.max(ow, oh));
        cut.width = Math.round(ow * s2);
        cut.height = Math.round(oh * s2);
        const c2 = cut.getContext('2d');
        c2.drawImage(
          img,
          box.x * back, box.y * back, box.w * back, box.h * back,
          0, 0, cut.width, cut.height
        );
        // 切り出した方も白黒にします
        try {
          const px2 = c2.getImageData(0, 0, cut.width, cut.height);
          const d2 = px2.data;
          for (let i = 0; i < d2.length; i += 4) {
            const g = (d2[i] * 0.299 + d2[i + 1] * 0.587 + d2[i + 2] * 0.114) | 0;
            d2[i] = g; d2[i + 1] = g; d2[i + 2] = g;
          }
          c2.putImageData(px2, 0, 0);
        } catch (e) { /* そのままでも進めます */ }
        resolve(cut.toDataURL('image/jpeg', quality || CASH_PHOTO_Q));
        return;
      }

      resolve(canvas.toDataURL('image/jpeg', quality || CASH_PHOTO_Q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('写真を開けませんでした')); };
    img.src = url;
  });
}

/**
 * サーバー（現金売上.gs）が新しい版かどうか
 *
 * 食いちがっていたら、その場で何をすればよいかを出します。
 * true なら、そのまま進めて大丈夫です。
 */
function cashGasOk(res) {
  const now = res && res.v ? String(res.v) : '';
  if (now === CASH_GAS_VERSION) return true;

  // ★「貼っただけ」では切り替わりません。デプロイを更新するまで、
  //   サーバーは前の版のまま動きつづけます。そこを名指しで伝えます
  const how = '★コードを貼っただけでは切り替わりません。'
    + 'Apps Script の右上「デプロイ」→「デプロイを管理」→ '
    + 'いま使っているデプロイの鉛筆 → バージョンを「新バージョン」→「デプロイ」';
  setCashMsg(now
    ? `Apps Script が古いままです（サーバー ${now} ／ アプリ ${CASH_GAS_VERSION}）。${how}`
    : `Apps Script が古いままです（版が分かりません）。${how}`, 'warn');
  return false;
}

async function onCashFile(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';           // 同じ写真をもう一度選べるように
  if (!file) return;

  const dateStr = ymd(state.y, state.m, state.d);
  // 撮り直したら、金額も入れ直すことになるので、記録済みの錠をはずします
  cashUnlocked = true;
  el.cashSales.readOnly = false;
  el.cashStaff.disabled = false;
  el.cashDone.classList.add('is-hidden');
  el.cashRedo.classList.add('is-hidden');
  el.cashSave.classList.remove('is-hidden');
  cashEdit.busy = true;
  setCashWait('写真を送っています…');
  el.cashTake.classList.add('is-busy');

  try {
    const dataUrl = await cashShrink(file);
    // 送る前に、撮ったものをその場で出します（待っているあいだ何も出ないと不安なので）
    el.cashShotImg.src = dataUrl;
    el.cashShotImg.classList.remove('is-hidden');
    el.cashShotEmpty.classList.add('is-hidden');
    el.cashShot.classList.remove('is-empty');

    // ★送る前に控えます。ここから先は何秒かかかるので、
    //   途中でアプリを閉じられても、戻ってきたら続きからやり直せるようにします
    cashJobSave({ kind: 'read', store: state.storeId, date: dateStr, image: dataUrl,
      at: new Date().toISOString() });
    await cashReadPhoto(dataUrl, dateStr, file);
  } catch (err) {
    setCashMsg(String(err && err.message || err), 'warn');
    showCashPhoto();
  } finally {
    cashEdit.busy = false;
    el.cashTake.classList.remove('is-busy');
    el.cashTakeText.textContent = (cashEdit.photo || cashEdit.pending) ? '📷 撮り直す' : '📷 ジャーナルを撮る';
    render();
  }
}

/**
 *  写真を送って、文字を読み取り、数を取り出します
 *
 *  ★onCashFile からも、続きからやり直すとき（cashResume）からも呼びます。
 *    最後まで行けたら控えを消します。途中で切れたら控えが残るので、
 *    次にアプリを開いたときに、もう一度ここへ入ります。
 *
 *  ★file は「いま撮った写真そのもの」です。読めなかったときに、
 *    もっときれいな画質で送り直すのに使います。
 *    続きからやり直すとき（cashResume）は、控えに小さくした写真しか
 *    残っていません。そのときは file が空で呼ばれ、送り直しはしません。
 */
async function cashReadPhoto(dataUrl, dateStr, file) {
  cashEdit.busy = true;
  el.cashTake.classList.add('is-busy');
  try {
    setCashWait('文字を読み取っています…');
    // ★ここでは読み取るだけで、ドライブには残しません。
    //   残すのは「記録する」を押したときです（撮っただけの写真が溜まらないように）
    const from = Date.now();
    let res = await Sync.ask('journal', {
      mode: 'read',
      store: state.storeId,
      date: dateStr,
      image: dataUrl,
    });
    if (!res.ok) throw new Error(res.error || '送れませんでした');

    // ★Apps Script の貼り直しが済んでいるか、ここで見ます。
    //   古いままだと、撮っただけでドライブに写真が残ってしまうなど、
    //   見た目では分からない食いちがいが出るためです
    if (!cashGasOk(res)) return;

    let got = parseJournalCash(res.text || '');

    // ★小さくして送ったせいで読み取れなかったのかもしれません。
    //   そのときだけ、元の画質でもう一度送り直します（ふだんは1回で終わります）
    // ★file が無いのは、続きからやり直しているときです。控えには小さくした
    //   写真しか残っていないので、送り直しても同じ結果にしかなりません。
    //   ここで file を見ずに送り直そうとして、画面に
    //   「file is not defined」と出していました（2026-09-05 に直しました）
    if (file && !res.ocrError && got.how === 'ng') {
      setCashWait('もう一度、きれいな写真で読み取っています…');
      const big = await cashShrink(file, CASH_PHOTO_Q_RETRY);
      const res2 = await Sync.ask('journal', {
        mode: 'read', store: state.storeId, date: dateStr, image: big,
      });
      if (res2.ok && parseJournalCash(res2.text || '').how !== 'ng') {
        res = res2;
        dataUrl = big;
        got = parseJournalCash(res2.text || '');
      }
    }
    cashEdit.ms = Date.now() - from;
    cashEdit.size = Math.round(dataUrl.length * 3 / 4 / 1024);
    cashEdit.gas = res.v || '（分かりません）';

    cashEdit.pending = dataUrl;
    // ★読み取った文字はそのまま持っておきます。金額が違って入ったときに、
    //   何が読めていたのかを見られるようにするためです（紙の形が変わったときの手がかり）
    cashEdit.text = res.text || '';
    el.cashOcrLink.classList.toggle('is-hidden', !cashEdit.text);
    cashEdit.ocr = got.yen;
    cashEdit.how = got.how;

    // ★同じ文字から、日報に入れる5つも読みます。
    //   検算が通らなければ使いません（現金だけの読み取りは、これまでどおり動きます）
    if (JOURNAL_STORES.includes(state.storeId)) {
      const jr = parseJournal(res.text || '');
      // ★検算が通らなくても入れます。ここを null にすると箱ごと消えてしまい、
      //   うまくいかなかったことすら分からなくなります（実際にそうなりました）
      cashEdit.j = jr.v;
      cashEdit.checks = jr.checks;
      cashEdit.sure = jr.sure || {};
      cashEdit.jok = jr.ok;
      cashEdit.jcut = !!jr.cut;
      cashEdit.jwhy = jr.ok ? ''
        : (jr.why || (jr.missing.length ? jr.missing.join('、') + ' を読み取れませんでした' : '読み取れませんでした'));
    }

    if (res.ocrError) {
      setCashMsg(`金額を読み取れませんでした。手で入れてください（${res.ocrError}）`, 'warn');
      return;
    }

    if (got.how === 'read') {
      el.cashSales.value = cashText(got.yen);
      // ★かかった時間と写真の大きさも出します。遅いと感じたときに、
      //   どこに時間がかかっているのかを、開かずにそのまま伝えられるようにするためです
      setCashMsg(`読み取りました：${cashText(got.yen)}円${cashHowLong()}`
        + '　紙と見くらべて、違っていれば直してください', 'ok');
    } else if (got.how === 'none') {
      el.cashSales.value = '0';
      setCashMsg('現金の行が見当たりませんでした。現金の会計が無かった日は 0円 です。'
        + '紙に現金の行があるのに 0円 になっているときは、手で直してください', 'warn');
    } else {
      setCashMsg('金額を読み取れませんでした。金額は手で入れてください。'
        + '下の「読み取った文字を見る」を送っていただければ、読み方を直します', 'warn');
    }
    cashJobClear();          // ここまで来たら、やり直す必要はありません
  } catch (err) {
    // ★控えは消しません。通信が切れただけなら、次に開いたときに続きからやり直します
    setCashMsg(String(err && err.message || err)
      + '　アプリを開き直すと、続きからやり直します', 'warn');
    showCashPhoto();
  } finally {
    cashEdit.busy = false;
    el.cashTake.classList.remove('is-busy');
    el.cashTakeText.textContent = (cashEdit.photo || cashEdit.pending) ? '📷 撮り直す' : '📷 ジャーナルを撮る';
    // ★描き直します。ここが抜けていたため「日報に入れる」が古いままで、
    //   前の日に読んだ数字が次の日にも出ていました。
    //   金額欄と伝えごとは日が変わったときにしか触らないので、上書きされません
    render();
  }
}

/** 記録に残っている写真を出す（ほかの端末で撮ったものも見られます） */
async function showCashPhoto() {
  const id = cashEdit.photo;
  // ★中身が届くまで、写真の枠は出しません。
  //   src が空のまま出すと、割れた写真の絵が出てしまいます
  el.cashShotImg.classList.add('is-hidden');
  el.cashShotImg.removeAttribute('src');
  el.cashShotEmpty.classList.remove('is-hidden');
  el.cashShot.classList.add('is-empty');
  if (!id) { el.cashShotEmpty.textContent = 'まだ撮っていません'; return; }

  el.cashShotEmpty.textContent = '写真を読み込んでいます…';
  const res = await Sync.ask('journalImage', { fileId: id });
  if (cashEdit.photo !== id) return;   // 待っているあいだに日を移った
  if (res.ok && res.image) {
    el.cashShotImg.src = `data:${res.type || 'image/jpeg'};base64,${res.image}`;
    el.cashShotImg.classList.remove('is-hidden');
    el.cashShotEmpty.classList.add('is-hidden');
    el.cashShot.classList.remove('is-empty');
  } else {
    el.cashShotEmpty.textContent = '写真を出せませんでした';
  }
}

/** かかった時間と写真の大きさ（「（4.2秒・310KB）」の形） */
function cashHowLong() {
  const bits = [];
  if (cashEdit.ms) bits.push(`${(cashEdit.ms / 1000).toFixed(1)}秒`);
  if (cashEdit.size) bits.push(`${cashEdit.size}KB`);
  return bits.length ? `（${bits.join('・')}）` : '';
}

/** 読み取った文字を出す */
function openOcrText() {
  const how = [
    cashEdit.ms ? `読み取り ${(cashEdit.ms / 1000).toFixed(1)}秒` : '',
    cashEdit.saveMs ? `記録 ${(cashEdit.saveMs / 1000).toFixed(1)}秒` : '',
    cashEdit.size ? `写真 ${cashEdit.size}KB` : '',
    cashEdit.gas ? `サーバー ${cashEdit.gas}` : '',
  ].filter(Boolean).join('　');
  el.ocrText.textContent = (how ? `（${how}）\n\n` : '')
    + (cashEdit.text || '（何も読み取れませんでした）');
  el.ocrCopy.textContent = 'コピーする';
  el.ocrModal.classList.remove('is-hidden');
}

async function copyOcrText() {
  try {
    await navigator.clipboard.writeText(cashEdit.text || '');
    el.ocrCopy.textContent = 'コピーしました';
  } catch (e) {
    el.ocrCopy.textContent = 'コピーできませんでした';
  }
}

function openShot() {
  const src = el.cashShotImg.getAttribute('src');
  if (!src) return;
  el.shotBig.src = src;
  el.shotModal.classList.remove('is-hidden');
}

/* -------- 記録する -------- */
async function saveCash() {
  const dateStr = ymd(state.y, state.m, state.d);
  const sales = cashYen(el.cashSales.value);

  if (sales === null) {
    setCashMsg('現金売上を入れてください', 'warn');
    return false;
  }
  // ★誰が記録したかを残します。あとで金額が合わないときに、
  //   その日の紙を出した人に聞けるようにするためです
  const by = el.cashStaff.value;
  if (!by) {
    setCashMsg('担当者を選んでください', 'warn');
    el.cashStaff.focus();
    return false;
  }

  // ★写真をドライブに残すのは、ここ（記録するを押したとき）です。
  //   同じ日の古い写真はサーバー側でゴミ箱に入るので、残るのは最後の1枚だけです
  if (cashEdit.pending) {
    el.cashSave.disabled = true;
    const before = el.cashSave.textContent;
    el.cashSave.textContent = '写真を残しています…';
    const from = Date.now();
    const res = await Sync.ask('journal', {
      mode: 'save',
      store: state.storeId,
      // フォルダの名前に使うので、店舗の名前も送ります
      storeName: getStore(state.storeId).name,
      date: dateStr,
      image: cashEdit.pending,
    });
    el.cashSave.disabled = false;
    el.cashSave.textContent = before;
    cashEdit.saveMs = Date.now() - from;

    if (res.ok && !cashGasOk(res)) return false;

    if (!res.ok || !res.fileId) {
      // 写真を残せていないのに記録してしまうと、あとで見返せません
      setCashMsg(`写真を残せませんでした（${res.error || '通信できません'}）。`
        + 'もう一度「記録する」を押してください', 'warn');
      return false;
    }
    cashEdit.photo = res.fileId;
    cashEdit.pending = '';
  }

  const now = new Date().toISOString();

  Store.setItem(state.storeId, dateStr, CASH_ITEM, {
    done: true,
    value: {
      sales, photo: cashEdit.photo || '', ocr: cashEdit.ocr, at: now, by,
      // ジャーナルから読めた5つと、手で入れた引き算の分。日報へはここから書きます
      j: cashSureValues(),
      m: cashEdit.m && Object.keys(cashEdit.m).length ? cashEdit.m : null,
    },
  });
  cashUnlocked = false;
  setCashMsg(cashEdit.saveMs
    ? `記録しました（写真を残すのに ${(cashEdit.saveMs / 1000).toFixed(1)}秒）`
    : '', cashEdit.saveMs ? 'ok' : '');
  render();
  return true;
}

/* -------- 1週間分（月〜日） -------- */

function renderCashWeek() {
  const start = cashWeekNow();

  el.cashWeekLabel.textContent = cashWeekLabel(start);
  el.cashWeekList.innerHTML = '';

  const todayStr = ymd(TODAY.y, TODAY.m, TODAY.d);
  cashWeekDays(start).forEach((dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    const cash = cashOf(state.storeId, dateStr);
    const shut = Closed.isClosed(state.storeId, y, m, d);

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'cash-day'
      + (dateStr === todayStr ? ' is-today' : '')
      + (shut ? ' is-closed' : '')
      + (!cash && !shut && dateStr <= todayStr ? ' is-yet' : '');
    row.innerHTML =
      `<span class="cash-day__date">${m}/${d}</span>`
      + `<span class="cash-day__dow">${DOW[dow]}</span>`
      + `<span class="cash-day__yen">${
        cash ? `${cashText(cash.sales)}円` : shut ? '定休日' : dateStr > todayStr ? '' : 'まだ'
      }</span>`
      + (cash && cash.photo ? '<span class="cash-day__photo">📷</span>' : '<span class="cash-day__photo"></span>');
    row.addEventListener('click', () => {
      state.y = y; state.m = m; state.d = d;
      cashTab = 'day';
      writeHash();
      render();
    });
    el.cashWeekList.appendChild(row);
  });

  // まだ撮っていない日があれば知らせます（一覧の合計が足りないことに気づけるように）
  const { miss } = cashWeekTotal(start);
  el.cashWeekMiss.classList.toggle('is-hidden', !miss.length);
  el.cashWeekMiss.textContent = miss.length
    ? `まだ撮っていない日があります：${miss.join('・')}` : '';
}

/** 週を送る（n = -1 前の週 / +1 次の週 / 0 今週） */
function moveCashWeek(n) {
  cashWeek = n === 0
    ? cashWeekStart(TODAY.y, TODAY.m, TODAY.d)
    : cashWeekShift(cashWeekNow(), n);
  render();
}

/** 記録し直す（押しまちがえたとき） */
function redoCash() {
  cashUnlocked = true;
  render();
  el.cashSales.focus();
}



/* -------- その月の一覧（探すためのもの） -------- */
function renderCashList() {
  const ym = `${state.y}-${pad2(state.m)}`;
  const month = Store.getMonth(state.storeId, ym) || {};
  const last = new Date(state.y, state.m, 0).getDate();

  el.cashList.innerHTML = '';
  let total = 0;
  let days = 0;

  for (let d = last; d >= 1; d--) {
    const dateStr = ymd(state.y, state.m, d);
    const rec = month[pad2(d)] || month[String(d)] || null;
    const v = rec && rec.items && rec.items[CASH_ITEM] && rec.items[CASH_ITEM].value;
    const cash = v && typeof v === 'object' ? v : null;
    if (!cash) continue;

    days += 1;
    total += Number(cash.sales) || 0;

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'cash-item';
    row.innerHTML =
      `<span class="cash-item__date">${state.m}/${d}（${DOW[new Date(state.y, state.m - 1, d).getDay()]}）</span>`
      + `<span class="cash-item__yen">${cashText(cash.sales)}円</span>`
      + (cash.photo ? '<span class="cash-item__photo">📷</span>' : '<span class="cash-item__photo"></span>');
    row.addEventListener('click', () => {
      state.d = d;
      writeHash();
      render();
    });
    el.cashList.appendChild(row);
  }

  el.cashMonthTitle.textContent = `${state.m}月の現金売上`;
  el.cashMonthSum.textContent = days ? `${days}日分　合計 ${cashText(total)}円` : '';

  if (!days) {
    const p = document.createElement('p');
    p.className = 'cash-empty';
    p.textContent = 'この月は、まだ1日も記録がありません。';
    el.cashList.appendChild(p);
  }
}


/* ============================================================
 *  アルバイトの教育（教育マニュアル）
 *
 *  一覧 … 教育中の人が、進み具合つきで並びます
 *  中身 … 1人を押すと、大カテゴリーごとの項目が出ます（クローズと同じ形）
 *
 *  ★全部にチェックが入った人は、一覧から「終わった人」へ移ります。
 *    記録は消さないので、あとから見返せます。
 *  ★名前を足すのに管理用PINは要りません（各店舗で入れるものなので）。
 * ============================================================ */

/** いま中身を開いている人の id（空なら一覧） */
let trainPerson = '';
/** 「終わった人」を開いているか */
let trainDoneOpen = false;

/** 一度だけ持ってくれば済むので、やった人を覚えておきます */
const trainCarried = new Set();

/**
 * その人の教育の記録（★人ごとに1行です。config.js の trainDayKey を見てください）
 *
 * 昔は1店舗を1行にまとめていたので、そこに入っているものがあれば
 * 一度だけ人ごとの行へ持ってきます。元の行は消しません。
 */
function trainItems(storeId, personId) {
  const items = Store.getDay(storeId, trainDayKey(personId)).items || {};
  const mark = `${storeId}/${personId}`;
  if (Object.keys(items).length || trainCarried.has(mark)) return items;

  trainCarried.add(mark);
  const old = Store.getDay(storeId, TRAIN_KEY).items || {};
  const head = `${personId}::`;
  let moved = 0;
  Object.keys(old).forEach((k) => {
    if (!k.startsWith(head)) return;
    Store.setItem(storeId, trainDayKey(personId), k.slice(head.length), old[k]);
    moved++;
  });
  if (!moved) return items;
  return Store.getDay(storeId, trainDayKey(personId)).items || {};
}

/** その人が終えた項目の数 */
function trainDoneCount(personId) {
  const items = trainItems(state.storeId, personId);
  return getTraining(state.storeId)
    .flatMap((sec) => sec.items)
    .filter((it) => (items[it.id] || {}).done)
    .length;
}

function renderTrain() {
  const people = Trainees.list(state.storeId);
  const total = trainTotal(state.storeId);

  // 開いていた人が一覧から消えていたら、一覧に戻します
  if (trainPerson && !people.some((p) => p.id === trainPerson)) trainPerson = '';

  el.trainList.classList.toggle('is-hidden', !!trainPerson);
  el.trainOne.classList.toggle('is-hidden', !trainPerson);

  if (trainPerson) renderTrainOne(trainPerson, total);
  else renderTrainList(people, total);
}

/* -------- 人の一覧 -------- */
function renderTrainList(people, total) {
  const going = [];
  const done = [];
  people.forEach((p) => {
    // ★人の名前は p.n です。数を n に入れると名前が消えるので、別の名前で持ちます
    const count = trainDoneCount(p.id);
    (total > 0 && count >= total ? done : going).push({ ...p, count });
  });

  el.trainCount.textContent = going.length ? `${going.length}人` : '';
  el.trainPeople.innerHTML = '';

  if (!going.length) {
    const none = document.createElement('p');
    none.className = 'cash-empty';
    none.textContent = people.length
      ? '教育中の人はいません。'
      : 'まだ誰も登録されていません。下から名前を足してください。';
    el.trainPeople.appendChild(none);
  }
  going.forEach((p) => el.trainPeople.appendChild(trainPersonRow(p, total, false)));

  el.trainDoneLabel.textContent = `終わった人（${done.length}人）`;
  el.trainDoneMark.textContent = trainDoneOpen ? '−' : '＋';
  el.trainDonePeople.classList.toggle('is-hidden', !trainDoneOpen);
  el.trainDonePeople.innerHTML = '';
  if (trainDoneOpen) {
    if (!done.length) {
      const none = document.createElement('p');
      none.className = 'cash-empty';
      none.textContent = 'まだいません。';
      el.trainDonePeople.appendChild(none);
    }
    done.forEach((p) => el.trainDonePeople.appendChild(trainPersonRow(p, total, true)));
  }
}

function trainPersonRow(p, total, isDone) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'train-person' + (isDone ? ' is-done' : '');
  const rate = total ? Math.round((p.count / total) * 100) : 0;

  // ★名前は textContent で入れます（記号が入っても画面が壊れないように）
  const name = document.createElement('span');
  name.className = 'train-person__name';
  name.textContent = p.n;
  row.appendChild(name);

  const bar = document.createElement('span');
  bar.className = 'train-person__bar';
  const fill = document.createElement('span');
  fill.className = 'train-person__fill';
  fill.style.width = `${rate}%`;
  bar.appendChild(fill);
  row.appendChild(bar);

  const num = document.createElement('span');
  num.className = 'train-person__num';
  num.textContent = isDone ? '✓ 終わり' : `${p.count} / ${total}`;
  row.appendChild(num);

  row.addEventListener('click', () => { trainPerson = p.id; render(); });
  return row;
}

/* -------- 1人分の中身 -------- */
function renderTrainOne(personId, total) {
  const person = Trainees.list(state.storeId).find((p) => p.id === personId);
  if (!person) { trainPerson = ''; return; }

  const items = trainItems(state.storeId, personId);
  const done = trainDoneCount(personId);

  el.trainOneName.textContent = person.n;
  el.trainOneBar.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
  el.trainOneCount.textContent = total
    ? (done >= total ? `${done} / ${total}　✓ 教育が終わりました` : `${done} / ${total}`)
    : '項目がまだありません。';

  el.trainSections.innerHTML = '';
  getTraining(state.storeId).forEach((sec) => {
    const card = document.createElement('div');
    card.className = 'cash-box';

    const head = document.createElement('div');
    head.className = 'cash-box__head';
    const title = document.createElement('h2');
    title.className = 'cash-box__title';
    title.textContent = sec.title;
    head.appendChild(title);
    const n = document.createElement('span');
    n.className = 'cash-box__date';
    const secDone = sec.items.filter((it) => (items[it.id] || {}).done).length;
    n.textContent = `${secDone} / ${sec.items.length}`;
    head.appendChild(n);
    card.appendChild(head);

    sec.items.forEach((it) => card.appendChild(trainItemRow(personId, it, items)));
    el.trainSections.appendChild(card);
  });
}

function trainItemRow(personId, item, items) {
  const on = !!(items[item.id] && items[item.id].done);

  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'train-item' + (on ? ' is-on' : '');
  row.setAttribute('aria-pressed', on ? 'true' : 'false');

  const box = document.createElement('span');
  box.className = 'train-item__box';
  box.textContent = on ? '✓' : '';
  row.appendChild(box);

  const body = document.createElement('span');
  body.className = 'train-item__body';
  const label = document.createElement('span');
  label.className = 'train-item__label';
  label.textContent = item.label;
  body.appendChild(label);
  if (item.hint) {
    const hint = document.createElement('span');
    hint.className = 'train-item__hint';
    hint.textContent = item.hint;
    body.appendChild(hint);
  }
  row.appendChild(body);

  row.addEventListener('click', () => {
    Store.setItem(state.storeId, trainDayKey(personId), item.id, { done: !on });
    render();
  });
  return row;
}

/**
 * その人を一覧から消す
 *
 * ★消すのは名前だけです。それまでのチェックはサーバーに残っていますが、
 *   同じ名前をもう一度足すと**別の人**として始まります（進み具合は最初から）。
 *   まちがえて消したときのために、そこも先に伝えておきます。
 */
async function removeTrainee() {
  const person = Trainees.list(state.storeId).find((p) => p.id === trainPerson);
  if (!person) return;

  const ok = await askConfirm({
    item: person.n,
    message: 'この人を教育の一覧から消します。'
      + 'もう一度足したときは、進み具合は最初からになります。',
    okLabel: '消す',
    danger: true,
  });
  if (!ok) return;

  Trainees.remove(state.storeId, person.id);
  trainPerson = '';
  render();
}

/* -------- 名前を足す・直す -------- */
function addTrainee() {
  const name = el.trainNewName.value.trim();
  if (!name) {
    el.trainAddMsg.textContent = '名前を入れてください。';
    return;
  }
  const made = Trainees.add(state.storeId, name);
  el.trainAddMsg.textContent = made ? '' : 'その名前は、もう入っています。';
  if (made) el.trainNewName.value = '';
  render();
}

/* ------------------------------------------------------------
 *  提出（全項目チェックで押せる）
 * ---------------------------------------------------------- */
function renderSubmit(closed, showList, dateStr, rec, items, done) {
  // 定休日で項目を出していない日は提出そのものが不要
  el.submitCard.classList.toggle('is-hidden', !showList);
  if (!showList) return;

  renderSyncWarn();

  const submitted = !!rec.submittedAt;
  const remain = items.length - done;
  const hasStaff = !!(rec.staff || '').trim();
  // 全項目チェック済み、かつ担当者を選んでいることが提出の条件です
  const canSubmit = items.length > 0 && remain === 0 && hasStaff;

  // 送っているあいだは、ボタンを引っこめて「送信中…」だけにします
  const sending = state.sending === `${state.storeId}/${dateStr}`;

  el.submitCard.classList.toggle('is-submitted', submitted && !sending);
  el.submitCard.classList.toggle('is-sending', sending);
  el.submitBtn.classList.toggle('is-hidden', submitted || sending);
  el.unsubmitBtn.classList.toggle('is-hidden', !submitted || sending);
  el.submitBtn.disabled = !canSubmit;

  if (sending) {
    el.submitStatus.innerHTML =
      '<span class="submit-card__sending"><span class="submit-card__spin"></span>送信中…</span>'
      + '<span class="submit-card__meta">みんなの端末に届くまで、この画面のままお待ちください</span>';
    return;
  }

  if (submitted) {
    const t = new Date(rec.submittedAt);
    el.submitStatus.innerHTML =
      `<span class="submit-card__mark">提出済み</span>` +
      `<span class="submit-card__meta">${t.getMonth() + 1}/${t.getDate()} ` +
      `${pad2(t.getHours())}:${pad2(t.getMinutes())}` +
      `${rec.submittedBy ? '　' + rec.submittedBy : ''}</span>`;
  } else if (canSubmit) {
    el.submitStatus.innerHTML = '<span class="submit-card__ready">全項目チェック済みです</span>';
  } else if (remain > 0) {
    el.submitStatus.innerHTML =
      `<span class="submit-card__remain">未チェックが残り ${remain} 項目あります</span>` +
      `<span class="submit-card__meta">すべてチェックして担当者を選ぶと提出できます</span>`;
  } else {
    el.submitStatus.innerHTML =
      '<span class="submit-card__remain">担当者が選ばれていません</span>' +
      '<span class="submit-card__meta">上の「担当者」から選ぶと提出できます</span>';
  }

  // 送れなかったときは、押したその場で分かるようにします
  // （上の帯にも出ますが、目は提出ボタンのあたりにあるためです）
  if (submitted && state.sendError && state.sendErrorKey === `${state.storeId}/${dateStr}`) {
    el.submitStatus.innerHTML +=
      `<span class="submit-card__failed">まだ送れていません：${state.sendError}<br>`
      + 'この端末には残っています。電波の届くところでアプリを開いておくと、自動で送られます。</span>';
  }
}

function submitDay() {
  const dateStr = ymd(state.y, state.m, state.d);
  const rec = Store.getDay(state.storeId, dateStr);
  const items = selectedDayItems();
  const remain = items.length - countDone(rec, items);
  // 念のため（ボタンは無効化済み）。担当者が未選択のときも提出しません
  if (remain > 0 || !(rec.staff || '').trim()) return;

  askConfirm({
    item: `${state.m}月${state.d}日の確認作業`,
    message: `${items.length}項目すべてのチェックが終わりました。担当者は ${rec.staff} さんです。提出しますか？`,
    okLabel: '提出する',
  }).then(async (ok) => {
    if (!ok) return;
    Store.submit(state.storeId, dateStr);
    await sendSubmit(`${state.storeId}/${dateStr}`);
  });
}

/**
 * 提出を送り切るまで「送信中…」を出す
 *
 * ★ふだんのチェックは待たせません（裏で送ります）。提出だけは、
 *   みんなの画面に出たことを見届けてから終わりにします。
 */
async function sendSubmit(key) {
  state.sending = key;
  state.sendError = '';
  render();

  const res = await Sync.waitSent();

  state.sending = '';
  state.sendError = res.ok ? '' : (res.error || '送れませんでした');
  state.sendErrorKey = res.ok ? '' : key;
  render();
}

function unsubmitDay() {
  const dateStr = ymd(state.y, state.m, state.d);
  askConfirm({
    item: `${state.m}月${state.d}日の提出`,
    message: '提出を取り消します。全店舗提出記録では「未提出」に戻ります。',
    okLabel: '取り消す',
    danger: true,
  }).then((ok) => {
    if (!ok) return;
    Store.unsubmit(state.storeId, dateStr);
    render();
  });
}

/* ------------------------------------------------------------
 *  店舗選択（アプリを開いて最初の画面）
 * ---------------------------------------------------------- */
function renderStorePicker() {
  const dateStr = ymd(state.y, state.m, state.d);
  const dow = new Date(state.y, state.m - 1, state.d).getDay();
  el.storesDate.textContent = `${state.m}月${state.d}日（${DOW[dow]}）の確認作業`;

  el.storeGrid.innerHTML = '';
  STORES.forEach((s) => {
    const closed = Closed.isClosed(s.id, state.y, state.m, state.d);
    const rec = Store.getDay(s.id, dateStr);

    let kind = 'todo', text = '未提出';
    if (closed) { kind = 'closed'; text = '定休日'; }
    else if (rec.submittedAt) { kind = 'done'; text = '提出済み'; }

    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'store-card store-card--' + kind;
    b.style.setProperty('--card-color', s.color);

    const chip = document.createElement('span');
    chip.className = 'logo-chip logo-chip--card';
    fillLogo(chip, s);

    const name = document.createElement('span');
    name.className = 'store-card__name';
    name.textContent = s.name;

    const status = document.createElement('span');
    status.className = 'store-card__status';
    status.textContent = text;

    b.appendChild(chip);
    b.appendChild(name);
    b.appendChild(status);
    b.addEventListener('click', () => {
      state.storeId = s.id;
      // 店舗を選んだら、その店舗の業務一覧へ。
      // 人によって入る店舗が変わるので、前回の続きには飛ばしません
      state.view = 'tasks';
      writeHash();
      render();
      window.scrollTo(0, 0);
    });
    li.appendChild(b);
    el.storeGrid.appendChild(li);
  });
}

/** 店舗選択画面に戻る */
function goHome() {
  state.storeId = '';
  state.view = 'stores';
  writeHash();
  render();
  window.scrollTo(0, 0);
}

/** 業務を選ぶ画面へ */
function goTasks() {
  state.view = 'tasks';
  writeHash();
  render();
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------
 *  業務選択（店舗を選んだあとの画面）
 *
 *  ただの入口ではなく、その店舗の「いまの状況」を並べています。
 *  ここを見れば、どの業務が残っているかが分かります。
 * ---------------------------------------------------------- */

/** 業務ごとの、その店舗のいまの状況 { text, kind } */
function taskStatus(taskId, storeId) {
  const dateStr = ymd(TODAY.y, TODAY.m, TODAY.d);

  if (taskId === 'day') {
    if (Closed.isClosed(storeId, TODAY.y, TODAY.m, TODAY.d)) return { text: '本日は定休日', kind: 'closed' };
    const rec = Store.getDay(storeId, dateStr);
    if (rec.submittedAt) return { text: '本日 提出済み', kind: 'done' };
    const items = getChecklist(storeId).flatMap((sec) =>
      sec.items.filter((it) => appliesTo(it, getStore(storeId), TODAY.y, TODAY.m, TODAY.d, sec)));
    const done = countDone(rec, items);
    return { text: `本日 ${done} / ${items.length}`, kind: 'todo' };
  }

  if (taskId === 'week') {
    const period = periodOfDate(TODAY.y, TODAY.m, TODAY.d);
    const st = periodStatus(storeId, period);
    if (!st.total) return { text: '項目なし', kind: 'none' };
    if (st.submittedAt) return { text: `提出済み ${st.rate}%`, kind: 'done' };
    const last = periodEndOf(period);
    const [, lm, ld] = last.split('-').map(Number);
    return { text: `${st.rate}%　提出 ${lm}/${ld}`, kind: 'todo' };
  }

  if (taskId === 'anytime') {
    const items = getAnytime(storeId);
    if (!items.length) return { text: '項目なし', kind: 'none' };
    // 期限が無い掃除なので、達成率ではなく「まだ一度も記録が無い数」を出します
    const rec = Store.getDay(storeId, ANYTIME_KEY);
    const never = items.filter((it) => !rec.items?.[it.id]?.at).length;
    return never
      ? { text: `${items.length}件　未記録 ${never}`, kind: 'todo' }
      : { text: `${items.length}件`, kind: 'none' };
  }

  if (taskId === 'cash') {
    if (Closed.isClosed(storeId, TODAY.y, TODAY.m, TODAY.d)) return { text: '本日は定休日', kind: 'closed' };
    const cash = cashOf(storeId, dateStr);
    return cash
      ? { text: `本日 ${cashText(cash.sales)}円`, kind: 'done' }
      : { text: '本日 まだ', kind: 'todo' };
  }

  if (taskId === 'train') {
    const people = Trainees.list(storeId);
    const total = trainTotal(storeId);
    // ★項目を先に見ます。項目が無いのに「みんな終わりました」と出すと嘘になります
    if (!total) return { text: '項目がまだ', kind: 'none' };
    if (!people.length) return { text: '名前がまだ', kind: 'none' };
    const all = getTraining(storeId).flatMap((sec) => sec.items);
    const going = people.filter((p) => {
      const items = trainItems(storeId, p.id);
      return all.filter((it) => (items[it.id] || {}).done).length < total;
    }).length;
    return going
      ? { text: `教育中 ${going}人`, kind: 'todo' }
      : { text: 'みんな終わりました', kind: 'done' };
  }

  if (taskId === 'month') {
    return { text: `${TODAY.m}月の一覧`, kind: 'none' };
  }
  return { text: '', kind: 'none' };
}

function renderTaskPicker() {
  const store = getStore(state.storeId);
  const dow = new Date(TODAY.y, TODAY.m - 1, TODAY.d).getDay();

  el.tasksTitle.textContent = store.name;
  el.tasksDate.textContent = `${TODAY.m}月${TODAY.d}日（${DOW[dow]}）　業務を選んでください`;

  el.taskGrid.innerHTML = '';
  taskList(store.id).forEach((task) => {
    const st = taskStatus(task.id, store.id);

    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'task-card task-card--' + st.kind;
    b.style.setProperty('--card-color', store.color);

    // 店舗カードのロゴにあたる場所。業務は絵文字で見分けます
    const icon = document.createElement('span');
    icon.className = 'task-card__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = task.icon || '';

    const main = document.createElement('span');
    main.className = 'task-card__main';
    const name = document.createElement('span');
    name.className = 'task-card__name';
    name.textContent = task.name;
    const sub = document.createElement('span');
    sub.className = 'task-card__sub';
    sub.textContent = task.sub || '';
    main.append(name, sub);

    const status = document.createElement('span');
    status.className = 'task-card__status';
    status.textContent = st.text;

    b.append(icon, main, status);
    b.addEventListener('click', () => {
      state.view = task.id;
      // 業務を開くときは今日に合わせる（別の店舗に入る日もあるため）
      state.y = TODAY.y; state.m = TODAY.m; state.d = TODAY.d;
      // ★シフトだけは「今日」ではなく「募集中の半月」を開きます。
      //   募集は先の半月にかけるものなので、今日の半月を開いてしまうと、
      //   出してもらった希望がどこにも見えません（実際そうなりました）
      if (task.id === 'shift') {
        const p = shiftFirstPeriod(state.storeId);
        state.y = p.y;
        state.m = p.m;
        state.d = p.half === 1 ? 1 : 16;
        shiftHalf = p.half;
      }
      writeHash();
      render();
      window.scrollTo(0, 0);
    });
    li.appendChild(b);
    el.taskGrid.appendChild(li);
  });
}

/* ------------------------------------------------------------
 *  立替金
 *
 *  お店ではなく「人」と「月」でまとめます。
 *  1件＝1つの項目として  _expense/2026-08  の中に入るので、
 *  同期の仕組み（スプレッドシート）はそのまま使えます。
 * ---------------------------------------------------------- */
/** いま見ている月の記録 */
function expenseRec() {
  return Store.getDay(EXPENSE_STORE, expenseMonthKey(state.y, state.m));
}

/**
 * いま何文字か（★マインだけに出します）
 *
 *  立替金は**1か月まるごとで1行**なので、件数が増えるほど1マスが太ります。
 *  5万文字を超えると、その月は**書けなくなります**（ほかの記録は無事です）。
 *
 * ★これは「測るだけ」です。上限は動きません。
 *   区切りを足すかどうかは、**実際の数字を見てから**決めます
 *   （9月から「渡した相手」が入るので、1件が何件に分かれるかは
 *     使ってみないと分かりません。2026-09-07 の時点では推測でした）。
 *
 * ★数え方はGASと同じです。あちらは記録まるごとを `JSON.stringify` して
 *   1マスに書くので、こちらも同じものを数えます。
 */
function renderExpenseSize() {
  const 箱 = el.expenseSize;
  if (!箱) return;
  // 現場のワークスには出しません。読んでも手の打ちようがない数字なので
  if (document.body.dataset.mode !== 'mine') {
    箱.classList.add('is-hidden');
    return;
  }
  let 文字数 = 0;
  try {
    文字数 = JSON.stringify(expenseRec()).length;
  } catch (e) {
    箱.classList.add('is-hidden');
    return;
  }
  const 余裕 = CELL_MAX / Math.max(文字数, 1);
  箱.classList.remove('is-hidden');
  箱.classList.toggle('is-near', 文字数 > CELL_SOFT);
  箱.textContent =
    `${文字数.toLocaleString()} / ${CELL_MAX.toLocaleString()} 文字`
    + `（余裕 ${余裕 >= 10 ? Math.round(余裕) : 余裕.toFixed(1)}倍）`
    + (文字数 > CELL_SOFT
      ? '　★4万文字を超えました。区切りを足す時期です'
      : '');
}

/** 1件分の明細だけ取り出す（精算済みの印は除く） */
function expenseEntries(rec) {
  const items = rec.items || {};
  return Object.keys(items)
    .filter((id) => !id.startsWith('paid:') && items[id] && items[id].yen)
    .map((id) => ({ id, ...items[id] }))
    .sort((a, b) => (a.d || '').localeCompare(b.d || '') || (a.at || '').localeCompare(b.at || ''));
}

/**
 * 人ごとにまとめる
 *
 * 並びは、クローズの担当者プルダウンと同じ順番です。
 * 月が変わっても同じ場所に同じ人がいる方が、探しやすいためです
 * （順番を変えたいときは、マネージの「担当者」で並べ替えます）。
 *
 * 立て替えが1件も無い人も、¥0 として行を出します。
 * 「この人はまだ入れていないのか、それとも本当に0円なのか」が
 * ひと目で分かるようにするためです（配達記録の表と同じ考え方）。
 *
 * 担当者リストに無い名前（辞めた方など）は、記録があるときだけ
 * 一番下に出ます。
 */
function expenseByPerson(rec) {
  const order = Staff.list();
  const map = new Map();
  order.forEach((name) => map.set(name, []));   // 0円の人も行を出すため、先に並べておく

  expenseEntries(rec).forEach((e) => {
    const name = e.by || '（名前なし）';
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(e);
  });
  const rank = (name) => {
    const i = order.indexOf(name);
    return i < 0 ? order.length : i;   // リストに無い人は下へ
  };

  return [...map.entries()]
    .map(([name, list]) => ({
      name,
      list,
      total: list.reduce((t, e) => t + (Number(e.yen) || 0), 0),
      paid: (rec.items || {})[expensePaidKey(name)] || null,
    }))
    // リストに無い人どうしは、金額の大きい順に並べます
    .sort((a, b) => rank(a.name) - rank(b.name) || b.total - a.total);
}

/* ------------------------------------------------------------
 *  キャッチの明細を1行にまとめる
 *
 *  キャッチは「1人に渡すごとに1件」入れるので、同じ日の同じ店舗で
 *  何人にも渡すと、明細が同じような行でうまってしまいます。
 *  そこで一覧では
 *
 *      日付 × 立て替えた人 × 店舗
 *
 *  を1行にまとめ、合計の人数と金額だけを出します。
 *  渡した相手は一覧には出さず、「明細」を押して開く画面で見ます
 *  （店舗が違えば、同じ日・同じ人でも別の行になります）。
 *
 *  キャッチ以外は、まとめる意味がないので1件が1行のままです。
 *  並びは、そのかたまりの 一番最初の1件があった場所です。
 * ---------------------------------------------------------- */

/** まとめるときの目じるし（日付・立て替えた人・店舗） */
function catchGroupKey(e) {
  return [e.d || '', e.by || '', e.store || ''].join('');
}

function catchGroups(list) {
  const map = new Map();
  const out = [];
  list.forEach((e) => {
    if (e.kind !== 'catch') {
      // キャッチ以外は、そのまま1件で1つのかたまりにします
      out.push({
        d: e.d || '', by: e.by || '', store: e.store || '',
        list: [e], people: 0, yen: Number(e.yen) || 0, isCatch: false,
      });
      return;
    }
    const key = catchGroupKey(e);
    let g = map.get(key);
    if (!g) {
      g = {
        d: e.d || '', by: e.by || '', store: e.store || '',
        list: [], people: 0, yen: 0, isCatch: true,
      };
      map.set(key, g);
      out.push(g);
    }
    g.list.push(e);
    g.people += Number(e.people) || 0;
    g.yen += Number(e.yen) || 0;
  });
  return out;
}

/**
 * まとめた行の領収書のしるし
 *   全部有り → ◯ ／ 全部無し → × ／ まざっている → △
 */
function groupReceipt(g) {
  const yes = g.list.filter((e) => e.receipt).length;
  if (yes === g.list.length) return { mark: '◯', none: false, title: '領収書あり' };
  if (yes === 0) return { mark: '×', none: true, title: '領収書なし' };
  return { mark: '△', none: true, title: `領収書あり ${yes}件／なし ${g.list.length - yes}件` };
}

function yenText(n) {
  return '¥' + (Number(n) || 0).toLocaleString('ja-JP');
}

/**
 * 金額を「¥ だけ小さく、数字は大きく」出す
 *
 * 帳簿らしい見え方にするためのものです。¥ を消してしまうと
 * 何の数字か分からなくなるので、消さずに控えめにしています。
 */
function yenMarkup(n) {
  return `<span class="yen-mark">¥</span>${(Number(n) || 0).toLocaleString('ja-JP')}`;
}

function renderExpense() {
  const rec = expenseRec();
  const people = expenseByPerson(rec);
  // 立て替えがあった人だけ。人数や未精算の数は、この人たちで数えます
  // （0円の人は「渡すものが無い」ので、精算のしようがありません）
  const paying = people.filter((p) => p.total > 0);
  const total = paying.reduce((t, p) => t + p.total, 0);
  const unpaid = paying.filter((p) => !(p.paid && p.paid.done));

  const unpaidYen = unpaid.reduce((t, p) => t + p.total, 0);

  el.expenseMonth.textContent = `${state.y}年${state.m}月`;

  /* ---- 表紙の数字 ---- */
  el.expenseTotalYen.innerHTML = yenMarkup(total);
  el.expenseUnpaidYen.innerHTML = yenMarkup(unpaidYen);
  el.expensePeople.innerHTML =
    `${paying.length}<span class="ledger-figure__unit">人</span>`;
  // 渡していない分が残っている月だけ、この数字に色を付けます
  el.expenseUnpaidBox.classList.toggle('is-on', unpaidYen > 0);
  // 数字を出しているので、下の一文は「記録がない」ときの案内だけにします
  el.expenseSummary.textContent = paying.length ? '' : 'この月の記録はまだありません。';
  el.expenseSummary.classList.toggle('is-hidden', paying.length > 0);
  renderExpenseSize();

  /* ---- 上の表：人ごとの合計と精算（スプレッドシートの「N月合計」） ---- */
  el.expenseTotalWrap.classList.toggle('is-hidden', people.length === 0);
  el.expenseTotals.innerHTML = '';
  people.forEach((p) => {
    const done = !!(p.paid && p.paid.done);
    const zero = p.total === 0;
    const tr = document.createElement('tr');
    if (done) tr.className = 'is-paid';
    else if (zero) tr.className = 'is-zero';   // 立て替えが無い人は色を落とす

    const name = document.createElement('td');
    name.className = 'exp-total__name';
    name.textContent = p.name;

    const yenTd = document.createElement('td');
    yenTd.className = 'exp-total__yen';
    if (zero) yenTd.textContent = '—';
    else yenTd.innerHTML = yenMarkup(p.total);

    const act = document.createElement('td');
    // 0円の人には精算ボタンを出しません（押しても渡すものがないため）
    if (!zero) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'exp-paid-btn' + (done ? ' is-done' : '');
      btn.textContent = done ? '済 ' + (shortDate(p.paid.at) || '') : '精算';
      btn.title = done ? '押すと精算をとり消します' : '現金を渡したら押します';
      btn.addEventListener('click', () => togglePaid(p));
      act.appendChild(btn);
    }

    tr.append(name, yenTd, act);
    el.expenseTotals.appendChild(tr);
  });

  /* ---- 一番下の合計行（帳簿の〆） ---- */
  el.expenseFoot.innerHTML = '';
  if (paying.length) {
    const tr = document.createElement('tr');
    tr.className = 'ledger-foot';
    tr.innerHTML =
      `<td class="exp-total__name">合計　<span class="ledger-foot__note">${paying.length}人</span></td>` +
      `<td class="exp-total__yen">${yenMarkup(total)}</td><td></td>`;
    el.expenseFoot.appendChild(tr);
  }

  /* ---- 下：人ごとの明細（立て替えがあった人だけ） ---- */
  el.expenseList.innerHTML = '';
  paying.forEach((p) => {
    const done = !!(p.paid && p.paid.done);
    // キャッチは「日付×店舗」でまとめます（立て替えた人はこのカードの人）
    const groups = catchGroups(p.list);
    const card = document.createElement('section');
    card.className = 'exp-card' + (done ? ' is-paid' : '');

    const head = document.createElement('div');
    head.className = 'exp-card__head';
    // 名前・件数・その人の合計。上の表を見に戻らなくても分かるようにします
    // 件数は「下に出ている行の数」です（キャッチはまとめた後の数になります）
    head.innerHTML =
      '<span class="exp-card__name"></span>' +
      `<span class="exp-card__count">${groups.length}件</span>` +
      `<span class="exp-card__total">${yenMarkup(p.total)}</span>`;
    head.querySelector('.exp-card__name').textContent = p.name;
    if (done) {
      const tag = document.createElement('span');
      tag.className = 'exp-card__paid';
      tag.textContent = '精算済み ' + (shortDate(p.paid.at) || '');
      head.appendChild(tag);
    }
    card.appendChild(head);

    const list = document.createElement('ul');
    list.className = 'exp-rows';
    groups.forEach((g) => {
      const e = g.list[0];
      const li = document.createElement('li');
      li.className = 'exp-row';
      const [, m, d] = (g.d || '').split('-');
      const receipt = groupReceipt(g);
      // キャッチは合計の人数で名前を作り直します（例：こじゃれキャッチ 63名）
      const label = g.isCatch
        ? expenseLabelOf('catch', g.store, g.people)
        : (e.label || '（項目なし）');
      li.innerHTML =
        `<span class="exp-row__date">${m ? `${+m}/${+d}` : '—'}</span>` +
        '<span class="exp-row__label"></span>' +
        `<span class="exp-row__receipt${receipt.none ? ' is-none' : ''}"` +
        ` title="${receipt.title}">${receipt.mark}</span>` +
        `<span class="exp-row__yen">${yenMarkup(g.yen)}</span>`;
      li.querySelector('.exp-row__label').textContent = label;
      /* ここには何件分かを添えていません。
         「こじゃれキャッチ 69名」だけで幅がいっぱいで、
         足すと iPhone の幅で名前ごと折り返してしまうためです。
         件数は「明細」を押すと、一番下の合計に出ます */

      if (g.isCatch) {
        // キャッチは渡した相手を一覧に出さないので、明細の画面で見て直します
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'row-edit';
        open.textContent = '明細';
        open.title = '渡した相手を見る・直す';
        open.addEventListener('click', () => openCatchDetail(g));
        li.appendChild(open);
      } else if (!done) {
        // 精算が済むまでは、間違えて入れたものを直したり消したりできます
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'row-edit';
        edit.textContent = '編集';
        edit.title = 'この1件を直す';
        edit.addEventListener('click', () => openExpenseForm(e));
        li.appendChild(edit);

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'exp-row__del';
        del.textContent = '×';
        del.title = 'この1件を消す';
        del.addEventListener('click', () => removeExpense(e));
        li.appendChild(del);
      }
      list.appendChild(li);
    });
    card.appendChild(list);
    el.expenseList.appendChild(card);
  });
}

async function togglePaid(p) {
  const key = expenseMonthKey(state.y, state.m);
  const done = !!(p.paid && p.paid.done);
  if (done) {
    const ok = await askConfirm({
      item: p.name,
      message: '精算済みをとり消します。よろしいですか？',
    });
    if (!ok) return;
    Store.setItem(EXPENSE_STORE, key, expensePaidKey(p.name), { done: false, by: '' });
  } else {
    const ok = await askConfirm({
      item: `${p.name}　${yenText(p.total)}`,
      message: `${state.m}月分を現金で渡したことにします。よろしいですか？`,
      okLabel: '渡した',
    });
    if (!ok) return;
    Store.setItem(EXPENSE_STORE, key, expensePaidKey(p.name), { done: true, by: p.name });
  }
  renderExpense();
  renderSyncStatus();
}

async function removeExpense(e) {
  const ok = await askConfirm({
    item: `${e.label}　${yenText(e.yen)}`,
    message: 'この1件を消します。よろしいですか？',
    okLabel: '消す',
    danger: true,
  });
  if (!ok) return;
  // 金額を0にすると一覧から外れます（消したことも同期で全端末に伝わります）
  Store.setItem(EXPENSE_STORE, expenseMonthKey(state.y, state.m), e.id, { yen: 0, done: false });
  renderLedger();
  renderSyncStatus();
}

/**
 * お金の一覧を出しなおす
 *
 * 現金支払い管理表とキャッチ集計は同じ記録を見ているので、
 * どちらから直しても、いま開いている方を出しなおします。
 */
function renderLedger() {
  if (state.view === 'catch') renderCatch();
  else renderExpense();
}

/* ---- 入力画面 ----
 *
 *  何も渡さなければ「新しく入れる」画面、
 *  一覧の「編集」から1件を渡すと「直す」画面になります。
 *  直したときは同じ番号に上書きするので、二重にはなりません。
 */
let expReceipt = true;
let expKind = '';     // 支払い項目の種類（parking / buy / catch / change / other）
let expStore = '';    // 買い出し・キャッチのときの店舗
let expEditing = null; // 直しているとき、その1件

/**
 * 「渡した相手」の選び方。店舗ごとにまとめて出します。
 * いま選んでいる店舗の人が一番上、そのあとに他店舗の人が続きます
 * （他店舗の子に渡すこともあるので、消さずに残しています）。
 */
function fillWhoOptions(who) {
  const map = CatchStaff.all();
  el.expWho.innerHTML = '<option value="">選んでください</option>';
  const order = pickableStores().map((x) => x.id)
    .sort((a, b) => (b === expStore ? 1 : 0) - (a === expStore ? 1 : 0));
  const known = [];
  order.forEach((id) => {
    const names = map[id] || [];
    if (!names.length) return;
    const g = document.createElement('optgroup');
    g.label = getStore(id).name;
    names.forEach((n) => {
      const o = document.createElement('option');
      o.value = n; o.textContent = n;
      g.appendChild(o);
      known.push(n);
    });
    el.expWho.appendChild(g);
  });
  const other = document.createElement('option');
  other.value = CATCH_OTHER;
  other.textContent = 'その他（名前を書く）';
  el.expWho.appendChild(other);
  el.expWho.value = (who && known.includes(who)) ? who : (who ? CATCH_OTHER : '');
}

function openExpenseForm(entry) {
  expEditing = entry || null;
  el.expDate.value = expEditing ? expEditing.d : ymd(TODAY.y, TODAY.m, TODAY.d);
  el.expLabel.value = '';
  el.expYen.value = expEditing ? expEditing.yen : '';
  el.expPeople.value = expEditing && expEditing.people ? expEditing.people : '';

  /* 渡した相手（キャッチのとき）。リストに無い人は「その他」で名前を書きます */
  const who = expEditing ? (expEditing.who || '') : '';
  fillWhoOptions(who);
  el.expWhoFree.value = el.expWho.value === CATCH_OTHER ? who : '';
  el.expenseError.textContent = '';
  expReceipt = expEditing ? !!expEditing.receipt : true;
  expKind = expEditing ? (expEditing.kind || '') : '';
  expStore = expEditing ? (expEditing.store || '') : '';
  // 「その他」は内容を自由に書いているので、その文字も戻します
  if (expEditing && getExpenseKind(expKind) && getExpenseKind(expKind).free) {
    el.expLabel.value = expEditing.label || '';
  }
  renderReceiptSeg();

  el.expenseFormTitle.textContent = expEditing ? '記録を直す' : '立て替えを記録する';
  el.expenseSave.textContent = expEditing ? '直す' : '記録する';

  const names = Staff.list();
  // 担当者リストから消された人の記録を直すときも、その名前を残しておきます
  if (expEditing && expEditing.by && !names.includes(expEditing.by)) names.push(expEditing.by);
  el.expBy.innerHTML = '<option value="">選んでください</option>';
  names.forEach((n) => {
    const o = document.createElement('option');
    o.value = n;
    o.textContent = n;
    el.expBy.appendChild(o);
  });
  if (expEditing) el.expBy.value = expEditing.by || '';

  /* 支払い項目のボタン */
  el.expChips.innerHTML = '';
  EXPENSE_KINDS.forEach((kind) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'exp-chip';
    b.dataset.kind = kind.id;
    b.textContent = kind.name;
    b.addEventListener('click', () => { expKind = kind.id; renderExpenseForm(); });
    el.expChips.appendChild(b);
  });

  /* 店舗のボタン（買い出し・キャッチのときだけ出ます）
     まいと（CATCH_ONLY_STORES）は買い出しには出しません。
     お店ではないので、そこへ買い出しに行くことがないためです */
  el.expStores.innerHTML = '';
  pickableStores().forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'exp-chip';
    b.dataset.store = s.id;
    if (CATCH_ONLY_STORES.some((x) => x.id === s.id)) b.dataset.catchOnly = '1';
    // 選んだときは、その店舗の色にします（一覧の店舗カードと同じ色）
    b.style.setProperty('--pick-color', s.color);
    // 略さない名前を出します（「おいでん」ではなく「おいでんテラス」）
    b.textContent = s.name;
    b.addEventListener('click', () => {
      expStore = s.id;
      fillWhoOptions(el.expWho.value === CATCH_OTHER ? el.expWhoFree.value : el.expWho.value);
      renderExpenseForm();
    });
    el.expStores.appendChild(b);
  });

  renderExpenseForm();
  el.expenseModal.classList.remove('is-hidden');
}

/** 選んだ項目に合わせて、下の入力欄を出し入れします */
function renderExpenseForm() {
  const kind = getExpenseKind(expKind);
  const isCatch = !!(kind && kind.who);
  [...el.expChips.children].forEach((b) => b.classList.toggle('is-on', b.dataset.kind === expKind));

  // まいとはキャッチのときだけ出します。買い出しに切り替えたら、
  // 選んだままにならないよう外します（見えないものが選ばれている状態を作らない）
  [...el.expStores.children].forEach((b) => {
    const only = b.dataset.catchOnly === '1';
    b.classList.toggle('is-hidden', only && !isCatch);
    if (only && !isCatch && expStore === b.dataset.store) expStore = '';
    b.classList.toggle('is-on', b.dataset.store === expStore);
  });

  /* 渡した相手は9月分から。8月までは人数と金額だけで記録できます */
  const whoOn = isCatch && catchWhoNeeded(el.expDate.value);
  el.expStoreField.classList.toggle('is-hidden', !(kind && kind.store));
  el.expPeopleField.classList.toggle('is-hidden', !(kind && kind.people));
  el.expWhoField.classList.toggle('is-hidden', !whoOn);
  el.expWhoNote.classList.toggle('is-hidden', !(isCatch && !whoOn));
  if (isCatch && !whoOn) el.expWhoNote.innerHTML = catchWhoNoteText();
  el.expFreeField.classList.toggle('is-hidden', !(kind && kind.free));
  el.expWhoFree.classList.toggle('is-hidden', el.expWho.value !== CATCH_OTHER);
}

function renderReceiptSeg() {
  [...el.expReceiptSeg.querySelectorAll('.seg__btn')].forEach((b) => {
    b.classList.toggle('is-on', (b.dataset.receipt === '1') === expReceipt);
  });
}

function saveExpense() {
  const d = el.expDate.value;
  const by = el.expBy.value;
  const kind = getExpenseKind(expKind);
  // 全角で入っていても読めるよう、ここでも半角に直してから数字にします
  const people = Math.round(Number(toHalfWidthNumber(el.expPeople.value)));
  const y = Math.round(Number(toHalfWidthNumber(el.expYen.value)));
  const label = expenseLabelOf(expKind, expStore, people, el.expLabel.value);
  const who = el.expWho.value === CATCH_OTHER ? el.expWhoFree.value.trim() : el.expWho.value;

  if (!d) { el.expenseError.textContent = '支払った日を入れてください。'; return; }
  if (!by) { el.expenseError.textContent = '立て替えた人を選んでください。'; return; }
  if (!kind) { el.expenseError.textContent = '支払い項目を選んでください。'; return; }
  if (kind.store && !expStore) { el.expenseError.textContent = 'どの店舗かを選んでください。'; return; }
  if (kind.people && (!people || people <= 0)) { el.expenseError.textContent = '人数を入れてください。'; return; }
  // 渡した相手は9月分から。8月までは人数と金額だけで記録できます
  if (kind.who && catchWhoNeeded(d) && !who) {
    el.expenseError.textContent = '渡した相手を選んでください。';
    return;
  }
  if (!label) { el.expenseError.textContent = '内容を入れてください。'; return; }
  if (!y || y <= 0) { el.expenseError.textContent = '金額を入れてください。'; return; }

  // 入れ先は「支払った日の月」。月をまたいで入れても、正しい月に入ります
  const [yy, mm] = d.split('-').map(Number);
  const key = expenseMonthKey(yy, mm);
  const id = expEditing ? expEditing.id
    : 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // 直すときに日付を別の月へ動かした場合は、元の月から取り除いてから移します
  if (expEditing) {
    const from = expenseMonthKey(state.y, state.m);
    if (from !== key) Store.setItem(EXPENSE_STORE, from, id, { yen: 0, done: false });
  }

  Store.setItem(EXPENSE_STORE, key, id, {
    done: true, d, by, label, yen: y, receipt: expReceipt,
    // あとから店舗ごとに集計できるよう、選んだ内容もそのまま残します
    kind: expKind, store: expStore || '', people: kind.people ? people : 0,
    who: kind.who ? who : '',
  });

  // 入れた月を表示する（先月分を入れたときも、その場で確かめられます）
  state.y = yy;
  state.m = mm;
  el.expenseModal.classList.add('is-hidden');
  writeHash();
  renderLedger();
  renderSyncStatus();
}

/* ------------------------------------------------------------
 *  キャッチ集計
 *
 *  現金支払い管理表に入れた「キャッチ」だけを取り出して、
 *  その月に 店舗ごとで 何人つれてきて いくら払ったか を出します。
 * ---------------------------------------------------------- */
function catchByStore() {
  const entries = expenseEntries(expenseRec()).filter((e) => e.kind === 'catch');

  const map = new Map();
  const add = (id) => {
    if (!map.has(id)) map.set(id, { id, list: [], people: 0, yen: 0 });
    return map.get(id);
  };
  catchStoreIds().forEach(add);              // 0人の月でも行を出すため、先に並べておく
  entries.forEach((e) => {
    const row = add(e.store || '');
    row.list.push(e);
    row.people += Number(e.people) || 0;
    row.yen += Number(e.yen) || 0;
  });

  return [...map.values()].filter((r) => r.id || r.list.length);
}

/* ------------------------------------------------------------
 *  キャッチのランキング
 *
 *  「誰に いくら渡したか」で数えます。相手は現金支払い管理表の
 *  キャッチの記録に入っている who です。
 * ---------------------------------------------------------- */

/** ランキングを「この月」で見るか「すべて」で見るか */
let rankRange = 'near';
/** 店舗でしぼる（空なら全店舗＝会社全部） */
let rankFilter = '';

/** キャッチの記録を集めます（すべてのときは、入っている月を全部読みます） */
function catchEntriesFor(range) {
  if (range !== 'all') {
    return expenseEntries(expenseRec()).filter((e) => e.kind === 'catch');
  }
  const dump = Store.adapter.dump();
  const out = [];
  Object.keys(dump).forEach((key) => {
    if (!key.startsWith(EXPENSE_STORE + '/')) return;
    const items = (dump[key] || {}).items || {};
    Object.keys(items).forEach((id) => {
      const v = items[id];
      if (v && v.yen && v.kind === 'catch') out.push({ id, ...v });
    });
  });
  return out;
}

/** 人ごとに足して、金額の多い順に並べます */
function catchRanking(range, storeId) {
  const map = new Map();
  catchEntriesFor(range)
    .filter((e) => !storeId || e.store === storeId)
    .forEach((e) => {
      const name = (e.who || '').trim() || '（相手なし）';
      if (!map.has(name)) map.set(name, { name, people: 0, yen: 0, count: 0 });
      const r = map.get(name);
      r.people += Number(e.people) || 0;
      r.yen += Number(e.yen) || 0;
      r.count += 1;
    });
  return [...map.values()].sort((a, b) => b.yen - a.yen || b.people - a.people
    || a.name.localeCompare(b.name, 'ja'));
}

/* 円グラフと帯の色。上位8人まで色を分けて、それより下は灰色にまとめます。
   明るい画面でも暗い画面でも読める明るさにそろえてあります */
const RANK_COLORS = ['#2f9e6e', '#3d7fd6', '#e0892c', '#9a63cf', '#d1566d',
  '#2fa3b5', '#8c9a35', '#b4713f'];
const RANK_REST_COLOR = '#98a2ac';
const RANK_TOP = 8;

function rankColor(i) { return i < RANK_TOP ? RANK_COLORS[i] : RANK_REST_COLOR; }

/** 円グラフに出す名前。長すぎると絵からはみ出すので、みじかくします */
function rankShortName(name) {
  return name.length > 6 ? `${name.slice(0, 5)}…` : name;
}

/** 金額の割合を、まんなかに合計を出した円グラフ（ドーナツ）にします */
function renderRankPie(list, total) {
  el.rankPie.classList.toggle('is-hidden', !total);
  if (!total) { el.rankPieBox.innerHTML = ''; return; }

  // 上位8人はそのまま。9人目からは「ほか」にひとまとめ
  const parts = list.slice(0, RANK_TOP).map((r, i) => ({
    name: r.name, yen: r.yen, color: RANK_COLORS[i],
  }));
  const restYen = list.slice(RANK_TOP).reduce((t, r) => t + r.yen, 0);
  if (restYen) {
    parts.push({ name: `ほか${list.length - RANK_TOP}人`, yen: restYen, color: RANK_REST_COLOR });
  }

  /* 輪のかたち。まわりに名前を出すので、横長の絵にしています */
  const VW = 220, VH = 158;                 // 絵ぜんたいの大きさ
  const CX = 110, CY = 79;                  // 輪のまんなか
  const R = 46, BAND = 17;                  // 半径と、輪の太さ
  const OUT = R + BAND / 2;                 // 輪の外がわ
  const C = 2 * Math.PI * R;
  const gap = parts.length > 1 ? C * 0.008 : 0;   // 色と色のあいだの細いすき間

  let acc = 0;
  const marks = [];
  const arcs = parts.map((p) => {
    const f = p.yen / total;
    // その色のまん中の向き（12時から時計まわり）
    marks.push({ ...p, f, mid: (acc + f / 2) * 2 * Math.PI - Math.PI / 2 });
    const len = f * C;
    const draw = Math.max(len - gap, 0.6);
    const off = -acc * C;
    acc += f;
    return `<circle class="rank-pie__arc" cx="${CX}" cy="${CY}" r="${R}" stroke="${p.color}"
        stroke-width="${BAND}"
        stroke-dasharray="${draw.toFixed(2)} ${(C - draw).toFixed(2)}"
        stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${CX} ${CY})"></circle>`;
  }).join('');

  /* ---- まわりに出す名前。細すぎる色は出しません（重なって読めなくなるため） ---- */
  const labels = marks.filter((m) => m.f >= 0.015);
  const right = [], left = [];
  labels.forEach((m) => {
    m.dir = Math.cos(m.mid) >= 0 ? 1 : -1;
    m.y0 = CY + (OUT + 7) * Math.sin(m.mid);
    (m.dir > 0 ? right : left).push(m);
  });
  // 上から順にならべ、近すぎるものは下へずらして重なりを防ぎます
  const STEP = 12, TOP = 11, BOTTOM = VH - 9;
  [right, left].forEach((side) => {
    side.sort((a, b) => a.y0 - b.y0);
    let y = TOP;
    side.forEach((m) => { m.y = Math.max(m.y0, y); y = m.y + STEP; });
    const over = side.length ? side[side.length - 1].y - BOTTOM : 0;
    if (over > 0) side.forEach((m) => { m.y = Math.max(m.y - over, TOP); });
  });

  const leads = labels.map((m) => {
    const x0 = CX + OUT * Math.cos(m.mid), y0 = CY + OUT * Math.sin(m.mid);
    const x1 = CX + (OUT + 6) * Math.cos(m.mid), y1 = CY + (OUT + 6) * Math.sin(m.mid);
    const lx = CX + m.dir * 64;
    return `<polyline class="rank-pie__lead" stroke="${m.color}"
        points="${x0.toFixed(1)},${y0.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)} `
      + `${(lx - m.dir * 4).toFixed(1)},${m.y.toFixed(1)}"></polyline>`;
  }).join('');

  const texts = labels.map((m) => {
    const nm = rankShortName(m.name);
    // 長い名前は少し小さくして、絵からはみ出さないようにします
    const fs = nm.length >= 6 ? 5.2 : nm.length >= 5 ? 6 : 7;
    const lx = CX + m.dir * 64;
    return `<text class="rank-pie__label" x="${lx}" y="${(m.y + 2.4).toFixed(1)}"
        text-anchor="${m.dir > 0 ? 'start' : 'end'}" style="font-size:${fs}px">`
      + '<tspan class="rank-pie__labelName"></tspan>'
      + `<tspan class="rank-pie__labelPct" dx="2.5" style="font-size:${(fs * 0.82).toFixed(1)}px">`
      + `${Math.round(m.f * 100)}%</tspan></text>`;
  }).join('');

  const people = list.reduce((t, r) => t + r.people, 0);
  // まんなかの金額は、けたが増えたら小さくして輪からはみ出さないようにします
  const fs = total >= 10000000 ? 9 : total >= 1000000 ? 10.5 : 12;
  el.rankPieBox.innerHTML = `
    <svg class="rank-pie__svg" viewBox="0 0 ${VW} ${VH}" role="img"
         aria-label="渡した相手ごとの金額の割合">
      <circle class="rank-pie__hole" cx="${CX}" cy="${CY}" r="${R}"
              stroke-width="${BAND}"></circle>
      ${arcs}
      ${leads}
      ${texts}
      <text class="rank-pie__yen" x="${CX}" y="${CY - 1}" style="font-size:${fs}px">¥${total.toLocaleString('ja-JP')}</text>
      <text class="rank-pie__people" x="${CX}" y="${CY + 10}">${people.toLocaleString('ja-JP')}名</text>
    </svg>`;

  // 名前はそのまま入れると危ないので、DOMで入れます
  [...el.rankPieBox.querySelectorAll('.rank-pie__labelName')].forEach((t, i) => {
    t.textContent = rankShortName(labels[i].name);
  });
  // マウスを乗せると、正しい名前と割合が出ます
  [...el.rankPieBox.querySelectorAll('.rank-pie__arc')].forEach((c, i) => {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    t.textContent = `${parts[i].name}　${((parts[i].yen / total) * 100).toFixed(1)}%`;
    c.appendChild(t);
  });
}

function renderCatchRank() {
  const all = catchRanking(rankRange, '');
  const list = catchRanking(rankRange, rankFilter);

  el.rankCount.textContent = list.length ? `（${list.length}人）` : '';

  /* ---- 店舗でしぼるボタン ---- */
  el.rankFilter.innerHTML = '';
  const chip = (id, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'exp-chip' + (rankFilter === id ? ' is-on' : '');
    b.dataset.store = id;
    if (id) b.style.setProperty('--pick-color', getStore(id).color);
    b.textContent = label;
    b.addEventListener('click', () => { rankFilter = id; renderCatchRank(); });
    el.rankFilter.appendChild(b);
  };
  chip('', '全店舗');
  catchStoreIds().forEach((id) => chip(id, getStore(id).name));

  /* ---- 順位 ---- */
  el.rankRows.innerHTML = '';
  if (!list.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td class="exp-total__name" colspan="5">キャッチの記録がありません。</td>';
    el.rankRows.appendChild(tr);
    el.rankFoot.innerHTML = '';
    renderRankPie([], 0);
    return;
  }

  const total = list.reduce((t, r) => t + r.yen, 0);

  // 金額が同じなら同じ順位にします
  let rank = 0, prev = null;
  list.forEach((r, i) => {
    if (prev === null || r.yen !== prev) rank = i + 1;
    prev = r.yen;

    const tr = document.createElement('tr');
    if (rank <= 3) tr.classList.add('is-top', 'is-top' + rank);

    const no = document.createElement('td');
    no.className = 'rank-no';
    no.textContent = rank;

    const name = document.createElement('td');
    name.className = 'exp-total__name rank-name';
    const dot = document.createElement('span');
    dot.className = 'rank-dot';
    dot.style.background = rankColor(i);
    name.append(dot, document.createTextNode(r.name));

    const people = document.createElement('td');
    people.className = 'exp-total__yen';
    people.innerHTML = r.people ? `${r.people.toLocaleString('ja-JP')}<span class="ledger-unit">名</span>` : '—';

    const yen = document.createElement('td');
    yen.className = 'exp-total__yen';
    yen.innerHTML = yenMarkup(r.yen);

    /* 帯の長さ＝全体に占める割合。表の右にあく場所を、この帯でうめます */
    const pct = total ? (r.yen / total) * 100 : 0;
    const share = document.createElement('td');
    share.className = 'rank-share';
    share.innerHTML = '<span class="rank-share__in">'
      + `<span class="rank-bar"><i style="width:${pct.toFixed(1)}%;`
      + `background:${rankColor(i)}"></i></span>`
      + `<b class="rank-pct">${pct.toFixed(1)}<span class="ledger-unit">%</span></b></span>`;

    tr.append(no, name, people, yen, share);
    el.rankRows.appendChild(tr);
  });

  /* ---- 合計 ---- */
  const people = list.reduce((t, r) => t + r.people, 0);
  el.rankFoot.innerHTML =
    '<tr class="ledger-foot"><td class="exp-total__name" colspan="2">合計</td>'
    + `<td class="exp-total__yen">${people.toLocaleString('ja-JP')}<span class="ledger-unit">名</span></td>`
    + `<td class="exp-total__yen">${yenMarkup(total)}</td>`
    + '<td class="rank-share"><span class="rank-share__in"><b class="rank-pct">100'
    + '<span class="ledger-unit">%</span></b></span></td></tr>';

  renderRankPie(list, total);

  // 全店舗の人数と合わないときは、しぼっていることが分かるようにします
  el.rankNote.classList.toggle('is-hidden', !all.length);
}

function renderCatch() {
  renderCatchRank();
  const rows = catchByStore();
  const people = rows.reduce((t, r) => t + r.people, 0);
  const total = rows.reduce((t, r) => t + r.yen, 0);

  el.catchMonth.textContent = `${state.y}年${state.m}月`;
  el.catchPeopleTotal.innerHTML = `${people}<span class="ledger-figure__unit">名</span>`;
  el.catchYenTotal.innerHTML = yenMarkup(total);
  el.catchSummary.textContent = people ? '' : 'この月のキャッチの記録はまだありません。';
  el.catchSummary.classList.toggle('is-hidden', people > 0);

  el.catchTotals.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    if (!r.people) tr.className = 'is-zero';   // 0人の店舗は色を落とす

    const name = document.createElement('td');
    name.className = 'exp-total__name';
    name.textContent = r.id ? getStore(r.id).name : '（店舗なし）';
    // 店舗の色を細い帯で添えます（一覧画面の店舗カードと同じ色）
    if (r.id && r.people) tr.style.setProperty('--row-color', getStore(r.id).color);

    const p = document.createElement('td');
    p.className = 'exp-total__yen';
    p.innerHTML = r.people ? `${r.people}<span class="ledger-unit">名</span>` : '—';

    const y = document.createElement('td');
    y.className = 'exp-total__yen';
    y.innerHTML = r.yen ? yenMarkup(r.yen) : '—';

    tr.append(name, p, y);
    el.catchTotals.appendChild(tr);
  });

  /* ---- 一番下の合計行 ---- */
  el.catchFoot.innerHTML = '';
  if (people) {
    const tr = document.createElement('tr');
    tr.className = 'ledger-foot';
    tr.innerHTML =
      '<td class="exp-total__name">合計</td>' +
      `<td class="exp-total__yen">${people}<span class="ledger-unit">名</span></td>` +
      `<td class="exp-total__yen">${yenMarkup(total)}</td>`;
    el.catchFoot.appendChild(tr);
  }

  /* ---- 店舗ごとの明細 ---- */
  el.catchList.innerHTML = '';
  rows.filter((r) => r.list.length).forEach((r) => {
    // 同じ日に同じ人が立て替えた分は1行にまとめます（店舗はこのカードの店舗）
    const groups = catchGroups(r.list);
    const card = document.createElement('section');
    card.className = 'exp-card';
    // 左の帯と店舗名の色。一覧画面の店舗カードと同じ色を使います
    if (r.id) card.style.setProperty('--card-color', getStore(r.id).color);

    const head = document.createElement('div');
    head.className = 'exp-card__head';
    head.innerHTML =
      '<span class="exp-card__name"></span>' +
      `<span class="exp-card__count">${r.people}名</span>` +
      `<span class="exp-card__total">${yenMarkup(r.yen)}</span>`;
    head.querySelector('.exp-card__name').textContent = r.id ? getStore(r.id).name : '（店舗なし）';
    card.appendChild(head);

    const list = document.createElement('ul');
    list.className = 'exp-rows';
    groups.forEach((g) => {
      const li = document.createElement('li');
      li.className = 'exp-row';
      const [, m, d] = (g.d || '').split('-');
      li.innerHTML =
        `<span class="exp-row__date">${m ? `${+m}/${+d}` : '—'}</span>` +
        '<span class="exp-row__label"></span>' +
        `<span class="exp-row__yen">${yenMarkup(g.yen)}</span>`;
      // 人数 → 立て替えた人 の順に出します（渡した相手は「明細」の中）
      const labelEl = li.querySelector('.exp-row__label');
      labelEl.textContent = `${g.people}名${g.by ? '　立替 ' + g.by : ''}`;

      // こちらは名前が短いので、何件分かを添えても折り返しません
      if (g.list.length > 1) {
        const n = document.createElement('span');
        n.className = 'exp-row__n';
        n.textContent = `${g.list.length}件`;
        labelEl.appendChild(n);
      }

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'row-edit';
      open.textContent = '明細';
      open.title = '渡した相手を見る・直す';
      open.addEventListener('click', () => openCatchDetail(g));
      li.appendChild(open);

      list.appendChild(li);
    });
    card.appendChild(list);
    el.catchList.appendChild(card);
  });
}

/* ------------------------------------------------------------
 *  キャッチの明細（まとめた1行の中身）
 *
 *  一覧では「日付 × 立て替えた人 × 店舗」で1行にまとめているので、
 *  誰にいくら渡したかは、この画面で見て、1件ずつ直します。
 * ---------------------------------------------------------- */

/** いま開いているかたまり。{ d, by, store } */
let catchDetail = null;

function openCatchDetail(g) {
  catchDetail = { d: g.d, by: g.by, store: g.store };
  renderCatchDetail();
  el.catchDetailModal.classList.remove('is-hidden');
}

function closeCatchDetail() {
  catchDetail = null;
  el.catchDetailModal.classList.add('is-hidden');
}

/** 「8/6（水）」のかたち */
function catchDetailDate(str) {
  const [y, m, d] = (str || '').split('-').map(Number);
  if (!y || !m || !d) return '日付なし';
  return `${m}/${d}（${DOW[new Date(y, m - 1, d).getDay()]}）`;
}

/**
 * 中身を出す
 *
 * 開いたまま直したり消したりできるので、そのつど数えなおします。
 * 全部消して空になったら、この画面は閉じます。
 */
function renderCatchDetail() {
  if (!catchDetail) return;
  const { d, by, store } = catchDetail;
  const rec = expenseRec();
  const list = expenseEntries(rec).filter((e) => e.kind === 'catch'
    && (e.d || '') === d && (e.by || '') === by && (e.store || '') === store);
  if (!list.length) { closeCatchDetail(); return; }

  const people = list.reduce((t, e) => t + (Number(e.people) || 0), 0);
  const yen = list.reduce((t, e) => t + (Number(e.yen) || 0), 0);
  // 精算が済んだ月の分は、金額が変わってしまうと困るので直せなくします
  const paid = (rec.items || {})[expensePaidKey(by)];
  const locked = !!(paid && paid.done);

  /* 見出し：いつ・どの店舗・誰が立て替えたか */
  el.catchDetailHead.textContent =
    `${catchDetailDate(d)}　${store ? getStore(store).name : '（店舗なし）'}　立替 ${by || '（名前なし）'}`;
  // 店舗の色を細い帯で添えます（キャッチ集計のカードと同じ色）
  el.catchDetailHead.style.setProperty('--card-color', store ? getStore(store).color : 'var(--money)');

  /* 1件ずつ：渡した相手・人数・金額 */
  el.catchDetailList.innerHTML = '';
  list.forEach((e) => {
    const li = document.createElement('li');
    li.className = 'catch-detail__row';
    li.innerHTML =
      '<span class="catch-detail__who"></span>' +
      `<span class="catch-detail__people">${Number(e.people) || 0}<span class="ledger-unit">名</span></span>` +
      `<span class="catch-detail__yen">${yenMarkup(e.yen)}</span>`;
    li.querySelector('.catch-detail__who').textContent = (e.who || '').trim() || '（相手なし）';

    if (!locked) {
      const act = document.createElement('span');
      act.className = 'catch-detail__act';

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'row-edit';
      edit.textContent = '直す';
      edit.title = 'この1件を直す';
      edit.addEventListener('click', () => {
        closeCatchDetail();
        openExpenseForm(e);
      });
      act.appendChild(edit);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'exp-row__del';
      del.textContent = '×';
      del.title = 'この1件を消す';
      del.addEventListener('click', async () => {
        await removeExpense(e);
        renderCatchDetail();   // 消したあとの中身を出しなおす
      });
      act.appendChild(del);

      li.appendChild(act);
    }
    el.catchDetailList.appendChild(li);
  });

  /* 一番下の合計。ボタンの場所は空のまま置いて、金額の位置をそろえます */
  el.catchDetailFoot.innerHTML =
    `<span class="catch-detail__who">合計　<span class="ledger-foot__note">${list.length}件</span></span>` +
    `<span class="catch-detail__people">${people}<span class="ledger-unit">名</span></span>` +
    `<span class="catch-detail__yen">${yenMarkup(yen)}</span>` +
    (locked ? '' : '<span class="catch-detail__act"></span>');

  el.catchDetailNote.textContent = locked
    ? '精算が済んでいるので、直したり消したりはできません。'
    : '';
  el.catchDetailNote.classList.toggle('is-hidden', !locked);
}

/* ============================================================
 *  精算履歴（経理担当だけ・T3 Works Mine にしか出しません）
 *
 *  その月分をまとめて会社の口座から払った記録です。
 *  金額はここでは持たず、現金支払い管理表から毎回計算します。
 *  スプレッドシートで  ='1月'!C17  と参照していたのと同じで、
 *  あとから明細を直せば、この表の金額も勝手に付いてきます。
 * ============================================================ */

/** その月の立替の合計（現金支払い管理表の合計と同じ数字） */
function expenseTotalOf(y, m) {
  const rec = Store.getDay(EXPENSE_STORE, expenseMonthKey(y, m));
  return expenseEntries(rec).reduce((t, e) => t + (Number(e.yen) || 0), 0);
}

/** その月の精算（まだなら null） */
function settleOf(y, m) {
  const rec = Store.getDay(EXPENSE_STORE, expenseMonthKey(y, m));
  const s = (rec.items || {})[SETTLE_KEY];
  return s && s.d ? s : null;
}

/**
 * 精算日と出金口座を入れられる状態か
 *
 * 経理担当も現場の T3 Works を使うので、この画面は誰でも開けます。
 * そのかわり、ひらいた直後は必ず「見るだけ」にしておき、
 * 🔒 をわざと押したときだけ入力できるようにします。
 * 画面を出入りすると false に戻ります（触りっぱなしを防ぐため）。
 */
let settleUnlocked = false;

/** 1年12か月分の行 */
function settleRows(y) {
  const rows = [];
  for (let m = 1; m <= 12; m++) {
    rows.push({ y, m, yen: expenseTotalOf(y, m), settle: settleOf(y, m) });
  }
  return rows;
}

function renderSettle() {
  const rows = settleRows(state.y);
  const total = rows.reduce((t, r) => t + r.yen, 0);
  const first = rows.slice(0, 6).reduce((t, r) => t + r.yen, 0);   // 上半期
  const last = rows.slice(6).reduce((t, r) => t + r.yen, 0);       // 下半期
  // 金額があるのに精算日が入っていない月＝まだ払っていない月
  const yet = rows.filter((r) => r.yen && !r.settle);

  el.settleYear.textContent = `${state.y}年`;
  el.settleSummary.textContent = total
    ? `年間 ${yenText(total)}　精算待ち ${yet.length}か月（${yenText(yet.reduce((t, r) => t + r.yen, 0))}）`
    : 'この年の記録はまだありません。';

  el.settleRows.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    // 記録が無い月は色を落とし、精算待ちの月は目立たせます
    if (!r.yen) tr.className = 'is-zero';
    else if (!r.settle) tr.className = 'is-yet';
    if (r.y === TODAY.y && r.m === TODAY.m) tr.classList.add('is-now');

    const month = document.createElement('td');
    month.className = 'exp-total__name';
    month.textContent = `${r.m}月`;

    const yen = document.createElement('td');
    yen.className = 'exp-total__yen';
    yen.innerHTML = r.yen ? yenMarkup(r.yen) : '—';

    const date = document.createElement('td');
    date.className = 'settle-cell';
    if (r.yen && !r.settle) date.classList.add('is-yet');
    const day = document.createElement('span');
    day.textContent = r.settle ? shortDate2(r.settle.d) : (r.yen ? '未精算' : '—');
    date.appendChild(day);
    // スマホでは出金口座の列を出さないので、その分をここに小さく添えます
    // （どちらを出すかは CSS が幅で決めます）
    if (r.settle && r.settle.label) {
      const sub = document.createElement('span');
      sub.className = 'settle-cell__acc';
      sub.textContent = r.settle.label;
      date.appendChild(sub);
    }

    const acc = document.createElement('td');
    acc.className = 'settle-cell';
    acc.textContent = (r.settle && r.settle.label) || '—';

    /* ---- 押すところ ----
       かぎを開けたときだけ、押せる形のボタンを出します。
       行のどこを押せばいいのか迷わないよう、
       「未精算」の文字ではなく、はっきりしたボタンにしています */
    const act = document.createElement('td');
    act.className = 'settle-act';
    if (r.yen && settleUnlocked) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'settle-btn' + (r.settle ? '' : ' is-todo');
      // 画面が狭いときは短い方だけ出します（どちらを出すかは CSS が決めます）
      btn.innerHTML = r.settle
        ? '直す'
        : '<span class="settle-btn__long">精算を入れる</span>'
          + '<span class="settle-btn__short">入れる</span>';
      btn.title = r.settle
        ? '精算日と出金口座を直します'
        : 'この月分を払ったら、精算日と出金口座を入れます';
      btn.addEventListener('click', () => openSettleForm(r));
      act.appendChild(btn);
    }

    tr.append(month, yen, date, acc, act);
    el.settleRows.appendChild(tr);
  });

  /* ---- 下の合計（スプレッドシートの F7・F13・C14 にあたる行） ---- */
  el.settleFoot.innerHTML = '';
  const foot = (label, yen, cls) => {
    const tr = document.createElement('tr');
    tr.className = 'settle-foot' + (cls ? ' ' + cls : '');
    tr.innerHTML =
      '<td class="exp-total__name"></td>' +
      `<td class="exp-total__yen">${yenMarkup(yen)}</td><td></td><td></td><td></td>`;
    tr.querySelector('.exp-total__name').textContent = label;
    el.settleFoot.appendChild(tr);
  };
  foot('1〜6月', first);
  foot('7〜12月', last);
  foot('年間合計', total, 'settle-foot--total ledger-foot');

  renderSettleLock();
}

/** 🔒 のボタンの見た目 */
function renderSettleLock() {
  const b = el.settleLockBtn;
  b.classList.toggle('is-on', settleUnlocked);
  b.setAttribute('aria-pressed', settleUnlocked ? 'true' : 'false');
  b.querySelector('.settle-lock__icon').textContent = settleUnlocked ? '✏️' : '🔒';
  b.querySelector('.settle-lock__name').textContent = settleUnlocked
    ? '入力できます'
    : '見るだけになっています';
  // スマホではボタンの文字が「入れる」に縮むので、文言は「右の緑のボタン」にしています
  b.querySelector('.settle-lock__sub').textContent = settleUnlocked
    ? '月の行の右にある緑のボタンを押してください（もう一度ここを押すと見るだけに戻ります）'
    : '経理担当の方は、ここを押すと精算を入れるボタンが出ます';
}

/** 2026-08-04 → 8/4 */
function shortDate2(str) {
  const [, m, d] = (str || '').split('-');
  return m ? `${+m}/${+d}` : '';
}

/* -------- 精算日と出金口座を入れる -------- */
let settleEditing = null;   // いま直している { y, m, yen, settle }

function openSettleForm(row) {
  settleEditing = row;
  el.settleFormTitle.textContent = `${row.y}年${row.m}月分の精算`;
  el.settleFormYen.textContent = yenText(row.yen);
  el.settleDate.value = (row.settle && row.settle.d) || ymd(TODAY.y, TODAY.m, TODAY.d);
  el.settleAccount.value = (row.settle && row.settle.label) || '';
  el.settleError.textContent = '';
  el.settleClear.classList.toggle('is-hidden', !row.settle);

  /* よく使う口座のボタン。過去に入れた口座もそのまま候補にします */
  const used = [];
  settleRows(row.y).forEach((r) => {
    const name = r.settle && r.settle.label;
    if (name && !used.includes(name)) used.push(name);
  });
  const names = [...new Set(SETTLE_ACCOUNTS.concat(used))];

  el.settleAccounts.innerHTML = '';
  names.forEach((name) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'exp-chip';
    b.textContent = name;
    b.addEventListener('click', () => {
      el.settleAccount.value = name;
      markSettleChips();
    });
    el.settleAccounts.appendChild(b);
  });
  markSettleChips();
  el.settleModal.classList.remove('is-hidden');
}

/** いま入っている口座と同じボタンに色を付ける */
function markSettleChips() {
  const now = el.settleAccount.value.trim();
  [...el.settleAccounts.children].forEach((b) => {
    b.classList.toggle('is-on', b.textContent === now);
  });
}

function saveSettle() {
  if (!settleEditing) return;
  const d = el.settleDate.value;
  const account = el.settleAccount.value.trim();
  if (!d) { el.settleError.textContent = '精算日を入れてください。'; return; }
  if (!account) { el.settleError.textContent = '出金口座を入れてください。'; return; }

  const { y, m } = settleEditing;
  Store.setItem(EXPENSE_STORE, expenseMonthKey(y, m), SETTLE_KEY, {
    done: true, d, label: account,
  });
  el.settleModal.classList.add('is-hidden');
  renderSettle();
  renderSyncStatus();
}

async function clearSettle() {
  if (!settleEditing) return;
  const { y, m } = settleEditing;
  const ok = await askConfirm({
    item: `${y}年${m}月分`,
    message: '精算日と出金口座を消して、「未精算」に戻します。立て替えの記録は消えません。',
    okLabel: '消す',
    danger: true,
  });
  if (!ok) return;

  // 空にすることで消えたことにします（消えたことも他の端末に伝わります）
  Store.setItem(EXPENSE_STORE, expenseMonthKey(y, m), SETTLE_KEY, {
    done: false, d: '', label: '',
  });
  el.settleModal.classList.add('is-hidden');
  renderSettle();
  renderSyncStatus();
}

/* ============================================================
 *  会議資料
 *    もとは Google スプレッドシート「2026_売上比率_会議」。
 *
 *    ・数字   … js/meeting-data.js に入れてあるのは「もとの数字」だけです。
 *               率・差・累計はここで計算します（もとのシートは月によって
 *               計算式がちがっていたので、そちらの率は使いません）。
 *    ・キャッチ … シートの数字ではなく、このアプリのキャッチ集計
 *               （現金支払い管理表に入れた分）から拾います。
 *    ・議事録 … _meeting/YYYY-MM に1つずつ入れます。表に直接書けます。
 * ============================================================ */

/** 入っている月のうち、一番新しい月。1つも無ければ null */
function latestMeetingMonth() {
  if (typeof MEETING_DATA === 'undefined') return null;
  const keys = Object.keys(MEETING_DATA).sort();
  if (!keys.length) return null;
  const [y, m] = keys[keys.length - 1].split('-');
  return { y: +y, m: +m };
}

/** その月のデータ。無ければ null */
/**
 * その月の数字。
 *   下じき … meeting-data.js（2026年1〜6月を取り込んだもの）
 *   上ぬり … _meeting/YYYY-MM に保存された数字
 *            num:店舗id  … 日報から取り込んだ5項目
 *            util:店舗id … 手で入れた光熱費
 * 何度も呼ばれるので、取り込みや手入力があるまでは覚えたものを返します。
 */
let meetingSeq = 0;
const meetingMemo = { key: '', seq: -1, val: null };

function meetingOf(y, m) {
  const key = meetingMonthKey(y, m);
  if (meetingMemo.key === key && meetingMemo.seq === meetingSeq) return meetingMemo.val;
  const base = (typeof MEETING_DATA === 'undefined') ? null : (MEETING_DATA[key] || null);
  const val = meetingWithSaved(base, key);
  meetingMemo.key = key;
  meetingMemo.seq = meetingSeq;
  meetingMemo.val = val;
  return val;
}

function meetingWithSaved(base, key) {
  const items = Store.getDay(MEETING_STORE, key).items || {};
  const ids = Object.keys(items).filter((k) => k.indexOf('num:') === 0 || k.indexOf('util:') === 0);
  if (!ids.length) return base;

  const out = { rows: {}, notes: (base && base.notes) || [] };
  if (base) {
    Object.entries(base.rows).forEach(([id, v]) => {
      out.rows[id] = { now: (v.now || []).slice(), last: (v.last || []).slice() };
    });
  }
  ids.forEach((k) => {
    const sid = k.split(':')[1];
    const saved = items[k] && items[k].value;
    if (!saved || !sid) return;
    if (!out.rows[sid]) out.rows[sid] = { now: [], last: [] };
    ['now', 'last'].forEach((side) => {
      const src = saved[side];
      if (!src) return;
      if (!out.rows[sid][side]) out.rows[sid][side] = [];
      Object.keys(src).forEach((f) => {
        const i = MEETING_FIELDS.indexOf(f);
        if (i >= 0 && typeof src[f] === 'number') out.rows[sid][side][i] = src[f];
      });
    });
  });
  return out;
}

/** 数字の配列（meeting-data.js の並び）を名前つきに開く */
function meetingRow(arr) {
  const o = {};
  MEETING_FIELDS.forEach((k, i) => { o[k] = (arr && arr[i] !== undefined) ? arr[i] : null; });
  return o;
}

/** 何店舗分かを1つに足す（合計の行を、店舗と同じ形で作るため） */
function meetingSum(rows) {
  const o = {};
  MEETING_FIELDS.forEach((k) => { o[k] = 0; });
  rows.forEach((r) => MEETING_FIELDS.forEach((k) => { o[k] += Number(r[k]) || 0; }));
  return o;
}

/**
 * その月のキャッチ（店舗id → { yen, people }）
 * 現金支払い管理表で「キャッチ」を選んで入れた分を、店舗ごとに足します
 * （キャッチ集計のページと同じ数字になります）
 */
function meetingCatchOf(y, m) {
  const rec = Store.getDay(EXPENSE_STORE, expenseMonthKey(y, m));
  const out = {};
  expenseEntries(rec)
    .filter((e) => e.kind === 'catch')
    .forEach((e) => {
      const id = e.store || '';
      if (!out[id]) out[id] = { yen: 0, people: 0 };
      out[id].yen += Number(e.yen) || 0;
      out[id].people += Number(e.people) || 0;
    });
  return out;
}

/**
 * 1月から m 月までのうち、数字が入っている月の数と、一番新しい月
 *
 * 7月・8月のように まだ入力されていない月を開いたときに、
 * 累計の見出しや円グラフの目安が先に進んでしまわないようにするためです。
 */
function meetingFilledUpTo(y, m) {
  let count = 0, last = 0;
  for (let i = 1; i <= m; i += 1) {
    if (meetingOf(y, i)) { count += 1; last = i; }
  }
  return { count, last };
}

/** 1月から m 月までの税抜売上（店舗ごと）。{ 店舗id: { ex, lastEx } } */
function meetingCumByStore(y, m) {
  const out = {};
  STORES.forEach((s) => { out[s.id] = { ex: 0, lastEx: 0 }; });
  for (let i = 1; i <= m; i += 1) {
    const rec = meetingOf(y, i);
    if (!rec) continue;
    Object.entries(rec.rows).forEach(([id, v]) => {
      if (!out[id]) out[id] = { ex: 0, lastEx: 0 };
      out[id].ex += meetingRow(v.now).ex || 0;
      out[id].lastEx += meetingRow(v.last).ex || 0;
    });
  }
  return out;
}

/* ------------------------------------------------------------
 *  表の列
 *
 *  1つの項目につき「今年・昨年・差」の3列。もとのシートと同じ並びです。
 *    main    … その升目の主の数字   mainKind: yen=金額 / num=人数 / pct=率
 *    sub     … 主の数字に添える数字（原価なら金額の下に率）
 *    goodWhen… 増えた方が良いか（差の色分けに使います）
 *  1つの表に全部入れると横に長くなりすぎるので、3つに分けています。
 * ---------------------------------------------------------- */
/**
 * 原価率。★日報の「まとめ」タブが出している原材料費率と同じ出し方です
 *   原価（＝仕入の税込累計）÷ 税込売上
 * 原価はもともと税込の数字なので、割る相手も税込にそろえます。
 * もとのスプレッドシートは昨年だけ税抜売上で割っていて土俵が違いました。
 * ko-dai の指示で、今年も昨年も税込にそろえてあります（2026年8月15日）。
 * 人件費率と光熱費率は税のない数字なので、今年・昨年とも税抜売上で割ります。
 * F/L はこの2つの率の足し算です（6月のシートと同じ）。
 */
function meetingCostRate(v) {
  return v.inc ? v.cost / v.inc : null;
}

const MEETING_MODES = {
  sales: [
    { label: '税込売上', mainKind: 'yen', main: (v) => v.inc, goodWhen: 'up' },
    { label: '税抜売上', mainKind: 'yen', main: (v) => v.ex, goodWhen: 'up' },
    { label: '来店人数', mainKind: 'num', unit: '人', main: (v) => v.guests, goodWhen: 'up' },
    { label: '客単価', mainKind: 'yen', goodWhen: 'up',
      main: (v) => (v.guests ? Math.round(v.ex / v.guests) : null) },
  ],
  cost: [
    // big … 金額と率のどちらも大きく出します（会議で一番見る2つ）
    { label: '原価', mainKind: 'yen', subKind: 'pct', goodWhen: 'down', big: true,
      main: (v) => v.cost, sub: (v) => meetingCostRate(v) },
    { label: '人件費', mainKind: 'yen', subKind: 'pct', goodWhen: 'down', big: true,
      main: (v) => v.labor, sub: (v) => (v.ex ? v.labor / v.ex : null) },
    { label: 'F/L', mainKind: 'pct', goodWhen: 'down',
      main: (v) => {
        const c = meetingCostRate(v);
        const l = v.ex ? v.labor / v.ex : null;
        return (c === null || l === null) ? null : c + l;
      } },
    // キャッチだけは、差の下段を「増減率」ではなく「人数の差」にします。
    // 人数も会議で見る数字なので、金額と同じ大きさで出します（big）
    { label: 'キャッチ', mainKind: 'yen', subKind: 'num', subUnit: '人', diffSub: 'sub', big: true,
      main: (v) => v.katch, sub: (v) => v.katchPeople },
  ],
  // 光熱費も、もとのシートと同じように金額と率の両方を出します。
  // ★その下に使用量を1行ずつ足しています。金額だけだと、値上がりで増えたのか
  //   使いすぎで増えたのかが分かりません。使用量が並んでいれば見分けられます
  util: MEETING_UTIL_ROWS.reduce((rows, u) => rows.concat([
    { label: u.name, mainKind: 'yen', subKind: 'pct', goodWhen: 'down', big: true,
      main: (v) => v[u.key], sub: (v) => (v.ex ? v[u.key] / v.ex : null) },
    { label: `${u.name} 使用量`, mainKind: 'num', unit: u.unit, goodWhen: 'down',
      main: (v) => v[u.use] },
  ]), []).concat([
    { label: '光熱費 合計', mainKind: 'yen', subKind: 'pct', goodWhen: 'down', big: true,
      main: (v) => (v.gas + v.water + v.power) || null,
      sub: (v) => (v.ex ? (v.gas + v.water + v.power) / v.ex : null) },
  ]),
};

/** いまどの表を出しているか */
let meetingMode = 'sales';

/**
 * 数字を書き出す（差のときは符号を付けます）
 *   yen   … 金額      num … 人数
 *   pct   … 率（％）。差のときは「率がどれだけ動いたか」を％で出します
 *   ratio … 前の年から何％増えたか減ったか
 */
function meetingNum(n, kind, unit, diff) {
  if (n === null || n === undefined || !isFinite(n) || (!diff && !n)) return '—';
  const isPct = kind === 'pct' || kind === 'ratio';
  if (diff && Math.round(isPct ? n * 1000 : n) === 0) return '±0';
  const sign = diff ? (n > 0 ? '+' : '−') : '';
  const v = diff ? Math.abs(n) : n;
  if (isPct) return `${sign}${(v * 100).toFixed(1)}%`;
  if (kind === 'num') return `${sign}${Math.round(v).toLocaleString('ja-JP')}<span class="ledger-unit">${unit || ''}</span>`;
  return sign + yenMarkup(Math.round(v));
}

/** 1つの升目（主の数字と、あれば下に添える数字） */
function meetingCell(col, v, opts = {}) {
  const diff = !!opts.diff;
  const main = col.main ? col.main(v) : null;
  const sub = col.sub ? col.sub(v) : null;
  let cls = 'mt-cell';
  cls += opts.last ? ' is-last' : (opts.diff ? '' : ' is-now');
  if (diff) {
    cls += ' is-vs';
    if (col.goodWhen && main) {
      const good = col.goodWhen === 'up' ? main > 0 : main < 0;
      cls += good ? ' is-good' : ' is-bad';
    }
  }
  if (col.big) cls += ' mt-cell--two';
  const subHtml = col.sub
    ? `<span class="mt-sub">${meetingNum(sub, col.subKind, col.subUnit, diff)}</span>`
    : '';
  return `<td class="${cls}"><span class="mt-main">${meetingNum(main, col.mainKind, col.unit, diff)}</span>${subHtml}</td>`;
}

/**
 * 差の升目に出すもの
 *   上段 … 今年 − 昨年（金額・人数・率）
 *   下段 … 前の年から何％増えたか減ったか
 *          （キャッチだけは、人数の差を出します）
 * 率だけの項目（F/L）は、率の差そのものが％なので下段はありません。
 */
function meetingDiffCol(col, now, last) {
  const a = col.main ? col.main(now) : null;
  const b = col.main ? col.main(last) : null;
  // 今年も昨年も入っていない項目は、差も「—」にします（±0 とは出しません）
  const d = (x, y) => ((x === null || y === null) || (!x && !y) ? null : x - y);
  const out = { ...col, main: () => d(a, b), sub: null, subKind: 'ratio', subUnit: '' };

  if (col.diffSub === 'sub' && col.sub) {
    const s = d(col.sub(now), col.sub(last));
    out.sub = () => s;
    out.subKind = col.subKind;
    out.subUnit = col.subUnit;
  } else if (col.mainKind !== 'pct') {
    const r = (a && b) ? (a / b - 1) : null;
    out.sub = () => r;
  }
  return out;
}

/** 1項目分の3つの升目（今年・昨年・差） */
function meetingCells(col, now, last) {
  return meetingCell(col, now)
    + meetingCell(col, last, { last: true })
    + meetingCell(meetingDiffCol(col, now, last), null, { diff: true });
}

/* ------------------------------------------------------------
 *  議事録
 * ---------------------------------------------------------- */

/** 取り込んだ議題に付ける項目名（写す前と後で同じものになるようにします） */
function meetingNoteId(i) {
  return `n${String(i + 1).padStart(3, '0')}`;
}

/** その月の議題。まだ一度も直していない月は、取り込んだメモをそのまま見せます */
function meetingNotes(y, m) {
  const rec = Store.getDay(MEETING_STORE, meetingMonthKey(y, m));
  const items = rec.items || {};
  const seeded = items[MEETING_SEED_KEY] && items[MEETING_SEED_KEY].done;

  if (!seeded) {
    // まだ写していない月。id は seedMeetingNotes が付けるものと同じにしておきます
    // （そうしておかないと、取り込んだ議題を直したときに新しい議題として増えます）
    const src = meetingOf(y, m);
    return ((src && src.notes) || []).map((g, i) => ({
      id: meetingNoteId(i), seq: i, text: g.join('\n'),
    }));
  }
  return Object.keys(items)
    .filter((id) => id !== MEETING_SEED_KEY && items[id] && items[id].done && (items[id].text || '').trim())
    .map((id) => ({ id, seq: Number(items[id].seq) || 0, text: items[id].text }))
    .sort((a, b) => a.seq - b.seq || a.id.localeCompare(b.id));
}

/**
 * はじめて直すときに、取り込んだメモを記録として書き写します
 *
 * こうしておくと、取り込んだ議題も足した議題も同じ扱いになり、
 * どれでも直せる・消せるようになります（写すのは1回だけです）。
 */
function seedMeetingNotes(y, m) {
  const key = meetingMonthKey(y, m);
  const rec = Store.getDay(MEETING_STORE, key);
  if (rec.items && rec.items[MEETING_SEED_KEY] && rec.items[MEETING_SEED_KEY].done) return;
  const src = meetingOf(y, m);
  ((src && src.notes) || []).forEach((g, i) => {
    Store.setItem(MEETING_STORE, key, meetingNoteId(i), { done: true, text: g.join('\n'), seq: i });
  });
  Store.setItem(MEETING_STORE, key, MEETING_SEED_KEY, { done: true });
}

/**
 * 枠に書いた内容を保存します
 *
 *   書いている途中でも少し手が止まったら保存し、
 *   ほかを押したとき（blur）にももう一度保存します。
 *   「ほかを押したとき」だけにすると、書いたまま月を送ったり
 *   アプリを閉じたりしたときに消えてしまうためです。
 *
 *   保存しても画面は作り直しません。作り直すと、書いている途中の
 *   枠から入力の位置（カーソル）が外れてしまうためです。
 *   空いている枠に書いたときだけ、その枠を議題に格上げして、
 *   下に新しい空の枠を1つ足します。
 */
function saveMeetingNote(box, opts = {}) {
  const text = box.value.replace(/\r/g, '').trim();
  const was = box.dataset.was || '';
  const id = box.dataset.id;

  if (!text && !id) return;                       // 空いている枠のまま。何もしません
  if (text === was) return;                       // 何も変わっていない

  seedMeetingNotes(state.y, state.m);
  const key = meetingMonthKey(state.y, state.m);

  if (!text) {
    // からっぽにしたら、その議題は消えます。
    // ただし消すのは、書き終えて枠から出たときだけです
    // （書き直そうと全部消しただけで消えてしまわないように）
    if (!opts.done) return;
    Store.setItem(MEETING_STORE, key, id, { done: false, text: '' });
    renderMeetingNotes();
    renderSyncStatus();
    return;
  }

  if (id) {
    Store.setItem(MEETING_STORE, key, id, { done: true, text, seq: Number(box.dataset.seq) || 0 });
    box.dataset.was = text;
  } else {
    // 一番下の空いている枠。書くと議題が1つ増えます
    const notes = meetingNotes(state.y, state.m);
    const seq = notes.length ? notes[notes.length - 1].seq + 1 : 0;
    const newId = 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    Store.setItem(MEETING_STORE, key, newId, { done: true, text, seq });
    promoteMeetingNoteBox(box, newId, seq, notes.length + 1);
  }
  renderSyncStatus();
}

/** 空いている枠を議題に変えて、その下に新しい空の枠を足します */
function promoteMeetingNoteBox(box, id, seq, no) {
  box.dataset.id = id;
  box.dataset.seq = seq;
  box.dataset.was = box.value.replace(/\r/g, '').trim();
  box.placeholder = '';
  const item = box.parentElement;
  item.classList.remove('meeting-note--new');
  item.querySelector('.meeting-note__no').textContent = no;
  el.meetingNotes.appendChild(meetingNoteRow(null, 0));
  el.meetingNoteCount.textContent = `（${no}件）`;
}

/* ------------------------------------------------------------
 *  画面を作る
 * ---------------------------------------------------------- */
function renderMeeting() {
  const rec = meetingOf(state.y, state.m);
  // 「2026年6月」の右に「7月の会議」。どちらの月の話かを取り違えないためです
  const heldText = meetingHeldText(state.y, state.m, state.y);
  el.meetingNotesOf.textContent = `（${heldText}の会議）`;
  el.meetingMonth.innerHTML = `${state.y}年${state.m}月`
    + `<span class="meeting-held">${heldText}の会議</span>`;

  /* ---- その月の店舗ごとの数字を並べる ---- */
  const katch = meetingCatchOf(state.y, state.m);
  const katchLast = meetingCatchOf(state.y - 1, state.m);
  const list = [];
  if (rec) {
    STORES.forEach((s) => {
      const v = rec.rows[s.id];
      if (!v) return;
      const now = meetingRow(v.now);
      const last = meetingRow(v.last);
      // キャッチだけは、シートの数字ではなくキャッチ集計の数字を使います
      now.katch = (katch[s.id] || {}).yen || 0;
      now.katchPeople = (katch[s.id] || {}).people || 0;
      last.katch = (katchLast[s.id] || {}).yen || 0;
      last.katchPeople = (katchLast[s.id] || {}).people || 0;
      list.push({ store: s, now, last });
    });
  }
  const has = list.length > 0;

  /* キャッチは店舗ごとに数えるので、店舗が入っていない記録は
     どの店舗にも出ません。埋もれないよう、ここで知らせます */
  const loose = katch[''] || null;
  el.meetingCatchWarn.classList.toggle('is-hidden', !(has && loose && loose.yen));
  if (loose && loose.yen) {
    el.meetingCatchWarn.textContent =
      `店舗が入っていないキャッチが ${loose.people.toLocaleString('ja-JP')}名`
      + `／¥${loose.yen.toLocaleString('ja-JP')} あります。`
      + '現金支払い管理表でその記録に店舗を入れると、この表に出ます。';
  }

  el.meetingSummary.textContent = has ? '' : 'この月の数字は、まだ入っていません。';
  el.meetingSummary.classList.toggle('is-hidden', has);
  el.meetingTableWrap.classList.toggle('is-hidden', !has);
  el.meetingBar.classList.toggle('is-hidden', !has);

  if (has) {
    renderMeetingTable(list);
  } else {
    // 数字の無い月に切り替えたとき、前の月の表が残らないように空にします
    el.meetingHead.innerHTML = '';
    el.meetingBody.innerHTML = '';
    el.meetingScrollHint.classList.add('is-hidden');
  }
  renderMeetingMonths();
  renderNippou();
  el.utilEdit.classList.toggle('is-hidden', meetingMode !== 'util');
  renderMeetingLast();
  renderMeetingCum();
  renderMeetingGoals();
  renderMeetingNotes();
}

/** 1〜12月のタブ。数字が入っている月は濃く出します */
function renderMeetingMonths() {
  el.meetingMonths.innerHTML = '';
  for (let m = 1; m <= 12; m += 1) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'meeting-month';
    b.classList.toggle('is-on', m === state.m);
    b.classList.toggle('is-filled', !!meetingOf(state.y, m));
    // 「6月」の下に「7月会議」。数字の月と会議の月を取り違えないためです
    const h = meetingHeldMonth(state.y, m);
    b.innerHTML = `<span class="meeting-month__m">${m}月</span>`
      + `<span class="meeting-month__meet">${h.y === state.y ? '' : '翌'}${h.m}月会議</span>`;
    b.addEventListener('click', () => {
      flushMeetingNotes();
      state.m = m;
      writeHash();
      render();
    });
    el.meetingMonths.appendChild(b);
  }
}

/**
 * その月の数字を見る会議は、翌月に開きます（6月の数字 → 7月の会議）。
 * もとのスプレッドシートの「6月（7月会議用）」と同じ数え方です。
 */
function meetingHeldMonth(y, m) {
  return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
}

/**
 * 会議の月の書き方。年をまたぐとき（12月の数字＝翌年1月の会議）だけ
 * 年も書きます。12月と1月を取り違えないためです。
 */
function meetingHeldText(y, m, base) {
  const h = meetingHeldMonth(y, m);
  return h.y === base ? `${h.m}月` : `${h.y}年${h.m}月`;
}

/** 先月の会議で決まったこと。見出しの行だけを並べます */
function renderMeetingLast() {
  const d = new Date(state.y, state.m - 2, 1);
  const y = d.getFullYear(), m = d.getMonth() + 1;
  const notes = meetingNotes(y, m);

  el.meetingLast.classList.toggle('is-hidden', !notes.length);
  if (!notes.length) return;

  // 5月の数字は6月の会議で話しているので、会議の月で書きます
  el.meetingLastTitle.textContent = `${meetingHeldText(y, m, state.y)}会議の議題`;
  el.meetingLastGoTo = { y, m };
  el.meetingLastList.innerHTML = '';
  notes.forEach((note, i) => {
    const li = document.createElement('li');
    li.className = 'meeting-last__item';
    li.innerHTML = '<span class="meeting-last__no"></span><span class="meeting-last__text"></span>';
    li.querySelector('.meeting-last__no').textContent = i + 1;
    li.querySelector('.meeting-last__text').textContent = (note.text || '').split('\n')[0];
    el.meetingLastList.appendChild(li);
  });
}

/** 今年と昨年をとなり合わせに並べた表 */
function renderMeetingTable(list) {
  const cols = MEETING_MODES[meetingMode] || MEETING_MODES.sales;

  /* ---- 見出しは2段。上が項目、下が「2026年 / 昨年 / 差」 ---- */
  const top = document.createElement('tr');
  top.className = 'meeting-head-top';
  top.innerHTML = '<th rowspan="2" class="meeting-th-name">店舗</th>'
    + cols.map((c) => `<th colspan="3" class="meeting-th-group">${c.label}</th>`).join('');

  const sub = document.createElement('tr');
  sub.className = 'meeting-head-sub';
  sub.innerHTML = cols.map(() =>
    `<th class="is-now">${state.y}年</th><th class="is-last">昨年</th><th class="is-vs">差</th>`).join('');

  el.meetingHead.innerHTML = '';
  el.meetingHead.append(top, sub);

  /* ---- 店舗の行 ---- */
  el.meetingBody.innerHTML = '';
  list.forEach(({ store, now, last }) => {
    const tr = document.createElement('tr');
    tr.style.setProperty('--row-color', store.color);
    const name = document.createElement('th');
    name.scope = 'row';
    name.className = 'meeting-td-name';
    name.textContent = store.name;
    tr.appendChild(name);
    cols.forEach((c) => tr.insertAdjacentHTML('beforeend', meetingCells(c, now, last)));
    el.meetingBody.appendChild(tr);
  });


  // 表が画面に入りきらないときだけ、横にすべらせる案内を出します
  updateMeetingScrollHint();
}

/** 表がはみ出しているかを測って、案内を出し入れします */
function updateMeetingScrollHint() {
  const wrap = el.meetingTableWrap;
  if (wrap.classList.contains('is-hidden') || !wrap.clientWidth) {
    el.meetingScrollHint.classList.add('is-hidden');
    return;
  }
  el.meetingScrollHint.classList.toggle('is-hidden', wrap.scrollWidth <= wrap.clientWidth + 1);
}

/** 1月からの累計（別枠）。店舗ごとと、6店舗・5店舗の合計 */
function renderMeetingCum() {
  const cum = meetingCumByStore(state.y, state.m);
  el.meetingCumTitle.textContent = `${state.y}年累計売上（税抜）`;
  el.meetingCumYearHead.textContent = `${state.y}年`;

  const shown = STORES.filter((s) => cum[s.id] && cum[s.id].ex);
  el.meetingCumBody.innerHTML = '';
  shown.forEach((s) => {
    const c = cum[s.id];
    const tr = document.createElement('tr');
    tr.style.setProperty('--row-color', s.color);
    tr.innerHTML = '<th scope="row" class="meeting-td-name"></th>'
      + `<td class="mt-cell is-now">${meetingNum(c.ex, 'yen')}</td>`
      + `<td class="mt-cell is-last">${meetingNum(c.lastEx, 'yen')}</td>`
      + `<td class="mt-cell is-vs${c.lastEx ? (c.ex >= c.lastEx ? ' is-good' : ' is-bad') : ''}">`
      + `<span class="mt-main">${c.lastEx ? meetingNum(c.ex - c.lastEx, 'yen', '', true) : '—'}</span>`
      + `<span class="mt-sub">${c.lastEx ? meetingNum(c.ex / c.lastEx - 1, 'ratio', '', true) : ''}</span></td>`;
    tr.querySelector('.meeting-td-name').textContent = s.name;
    el.meetingCumBody.appendChild(tr);
  });

  /* 6店舗の合計と、昨年もあった5店舗だけの合計。
     6店舗の方は昨年の数字が無いので、そこは「—」にします */
  const five = SALES_TARGET_FIVE_STORES;
  const all6 = shown.reduce((t, s) => t + cum[s.id].ex, 0);
  const now5 = shown.filter((s) => five.includes(s.id)).reduce((t, s) => t + cum[s.id].ex, 0);
  const last5 = shown.filter((s) => five.includes(s.id)).reduce((t, s) => t + cum[s.id].lastEx, 0);

  const row = (label, now, last) =>
    '<tr class="meeting-foot"><th scope="row" class="meeting-td-name">' + label + '</th>'
    + `<td class="mt-cell is-now">${meetingNum(now, 'yen')}</td>`
    + `<td class="mt-cell is-last">${last ? meetingNum(last, 'yen') : '—'}</td>`
    + `<td class="mt-cell is-vs${last ? (now >= last ? ' is-good' : ' is-bad') : ''}">`
    + `<span class="mt-main">${last ? meetingNum(now - last, 'yen', '', true) : '—'}</span>`
    + `<span class="mt-sub">${last ? meetingNum(now / last - 1, 'ratio', '', true) : ''}</span></td></tr>`;

  el.meetingCumFoot.innerHTML =
    (shown.length > five.length ? row(`年間${shown.length}店舗累計`, all6, 0) : '')
    + row(`年間${five.length}店舗累計`, now5, last5);

  el.meetingCumWrap.classList.toggle('is-hidden', !shown.length);
}

/* ------------------------------------------------------------
 *  日報からの取り込み
 *
 *  ブラウザからスプレッドシートは読めないので、GAS（バックエンド）に
 *  「このフォルダの、この年月のファイルの、このセルを読んで」と頼みます。
 *  返ってきた数字は _meeting/YYYY-MM に入れるので、ふだんの同期で
 *  みんなの端末にも届きます。光熱費とキャッチは日報にないので触りません。
 * ---------------------------------------------------------- */
let nippouBusy = false;
/** 取り込みの結果を、どの月のものとして出しているか */
let nippouShownKey = '';

/* ------------------------------------------------------------
 *  会議資料の数字を、記録へ写す（1回だけ）
 *
 *  ★`js/meeting-data.js` は GitHub Pages で誰でも読めます。会社の売上・原価・
 *    人件費が店舗別・月別に出てしまうので、公開から外します。
 *    外すと画面から消えるので、先にここで記録（スプレッドシート）へ写します。
 *    写したあとは、ファイルが無くても今までどおり出ます。
 *
 *  ★すでに記録がある店舗は書き換えません。日報から取り込み直した分を
 *    上書きしないためです。二度押しても増えません。
 *
 *  ★キャッチは写しません。`renderMeeting()` がいつも立替金の集計で
 *    上書きするので、記録に入れても使われません。
 * ---------------------------------------------------------- */

/** 1店舗分の数字を、日報から取り込む分（num）と光熱費（util）に分けます */
function meetingMoveSplit(arr) {
  const num = {};
  const util = {};
  MEETING_FIELDS.forEach((f, i) => {
    const n = arr && arr[i];
    if (typeof n !== 'number') return;
    if (NIPPOU_FIELDS.includes(f)) num[f] = n;
    else if (MEETING_UTIL_FIELDS.includes(f)) util[f] = n;
  });
  return { num, util };
}

/** その月を写します。書いた件数を返します */
function meetingMoveMonth(key) {
  const data = MEETING_DATA[key];
  if (!data) return 0;
  const items = Store.getDay(MEETING_STORE, key).items || {};
  let wrote = 0;
  Object.entries(data.rows || {}).forEach(([sid, v]) => {
    const num = {};
    const util = {};
    ['now', 'last'].forEach((side) => {
      const got = meetingMoveSplit(v[side]);
      if (Object.keys(got.num).length) num[side] = got.num;
      if (Object.keys(got.util).length) util[side] = got.util;
    });
    if (Object.keys(num).length && !items[`num:${sid}`]) {
      Store.setItem(MEETING_STORE, key, `num:${sid}`, { value: num });
      wrote += 1;
    }
    if (Object.keys(util).length && !items[`util:${sid}`]) {
      Store.setItem(MEETING_STORE, key, `util:${sid}`, { value: util });
      wrote += 1;
    }
  });
  Store.setItem(MEETING_STORE, key, MEETING_MOVED_KEY, { done: true });
  return wrote;
}

/**
 * 写せたかを、記録から読み直して確かめます
 *
 * ★見るのは「同じ数字か」ではなく「記録に数字があるか」です。
 *   日報から取り込み直した月は、もとの数字と違っていて構いません。
 *   大事なのは、ファイルを外しても画面が欠けないことです。
 */
function meetingMoveCheck(key) {
  const data = MEETING_DATA[key];
  const items = Store.getDay(MEETING_STORE, key).items || {};
  const ng = [];
  Object.entries(data.rows || {}).forEach(([sid, v]) => {
    ['now', 'last'].forEach((side) => {
      const got = meetingMoveSplit(v[side]);
      const num = ((items[`num:${sid}`] || {}).value || {})[side] || {};
      const util = ((items[`util:${sid}`] || {}).value || {})[side] || {};
      Object.keys(got.num).forEach((f) => {
        if (typeof num[f] !== 'number') ng.push(`${sid} ${side} ${f}`);
      });
      Object.keys(got.util).forEach((f) => {
        if (typeof util[f] !== 'number') ng.push(`${sid} ${side} ${f}`);
      });
    });
  });
  return ng;
}

/** まだ写していない月 */
function meetingMoveRest() {
  if (typeof MEETING_DATA === 'undefined') return [];
  return Object.keys(MEETING_DATA).sort().filter((k) => {
    const items = Store.getDay(MEETING_STORE, k).items || {};
    return !(items[MEETING_MOVED_KEY] && items[MEETING_MOVED_KEY].done);
  });
}

/** 1回押せば、入っている月を全部写します */
function moveMeetingData() {
  const keys = Object.keys(MEETING_DATA || {}).sort();
  const lines = [];
  let wrote = 0;
  let ng = 0;
  keys.forEach((key) => {
    wrote += meetingMoveMonth(key);
    const bad = meetingMoveCheck(key);
    const [y, m] = key.split('-');
    const stores = Object.keys(MEETING_DATA[key].rows || {}).length;
    if (bad.length) {
      ng += 1;
      lines.push({ ok: false, text: `${Number(y)}年${Number(m)}月　★入っていません：${bad.slice(0, 4).join('／')}` });
    } else {
      lines.push({ ok: true, text: `${Number(y)}年${Number(m)}月　${stores}店舗　✓` });
    }
  });
  meetingSeq += 1;
  renderMeeting();
  meetingMoveShow(lines, ng
    ? '★入っていない月があります。ko-dai に知らせてください'
    : `全部そろいました（${keys.length}か月・${wrote}件を書きました）。同期が終わるまで待ってください`);
}

/** 結果を出します */
function meetingMoveShow(lines, head) {
  const list = document.getElementById('meetingMoveList');
  if (!list) return;
  list.innerHTML = '';
  [{ head: true, text: head }].concat(lines).forEach((l) => {
    const li = document.createElement('li');
    li.className = 'nippou__row' + (l.head ? ' is-head' : '') + (l.ok === false ? ' is-ng' : '');
    li.textContent = l.text;
    list.appendChild(li);
  });
  list.classList.remove('is-hidden');
}

/**
 * 写すボタンを出します
 *
 * ★index.html は本部のファイルなので触りません。ここで足します。
 *   写し終われば消えます（`js/meeting-data.js` を外したあとも出ません）。
 */
function renderMeetingMove() {
  let box = document.getElementById('meetingMove');
  const rest = meetingMoveRest();

  if (typeof MEETING_DATA === 'undefined' || !rest.length) {
    if (box) box.classList.add('is-hidden');
    return;
  }

  if (!box) {
    box = document.createElement('div');
    box.id = 'meetingMove';

    const head = document.createElement('div');
    head.className = 'nippou__head';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = '会議資料の数字を記録へ写す';
    btn.addEventListener('click', moveMeetingData);
    const note = document.createElement('span');
    note.className = 'nippou__note';
    note.id = 'meetingMoveNote';
    head.append(btn, note);

    const list = document.createElement('ul');
    list.className = 'nippou__list is-hidden';
    list.id = 'meetingMoveList';

    box.append(head, list);
    el.nippouBox.appendChild(box);
  }

  box.classList.remove('is-hidden');
  const note = document.getElementById('meetingMoveNote');
  if (note) {
    note.textContent = `1回押すと、${rest.length}か月分が記録に入ります`
      + '（公開ファイルを外すための下ごしらえです）';
  }
}

function renderNippou() {
  renderMeetingMove();
  const folders = NippouFolders.all();
  const n = STORES.filter((s) => folders[s.id]).length;
  el.nippouNote.textContent = n
    ? `${state.y}年${state.m}月と、${state.y - 1}年${state.m}月の日報を読みます（${n}店舗）`
    : 'マネージの「日報フォルダ」に登録すると使えます';
  el.nippouPull.disabled = !n || nippouBusy || !Sync.enabled();

  // 別の月に移ったら、前の月の結果は消します（どの月の話か分からなくなるため）
  if (nippouShownKey && nippouShownKey !== meetingMonthKey(state.y, state.m)) {
    el.nippouResult.classList.add('is-hidden');
    nippouShownKey = '';
  }
}

async function pullNippou() {
  if (nippouBusy) return;
  const folders = NippouFolders.all();
  const targets = STORES.filter((s) => folders[s.id]);
  if (!targets.length) return;

  /* ★頼んだときの年月を先に覚えます。
     読むのに数秒かかるので、その間に月を切り替えられると、
     覚えておかないと「いま開いている月」に入れてしまいます */
  const y = state.y;
  const m = state.m;
  const key = meetingMonthKey(y, m);

  nippouBusy = true;
  el.nippouPull.disabled = true;
  el.nippouPull.textContent = '読んでいます…';
  el.nippouResult.classList.add('is-hidden');

  const res = await Sync.ask('nippou', {
    y,
    m,
    stores: targets.map((s) => ({
      id: s.id, folder: NippouFolders.idOf(s.id), cells: nippouAsk(s.id, y, m),
    })),
  });

  nippouBusy = false;
  el.nippouPull.textContent = '日報から取り込む';

  const lines = [{ head: true, text: `${y}年${m}月として取り込みました` }];
  if (!res.ok) {
    lines.push({ ok: false, text: res.error || '取り込めませんでした' });
  } else {
    targets.forEach((s) => {
      const got = (res.stores || {})[s.id] || {};
      const val = {};
      const parts = [];
      let ng = false;
      [['now', y], ['last', y - 1]].forEach(([side, year]) => {
        const g = got[side];
        if (!g || g.error) { parts.push(`${year}年 ${(g && g.error) || '読めません'}`); return; }
        // 年ごとに配置が違うことがあるので、その年月の配置で組み立てます
        const o = nippouPick(s.id, nippouYm(year, m), g);
        // 売上が0の日報は、まだ書きこまれていないものとして入れません
        if (!o.inc && !o.ex) { parts.push(`${g.name || year} まだ数字が入っていません`); return; }
        // ★検算。日報としてありえない数なら、入れずに知らせます
        const hen = nippouCheck(o);
        if (hen) { ng = true; parts.push(`${g.name || `${year}年`} ★${hen}`); return; }
        val[side] = o;
        // どのファイルを読んだかを出します（月がずれていないか、ここで分かります）
        parts.push(`${g.name || `${year}年`} ✓`);
      });
      if (val.now || val.last) Store.setItem(MEETING_STORE, key, `num:${s.id}`, { value: val });
      lines.push({ ok: !ng && !!val.now, name: s.name, text: parts.join('　') });
    });
    meetingSeq += 1;
  }

  // 表を先に描き直してから結果を出します
  // （月を切り替えていた場合、結果が消えてしまわないように）
  renderMeeting();

  nippouShownKey = key;
  el.nippouResult.innerHTML = '';
  lines.forEach((l) => {
    const li = document.createElement('li');
    li.className = 'nippou__row' + (l.head ? ' is-head' : '') + (l.ok === false ? ' is-ng' : '');
    if (l.name) {
      const b = document.createElement('b');
      b.textContent = l.name;
      li.appendChild(b);
    }
    li.appendChild(document.createTextNode(l.text));
    el.nippouResult.appendChild(li);
  });
  el.nippouResult.classList.remove('is-hidden');
}

/* ------------------------------------------------------------
 *  光熱費の手入力
 *
 *  日報にはガス・水道・電気が入っていないので、ここだけ手で入れます。
 *  取り込みとは別の項目（util:店舗id）に入れるので、日報から取り込んでも
 *  消えません。逆に、ここで保存しても取り込んだ数字は消しません。
 * ---------------------------------------------------------- */
let utilSide = 'now';

/** その月・その年の光熱費（画面に出ているもの）を取り出します */
function utilValues(side) {
  const rec = meetingOf(state.y, state.m);
  const out = {};
  STORES.forEach((s) => {
    const row = rec && rec.rows[s.id];
    const v = meetingRow(row && row[side]);
    out[s.id] = {};
    MEETING_UTIL_FIELDS.forEach((f) => { out[s.id][f] = Number(v[f]) || 0; });
  });
  return out;
}

function openUtilForm() {
  utilSide = 'now';
  [...el.utilYear.children].forEach((b) => b.classList.toggle('is-on', b.dataset.side === 'now'));
  fillUtilForm();
  el.utilModal.classList.remove('is-hidden');
}

function fillUtilForm() {
  const vals = utilValues(utilSide);
  el.utilRows.innerHTML = '';
  STORES.forEach((s) => {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.className = 'util-name';
    name.textContent = s.name;
    tr.appendChild(name);

    // ガス・水道・電気それぞれに「金額」と「使用量」の2つを並べます
    MEETING_UTIL_ROWS.forEach((u) => {
      [{ f: u.key, hint: '円' }, { f: u.use, hint: u.unit }].forEach((box) => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.inputMode = 'numeric';
        input.className = 'util-input' + (box.f === u.use ? ' util-input--use' : '');
        input.dataset.store = s.id;
        input.dataset.field = box.f;
        input.value = vals[s.id][box.f] || '';
        input.placeholder = box.hint;
        td.appendChild(input);
        tr.appendChild(td);
      });
    });
    el.utilRows.appendChild(tr);
  });
}

function saveUtilForm() {
  const key = meetingMonthKey(state.y, state.m);
  // 画面に出ていない方の年も、いまの数字をそのまま書き写します
  // （片方だけ保存して、もう片方が消えてしまわないように）
  const other = utilSide === 'now' ? 'last' : 'now';
  const otherVals = utilValues(other);
  const typed = {};
  [...el.utilRows.querySelectorAll('.util-input')].forEach((i) => {
    const sid = i.dataset.store;
    if (!typed[sid]) typed[sid] = {};
    typed[sid][i.dataset.field] = Math.max(Math.round(Number(i.value) || 0), 0);
  });

  STORES.forEach((s) => {
    const val = {};
    val[utilSide] = typed[s.id] || {};
    val[other] = otherVals[s.id] || {};
    Store.setItem(MEETING_STORE, key, `util:${s.id}`, { value: val });
  });

  meetingSeq += 1;
  el.utilModal.classList.add('is-hidden');
  renderMeeting();
}

/** 年間目標に対する進み具合（円グラフ） */
function renderMeetingGoals() {
  const cum = meetingCumByStore(state.y, state.m);
  // 目安は「入力されている月の数 ÷ 12」。まだ入っていない月まで数えると、
  // どの店舗も遅れているように見えてしまいます
  const filled = meetingFilledUpTo(state.y, state.m);
  const pace = filled.count / 12;
  el.meetingGoalPace.textContent = filled.count
    ? `（${filled.last}月まで＝目安 ${Math.round(pace * 100)}%）` : '';

  /* ★目標はマネージで登録します（設定なので、公開ウェブには出ません）。
     1つも登録が無いときは、黙って消さずに知らせます。
     消えたのか、まだ入れていないのかが分からないのが一番こまるためです */
  el.meetingGoals.innerHTML = '';
  if (!SalesTargets.any()) {
    const p = document.createElement('p');
    p.className = 'expense-note';
    p.textContent = '年間の売上目標がまだ登録されていません（マネージで登録します）';
    el.meetingGoals.appendChild(p);
    el.meetingGoals.classList.remove('is-hidden');
    el.meetingGoalNote.classList.add('is-hidden');
    return;
  }

  const five = SALES_TARGET_FIVE_STORES;
  const targets = SalesTargets.all();
  const items = STORES
    .filter((s) => targets[s.id] && cum[s.id] && cum[s.id].ex)
    .map((s) => ({ name: s.name, color: s.color, now: cum[s.id].ex, goal: targets[s.id] }));

  const now5 = five.reduce((t, id) => t + ((cum[id] || {}).ex || 0), 0);
  const goal5 = salesTargetFive();
  if (now5 && goal5) {
    items.unshift({
      name: `${five.length}店舗 合計`, color: 'var(--money)',
      now: now5, goal: goal5, big: true,
    });
  }

  el.meetingGoals.classList.toggle('is-hidden', !items.length);
  el.meetingGoalNote.classList.toggle('is-hidden', !items.length);
  items.forEach((it) => el.meetingGoals.appendChild(goalCard(it, pace)));
}

/** 円グラフ1つ分 */
function goalCard({ name, color, now, goal, big }, pace) {
  const ratio = goal ? now / goal : 0;
  const R = 42;
  const C = 2 * Math.PI * R;
  const shown = Math.min(ratio, 1);                // 輪は100%で止め、数字は本当の値を出します
  const card = document.createElement('section');
  card.className = 'goal-card' + (big ? ' goal-card--big' : '');
  card.style.setProperty('--goal-color', color);
  // 目安の印を置く角度（12時から時計回り）
  const a = (pace * 2 * Math.PI) - Math.PI / 2;

  /* 目安との差。「いまの時期なら ここまで」に対して
     さきに進んでいるか、おくれているかを言葉で出します */
  const gap = (ratio - pace) * 100;
  const late = gap < 0;
  const gapText = Math.abs(gap) < 0.05
    ? '±0%'
    : `${late ? '−' : '+'}${Math.abs(gap).toFixed(1)}%`;

  card.innerHTML = `
    <svg class="goal-ring" viewBox="0 0 100 100" role="img" aria-label="${name} ${Math.round(ratio * 100)}%">
      <circle class="goal-ring__bg" cx="50" cy="50" r="${R}"></circle>
      <circle class="goal-ring__fill" cx="50" cy="50" r="${R}"
              stroke-dasharray="${(C * shown).toFixed(1)} ${C.toFixed(1)}"
              transform="rotate(-90 50 50)"></circle>
      <line class="goal-ring__pace"
            x1="${(50 + (R - 9) * Math.cos(a)).toFixed(1)}" y1="${(50 + (R - 9) * Math.sin(a)).toFixed(1)}"
            x2="${(50 + (R + 9) * Math.cos(a)).toFixed(1)}" y2="${(50 + (R + 9) * Math.sin(a)).toFixed(1)}"></line>
      <text class="goal-ring__pct" x="50" y="54">${(ratio * 100).toFixed(1)}%</text>
    </svg>
    <p class="goal-card__name"></p>
    <p class="goal-card__yen">${yenMarkup(now)}</p>
    <dl class="goal-card__rows">
      <div class="goal-row"><dt>目標</dt><dd>${yenMarkup(goal)}</dd></div>
      <div class="goal-row goal-row--left"><dt>残り</dt><dd>${now >= goal
        ? '<span class="goal-done">目標をこえました</span>'
        : yenMarkup(goal - now)}</dd></div>
    </dl>
    <p class="goal-card__pace">
      <span class="goal-gap ${late ? 'is-late' : 'is-ahead'}">${gapText}</span>
      <span class="goal-card__paceLabel">目安 ${Math.round(pace * 100)}%</span>
    </p>
  `;
  card.querySelector('.goal-card__name').textContent = name;
  return card;
}

/** 議題1つ分の枠を作ります（note が null なら、一番下の空いている枠） */
function meetingNoteRow(note, i) {
  const item = document.createElement('div');
  item.className = 'meeting-note' + (note ? '' : ' meeting-note--new');

  const no = document.createElement('span');
  no.className = 'meeting-note__no';
  no.textContent = note ? i + 1 : '＋';

  const box = document.createElement('textarea');
  box.className = 'meeting-note__text';
  box.rows = 1;
  box.value = note ? note.text : '';
  box.dataset.id = note ? note.id : '';
  box.dataset.seq = note ? note.seq : '';
  box.dataset.was = note ? note.text : '';
  box.placeholder = note ? '' : 'ここに書くと、議題が1つ増えます';

  let timer = null;
  box.addEventListener('input', () => {
    growNoteBox(box);
    clearTimeout(timer);
    timer = setTimeout(() => saveMeetingNote(box), 700);   // 手が止まったら保存
  });
  box.addEventListener('blur', () => {
    clearTimeout(timer);
    saveMeetingNote(box, { done: true });
  });

  item.append(no, box);
  return item;
}

/** 議事録。枠にそのまま書けます */
function renderMeetingNotes() {
  const notes = meetingNotes(state.y, state.m);
  el.meetingNoteCount.textContent = notes.length ? `（${notes.length}件）` : '';
  el.meetingNotes.innerHTML = '';
  notes.forEach((note, i) => el.meetingNotes.appendChild(meetingNoteRow(note, i)));
  el.meetingNotes.appendChild(meetingNoteRow(null, 0));   // 一番下の、空いている枠
  [...el.meetingNotes.querySelectorAll('.meeting-note__text')].forEach(growNoteBox);
}

/** 書きかけのまま画面を離れるときに、取りこぼさないよう保存します */
function flushMeetingNotes() {
  if (state.view !== 'meeting') return;
  [...el.meetingNotes.querySelectorAll('.meeting-note__text')]
    .forEach((box) => saveMeetingNote(box));
}

/** 書いた行数に合わせて枠の高さを伸ばします */
function growNoteBox(box) {
  box.style.height = 'auto';
  box.style.height = `${box.scrollHeight}px`;
}

/* ------------------------------------------------------------
 *  全店舗提出記録
 *
 *    上 … その月のカレンダー。1日分の升目に6店舗の印が並びます
 *    中 … 選んだ日の中身（今までどおりの一覧）
 *    下 … その月のミスの記録
 * ---------------------------------------------------------- */

function renderReport() {
  renderReportCalendar();
  renderReportDay();
  renderMissList('close');
}

/**
 * その月のカレンダー
 *
 * 6店舗 × 31日分の記録を1日ずつ読むと、そのたびに保存データを
 * まるごと読み直すことになって重くなります。店舗ごとに1回だけ
 * Store.getMonth で読み、そこから引きます。
 */
function renderReportCalendar() {
  const { y, m } = state;
  const ym = `${y}-${pad2(m)}`;
  const byStore = {};
  STORES.forEach((s) => { byStore[s.id] = Store.getMonth(s.id, ym) || {}; });
  const misses = missCountByDay(y, m);

  el.reportMonth.textContent = `${y}年${m}月`;

  /* ---- 曜日の見出し ---- */
  el.calHead.innerHTML = '';
  DOW.forEach((w, i) => {
    const c = document.createElement('span');
    c.className = 'cal__dow' + (i === 0 ? ' is-sun' : (i === 6 ? ' is-sat' : ''));
    c.textContent = w;
    el.calHead.appendChild(c);
  });

  /* ---- 日の升目 ---- */
  el.calGrid.innerHTML = '';
  const first = new Date(y, m - 1, 1).getDay();     // その月の1日の曜日
  const last = daysInMonth(y, m);
  for (let i = 0; i < first; i += 1) {
    const blank = document.createElement('span');
    blank.className = 'cal__cell is-empty';
    el.calGrid.appendChild(blank);
  }

  let doneAll = 0, targetAll = 0;
  for (let d = 1; d <= last; d += 1) {
    const dateStr = ymd(y, m, d);
    const dow = new Date(y, m - 1, d).getDay();
    const future = dateStr > ymd(TODAY.y, TODAY.m, TODAY.d);

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal__cell'
      + (d === state.d ? ' is-picked' : '')
      + (dateStr === ymd(TODAY.y, TODAY.m, TODAY.d) ? ' is-today' : '')
      + (future ? ' is-future' : '')
      + (dow === 0 ? ' is-sun' : (dow === 6 ? ' is-sat' : ''));

    const num = document.createElement('span');
    num.className = 'cal__num';
    num.textContent = d;
    cell.appendChild(num);

    /* 店舗の印。
         提出した店舗 … その店舗のアイコン
         定休日       … アイコンをうすく
         未提出       … アイコンは出さず、最後に「未◯」と数で出します */
    const marks = document.createElement('span');
    marks.className = 'cal__marks';
    let done = 0, target = 0, yet = 0;
    STORES.forEach((s) => {
      const closed = Closed.isClosed(s.id, y, m, d);
      const submitted = !closed && !!(byStore[s.id][pad2(d)] || {}).submittedAt;
      if (!closed) {
        target += 1;
        if (submitted) done += 1; else yet += 1;
      }
      if (!closed && !submitted) return;          // 未提出はアイコンを出しません

      const chip = document.createElement('span');
      chip.className = 'logo-chip cal-logo' + (closed ? ' is-closed' : '');
      chip.title = `${s.name}${closed ? '（定休日）' : '（提出済み）'}`;
      fillLogo(chip, s);
      marks.appendChild(chip);
    });
    // まだ出ていない店舗の数。過ぎた日だけ赤くして、目に留まるようにします
    if (yet) {
      const left = document.createElement('span');
      left.className = 'cal-yet' + (future ? '' : ' is-late');
      left.textContent = `未${yet}`;
      left.title = `未提出 ${yet}店舗`;
      marks.appendChild(left);
    }
    cell.appendChild(marks);

    // その日のミスの数
    if (misses[dateStr]) {
      const badge = document.createElement('span');
      badge.className = 'cal-miss';
      badge.textContent = misses[dateStr] > 1 ? misses[dateStr] : '!';
      badge.title = `ミスの記録 ${misses[dateStr]}件`;
      cell.appendChild(badge);
    }
    if (!future && target && done === target) cell.classList.add('is-all');
    if (!future) { doneAll += done; targetAll += target; }

    cell.addEventListener('click', () => {
      state.d = d;
      writeHash();
      render();
    });
    el.calGrid.appendChild(cell);
  }

  el.reportMonthSummary.textContent = targetAll
    ? `今日までの提出 ${doneAll} / ${targetAll}（定休日を除く）`
    : '';
  el.reportMonthSummary.classList.toggle('is-all-done', targetAll > 0 && doneAll === targetAll);
}

/** 選んだ日の中身（店舗ごとの提出状況） */
function renderReportDay() {
  const dateStr = ymd(state.y, state.m, state.d);
  const dow = new Date(state.y, state.m - 1, state.d).getDay();
  el.reportDate.textContent = `${state.y}年${state.m}月${state.d}日（${DOW[dow]}）`;

  let submitted = 0, closedCount = 0;
  el.reportList.innerHTML = '';

  STORES.forEach((s) => {
    const closed = Closed.isClosed(s.id, state.y, state.m, state.d);
    const rec = Store.getDay(s.id, dateStr);
    const items = closed ? [] : itemsForDay(s.id, state.d);
    const done = countDone(rec, items);

    let kind, text, sub = '';
    if (closed) {
      kind = 'closed'; text = '定休日';
      closedCount++;
    } else if (rec.submittedAt) {
      const t = new Date(rec.submittedAt);
      kind = 'done'; text = '提出済み';
      sub = `${pad2(t.getHours())}:${pad2(t.getMinutes())}${rec.submittedBy ? '　' + rec.submittedBy : ''}`;
      submitted++;
    } else {
      kind = 'todo'; text = '未提出';
      sub = `${done} / ${items.length} 項目`;
    }

    const li = document.createElement('li');
    li.className = 'report-item report-item--' + kind;

    const chip = document.createElement('span');
    chip.className = 'logo-chip logo-chip--tab';
    fillLogo(chip, s);

    const name = document.createElement('span');
    name.className = 'report-item__name';
    name.textContent = s.name;

    const status = document.createElement('span');
    status.className = 'report-item__status';
    status.innerHTML = `<span class="report-item__badge">${text}</span>` +
      (sub ? `<span class="report-item__sub">${sub}</span>` : '');

    // 店舗の行を押すと、その店舗のクローズの画面へ
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'report-item__go';
    go.append(chip, name, status);
    go.addEventListener('click', () => {
      state.storeId = s.id;
      state.view = 'day';
      writeHash();
      render();
    });

    // 「じつはできていなかった」をその場で残せるようにします
    const miss = document.createElement('button');
    miss.type = 'button';
    miss.className = 'report-item__miss';
    miss.textContent = 'ミス';
    miss.title = `${s.name}のミスを記録する`;
    miss.addEventListener('click', () => openMissForm('close', null, { d: dateStr, store: s.id }));

    li.append(go, miss);
    el.reportList.appendChild(li);
  });

  const target = STORES.length - closedCount;
  el.reportSummary.textContent =
    `提出済み ${submitted} / ${target} 店舗` +
    (closedCount ? `（定休日 ${closedCount} 店舗を除く）` : '');
  el.reportSummary.classList.toggle('is-all-done', target > 0 && submitted === target);
}

/* ------------------------------------------------------------
 *  ミスの記録（クローズと週間掃除の両方で使います）
 *
 *  記録は kind で分けています。
 *    close … クローズの提出記録のページ
 *    week  … 週間掃除の達成状況のページ
 *  古い記録には kind がないので、その場合は close として扱います。
 * ---------------------------------------------------------- */

/** 画面ごとの部品。同じ作りを2か所で使い回します */
const MISS_UI = {
  close: {
    count: 'missCount', filter: 'missFilter', tally: 'missTally', list: 'missList',
    empty: 'この月のミスの記録はありません。',
  },
  week: {
    count: 'wmissCount', filter: 'wmissFilter', tally: 'wmissTally', list: 'wmissList',
    empty: 'この期のミスの記録はありません。',
  },
};

/** 画面ごとの「この月／この期」と「すべて」、店舗のしぼり */
const missView = {
  close: { range: 'near', filter: '' },
  week: { range: 'near', filter: '' },
};

/**
 * 入っているミスを全部（新しい順）
 *
 * 保存データを1回だけ読み、_miss/ で始まる入れ物をすべて集めます。
 */
function missAll(kind) {
  const dump = Store.adapter.dump();
  const out = [];
  Object.keys(dump).forEach((key) => {
    if (!key.startsWith(MISS_STORE + '/')) return;
    const ym = key.slice(MISS_STORE.length + 1);
    const items = (dump[key] || {}).items || {};
    Object.keys(items).forEach((id) => {
      const v = items[id];
      if (!v || !v.done || !(v.text || '').trim()) return;
      if ((v.kind || 'close') !== kind) return;
      out.push({ id, ym, ...v });
    });
  });
  return out.sort((a, b) => (b.d || '').localeCompare(a.d || '') || (b.at || '').localeCompare(a.at || ''));
}

/** いま見ている範囲（クローズ＝その月／週間掃除＝その期）に入っているか */
function missInRange(kind, e) {
  if (kind === 'week') {
    const [y, m, d] = (e.d || '').split('-').map(Number);
    if (!y) return false;
    return periodOfDate(y, m, d) === currentPeriod();
  }
  return (e.d || '').startsWith(missMonthKey(state.y, state.m));
}

/** その月のミスを「日付 → 件数」に（提出記録のカレンダーの印） */
function missCountByDay(y, m) {
  const out = {};
  missAll('close')
    .filter((e) => (e.d || '').startsWith(missMonthKey(y, m)))
    .forEach((e) => { out[e.d] = (out[e.d] || 0) + 1; });
  return out;
}

/** ミスを「期のはじまり → 件数」に（週間掃除の一覧の印） */
function missCountByPeriod() {
  const out = {};
  missAll('week').forEach((e) => {
    const [y, m, d] = (e.d || '').split('-').map(Number);
    if (!y) return;
    const p = periodOfDate(y, m, d);
    out[p] = (out[p] || 0) + 1;
  });
  return out;
}

/** ミスの一覧（この月・この期／すべて、店舗でしぼれます） */
function renderMissList(kind) {
  const ui = MISS_UI[kind];
  const view = missView[kind];
  const everything = missAll(kind);
  const all = view.range === 'all' ? everything : everything.filter((e) => missInRange(kind, e));
  const list = view.filter ? all.filter((e) => e.store === view.filter) : all;

  const $count = $(ui.count), $filter = $(ui.filter), $tally = $(ui.tally), $list = $(ui.list);
  $count.textContent = list.length ? `（${list.length}件）` : '';

  /* ---- 店舗でしぼるボタン。件数も出します ---- */
  const countOf = (id) => all.filter((e) => e.store === id).length;
  $filter.innerHTML = '';
  const chip = (id, label, n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'exp-chip' + (view.filter === id ? ' is-on' : '');
    b.dataset.store = id;
    if (id) b.style.setProperty('--pick-color', getStore(id).color);
    b.textContent = n ? `${label} ${n}` : label;
    b.addEventListener('click', () => { view.filter = id; renderMissList(kind); });
    $filter.appendChild(b);
  };
  chip('', `全店舗 ${all.length}`, 0);
  STORES.forEach((s) => chip(s.id, s.name, countOf(s.id)));

  /* ---- 店舗ごとの件数（多い順）---- */
  const tally = STORES.map((s) => ({ s, n: countOf(s.id) })).filter((r) => r.n)
    .sort((a, b) => b.n - a.n);
  $tally.textContent = tally.length > 1
    ? '多い順　' + tally.map((r) => `${r.s.name} ${r.n}件`).join('　／　') : '';
  $tally.classList.toggle('is-hidden', tally.length < 2);

  /* ---- 一覧 ---- */
  $list.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'miss-empty';
    li.textContent = view.range === 'all' ? 'ミスの記録はまだありません。' : ui.empty;
    $list.appendChild(li);
    return;
  }

  list.forEach((e) => {
    const store = getStore(e.store);
    const li = document.createElement('li');
    li.className = 'miss-item';
    if (store) li.style.setProperty('--row-color', store.color);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'miss-item__btn';
    const [yy, mm, dd] = (e.d || '').split('-');
    // すべてを見ているときは、何年かも分かるようにします
    const date = mm ? ((view.range === 'all' ? `${yy}/` : '') + `${+mm}/${+dd}`) : '—';
    btn.innerHTML =
      `<span class="miss-item__date">${date}</span>` +
      '<span class="miss-item__store"></span>' +
      '<span class="miss-item__who"></span>' +
      '<span class="miss-item__text"></span>' +
      `<span class="miss-item__by">${e.by ? '記録 ' + e.by : ''}</span>`;
    btn.querySelector('.miss-item__store').textContent = store ? store.name : '（店舗なし）';
    btn.querySelector('.miss-item__who').textContent = e.who || '—';
    btn.querySelector('.miss-item__text').textContent = e.text || '';
    btn.addEventListener('click', () => openMissForm(kind, e));

    li.appendChild(btn);
    $list.appendChild(li);
  });
}

/* -------- ミスを記録する画面（1つを使い回します） -------- */
let missEditing = null;
let missStore = '';
let missKind = 'close';

function openMissForm(kind, entry, preset = {}) {
  missKind = kind;
  missEditing = entry || null;
  missStore = entry ? (entry.store || '') : (preset.store || '');
  el.missDate.value = entry ? entry.d : (preset.d || ymd(state.y, state.m, state.d));
  el.missText.value = entry ? (entry.text || '') : '';
  el.missError.textContent = '';
  el.missFormTitle.textContent = (entry ? 'ミスの記録を直す' : 'ミスを記録する')
    + (kind === 'week' ? '（週間掃除）' : '');
  el.missSave.textContent = entry ? '直す' : '記録する';
  el.missDeleteRow.classList.toggle('is-hidden', !entry);

  /* 記録した人 */
  const names = Staff.list();
  if (entry && entry.by && !names.includes(entry.by)) names.push(entry.by);
  el.missBy.innerHTML = '<option value="">選んでください</option>';
  names.forEach((n) => {
    const o = document.createElement('option');
    o.value = n; o.textContent = n;
    el.missBy.appendChild(o);
  });
  el.missBy.value = entry ? (entry.by || '') : '';

  /* ミスした人。リストに無い人（アルバイトなど）は「その他」で名前を書きます */
  const who = entry ? (entry.who || '') : '';
  const list = Staff.list();
  el.missWho.innerHTML = '<option value="">選んでください</option>';
  list.forEach((n) => {
    const o = document.createElement('option');
    o.value = n; o.textContent = n;
    el.missWho.appendChild(o);
  });
  const other = document.createElement('option');
  other.value = MISS_OTHER;
  other.textContent = 'その他（名前を書く）';
  el.missWho.appendChild(other);

  const known = who && list.includes(who);
  el.missWho.value = known ? who : (who ? MISS_OTHER : '');
  el.missWhoFree.value = known ? '' : who;
  renderMissWhoField();

  /* 店舗のボタン */
  el.missStores.innerHTML = '';
  STORES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'exp-chip';
    b.dataset.store = s.id;
    b.style.setProperty('--pick-color', s.color);
    b.textContent = s.name;
    b.addEventListener('click', () => { missStore = s.id; renderMissChips(); });
    el.missStores.appendChild(b);
  });
  renderMissChips();

  el.missModal.classList.remove('is-hidden');
}

function renderMissChips() {
  [...el.missStores.children].forEach((b) => b.classList.toggle('is-on', b.dataset.store === missStore));
}

/** 「その他」を選んだときだけ、名前を書く欄を出します */
function renderMissWhoField() {
  el.missWhoFree.classList.toggle('is-hidden', el.missWho.value !== MISS_OTHER);
}

function saveMiss() {
  const d = el.missDate.value;
  const by = el.missBy.value;
  const who = el.missWho.value === MISS_OTHER
    ? el.missWhoFree.value.trim()
    : el.missWho.value;
  const text = el.missText.value.replace(/\r/g, '').trim();

  if (!d) { el.missError.textContent = '日付を入れてください。'; return; }
  if (!missStore) { el.missError.textContent = 'どの店舗かを選んでください。'; return; }
  if (el.missWho.value === MISS_OTHER && !who) {
    el.missError.textContent = 'ミスした人の名前を書いてください。'; return;
  }
  if (!text) { el.missError.textContent = '内容を入れてください。'; return; }

  // 入れ先は「その日の月」。月をまたいで入れても、正しい月に入ります
  const [yy, mm, dd] = d.split('-').map(Number);
  const key = missMonthKey(yy, mm);
  const id = missEditing ? missEditing.id
    : 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // 直すときに日付を別の月へ動かした場合は、元の月から取り除いてから移します
  // （どの月に入っている記録かは、一覧を作るときに ym として持たせてあります）
  if (missEditing) {
    const from = missEditing.ym || key;
    if (from !== key) Store.setItem(MISS_STORE, from, id, { done: false, text: '' });
  }

  Store.setItem(MISS_STORE, key, id, {
    done: true, d, store: missStore, text, who, by, kind: missKind,
  });

  // その記録が見える場所へ移します
  state.y = yy; state.m = mm;
  state.d = Math.min(dd, daysInMonth(yy, mm));
  el.missModal.classList.add('is-hidden');
  writeHash();
  render();
  renderSyncStatus();
}

async function removeMiss() {
  if (!missEditing) return;
  const store = getStore(missEditing.store);
  const ok = await askConfirm({
    item: `${(missEditing.d || '').replace(/^\d{4}-/, '')}　${store ? store.name : ''}`,
    message: 'このミスの記録を消します。よろしいですか？',
    okLabel: '消す',
    danger: true,
  });
  if (!ok) return;

  // 中身を空にすると一覧から外れます（消したことも同期で全端末に伝わります）
  Store.setItem(MISS_STORE, missEditing.ym || missMonthKey(state.y, state.m), missEditing.id,
    { done: false, text: '' });
  el.missModal.classList.add('is-hidden');
  render();
  renderSyncStatus();
}

/** 「この月／この期」と「すべて」の切り替えを取り付けます */
function bindMissRange(kind, id) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('.seg__btn');
    if (!b) return;
    missView[kind].range = b.dataset.range;
    [...$(id).children].forEach((n) => n.classList.toggle('is-on', n === b));
    renderMissList(kind);
  });
}

/** 表示中の日付を前後にずらす（月・年をまたいでもOK） */
/** 週間掃除の一覧を1年ずらします（その年の1つ目の期に移ります） */
function shiftWeekAllYear(diff) {
  const year = state.y + diff;
  let p = periodOfDate(year, 1, 1);
  if (p.slice(0, 4) < String(year)) p = addDaysStr(p, 14);
  goToWeek(p);
  writeHash();
  render();
}

/** 提出記録のカレンダーを1か月ずらします（日は その月に収まる日に寄せます） */
function shiftReportMonth(diff) {
  const dt = new Date(state.y, state.m - 1 + diff, 1);
  state.y = dt.getFullYear();
  state.m = dt.getMonth() + 1;
  state.d = Math.min(state.d, daysInMonth(state.y, state.m));
  writeHash();
  render();
}

function shiftDay(diff) {
  const dt = new Date(state.y, state.m - 1, state.d + diff);
  state.y = dt.getFullYear();
  state.m = dt.getMonth() + 1;
  state.d = dt.getDate();
  writeHash();
  render();
}

/** 表示中の月を前後にずらす（立替金の画面で使います） */
function shiftMonth(diff) {
  const dt = new Date(state.y, state.m - 1 + diff, 1);
  state.y = dt.getFullYear();
  state.m = dt.getMonth() + 1;
  state.d = Math.min(state.d, daysInMonth(state.y, state.m));
  writeHash();
  render();
}

/* ------------------------------------------------------------
 *  この日だけ営業／休業にする切り替え
 * ---------------------------------------------------------- */
function renderDayFlags(closed, dateStr) {
  const ex = Closed.exceptionOn(state.storeId, dateStr);

  el.overrideTag.classList.toggle('is-hidden', !ex);
  if (ex) {
    el.overrideTag.textContent = ex === 'closed' ? '臨時休業' : '臨時営業';
    el.overrideTag.className = 'override-tag override-tag--' + ex;
  }
  el.overrideReset.classList.toggle('is-hidden', !ex);
  el.closedToggle.textContent = closed ? 'この日は営業する' : 'この日を休業にする';
}

/** この日の営業／休業を切り替える */
function toggleDayClosed() {
  const dateStr = ymd(state.y, state.m, state.d);
  const closed = closedOn(state.storeId, state.d);
  const next = closed ? 'open' : 'closed';

  askConfirm({
    item: `${state.m}月${state.d}日`,
    message: next === 'closed'
      ? 'この日を休業にします。確認作業は不要になり、確認漏れにも数えません。'
      : 'この日を営業日にします。通常どおり確認作業が表示されます。',
    okLabel: next === 'closed' ? '休業にする' : '営業にする',
  }).then((ok) => {
    if (!ok) return;
    // 曜日の設定と同じ結果になるなら例外は持たない（設定が散らからないように）
    const byDow = Closed.dows(state.storeId).includes(new Date(state.y, state.m - 1, state.d).getDay());
    Closed.setException(state.storeId, dateStr, (next === 'closed') === byDow ? null : next);
    render();
  });
}

/* ------------------------------------------------------------
 *  担当者プルダウン
 * ---------------------------------------------------------- */
function renderStaffSelect(current) {
  const names = Staff.list();
  // 過去に選ばれた名前がリストから消えていても表示は残す
  if (current && !names.includes(current)) names.unshift(current);

  el.staffSelect.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '未選択';
  el.staffSelect.appendChild(blank);

  names.forEach((name) => {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = name;
    el.staffSelect.appendChild(o);
  });

  // ★担当者の出し入れは**マネージだけ**です（ko-dai の指示・2026-09-05）。
  //   前はここに「＋ 担当者リストを編集…」を出していましたが、
  //   押しても設定が開くだけで、**そこに編集する所はありません**でした。
  //   名前と中身が食いちがっていたので、消しました。
  //   まだ1人も登録が無いときだけ、どこで登録するかを出します（選べません）。
  if (!names.length) {
    const どこ = document.createElement('option');
    どこ.value = '';
    どこ.disabled = true;
    どこ.textContent = '担当者はマネージで登録します';
    el.staffSelect.appendChild(どこ);
  }

  el.staffSelect.value = current;
  el.staffSelect.classList.toggle('is-empty', !current);
}

/** 1項目の行を組み立て */
function buildItemRow(storeId, dateStr, item, data) {
  data = data || { done: false, value: '', at: null };

  const row = document.createElement('div');
  row.className = 'item' + (data.done ? ' is-done' : '');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'item__check';
  cb.checked = !!data.done;
  cb.id = `chk-${item.id}`;

  const body = document.createElement('div');
  body.className = 'item__body';

  const label = document.createElement('label');
  label.className = 'item__label';
  label.htmlFor = cb.id;
  label.textContent = item.label;
  body.appendChild(label);

  if (item.hint) {
    const hint = document.createElement('p');
    hint.className = 'item__hint';
    hint.textContent = item.hint;
    body.appendChild(hint);
  }

  /* 数値・テキスト入力 */
  if (item.type === 'number' || item.type === 'text') {
    const wrap = document.createElement('div');
    wrap.className = 'item__value';
    const input = document.createElement('input');
    input.className = 'item__input' + (item.type === 'text' ? ' item__input--text' : '');
    input.value = data.value || '';
    if (item.type === 'number') {
      input.type = 'text';
      input.inputMode = 'decimal';
      input.placeholder = '数値を入力';
      // 全角の数字（１２３）で入れても半角に直します
      bindNumericInput(input);
    } else {
      input.type = 'text';
      input.placeholder = '内容を入力';
    }
    input.addEventListener('change', () => {
      // 数値の項目は、貼り付けなどで全角のまま残った場合もここで直します
      if (item.type === 'number') input.value = toHalfWidthNumber(input.value);
      Store.setItem(storeId, dateStr, item.id, { value: input.value });
      renderDayTabs(false);
    });
    wrap.appendChild(input);
    if (item.unit) {
      const u = document.createElement('span');
      u.className = 'item__unit';
      u.textContent = item.unit;
      wrap.appendChild(u);
    }
    body.appendChild(wrap);
  }

  /* チェックした時刻（担当者はその日の担当者なので項目ごとには出さない） */
  const time = document.createElement('span');
  time.className = 'item__time';
  time.textContent = timeText(data);

  /* 誤チェック防止：チェックの前に確認する
     click で preventDefault し、「はい」のときだけ実際に切り替える */
  cb.addEventListener('click', (e) => {
    // click の時点で checked は既に反転済み。preventDefault で元に戻るので、
    // 「これから入れたい状態」は cb.checked そのもの
    const turningOn = cb.checked;
    e.preventDefault();
    // 提出済みの日でチェックを外すと、提出も取り消しになる
    const wasSubmitted = !turningOn && !!Store.getDay(storeId, dateStr).submittedAt;
    askConfirm({
      item: item.label,
      message: turningOn
        ? 'この項目を「完了」にします。確認は済んでいますか？'
        : wasSubmitted
          ? 'この項目のチェックを外します。この日は提出済みのため、提出も取り消されます。'
          : 'この項目のチェックを外します。よろしいですか？',
      okLabel: turningOn ? '完了にする' : 'チェックを外す',
      danger: !turningOn,
    }).then((ok) => {
      if (!ok) return;
      cb.checked = turningOn;
      const next = Store.setItem(storeId, dateStr, item.id, { done: turningOn });
      if (wasSubmitted) Store.unsubmit(storeId, dateStr);
      row.classList.toggle('is-done', turningOn);
      time.textContent = timeText(next);
      refreshProgress();
      renderDayTabs(false);
    });
  });

  row.appendChild(cb);
  row.appendChild(body);
  row.appendChild(time);
  return row;
}

function timeText(data) {
  if (!data.done || !data.at) return '';
  const t = new Date(data.at);
  return `${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
}

/** チェック後に進捗バーとセクション件数だけ更新 */
function refreshProgress() {
  const rec = Store.getDay(state.storeId, ymd(state.y, state.m, state.d));
  const items = selectedDayItems();
  const done = countDone(rec, items);
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  el.progressBar.style.width = pct + '%';
  el.progressBar.classList.toggle('is-done', done === items.length && items.length > 0);
  el.progressText.textContent = items.length ? `${done} / ${items.length}` : '定休日';

  const ignoreClosed = closedOn(state.storeId, state.d);
  getChecklist(state.storeId).forEach((sec) => {
    const badge = el.checklist.querySelector(`.section__count[data-section-id="${sec.id}"]`);
    if (!badge) return;
    const secItems = sectionItemsForDay(sec, state.storeId, state.d, ignoreClosed);
    const n = countDone(rec, secItems);
    badge.textContent = `${n} / ${secItems.length}`;
    badge.classList.toggle('is-done', n === secItems.length);
  });

  el.updated.textContent = rec.updatedAt
    ? `最終更新：${new Date(rec.updatedAt).toLocaleString('ja-JP')}${rec.updatedBy ? '（' + rec.updatedBy + '）' : ''}`
    : '';

  refreshSubmitCard();
}

/** チェックのたびに提出ボタンの状態も作り直す */
function refreshSubmitCard() {
  const dateStr = ymd(state.y, state.m, state.d);
  const rec = Store.getDay(state.storeId, dateStr);
  const closed = closedOn(state.storeId, state.d);
  const items = selectedDayItems();
  renderSubmit(closed, !closed || hasAnyData(rec), dateStr, rec, items, countDone(rec, items));
  renderWeekSubmit(dateStr);
}

/* ============================================================
 *  描画：週間掃除ビュー
 *
 *  縦が項目、横が週（日曜はじまり）。1週ずつ／2週まとめて を選べます。
 *  記録は「週」ごとに1つで、クローズの記録とは別に持っています
 *  （キーは storeId/W2026-08-02 の形。config.js の weekRecKey）。
 *
 *  提出と達成率の単位は「2週間（期）」です。期の1週目の記録に
 *  提出の印と備考を持たせています。
 * ============================================================ */

/** いま見ている週（日曜の日付） */
function currentWeek() {
  return weekStartOf(state.y, state.m, state.d);
}

/** いま見ている期（2週間）の1週目 */
function currentPeriod() {
  return periodStartOf(currentWeek());
}

/** 表示する週を移す。日付は、その週の日曜に合わせます */
function goToWeek(weekStart) {
  const [y, m, d] = weekStart.split('-').map(Number);
  state.y = y; state.m = m; state.d = d;
}

/** ISO日時を「8/12」の形にする */
function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function renderWeekView() {
  const storeId = state.storeId;
  const period = currentPeriod();
  const weeks = periodWeeks(period);
  const nowWeek = weekStartOf(TODAY.y, TODAY.m, TODAY.d);

  /* ---- 見出しと送り戻し ---- */
  el.weekNavMain.textContent = periodRangeLabel(period);
  el.weekNavSub.textContent = period === periodStartOf(nowWeek) ? 'この2週間' : '2週間分';

  /* ---- 表 ---- */
  const items = getWeekly(storeId).filter((it) => weeks.some((w) => weeklyAppliesTo(it, w, storeId)));
  const empty = items.length === 0;
  el.weekEmpty.classList.toggle('is-hidden', !empty);
  el.weekNoteCard.classList.toggle('is-hidden', empty);
  el.periodCard.classList.toggle('is-hidden', empty);
  el.weekTableWrap.classList.toggle('is-hidden', empty);

  const t = el.weekTable;
  t.innerHTML = '';

  const thead = document.createElement('thead');
  const htr = document.createElement('tr');
  htr.innerHTML = '<th class="col-item">掃除する場所</th>';
  weeks.forEach((w, i) => {
    const th = document.createElement('th');
    // 横1列に収める（「8/9〜8/15」を1行で）
    th.innerHTML =
      `<span class="week-th__nth">${i + 1}週目</span>` +
      `<span class="week-th__range">${weekShortLabel(w)}〜${weekShortLabel(weekEndOf(w))}</span>`;
    if (w === nowWeek) {
      th.classList.add('is-now');
      // 左右どちらが今週かが ひと目で分かるように札を出します
      th.insertAdjacentHTML('beforeend', '<span class="week-th__now">今週</span>');
    }
    th.title = weekRangeLabel(w);
    htr.appendChild(th);
  });
  thead.appendChild(htr);
  t.appendChild(thead);

  const tbody = document.createElement('tbody');
  // ホール・キッチン・トイレ…の見出しで区切って並べます
  const groups = groupWeekly(items);
  groups.forEach((g) => {
    // 見出しが1つしか無いときは、わざわざ帯を出しません
    if (groups.length > 1) {
      const htr2 = document.createElement('tr');
      htr2.className = 'week-group';
      const gtd = document.createElement('td');
      gtd.colSpan = 3;
      // 色の棒＋名前。上に余白を空けて、項目の行と見分けやすくします
      const glabel = document.createElement('span');
      glabel.className = 'week-group__label';
      glabel.textContent = g.name;
      gtd.appendChild(glabel);
      htr2.appendChild(gtd);
      tbody.appendChild(htr2);
    }

    g.items.forEach((it, i) => {
      const tr = document.createElement('tr');
      // 1行おきに色を付けて、目が横にすべらないようにします（見出しごとに数え直し）
      if (i % 2 === 1) tr.classList.add('is-alt');

      const nameTd = document.createElement('td');
      nameTd.className = 'col-item';
      nameTd.textContent = it.label;
      // 毎週やるものにだけ印を付けます（2週に1回のものは、マスが1つに
      // つながっているので印は付けません）
      if (!isBiweekly(it)) {
        const tag = document.createElement('span');
        tag.className = 'week-every';
        tag.textContent = '毎週';
        nameTd.appendChild(tag);
      }
      tr.appendChild(nameTd);

      // 2週に1回の項目は、記録を期の1週目にまとめて持ち、マスも1つにつなげます
      if (isBiweekly(it)) {
        const td = weekCell(storeId, it, period, nowWeek);
        td.classList.add('week-cell--span');
        td.colSpan = 2;
        tr.appendChild(td);
      } else {
        weeks.forEach((w) => tr.appendChild(weekCell(storeId, it, w, nowWeek)));
      }
      tbody.appendChild(tr);
    });
  });
  t.appendChild(tbody);

  renderPeriodCard(storeId, period);

  /* ---- 備考（期ごと） ---- */
  el.weekNote.value = Store.getDay(storeId, weekRecKey(period)).note || '';

  /* ---- 随時掃除（上の表とは別物。達成率には入れません） ---- */
  renderAnytimeBlock();
}

/** 表のマス1つ。押すと「やった人」を選ぶ画面が出ます */
function weekCell(storeId, item, week, nowWeek) {
  const td = document.createElement('td');
  td.className = 'week-cell';
  if (week === nowWeek) td.classList.add('is-now');
  if (week > nowWeek) td.classList.add('is-future');

  if (!weeklyAppliesTo(item, week, storeId)) {
    td.classList.add('is-future');
    td.innerHTML = '<span class="cell-mark cell-mark--none">–</span>';
    return td;
  }

  const cur = Store.getDay(storeId, weekRecKey(week)).items?.[item.id];
  const done = !!cur?.done;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'week-btn' + (done ? ' is-done' : '');

  // 済んだマスは「✓ 担当者 日付」を横1列に並べます
  const mark = document.createElement('span');
  mark.className = 'week-btn__mark';
  mark.textContent = done ? '✓' : '・';
  btn.appendChild(mark);

  if (done) {
    if (cur.by) {
      const by = document.createElement('span');
      by.className = 'week-btn__name';
      by.textContent = cur.by;
      btn.appendChild(by);
    }
    const at = shortDate(cur.at);
    if (at) {
      const when = document.createElement('span');
      when.className = 'week-btn__date';
      when.textContent = at;
      btn.appendChild(when);
    }
  }

  btn.title = `${item.label}　${weekRangeLabel(week)}`;
  btn.addEventListener('click', () => openDoerModal(item, week));
  td.appendChild(btn);
  return td;
}

/* ------------------------------------------------------------
 *  達成率の円グラフ（ドーナツ）
 *
 *  中央に％の数字を大きく置き、輪の長さで進み具合を見せます。
 *  数字が主役で、輪はその補助です。
 * ---------------------------------------------------------- */
function donut(rate, { size = 96, stroke = 10, color = 'var(--store)', label = '' } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const pct = Math.min(Math.max(rate, 0), 100);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'donut');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${label}達成率 ${rate}%`);

  const title = document.createElementNS(NS, 'title');
  title.textContent = `${label}達成率 ${rate}%`;
  svg.appendChild(title);

  // 下地の輪（100%分の目盛り）
  const track = document.createElementNS(NS, 'circle');
  track.setAttribute('class', 'donut__track');
  track.setAttribute('cx', size / 2);
  track.setAttribute('cy', size / 2);
  track.setAttribute('r', r);
  track.setAttribute('stroke-width', stroke);
  svg.appendChild(track);

  // 進んだ分の輪。12時から時計回りに伸びます
  if (pct > 0) {
    const arc = document.createElementNS(NS, 'circle');
    arc.setAttribute('class', 'donut__arc');
    arc.setAttribute('cx', size / 2);
    arc.setAttribute('cy', size / 2);
    arc.setAttribute('r', r);
    arc.setAttribute('stroke-width', stroke);
    arc.setAttribute('stroke-dasharray', `${(circ * pct) / 100} ${circ}`);
    arc.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
    arc.style.stroke = pct === 100 ? 'var(--ok)' : color;
    svg.appendChild(arc);
  }

  const text = document.createElementNS(NS, 'text');
  text.setAttribute('class', 'donut__value');
  text.setAttribute('x', size / 2);
  text.setAttribute('y', size / 2);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'central');
  text.style.fill = pct === 100 ? 'var(--ok)' : color;
  text.textContent = `${rate}%`;
  svg.appendChild(text);

  return svg;
}

/* ------------------------------------------------------------
 *  この2週間の達成状況と提出
 * ---------------------------------------------------------- */
function renderPeriodCard(storeId, period) {
  const st = periodStatus(storeId, period);
  const submitted = !!st.submittedAt;

  el.periodTitle.textContent = `この2週間 ${periodRangeLabel(period)}`;
  el.periodRate.textContent = `${st.rate}%`;
  el.periodRate.classList.toggle('is-full', st.rate === 100);
  el.periodBar.style.width = `${st.rate}%`;
  el.periodBar.classList.toggle('is-done', st.rate === 100);

  const remain = st.total - st.done;
  el.periodCount.textContent = `${st.done} / ${st.total} マス` +
    (st.total === 0 ? '' : remain === 0 ? '　すべて済んでいます' : `　残り ${remain} マス`);

  el.periodCard.classList.toggle('is-submitted', submitted);

  // 提出はクローズのページで行うので、ここではいつ提出できるかだけ案内します
  const last = periodEndOf(period);
  if (submitted) {
    const d = new Date(st.submittedAt);
    el.periodWhen.textContent =
      `提出済み　${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` +
      `${st.submittedBy ? '　' + st.submittedBy : ''}`;
    el.periodWhen.classList.add('is-done');
  } else {
    const [, lm, ld] = last.split('-').map(Number);
    el.periodWhen.textContent = TODAY_STR > last
      ? `未提出です（提出日は ${lm}/${ld} でした）。クローズの ${lm}/${ld} から提出できます`
      : `提出は最終日の ${lm}/${ld}（土）に、クローズの提出ボタンの下に出ます`;
    el.periodWhen.classList.remove('is-done');
  }
}

/* ------------------------------------------------------------
 *  週間掃除の提出（クローズのページの、提出ボタンの下）
 *
 *  2週間に1回でよいので、その2週間の最終日（2週目の土曜）を
 *  開いているときだけ出します。出し忘れたときのために、
 *  最終日を過ぎても未提出のあいだは出したままにしています。
 * ---------------------------------------------------------- */
function renderWeekSubmit(dateStr) {
  const storeId = state.storeId;
  const period = periodStartOf(weekStartOf(state.y, state.m, state.d));
  const last = periodEndOf(period);
  const st = periodStatus(storeId, period);
  const submitted = !!st.submittedAt;

  // 出す日：その2週間の最終日。ただし提出済みならその日だけ、
  // 未提出なら最終日を過ぎたあとも出しておく
  const isLast = dateStr === last;
  const overdue = !submitted && dateStr > last && dateStr <= addDaysStr(last, 13);
  const show = st.total > 0 && (isLast || overdue);

  el.weekSubmitCard.classList.toggle('is-hidden', !show);
  if (!show) return;

  const [, lm, ld] = last.split('-').map(Number);
  el.weekSubmitRange.textContent = periodRangeLabel(period) + (overdue ? `　※${lm}/${ld}が提出日でした` : '');
  el.weekSubmitRate.textContent = `達成率 ${st.rate}%（${st.done} / ${st.total} マス）`;
  el.weekSubmitRate.classList.toggle('is-full', st.rate === 100);

  const sending = state.sending === `${state.storeId}/${weekRecKey(period)}`;
  el.weekSubmitCard.classList.toggle('is-submitted', submitted && !sending);
  el.weekSubmitCard.classList.toggle('is-sending', sending);
  el.periodSubmit.classList.toggle('is-hidden', submitted || sending);
  el.periodDone.classList.toggle('is-hidden', !submitted || sending);

  if (sending) {
    el.weekSubmitRate.innerHTML =
      '<span class="submit-card__sending"><span class="submit-card__spin"></span>送信中…</span>';
    return;
  }

  if (submitted) {
    const d = new Date(st.submittedAt);
    el.periodDoneMeta.textContent =
      `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` +
      `${st.submittedBy ? '　' + st.submittedBy : ''}　達成率 ${st.rate}%`;
  } else {
    fillStaffOptions(el.periodStaff, st.staff);
    refreshPeriodSubmitBtn();
  }
}

/**
 * 同期が止まっていたら、その場で知らせる
 *
 * ★クローズは、同じ日を何人かで見ます。同期が止まっている端末は
 *   「誰かが提出したのに、こちらは未提出のまま」になります。
 *   ヘッダーの小さなしるしだけでは気づけないので、ここにも出します。
 */
function renderSyncWarn() {
  if (!el.syncWarn) return;
  if (!Sync.enabled() || !Sync.pin()) {
    el.syncWarn.classList.add('is-hidden');
    return;
  }

  // ★まず「まだ送れていない分」を見ます。
  //   チェックや提出はいったんこの端末に入り、あとからまとめて送られます。
  //   ここが残ったままアプリを閉じると、みんなの画面には出ません。
  //   実際に、64項目全部チェックしてあるのに提出だけ届いていない日がありました
  const waiting = Sync.outbox().length;
  const stale = Sync.lastSyncAt && (Date.now() - Sync.lastSyncAt.getTime() > 5 * 60 * 1000);
  const never = !Sync.lastSyncAt;

  // ★これが最優先です。シートに保存できなかった記録があると、
  //   送れたように見えて中身が入っていません。ほかの知らせより先に出します
  if (Sync.serverWarn) {
    el.syncWarn.classList.remove('is-hidden');
    el.syncWarn.className = 'sync-warn';
    el.syncWarn.textContent = Sync.serverWarn;
    return;
  }

  if (waiting) {
    el.syncWarn.classList.remove('is-hidden');
    el.syncWarn.className = 'sync-warn is-waiting';
    el.syncWarn.textContent = `まだ送れていない入力が ${waiting}件 あります。`
      + '電波の届くところでアプリを開いたままにしてください。'
      + '送れるまで、ほかの人の画面には出ません。';
    return;
  }

  const bad = !!Sync.lastError || stale || never;
  el.syncWarn.className = 'sync-warn' + (bad ? '' : ' is-hidden');
  if (!bad) return;
  el.syncWarn.textContent = (Sync.lastError || 'しばらく同期できていません')
    + '　ほかの人が提出しても、この画面には出ていないかもしれません。'
    + 'ヘッダーのしるしを押すと、いま同期します。';
}

/** 提出する人を選ぶまで、週間掃除の提出ボタンは押せません */
function refreshPeriodSubmitBtn() {
  const picked = !!el.periodStaff.value;
  el.periodSubmitBtn.disabled = !picked;
  el.periodStaff.classList.toggle('is-empty', !picked);
  el.weekSubmitHint.textContent = picked ? '' : '提出する人を選ぶと提出できます';
}

/** 担当者のプルダウンを作る（空欄つき） */
function fillStaffOptions(select, current) {
  const names = Staff.list();
  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '選択…';
  select.appendChild(blank);
  names.forEach((n) => {
    const o = document.createElement('option');
    o.value = n;
    o.textContent = n;
    select.appendChild(o);
  });
  select.value = names.includes(current) ? current : '';
}

function submitPeriod() {
  const storeId = state.storeId;
  const period = currentPeriod();
  const st = periodStatus(storeId, period);
  if (st.total === 0) return;

  const name = el.periodStaff.value;
  if (!name) return; // 念のため（ボタンは無効化済み）

  const remain = st.total - st.done;
  askConfirm({
    item: `週間掃除　${periodRangeLabel(period)}`,
    message: (remain === 0
      ? `${st.total}マスすべてが済んでいます（達成率 100%）。`
      : `達成率 ${st.rate}%（${st.done} / ${st.total} マス）で提出します。`
        + `未実施が ${remain} マスありますが、このまま提出しますか？`)
      + `\n提出する人は ${name} さんです。`,
    okLabel: '提出する',
  }).then(async (ok) => {
    if (!ok) return;
    Store.setStaff(storeId, weekRecKey(period), name);
    Store.submit(storeId, weekRecKey(period));
    await sendSubmit(`${storeId}/${weekRecKey(period)}`);
  });
}

function unsubmitPeriod() {
  const storeId = state.storeId;
  const period = currentPeriod();
  askConfirm({
    item: `週間掃除　${periodRangeLabel(period)}`,
    message: '提出を取り消します。6店舗の達成状況では「未提出」に戻ります。',
    okLabel: '取り消す',
    danger: true,
  }).then((ok) => {
    if (!ok) return;
    Store.unsubmit(storeId, weekRecKey(period));
    render();
  });
}

/* ============================================================
 *  描画：6店舗の達成状況（週間掃除）
 * ============================================================ */
function renderWeekAll() {
  renderWeekAllYear();
  renderWeekAllPeriod();
  renderMissList('week');
}

/**
 * その年の「期」を全部ならべる
 *
 * 週間掃除は2週間で1つの区切りなので、日のカレンダーではなく期をならべます。
 * 中の見かたは提出記録のカレンダーと同じで、
 *   出した店舗 … その店舗のアイコン
 *   項目が無い … アイコンをうすく
 *   まだの店舗 … アイコンは出さず「未◯」と数で
 * です。
 */
function renderWeekAllYear() {
  const year = state.y;
  el.weekAllYear.textContent = `${year}年`;
  const misses = missCountByPeriod();
  const now = currentPeriod();
  const today = ymd(TODAY.y, TODAY.m, TODAY.d);

  /* その年に始まる期を集めます */
  let p = periodOfDate(year, 1, 1);
  if (p.slice(0, 4) < String(year)) p = addDaysStr(p, 14);
  const list = [];
  while (p.slice(0, 4) === String(year)) { list.push(p); p = addDaysStr(p, 14); }

  el.weekAllGrid.innerHTML = '';
  let doneAll = 0, targetAll = 0;
  list.forEach((start) => {
    const future = start > today;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'period-cell'
      + (start === now ? ' is-picked' : '')
      + (future ? ' is-future' : '');

    const label = document.createElement('span');
    label.className = 'period-cell__label';
    label.textContent = periodRangeLabel(start).replace(/（.）/g, '');
    cell.appendChild(label);

    const marks = document.createElement('span');
    marks.className = 'cal__marks';
    let done = 0, target = 0, yet = 0;
    STORES.forEach((s) => {
      const st = periodStatus(s.id, start);
      const none = st.total === 0;                 // この期は対象の項目が無い
      if (!none) {
        target += 1;
        if (st.submittedAt) done += 1; else yet += 1;
      }
      if (!none && !st.submittedAt) return;

      const chip = document.createElement('span');
      chip.className = 'logo-chip cal-logo' + (none ? ' is-closed' : '');
      chip.title = `${s.name}${none ? '（項目なし）' : '（提出済み）'}`;
      fillLogo(chip, s);
      marks.appendChild(chip);
    });
    if (yet) {
      const left = document.createElement('span');
      left.className = 'cal-yet' + (future ? '' : ' is-late');
      left.textContent = `未${yet}`;
      left.title = `未提出 ${yet}店舗`;
      marks.appendChild(left);
    }
    cell.appendChild(marks);

    if (misses[start]) {
      const badge = document.createElement('span');
      badge.className = 'cal-miss';
      badge.textContent = misses[start] > 1 ? misses[start] : '!';
      badge.title = `ミスの記録 ${misses[start]}件`;
      cell.appendChild(badge);
    }
    if (!future && target && done === target) cell.classList.add('is-all');
    if (!future) { doneAll += done; targetAll += target; }

    cell.addEventListener('click', () => {
      goToWeek(start);
      writeHash();
      render();
    });
    el.weekAllGrid.appendChild(cell);
  });

  el.weekAllYearSummary.textContent = targetAll ? `今までの提出 ${doneAll} / ${targetAll}` : '';
  el.weekAllYearSummary.classList.toggle('is-all-done', targetAll > 0 && doneAll === targetAll);
}

/** 選んだ期の中身（店舗ごとの達成率） */
function renderWeekAllPeriod() {
  const period = currentPeriod();
  el.weekAllRange.textContent = periodRangeLabel(period);

  const rows = STORES.map((store) => ({ store, st: periodStatus(store.id, period) }));
  const active = rows.filter((r) => r.st.total > 0);
  const submitted = active.filter((r) => r.st.submittedAt).length;
  const avg = active.length
    ? Math.round(active.reduce((n, r) => n + r.st.rate, 0) / active.length)
    : 0;

  el.weekAllSummary.textContent = active.length
    ? `平均の達成率 ${avg}%　提出済み ${submitted} / ${active.length} 店舗`
    : 'この2週間に対象の項目がある店舗はありません。';
  el.weekAllSummary.classList.toggle('is-all-done', active.length > 0 && submitted === active.length);

  el.weekAllList.innerHTML = '';
  rows.forEach(({ store, st }) => {
    const li = document.createElement('li');
    li.className = 'rate-item';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rate-card';
    btn.style.setProperty('--card-color', store.color);

    // 店舗選択の画面と同じ並び（ロゴ → 店名 → 中身）にそろえます
    const chip = document.createElement('span');
    chip.className = 'logo-chip logo-chip--rate';
    fillLogo(chip, store);
    btn.appendChild(chip);

    const name = document.createElement('span');
    name.className = 'rate-card__name';
    name.textContent = store.name;
    btn.appendChild(name);

    // 6店舗を並べて比べる画面なので、輪の色はそろえます。
    // 店舗の見分けはロゴ・店名・カードの上の色が持たせます
    btn.appendChild(donut(st.total ? st.rate : 0, {
      size: 104, stroke: 10, color: 'var(--accent)', label: `${store.name}の`,
    }));

    const count = document.createElement('span');
    count.className = 'rate-card__count';
    count.textContent = st.total ? `${st.done} / ${st.total} マス` : '項目なし';
    btn.appendChild(count);

    const badge = document.createElement('span');
    badge.className = 'rate-card__badge ' +
      (!st.total ? 'rate-card__badge--none'
        : st.submittedAt ? 'rate-card__badge--done' : 'rate-card__badge--todo');
    badge.textContent = !st.total ? '—' : st.submittedAt ? '提出済み' : '未提出';
    if (st.submittedAt && st.submittedBy) badge.title = `提出者 ${st.submittedBy}`;
    btn.appendChild(badge);

    btn.addEventListener('click', () => {
      state.storeId = store.id;
      state.view = 'week';
      goToWeek(period);
      writeHash();
      render();
      window.scrollTo(0, 0);
    });
    li.appendChild(btn);
    el.weekAllList.appendChild(li);
  });
}

/* ---------- やった人を選ぶ ---------- */
let doerTarget = null; // { item, week }

function openDoerModal(item, week) {
  doerTarget = { kind: 'week', item, week };
  el.doerItem.textContent = item.label;
  el.doerWeek.textContent = isBiweekly(item)
    ? `${periodRangeLabel(periodStartOf(week))} のうち1回`
    : weekRangeLabel(week);

  const cur = Store.getDay(state.storeId, weekRecKey(week)).items?.[item.id];
  const done = !!cur?.done;
  el.doerClear.classList.toggle('is-hidden', !done);

  fillDoerNames(done, cur);
  el.doerModal.classList.remove('is-hidden');
}

/**
 * 随時掃除の「やった人」を選ぶ画面
 * 週の指定がないので、押した日がそのまま「最後にやった日」になります
 */
function openAnytimeDoer(item) {
  doerTarget = { kind: 'anytime', item, week: null };
  el.doerItem.textContent = item.label;

  const cur = Store.getDay(state.storeId, ANYTIME_KEY).items?.[item.id];
  const done = !!cur?.at;
  el.doerWeek.textContent = done
    ? `最後にやったのは ${shortDate(cur.at)}（${cur.by || '担当者なし'}）`
    : 'まだ記録がありません';
  el.doerClear.classList.toggle('is-hidden', !done);

  fillDoerNames(done, cur);
  el.doerModal.classList.remove('is-hidden');
}

/** 担当者のボタンを並べる（週間掃除・随時掃除で共通） */
function fillDoerNames(done, cur) {
  const names = Staff.list();
  el.doerGrid.innerHTML = '';
  if (!names.length) {
    el.doerGrid.innerHTML = '<p class="modal__note">担当者が登録されていません。管理アプリから登録してください。</p>';
  }
  names.forEach((name) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'doer-btn' + (done && cur.by === name ? ' is-current' : '');
    b.textContent = name;
    b.addEventListener('click', () => pickDoer(name));
    el.doerGrid.appendChild(b);
  });
}

function closeDoerModal() {
  doerTarget = null;
  el.doerModal.classList.add('is-hidden');
}

/** 記録の入れ先。随時掃除は日付ではなく1つのまとまりに入れます */
function doerKey(target) {
  return target.kind === 'anytime' ? ANYTIME_KEY : weekRecKey(target.week);
}

function doerRedraw() {
  // 随時掃除も週間掃除ページの中にあるので、まとめて描き直します
  renderWeekView();
  renderSyncStatus();
}

function pickDoer(name) {
  if (!doerTarget) return;
  const target = doerTarget;
  Store.setItem(state.storeId, doerKey(target), target.item.id, { done: true, by: name });
  closeDoerModal();
  doerRedraw();
}

function clearDoer() {
  if (!doerTarget) return;
  const target = doerTarget;
  Store.setItem(state.storeId, doerKey(target), target.item.id, { done: false, by: '' });
  closeDoerModal();
  doerRedraw();
}

/* ============================================================
 *  描画：随時掃除ビュー（決まった間隔がない掃除）
 *
 *  期限が無いので、できた・できないの判定はしません。
 *  「最後にやった日」と「そこから何日たったか」だけを見せます。
 * ============================================================ */
/** 日付（ISO）から今日までの日数。今日なら 0 */
function daysAgo(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(TODAY.y, TODAY.m - 1, TODAY.d);
  return Math.round((b - a) / 86400000);
}

/** 「今日」「昨日」「12日前」のような言い方にする */
function agoLabel(n) {
  if (n === null) return '';
  if (n <= 0) return '今日';
  if (n === 1) return '昨日';
  return `${n}日前`;
}

function renderAnytimeBlock() {
  const storeId = state.storeId;
  const items = getAnytime(storeId).filter(anytimeShows);
  // 項目が無い店舗では、この かたまり ごと出しません
  el.anytimeBlock.classList.toggle('is-hidden', items.length === 0);
  if (!items.length) return;

  const rec = Store.getDay(storeId, ANYTIME_KEY);
  const groups = groupWeekly(items); // 見出しは週間掃除と同じ分け方

  el.anytimeList.innerHTML = '';
  groups.forEach((g) => {
    if (groups.length > 1) {
      const head = document.createElement('li');
      head.className = 'anytime-group';
      head.innerHTML = `<span class="week-group__label">${g.name}</span>`;
      el.anytimeList.appendChild(head);
    }

    g.items.forEach((item) => {
      const cur = rec.items?.[item.id];
      const n = daysAgo(cur?.at);

      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'anytime-row' + (n === null ? ' is-never' : '');

      const main = document.createElement('span');
      main.className = 'anytime-row__main';
      const name = document.createElement('span');
      name.className = 'anytime-row__name';
      name.textContent = item.label;
      main.appendChild(name);
      if (item.note) {
        const note = document.createElement('span');
        note.className = 'anytime-row__note';
        note.textContent = item.note;
        main.appendChild(note);
      }

      const last = document.createElement('span');
      last.className = 'anytime-row__last';
      if (n === null) {
        last.innerHTML = '<span class="anytime-row__ago">まだ記録なし</span>';
      } else {
        last.innerHTML =
          `<span class="anytime-row__ago">${agoLabel(n)}</span>` +
          `<span class="anytime-row__date">${shortDate(cur.at)}${cur.by ? '　' + cur.by : ''}</span>`;
      }

      b.append(main, last);
      b.addEventListener('click', () => openAnytimeDoer(item));
      li.appendChild(b);
      el.anytimeList.appendChild(li);
    });
  });
}

/* ============================================================
 *  描画：月間表ビュー（確認漏れの一覧チェック用）
 * ============================================================ */
function renderMonthView() {
  const storeId = state.storeId;
  const ym = `${state.y}-${pad2(state.m)}`;
  const month = Store.getMonth(storeId, ym);
  const last = daysInMonth(state.y, state.m);
  const sections = getChecklist(storeId);
  const startDate = Store.firstDate(storeId); // 運用開始前は「対象外」扱い（×にしない）

  /** 前日まで＝確認漏れの判定対象。本日はまだ営業中なので漏れに数えない */
  const isPast = (dateStr) =>
    dateStr < TODAY_STR && !!startDate && dateStr >= startDate;
  const isToday = (dateStr) => dateStr === TODAY_STR;

  /* ---- 表 ---- */
  const t = el.monthTable;
  t.innerHTML = '';

  const thead = document.createElement('thead');
  const htr = document.createElement('tr');
  htr.innerHTML = '<th class="col-item">確認項目</th>';
  for (let d = 1; d <= last; d++) {
    const dow = new Date(state.y, state.m - 1, d).getDay();
    const th = document.createElement('th');
    th.textContent = d;
    if (dow === 0) th.className = 'is-sun';
    if (dow === 6) th.className = 'is-sat';
    if (closedOn(storeId, d)) th.classList.add('is-closed');
    if (ymd(state.y, state.m, d) === TODAY_STR) th.classList.add('is-today');
    htr.appendChild(th);
  }
  thead.appendChild(htr);
  t.appendChild(thead);

  const tbody = document.createElement('tbody');
  let missCount = 0;

  sections.forEach((sec) => {
    const secTr = document.createElement('tr');
    secTr.className = 'row-section';
    secTr.innerHTML = `<td class="col-item">${sec.title}</td><td colspan="${last}"></td>`;
    tbody.appendChild(secTr);

    sec.items.forEach((it) => {
      const tr = document.createElement('tr');
      const th = document.createElement('td');
      th.className = 'col-item';
      th.textContent = it.label;
      tr.appendChild(th);

      for (let d = 1; d <= last; d++) {
        const dateStr = ymd(state.y, state.m, d);
        const rec = month[pad2(d)];
        const done = !!rec?.items?.[it.id]?.done;
        const td = document.createElement('td');
        td.className = 'day-cell';
        if (closedOn(storeId, d)) {
          td.innerHTML = '<i class="cell-mark cell-mark--closed">休</i>';
          td.classList.add('is-closed');
        } else if (!appliesTo(it, getStore(storeId), state.y, state.m, d)) {
          // その日は対象外の項目（例：肉の日POP、翌日が休みのランチメニュー）
          td.innerHTML = '<i class="cell-mark cell-mark--off"></i>';
          td.classList.add('is-off');
        } else if (done) {
          td.innerHTML = '<i class="cell-mark cell-mark--ok">✓</i>';
        } else if (isPast(dateStr)) {
          td.innerHTML = '<i class="cell-mark cell-mark--ng">×</i>';
          missCount++;
        } else if (isToday(dateStr)) {
          td.innerHTML = '<i class="cell-mark cell-mark--wait">未</i>';
        } else {
          td.innerHTML = '<i class="cell-mark cell-mark--none">–</i>';
        }
        td.addEventListener('click', () => {
          state.d = d;
          state.view = 'day';
          writeHash();
          render();
        });
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  });

  /* 合計行 */
  const totalTr = document.createElement('tr');
  totalTr.className = 'row-total';
  const ttd = document.createElement('td');
  ttd.className = 'col-item';
  ttd.textContent = '完了数 / 全項目';
  totalTr.appendChild(ttd);

  let pastDays = 0, fullDays = 0, closedDays = 0, todayDone = null, todayTotal = 0, totalChecks = 0;
  for (let d = 1; d <= last; d++) {
    const dateStr = ymd(state.y, state.m, d);
    const rec = month[pad2(d)];
    const closed = closedOn(storeId, d);
    const dayItems = itemsForDay(storeId, d); // 定休日は0件、日によっても対象項目数が変わる
    const done = countDone(rec, dayItems);
    const td = document.createElement('td');

    if (closed) {
      // 定休日は対象日数にも確認漏れにも数えない
      if (isPast(dateStr) || isToday(dateStr)) closedDays++;
      if (isToday(dateStr)) todayDone = 'closed';
      td.innerHTML = '<i class="cell-mark cell-mark--closed">休</i>';
      td.classList.add('is-closed');
      td.title = `${state.m}/${d}　定休日`;
    } else {
      if (isPast(dateStr)) { pastDays++; totalChecks += dayItems.length; }
      if (isToday(dateStr)) { todayDone = done; todayTotal = dayItems.length; }
      if (dayItems.length > 0 && done === dayItems.length && (isPast(dateStr) || isToday(dateStr))) fullDays++;
      td.textContent = done;
      td.title = `${state.m}/${d}　${done} / ${dayItems.length}`;
      if (isPast(dateStr) && done < dayItems.length) td.classList.add('cell-mark--ng');
    }
    totalTr.appendChild(td);
  }
  tbody.appendChild(totalTr);
  t.appendChild(tbody);

  /* ---- サマリー ---- */
  const rate = totalChecks ? Math.round(((totalChecks - missCount) / totalChecks) * 100) : 0;
  const unit = (s) => `<span style="font-size:13px"> ${s}</span>`;
  const stat = (label, value, ng) =>
    `<div class="stat"><div class="stat__label">${label}</div><div class="stat__value${ng ? ' is-ng' : ''}">${value}</div></div>`;

  el.monthSummary.innerHTML =
    stat('対象日数（前日まで）', pastDays + unit('日')) +
    (closedDays ? stat('定休日', closedDays + unit('日')) : '') +
    stat('全項目クリアの日', fullDays + unit('日')) +
    stat('確認漏れ（前日まで）', missCount + unit('件'), missCount > 0) +
    stat('実施率', rate + unit('%')) +
    (todayDone === null
      ? ''
      : stat('本日の進捗',
          todayDone === 'closed'
            ? '<span style="font-size:17px">定休日</span>'
            : `${todayDone}<span style="font-size:13px"> / ${todayTotal}</span>`));
}

/* ============================================================
 *  全体描画
 * ============================================================ */
/* ============================================================
 *  シフト（管理者だけの画面）
 *
 *  アルバイトは別に配る提出ページ（…/shift/）から希望を出します。
 *  ここはその希望を集めて、こちらで組む場所です。
 *
 *  組み方
 *    1.「希望を取り込む」で、出してもらった人を枠に並べます
 *    2. 多い日は名前をタップして外す／時刻を直す
 *    3.「表で見る」で印刷、「文字でコピー」でLINEに貼る
 *
 *  ★取り込みは何度押しても、外した人を戻しません。
 *    一度取り込んだ組み合わせを taken に控えているためです。
 * ============================================================ */

/** いま開いている半月（1 = 1〜15日／2 = 16日〜末日）。年と月は state を使います */
let shiftHalf = 1;

/** 名前をタップしたときに、どこを直そうとしているか */
let shiftPickAt = null;   // { dateStr, slotId, index }（index が null なら「足す」）

function shiftRecKey() {
  return shiftKey(state.storeId, state.y, state.m, shiftHalf);
}

function shiftRec() {
  return Store.getDay(SHIFT_STORE, shiftRecKey());
}

/** その日の組んだ結果（無ければ空） */
/**
 * その日の組んだ結果
 *
 * ★出すときに必ず入り時間の早い順にそろえます。
 *   入れた順のまま出すと、あとから足した早い人が下に来て、
 *   表を上から読めなくなるためです。
 */
function shiftDayOf(rec, dateStr) {
  const v = (rec.items || {})[shiftDayKey(dateStr)] || {};
  // 時刻の入っていない人は、その枠のふだんの時刻として読みます
  // （時刻なしで入れていたころの分が残っていても、表が空白になりません）
  // ★見本（テスト用）の人は、組んだ表にも出しません
  const arr = (id, x) => shiftSort((Array.isArray(x) ? x : [])
    .filter((e) => e && !isShiftTester(e.n))
    .map((e) => (
      e.t === '' || e.t === undefined || e.t === null
        ? { ...e, t: shiftDefaultTime(state.storeId, id) }
        : e
    )));
  return {
    open: arr('open', v.open),
    lunch: arr('lunch', v.lunch),
    dinner: arr('dinner', v.dinner),
    memo: v.memo || '',
    // その日のパティの枠（'lunch' か 'dinner'。無ければ空）
    patty: SHIFT_PATTY_SLOTS.includes(v.patty) ? v.patty : '',
    // 人が足りないマス（'dinner|k' → あと何人ほしいか）。その人数だけ赤く出します
    short: shiftShortMap(v.short),
  };
}

/**
 * その日のメモ
 *
 * 書いたものがあればそれ。無ければ、はじめから入れておく文
 * （29日と2月9日の「肉の日」）を出します。
 */
function shiftMemoOf(rec, dateStr) {
  return shiftDayOf(rec, dateStr).memo || shiftDefaultMemo(dateStr);
}

function saveShiftDay(dateStr, day) {
  Store.setItem(SHIFT_STORE, shiftRecKey(), shiftDayKey(dateStr), {
    open: day.open, lunch: day.lunch, dinner: day.dinner,
    memo: day.memo, patty: day.patty || '',
    short: shiftShortMap(day.short),
  });
}

/** パティの選び先を開いている日（開いていなければ空） */
let pattyOpen = '';

/**
 * 出してもらった希望を全部。名簿の順に並べます
 *
 * ★見本（テスト用）の人は、ここで外します。ここを通ってから
 *   「取り込む」「提出を見る」「入る人を選ぶ」に行くので、1か所で足ります。
 *
 * ★希望は**人ごとの別の行**（`_shiftw/…`）に入っています。
 *   古い分は組んだ行の中に `w:名前` で入っているので、両方から集めます。
 *   同じ人が両方にいたら、**人ごとの行の方**を使います（新しい方です）。
 *
 * ★at を省くと、いま開いている半月のものを読みます。
 *   **ほかの半月を見るときは必ず渡してください。**希望が別の行になったので、
 *   rec を渡すだけでは「どの半月か」が分からなくなりました
 *   （shiftFirstPeriod が先の半月を見にいきます）。
 */
function shiftWishes(rec, at) {
  const p = at || {
    storeId: state.storeId, y: state.y, m: state.m, half: shiftHalf,
  };
  const order = shiftBuildNames(p.storeId);
  const found = new Map();

  const put = (name, v) => {
    if (!name || isShiftTester(name)) return;
    found.set(name, {
      name,
      days: v.days && typeof v.days === 'object' ? v.days : {},
      // 連絡は日ごとに書いてもらいます。note は日ごとにする前の書き方で、
      // そのころに出してもらった分がまだ残っているので読めるようにしています
      notes: v.notes && typeof v.notes === 'object' ? v.notes : {},
      note: v.note || '',
      sentAt: v.sentAt || null,
    });
  };

  // 古い分（組んだ行の中の w:名前）。先に入れて、新しい方で上書きします
  Object.keys(rec.items || {}).forEach((k) => {
    if (k.indexOf('w:') !== 0) return;
    put(k.slice(2), rec.items[k] || {});
  });

  // いまの形（人ごとの行）
  const head = shiftWishRowHead(p.storeId, p.y, p.m, p.half);
  Store.keysUnder(SHIFT_WISH_STORE).forEach((key) => {
    if (key.indexOf(head) !== 0) return;
    const v = (Store.getDay(SHIFT_WISH_STORE, key).items || {})[SHIFT_WISH_ITEM];
    // 名前は行の中に書いてあります（キーは番号なので、名前を直しても迷いません）
    if (v) put(String(v.n || ''), v);
  });

  const out = [...found.values()];
  return out.sort((a, b) => {
    const ia = order.indexOf(a.name), ib = order.indexOf(b.name);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

/**
 * その日、組んだ表の「その枠」に入る希望
 *
 * ★F（通し）はランチの枠に入ります。ディナーには出しません
 *   （今のスプレッドシートで、ランチのセルだけ塗りつぶしているのと同じ）。
 *
 * ★wishes は shiftWishes() の結果です。画面を描くときは15日×3枠＝45回
 *   呼ばれるので、そのつど作り直さずに1回作ったものを渡します
 *   （名簿の読み込みが毎回入ると、古い端末で目に見えて重くなります）。
 */
function shiftWishInto(wishes, dateStr, slotId) {
  const out = [];
  wishes.forEach((w) => {
    (w.days[dateStr] || []).forEach((e) => {
      if (!e || shiftSlotFor(e.s) !== slotId) return;
      // e … 退勤時刻（時刻を入れる店舗だけ入っています）
      out.push({
        name: w.name, t: e.t || '', e: e.e || '', s: e.s,
        full: e.s === SHIFT_FULL_ID,
      });
    });
  });
  return out;
}

/** 一度取り込んだ組み合わせ。古い形も新しい形も読めます（→ shiftTakenRead） */
function shiftTakenSet(rec) {
  return shiftTakenRead((rec.items || {})[SHIFT_TAKEN_KEY]);
}

/** 枠の中の並び順。早い時刻から、同じ時刻なら名簿の順 */
function shiftSort(list) {
  const order = shiftBuildNames(state.storeId);
  return list.slice().sort((a, b) => {
    // 時刻が入っていない人（F など）は、その枠の一番下に置きます
    const ta = a.t === '' || a.t === undefined ? 99 : Number(a.t);
    const tb = b.t === '' || b.t === undefined ? 99 : Number(b.t);
    if (ta !== tb) return ta - tb;
    const ia = order.indexOf(a.n), ib = order.indexOf(b.n);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

/**
 * その日、その人が実際にどこに入っているか
 *
 * 提出の一覧を、組んだシフトと突き合わせるために使います。
 * 入れたり外したりすれば、こちらの見ためもすぐ変わります。
 */
function shiftPlacedOn(rec, dateStr, name) {
  const day = shiftDayOf(rec, dateStr);
  const out = [];
  shiftSlotsOf(state.storeId).forEach((slot) => {
    day[slot.id].forEach((e) => {
      if (e.n === name) out.push({ slot: slot.id, t: e.t, f: !!e.f });
    });
  });
  return out;
}

/** その日が定休日か（半月の画面は月をまたがないので、日付から直に見ます） */
function shiftClosedOn(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Closed.isClosed(state.storeId, y, m, d);
}

/* -------- 半月を動かす -------- */

function shiftGo(y, m, half) {
  state.y = y;
  state.m = m;
  shiftHalf = half;
  state.d = Math.min(half === 1 ? 1 : 16, daysInMonth(y, m));
  writeHash(true);
  render();
}

function shiftGoStep(step) {
  const n = shiftStep(state.y, state.m, shiftHalf, step);
  shiftGo(n.y, n.m, n.half);
}

function shiftGoToday() {
  const t = businessDate();
  shiftGo(t.getFullYear(), t.getMonth() + 1, shiftHalfOf(t.getDate()));
}

/**
 * 画面を開いたときに出す半月
 *
 * ★「今日が入っている半月」ではありません。
 *   出してもらうのは先の半月なので、今日の半月を開くと
 *   「取り込んでも何も入らない」ことになります（実際そうなりました）。
 *   募集中のものがあればそれを、無ければ次に募集する半月を出します。
 */
function shiftFirstPeriod(storeId) {
  const t = businessDate();
  const now = { y: t.getFullYear(), m: t.getMonth() + 1, half: shiftHalfOf(t.getDate()) };
  // 今の半月から先へ4つ見て、募集中のものがあればそこを出す
  for (let i = 0; i <= 4; i += 1) {
    const p = shiftStep(now.y, now.m, now.half, i);
    const rec = Store.getDay(SHIFT_STORE, shiftKey(storeId, p.y, p.m, p.half));
    if (shiftPhaseOf(rec) === SHIFT_OPEN) return p;
  }
  // 募集中が無ければ、まだ確定していなくて「もう誰かが出している」半月
  for (let i = 0; i <= 4; i += 1) {
    const p = shiftStep(now.y, now.m, now.half, i);
    const rec = Store.getDay(SHIFT_STORE, shiftKey(storeId, p.y, p.m, p.half));
    if (shiftPhaseOf(rec) === SHIFT_BUILT) continue;
    // ★ここは「ほかの半月」を見ています。半月を渡さないと、
    //   いま開いている半月の希望を数えてしまいます
    if (shiftWishes(rec, { storeId, ...p }).length) return p;
  }
  // どれも無ければ「次の半月」。★今の半月は出しません。
  //   募集をかけるのは先の半月なので、いま動いている半月を開いても
  //   「取り込んでも何も入らない」ことになるためです
  return shiftStep(now.y, now.m, now.half, 1);
}

/* -------- 取り込み -------- */

/**
 * 出してもらった希望を、まだ入れていない分だけ枠に並べます
 *
 * ★すでに外した人は戻しません。一度取り込んだ組み合わせを
 *   taken に控えていて、そこに載っているものは飛ばすためです。
 */
function shiftTake() {
  const rec = shiftRec();
  const wishes = shiftWishes(rec);
  const taken = shiftTakenSet(rec);
  let added = 0;

  shiftDays(state.y, state.m, shiftHalf).forEach((dateStr) => {
    if (shiftClosedOn(dateStr)) return;
    const day = shiftDayOf(rec, dateStr);
    let touched = false;

    /* ★立ち上げで出した人は、立ち上げにだけ入れます。
       提出ページでは「立ち上げ」と、そのあとの「ランチ／F」を対にして出して
       もらっています。そのまま取り込むと、立ち上げとランチの両方に同じ名前が
       並んでしまい、二人いるように見えていました。
       ★そのあとどこへ入れるかは、組む人がつまんで動かして決めます。
       ★Fで出していた人は、立ち上げの名前に F を付けて残します
         （通しで入る、という情報が消えないようにするためです）。 */
    const openWish = new Map();
    shiftWishInto(wishes, dateStr, 'open').forEach((w) => openWish.set(w.name, w));
    const pairFull = new Set();
    if (openWish.size) {
      shiftWishInto(wishes, dateStr, 'lunch').forEach((w) => {
        if (openWish.has(w.name) && w.full) pairFull.add(w.name);
      });
    }

    shiftSlotsOf(state.storeId).forEach((slot) => {
      shiftWishInto(wishes, dateStr, slot.id).forEach((w) => {
        // 立ち上げで出している人の、そのあとの分（ランチ／F）は入れません
        if (slot.id !== 'open' && openWish.has(w.name)) return;
        // 印は「出してもらったときの枠」で付けます。ランチとFは別ものとして数えます
        const mark = shiftTakenId(w.name, dateStr, w.s);
        if (taken.has(mark)) return;
        taken.add(mark);
        if (day[slot.id].some((e) => e.n === w.name)) return;
        // ★マネージで決めてある「ふだんの持ち場」に入れます。
        //   決めていない人は、ひとまず左の持ち場（キッチン）です
        const entry = {
          n: w.name,
          t: w.t || shiftDefaultTime(state.storeId, w.s),
          p: ShiftStaff.laneOf(state.storeId, w.name) || SHIFT_LANES[0].id,
        };
        // ★退勤時刻（時刻を入れる店舗だけ）。出してもらったものをそのまま入れます
        if (w.e) entry.e = w.e;
        if (w.full || (slot.id === 'open' && pairFull.has(w.name))) entry.f = true;
        day[slot.id].push(entry);
        added += 1;
        touched = true;
      });
    });

    if (touched) {
      shiftSlotsOf(state.storeId).forEach((slot) => { day[slot.id] = shiftSort(day[slot.id]); });
      saveShiftDay(dateStr, day);
    }
  });

  // ★新しい短い形で書き直します。古い形（list）で入っていた分も、
  //   読むときに足してあるので、ここで書き直せば取りこぼしません
  Store.setItem(SHIFT_STORE, shiftRecKey(), SHIFT_TAKEN_KEY, shiftTakenWrite(taken));
  return added;
}

async function onShiftTake() {
  const rec = shiftRec();
  const wishes = shiftWishes(rec);
  if (!wishes.length) {
    el.shiftWishNote.textContent = 'まだ誰も希望を出していません';
    return;
  }
  const added = shiftTake();
  render();
  el.shiftWishNote.textContent = added
    ? `${added}人分を入れました`
    : '新しく入れるものはありませんでした';
}

/* -------- 募集をはじめる・確定する -------- */

/**
 * 募集をはじめる
 *
 * ★同じ店舗で募集中の半月は1つだけにします。
 *   2つ開いていると、アルバイトの提出ページにどちらを出すか決められません。
 */
/** 募集を始める画面を開く（期限をここで決めます） */
function openShiftRecruit() {
  const label = shiftRangeLabel(state.y, state.m, shiftHalf);
  const other = shiftOtherOpen();
  el.shiftOpenWhen.textContent = `${state.y}年 ${label} の募集`;
  el.shiftOpenDue.value = shiftDueOf(shiftRec()) || shiftDueDefault(state.y, state.m, shiftHalf);
  el.shiftOpenNote.textContent = other
    ? `いま募集中の ${other.label} は締め切られます。始めると、みんなの提出ページには ${label} が出ます。`
    : 'みんなの提出ページに、この期間と期限が出るようになります。';
  el.shiftOpenModal.classList.remove('is-hidden');
}

/** 募集を始める */
function startShiftRecruit() {
  const due = el.shiftOpenDue.value;
  if (!due) { el.shiftOpenNote.textContent = '提出の期限を選んでください。'; return; }

  const other = shiftOtherOpen();
  if (other) shiftSetPhase(other.y, other.m, other.half, SHIFT_BUILT);
  shiftSetPhase(state.y, state.m, shiftHalf, SHIFT_OPEN, due);
  el.shiftOpenModal.classList.add('is-hidden');
  render();
}

/** 確定する（提出を締め切る） */
async function buildShiftDone() {
  const label = shiftRangeLabel(state.y, state.m, shiftHalf);
  const rec = shiftRec();
  const n = shiftDays(state.y, state.m, shiftHalf)
    .filter((s) => !shiftClosedOn(s))
    .reduce((sum, s) => {
      const day = shiftDayOf(rec, s);
      return sum + shiftSlotsOf(state.storeId).reduce((k, slot) => k + day[slot.id].length, 0);
    }, 0);

  const ok = await askConfirm({
    item: `${label} のシフトを確定します`,
    message: `${n}人分が入っています。\n`
      + '確定すると、みんなが自分のスマホでシフト表を見られるようになります。\n'
      + '希望の受け付けは終わります（組んだ内容はあとから直せます）。',
    okLabel: '確定する',
    danger: true,
  });
  if (!ok) return;
  shiftSetPhase(state.y, state.m, shiftHalf, SHIFT_BUILT);
  render();
}

function shiftSetPhase(y, m, half, v, due) {
  const key = shiftKey(state.storeId, y, m, half);
  // 期限は、渡されなければ前のものをそのまま残します
  // （確定するときに、募集のときに決めた期限を消さないため）
  const keep = due === undefined
    ? shiftDueOf(Store.getDay(SHIFT_STORE, key))
    : (due || '');
  Store.setItem(SHIFT_STORE, key, SHIFT_PHASE_KEY, {
    v, at: new Date().toISOString(), due: keep,
  });
}

/** いま募集中の、ほかの半月（前後4つ分を見ます） */
function shiftOtherOpen() {
  const here = shiftKey(state.storeId, state.y, state.m, shiftHalf);
  for (let i = -4; i <= 4; i += 1) {
    const p = shiftStep(state.y, state.m, shiftHalf, i);
    const key = shiftKey(state.storeId, p.y, p.m, p.half);
    if (key === here) continue;
    if (shiftPhaseOf(Store.getDay(SHIFT_STORE, key)) === SHIFT_OPEN) {
      return { ...p, label: shiftRangeLabel(p.y, p.m, p.half) };
    }
  }
  return null;
}

/* -------- 描画 -------- */

/* ============================================================
 *  シフトに入る人（名簿と、配る番号）
 *
 *  ★ワークスにもマインにも、**全店舗**に出します。
 *    名前の登録と番号の配布を、各店長にまかせるためです（ko-dai の指示・2026-09-05）。
 *  ★番号は**伏せて**出します。ワークスはアルバイトも同じPINで入るので、
 *    そのまま出すと「番号で本人を決める」仕組みが崩れます
 *    （他人の番号で出せてしまいます）。「見る」を押した人の分だけ出します。
 *  ★マネージにも同じものがあります。あちらは管理用PINの内側なので、
 *    番号をはじめから出しています。
 * ============================================================ */

/** 番号を出している人（押した分だけ。画面を離れると忘れます） */
let shiftCodeOpen = new Set();

/** 「他店舗にも所属」を開いている人の番号（1人分だけ開きます） */
let shiftLinkOpen = '';

/**
 * 名簿を出している店舗（空なら出していません）
 *
 * ★名前も番号も、**ふだんは出しません。**ワークスはお店の端末で開きっぱなしに
 *   なることがあり、誰がいつ見るか分からないためです。押したときだけ出します。
 * ★店舗を変えたら閉じます（別の店舗の名簿が、そのまま出たままにならないように）。
 * ★アプリを裏に回したときも閉じます（置いたまま離れたとき用）。
 */
let shiftRosterOpenFor = '';
/**
 * この端末は管理用PINか（null＝まだ聞いていない）
 *
 * ★名簿（`shiftStaff`）は**管理用PINが要る設定**です（`ADMIN_SETTINGS`）。
 *   ふつうのPINの端末で名前や番号を直すと、
 *     ① 画面ではいったん変わる
 *     ② サーバーが断る（`need_admin`）→ 送信箱から**黙って捨てられる**
 *     ③ 次に取り込んだときに、**元に戻る**
 *   という順で消えます。**赤い帯も出ません。**
 *   （2026-09-07、実地で①②③をなぞって確かめました）
 *   なので、直せない端末では**先にそう出します。**
 */
let shiftRosterAdmin = null;
let shiftRosterAsking = false;

/**
 * 名簿を直すのに、管理用PINが要るか
 *
 * ★`ADMIN_SETTINGS` を見ます。**ここで判断を書き固めません。**
 *   本部が `shiftStaff` を外したら、この画面の警告も**自動で消えます**。
 *   2か所に書くと、片方だけ直したときに画面がうそをつきます（今日3回ありました）。
 */
function shiftRosterNeedsAdmin() {
  return typeof ADMIN_SETTINGS !== 'undefined' && ADMIN_SETTINGS.includes('shiftStaff');
}

function shiftRosterProbe() {
  if (!shiftRosterNeedsAdmin()) return;   // 要らないなら、聞きに行きません
  if (shiftRosterAdmin !== null || shiftRosterAsking) return;
  // ★PINを入れていない端末では聞きません（聞いても答えが出ません）
  if (typeof Sync === 'undefined' || !Sync.enabled || !Sync.enabled() || !Sync.pin()) return;
  shiftRosterAsking = true;
  Sync.probeAdmin().then((r) => {
    shiftRosterAsking = false;
    // 通信できなかったときは「分からない」のままにします（勝手に警告を出さない）
    if (r && !r.error) { shiftRosterAdmin = !!r.admin; renderKeepScroll(); }
  }).catch(() => { shiftRosterAsking = false; });
}

/** 名簿を閉じる（出していたものは全部忘れます） */
function shiftRosterClose() {
  shiftRosterOpenFor = '';
  shiftCodeOpen = new Set();
  shiftLinkOpen = '';
}

/**
 * 裏に回ったら閉じる、の一度だけの仕掛け
 *
 * ★起動のところ（共通）には足さず、名簿を初めて描くときに1回だけ付けます。
 */
let shiftRosterHooked = false;
function shiftRosterHook() {
  if (shiftRosterHooked) return;
  shiftRosterHooked = true;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !shiftRosterOpenFor) return;
    shiftRosterClose();
    if (state.view === 'shift') renderKeepScroll();
  });
}

function renderShiftRoster(組む) {
  shiftRosterHook();
  let box = document.getElementById('shiftRoster');
  if (!box) {
    box = document.createElement('section');
    box.id = 'shiftRoster';
    box.className = 'card';
    el.viewShift.insertBefore(box, el.viewShift.firstChild);
  }
  const store = getStore(state.storeId);
  const people = ShiftStaff.people(state.storeId);
  const 見本 = people.find((p) => isShiftTester(p.n));
  // ★店舗を変えたら閉じます
  if (shiftRosterOpenFor && shiftRosterOpenFor !== state.storeId) shiftRosterClose();
  const 出す = shiftRosterOpenFor === state.storeId;
  box.innerHTML = '';

  const h = document.createElement('h2');
  h.className = 'card__title';
  h.textContent = 'シフトに入る人';
  box.appendChild(h);

  /* ★閉じているあいだは、名前も番号も**作りません**。
     隠すだけだと、画面の中には残ってしまうためです */
  if (!出す) {
    const note = document.createElement('p');
    note.className = 'card__note';
    note.innerHTML = people.length
      ? `${people.length}人が登録されています。`
        + '<b>名前と番号は、押したときだけ出します。</b>'
      : 'まだ登録されていません。';
    box.appendChild(note);

    const row = document.createElement('div');
    row.className = 'card__actions';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'btn btn--primary';
    open.textContent = people.length ? '名前と番号を出す' : '名前を登録する';
    open.addEventListener('click', () => {
      shiftRosterOpenFor = state.storeId;
      renderKeepScroll();
    });
    row.appendChild(open);
    box.appendChild(row);
    return;
  }

  shiftRosterProbe();
  if (shiftRosterNeedsAdmin() && shiftRosterAdmin === false) {
    // ★直せない端末。押しても消えるので、先に言います
    const 警告 = document.createElement('p');
    警告.className = 'card__note';
    警告.style.cssText = 'font-weight:700;color:var(--ng);'
      + 'border:1px solid var(--ng);border-radius:9px;padding:9px 11px;';
    警告.innerHTML = '★この端末では、<b>名前・番号・チェックを直しても保存されません。</b><br>'
      + '名簿を直すには<b>管理用のPIN</b>が要ります（マネージと同じPINです）。<br>'
      + '見るだけなら、このままで大丈夫です。';
    box.appendChild(警告);
  }

  const note = document.createElement('p');
  note.className = 'card__note';
  note.innerHTML = '1行に1人。保存すると<b>1人ずつに番号</b>が作られます。'
    + 'その番号を本人に送ってください。<br>'
    + '<b>番号は本人だけのもの</b>です。ほかの人に見せないでください'
    + '（番号を知っていれば、その人として出せてしまいます）。<br>'
    + '名前を消しても、<b>組みおわったシフトはそのまま残ります</b>。<br>'
    + '★<b>消した名前を戻すと、番号は新しくなります。</b>前の番号では入れません。'
    + '名前を打ちまちがえたときも同じです（消える人がいるときは、保存の前に聞きます）。'
    + (組む ? '' : '<br>この店舗は、まだシフトを組んでいません。名前と番号だけ先に用意できます。');
  box.appendChild(note);

  const area = document.createElement('textarea');
  area.className = 'field__input field__input--area';
  area.rows = Math.max(6, people.length + 2);
  area.value = people.map((p) => p.n).join('\n');
  area.placeholder = '\u5c71\u7530\n\u4f50\u85e4\n\u9234\u6728';
  box.appendChild(area);

  const row = document.createElement('div');
  row.className = 'card__actions';
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'btn btn--primary';
  save.textContent = '名前を保存';
  save.addEventListener('click', () => {
    // ★消える人がいたら、先に聞きます。名前を1文字打ちまちがえただけでも、
    //   その人は名簿から消え、番号が使えなくなります（画面には何も出ません）
    if (!shiftRosterConfirm(state.storeId, area.value)) return;
    ShiftStaff.saveFromText(state.storeId, area.value);
    renderKeepScroll();
  });
  row.appendChild(save);

  const hide = document.createElement('button');
  hide.type = 'button';
  hide.className = 'btn';
  hide.textContent = '隠す';
  hide.addEventListener('click', () => {
    shiftRosterClose();
    renderKeepScroll();
  });
  row.appendChild(hide);

  if (!見本) {
    const demo = document.createElement('button');
    demo.type = 'button';
    demo.className = 'btn';
    demo.textContent = '見本（テスト用）を作る';
    demo.title = 'アルバイトの画面を見るための、この店舗の見本を作ります';
    demo.addEventListener('click', () => {
      const now = ShiftStaff.people(state.storeId).map((p) => p.n);
      ShiftStaff.saveFromText(state.storeId, now.concat([SHIFT_TESTER_NAME]).join('\n'));
      renderKeepScroll();
    });
    row.appendChild(demo);
  }
  box.appendChild(row);

  box.appendChild(shiftCodeList(store, people));
}

/** 配る番号の一覧。番号は押した人の分だけ出します */
function shiftCodeList(store, people) {
  const wrap = document.createElement('div');
  if (!people.length) {
    const p = document.createElement('p');
    p.className = 'card__note';
    p.textContent = '名前を保存すると、ここに番号が出ます。';
    wrap.appendChild(p);
    return wrap;
  }

  const h = document.createElement('h3');
  h.className = 'card__sub';
  h.textContent = '配る番号';
  wrap.appendChild(h);

  const url = document.createElement('p');
  url.className = 'card__note';
  url.innerHTML = `提出ページのURLは <b>${shiftSubmitUrl()}</b>（全員おなじです）。<br>`
    + '<b>他店舗にも所属</b>を押して店舗を選ぶと、その人は提出ページで'
    + '<b>店舗を切り替えられる</b>ようになります。<br>'
    + '選んだ店舗の名簿にも<b>同じ番号で入る</b>ので、'
    + '<b>向こうでも押された状態</b>になります（二重に登録しなくて済みます）。<br>'
    + '番号を送ったら、<b>名前の左のチェック</b>を付けてください（どこまで送ったか分かります）。';
  wrap.appendChild(url);

  // ★どこまで配ったか。26人にLINEで送るので、数が見えないと見失います
  //   （マネージと同じ数え方です。同じ `s` の印を見ています）
  const 送りずみ = people.filter((x) => x.s).length;
  const 数 = document.createElement('p');
  数.className = 'card__note';
  数.style.cssText = 'font-weight:700;'
    + (送りずみ === people.length ? 'color:var(--ok);' : '');
  数.textContent = 送りずみ === people.length
    ? `全員に送りました（${people.length}人）`
    : `送りずみ ${送りずみ} / ${people.length}人`;
  wrap.appendChild(数);

  people.forEach((p) => {
    const line = document.createElement('div');
    line.className = 'shift-code';
    // ★見た目は css/style.css（本部のもの）に足さず、ここで持たせます
    line.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;'
      + 'padding:8px 0;border-bottom:1px solid var(--line);';
    // ★番号をその人に送ったか。押すところを広めに取ります（指で押すため）
    const sent = document.createElement('label');
    sent.style.cssText = 'display:flex;align-items:center;justify-content:center;'
      + 'width:34px;height:34px;margin:-6px 0 -6px -6px;cursor:pointer;flex:0 0 auto;';
    sent.title = p.s ? '送りずみ（押すと外れます）' : '送ったら押してください';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !!p.s;
    box.style.cssText = 'width:20px;height:20px;accent-color:var(--ok);';
    box.addEventListener('change', () => {
      ShiftStaff.setSent(state.storeId, p.n, box.checked);
      renderKeepScroll();
    });
    sent.appendChild(box);
    line.appendChild(sent);

    const name = document.createElement('b');
    name.textContent = p.n + (isShiftTester(p.n) ? '（見本）' : '');
    // 送りずみの人は、うすくして「もう済んだ」と分かるようにします
    if (p.s) name.style.color = 'var(--text-sub)';
    line.appendChild(name);

    const code = document.createElement('span');
    code.className = 'shift-code__num';
    code.style.cssText = 'font-family:ui-monospace,monospace;letter-spacing:.08em;'
      + 'color:var(--text-sub);min-width:6.5em;';
    const 出す = shiftCodeOpen.has(p.c);
    code.textContent = 出す ? p.c : '••••••';
    line.appendChild(code);

    const see = document.createElement('button');
    see.type = 'button';
    see.className = 'btn btn--small';
    see.textContent = 出す ? '隠す' : '見る';
    see.addEventListener('click', () => {
      if (出す) shiftCodeOpen.delete(p.c); else shiftCodeOpen.add(p.c);
      renderKeepScroll();
    });
    line.appendChild(see);

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn btn--small';
    copy.textContent = 'コピー';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(p.c);
        copy.textContent = 'コピーしました';
        setTimeout(() => { copy.textContent = 'コピー'; }, 1500);
      } catch (e) {
        // コピーできない端末では、代わりに番号を出します
        shiftCodeOpen.add(p.c);
        renderKeepScroll();
      }
    });
    line.appendChild(copy);

    // ★他店舗にも所属。押すと店舗を選べます。
    //   2店舗以上に入っている人だけ、提出ページで店舗を切り替えられます
    const よそ = shiftLinkedStores(p.c).filter((id) => id !== state.storeId);
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'btn btn--small' + (よそ.length ? ' btn--primary' : '');
    link.textContent = よそ.length
      ? `他店舗にも所属：${よそ.map((id) => (getStore(id) || {}).short || id).join('・')}`
      : '他店舗にも所属';
    link.addEventListener('click', () => {
      shiftLinkOpen = shiftLinkOpen === p.c ? '' : p.c;
      renderKeepScroll();
    });
    line.appendChild(link);

    // ★見本は、社員がその場でアルバイトの画面を開けるようにします
    if (isShiftTester(p.n)) {
      const open = document.createElement('a');
      open.className = 'btn btn--small';
      open.href = shiftSubmitUrl(p.c);
      open.target = '_blank';
      open.rel = 'noopener';
      open.textContent = 'アルバイトの画面を見る';
      line.appendChild(open);
    }
    wrap.appendChild(line);

    if (shiftLinkOpen === p.c) wrap.appendChild(shiftLinkPicker(p));
  });
  return wrap;
}

/**
 * 「他店舗にも所属」を押したときの、店舗選び
 *
 * ★選ぶと、その店舗の名簿にも**同じ名前・同じ番号**で入ります。
 *   なので**向こうの店舗から見ても、このボタンが押された状態**になります。
 *   同じ人を二重に登録する手間が消えます。
 */
function shiftLinkPicker(person) {
  const box = document.createElement('div');
  box.style.cssText = 'padding:8px 0 12px;display:flex;flex-wrap:wrap;gap:8px;'
    + 'align-items:center;border-bottom:1px solid var(--line);';

  const cap = document.createElement('span');
  cap.style.cssText = 'font-size:12px;color:var(--text-sub);width:100%;';
  cap.textContent = `${person.n} さんが入っている店舗を選んでください`
    + '（ここで選ぶと、向こうの名簿にも同じ番号で入ります）';
  box.appendChild(cap);

  const いま = new Set(shiftLinkedStores(person.c));
  STORES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    const on = いま.has(s.id);
    const ここ = s.id === state.storeId;
    b.className = 'btn btn--small' + (on ? ' btn--primary' : '');
    b.textContent = s.short + (ここ ? '（ここ）' : '');
    // ★いまいる店舗は外せません。外すと、押している本人が消えてしまいます
    b.disabled = ここ;
    if (ここ) b.style.opacity = '.6';
    b.addEventListener('click', () => {
      const next = new Set(いま);
      if (on) next.delete(s.id); else next.add(s.id);
      shiftSetLinked(state.storeId, person.n, person.c, [...next]);
      renderKeepScroll();
    });
    box.appendChild(b);
  });
  return box;
}

function renderShift() {
  // ★名簿（シフトに入る人）は全店舗に出します。シフトを組むところは
  //   SHIFT_STORES の店舗だけです。組まない店舗では、名簿だけを出して
  //   あとは隠します（空の表を見せても、できることが無いためです）
  const 組む = shiftBuilds(state.storeId);
  renderShiftRoster(組む);
  [...el.viewShift.children].forEach((c) => {
    if (c.id === 'shiftRoster') return;
    c.classList.toggle('is-hidden', !組む);
  });
  if (!組む) return;

  el.shiftNavMain.textContent = `${shiftRangeLabel(state.y, state.m, shiftHalf)}`;
  el.shiftNavSub.textContent = `${state.y}年${state.m}月 ${shiftHalf === 1 ? '前半' : '後半'}`;

  const rec = shiftRec();
  const names = shiftBuildNames(state.storeId);
  const wishes = shiftWishes(rec);
  const sent = wishes.filter((w) => w.sentAt).length;
  const phase = shiftPhaseOf(rec);

  /* -------- 募集の状態 -------- */
  el.shiftPhase.textContent = shiftPhaseText(phase);
  el.shiftPhase.className = 'shift-phase shift-phase--' + (phase || 'yet');
  el.shiftOpenBtn.classList.toggle('is-hidden', phase === SHIFT_OPEN);
  el.shiftOpenBtn.textContent = phase === SHIFT_BUILT ? '募集をやり直す' : 'シフト募集を始める';
  // 確定は、募集をはじめてからでないと押せません
  el.shiftBuildBtn.disabled = phase !== SHIFT_OPEN;
  el.shiftBuildBtn.textContent = phase === SHIFT_BUILT
    ? 'このシフトは確定ずみです'
    : 'シフトを確定する';

  el.shiftWishCount.textContent = names.length ? `提出 ${sent} / ${names.length}人` : '名簿が未登録';
  if (!names.length) {
    el.shiftWishNote.textContent = 'マネージの「シフトに入る人」で登録してください';
  } else if (!phase) {
    el.shiftWishNote.textContent = '募集をはじめると、みんなの提出ページに出ます';
  } else if (!sent) {
    el.shiftWishNote.textContent = 'まだ誰も出していません';
  } else {
    const yet = names.filter((n) => !wishes.some((w) => w.name === n && w.sentAt));
    el.shiftWishNote.textContent = yet.length ? `まだの人：${yet.join('・')}` : '全員そろいました';
  }
  // 募集中は、決めた期限も添えます
  const due = shiftDueOf(rec);
  if (phase === SHIFT_OPEN && due) {
    el.shiftWishNote.textContent += `　／　提出 ${shiftDueLabel(due, DOW)}`;
  }

  // ★順番が大事です。**幅を先に測ってから、中身を消します。**
  //
  //   この表はページの高さの8割以上（実測 4183px のうち 3562px）を占めます。
  //   中身を消したあとに clientWidth を読むと、そこで空のまま作り直しが起きて
  //   ページが 621px まで縮み、**ブラウザがスクロール位置を一番上に切り詰めます**。
  //   そのあと表を入れ直しても、位置は戻りません。
  //   同期は60秒ごとに render() を呼ぶので、下を見ているあいだに
  //   何度でも一番上へ飛ばされていました（ワークスでもマインでも同じです）。
  //
  //   クローズや週間掃除で起きなかったのは、消す中身がページの高さの
  //   大半ではないからです。この画面だけの症状でした。
  const cols = shiftCols(el.shiftDays.clientWidth || window.innerWidth);
  const days = shiftDays(state.y, state.m, shiftHalf);

  // ★組み立ててから、一度に入れかえます。消してから1つずつ足すと、
  //   そのあいだに幅や高さを読む処理が入ったとき、また同じことが起きます
  const できあがり = document.createDocumentFragment();
  // ★決まり文句がまだ登録されていない店舗には、そう出します。
  //   コードから名前を抜いたので、登録するまでボタンは出ません。
  //   黙って消すと「直したのか壊れたのか」が分かりません（2026-09-07）
  if (shiftMemoTagsAsk(state.storeId)) {
    const 知らせ = document.createElement('p');
    知らせ.className = 'shift-said';
    知らせ.textContent = 'メモの決まり文句は、マネージの「メモの決まり文句」で登録します'
      + '（登録するまで、メモ欄の下のボタンは出ません）';
    できあがり.appendChild(知らせ);
  }
  for (let i = 0; i < days.length; i += cols) {
    できあがり.appendChild(shiftGridBlock(rec, wishes, days.slice(i, i + cols)));
  }
  el.shiftDays.innerHTML = '';
  el.shiftDays.appendChild(できあがり);

  // 足りない日をLINEに送る文。★表を直せば数も文も変わります
  shiftShortCopyBox(rec);
}

/**
 * 日を横に並べた表（今のスプレッドシートと同じ作り）
 *
 *  ・横に SHIFT_COLS 日分
 *  ・1日は持ち場（キッチン／ホール）で2列に分かれます
 *  ・縦は 立ち上げ／ランチ／ディナー、一番下が連絡
 *
 *  縦に1日ずつ並べていたころより、前後の日と見くらべやすくなります。
 *  幅が足りないときは、この表だけが横にスクロールします。
 */
function shiftGridBlock(rec, wishes, days) {
  const wrap = document.createElement('div');
  wrap.className = 'shift-grid-wrap';
  const table = document.createElement('table');
  table.className = 'shift-grid';

  /* 1行目：日付（1日で持ち場の数だけ列を使います） */
  const head = document.createElement('tr');
  head.appendChild(document.createElement('th'));
  days.forEach((s) => {
    const [, m, d] = s.split('-').map(Number);
    const dow = new Date(s.replace(/-/g, '/')).getDay();
    const [yy] = s.split('-').map(Number);
    const th = document.createElement('th');
    th.colSpan = SHIFT_LANES.length;
    // 祝日は日曜と同じ色にします（休みの日と分かるように）
    const holi = isHoliday(yy, m, d);
    th.className = 'shift-grid__date'
      + (dow === 0 || holi ? ' is-sun' : dow === 6 ? ' is-sat' : '');
    th.textContent = shiftDayLabel(s, DOW);
    head.appendChild(th);
  });
  table.appendChild(head);

  /* 2行目：持ち場 */
  const lanes = document.createElement('tr');
  lanes.appendChild(document.createElement('th'));
  days.forEach(() => SHIFT_LANES.forEach((l) => {
    const th = document.createElement('th');
    th.className = 'shift-grid__lane';
    th.textContent = l.name;
    lanes.appendChild(th);
  }));
  table.appendChild(lanes);

  /* 枠ごとの行 */
  shiftSlotsOf(state.storeId).forEach((slot, si) => {
    const tr = document.createElement('tr');
    // ★枠の変わり目に太い線を引きます（立ち上げ｜ランチ｜ディナー）。
    //   線そのものは css/style.css の `.shift-grid tr.is-slot-top`（本部）です。
    //   1つめの枠には付けません。上の「持ち場」の行との境目は、もう付いています
    if (si > 0) tr.className = 'is-slot-top';
    const th = document.createElement('th');
    th.className = `shift-grid__slot shift-grid__slot--${slot.id}`;
    th.textContent = slot.name;
    tr.appendChild(th);

    days.forEach((dateStr) => {
      if (shiftClosedOn(dateStr)) {
        // 定休日は、枠の行をまとめて1つのマスにします
        if (si === 0) {
          const td = document.createElement('td');
          td.className = 'is-closed';
          td.colSpan = SHIFT_LANES.length;
          td.rowSpan = shiftSlotsOf(state.storeId).length;
          td.textContent = '定休日';
          tr.appendChild(td);
        }
        return;
      }
      const day = shiftDayOf(rec, dateStr);
      SHIFT_LANES.forEach((lane, li) => {
        const td = shiftCell(rec, wishes, day, dateStr, slot, lane, li === 0);
        // パティの枠は、その日のその枠全部を桃色のふちで囲みます
        if (day.patty === slot.id) {
          td.classList.add('is-patty');
          if (li === 0) td.classList.add('is-patty-first');
          if (li === SHIFT_LANES.length - 1) td.classList.add('is-patty-last');
        }
        tr.appendChild(td);
      });
    });
    table.appendChild(tr);
  });

  /* 一番下：連絡（こちらのメモと、アルバイトからの連絡） */
  const memo = document.createElement('tr');
  const memoTh = document.createElement('th');
  memoTh.className = 'shift-grid__slot shift-grid__slot--memo';
  memoTh.textContent = 'メモ';
  memo.appendChild(memoTh);
  days.forEach((dateStr) => {
    const td = document.createElement('td');
    td.colSpan = SHIFT_LANES.length;
    td.className = 'shift-grid__memo';
    if (shiftClosedOn(dateStr)) {
      td.classList.add('is-closed');
      memo.appendChild(td);
      return;
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'shift-memo';
    // ★29日と2月9日は「肉の日」がはじめから入ります（shiftDefaultMemo）
    input.value = shiftMemoOf(rec, dateStr);
    input.addEventListener('change', () => {
      const now = shiftDayOf(shiftRec(), dateStr);
      now.memo = input.value.trim();
      saveShiftDay(dateStr, now);
    });
    td.appendChild(input);

    // アルバイトからのその日の連絡。組むときに見えないと意味がないので、ここに出します
    const said = wishes
      .filter((w) => w.notes[dateStr])
      .map((w) => `${w.name}「${w.notes[dateStr]}」`);
    if (said.length) {
      const box = document.createElement('p');
      box.className = 'shift-said';
      box.textContent = said.join('　');
      td.appendChild(box);
    }

    // ★決まり文句が1つも無い店舗（仕込み／営業の4店舗）では、行ごと出しません。
    //   空の箱を置くと、メモの下にすき間だけが残ります
    if (shiftMemoTagsOf(state.storeId).length) {
      td.appendChild(shiftMemoTagBox(dateStr, input));
    }
    // ★パティを使わない店舗（popo・仕込み／営業の4店舗）では、ボタンごと出しません
    if (shiftHasPatty(state.storeId)) {
      td.appendChild(shiftPattyBox(shiftDayOf(rec, dateStr), dateStr));
    }
    memo.appendChild(td);
  });
  table.appendChild(memo);

  wrap.appendChild(table);
  return wrap;
}

/** 表の1マス（その日・その枠・その持ち場） */
function shiftCell(rec, wishes, day, dateStr, slot, lane, first) {
  const td = document.createElement('td');
  td.className = 'shift-cell';
  // つまんで動かすときの行き先。どのマスに落としたかを、ここから読みます
  td.dataset.date = dateStr;
  td.dataset.slot = slot.id;
  td.dataset.lane = lane.id;

  day[slot.id].forEach((e, i) => {
    if (shiftLaneOf(e) !== lane.id) return;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.dataset.i = i;
    chip.dataset.n = e.n;
    chip.addEventListener('pointerdown', (ev) => startShiftDrag(ev, chip));
    // ★F かどうかは shiftIsFull にまかせます。時刻を入れる店舗（popo）では
    //   入っている時刻から毎回決まるので、時刻を直せば塗りも変わります
    const 通し = shiftIsFull(state.storeId, e);
    chip.className = 'shift-chip' + (通し ? ' is-full' : '') + (e.early ? ' is-early' : '');
    chip.textContent = shiftNameText(state.storeId, slot.id, e);
    // ★通しの人は名前のうしろに F。塗りだけだと、ぱっと見て分かりません。
    //   popo は「字は出さなくていい」とのことなので、塗りだけです
    if (通し && shiftShowsFullMark(state.storeId)) {
      const mark = document.createElement('b');
      mark.className = 'chip-f';
      mark.textContent = 'F';
      chip.appendChild(mark);
    }
    const note = [通し ? (shiftUsesRange(state.storeId) ? '通し（ランチからディナーまで）' : 'F（ランチからディナーまで通し）') : '', e.early ? '早上がり' : ''].filter(Boolean);
    if (note.length) chip.title = note.join('・');
    chip.addEventListener('click', () => {
      if (shiftDrag.justMoved) return;   // 動かした直後は、開かない
      openShiftPick(dateStr, slot.id, lane.id, i);
    });
    td.appendChild(chip);
  });

  // ★あと何人ほしいか。人数の分だけ、赤いあきを名前の下に出します
  //   （元のシフト表で、足りないところのマスを赤く塗っているのと同じ意味です）。
  //   押すとそのままここに人を入れられて、入れた分だけ赤が消えます
  const short = shiftShortOf(day, slot.id, lane.id);
  for (let k = 0; k < short; k += 1) {
    const gap = document.createElement('button');
    gap.type = 'button';
    gap.className = 'shift-short';
    gap.textContent = '＋';
    gap.title = `あと${short}人ほしい（押すと入れられます）`;
    gap.addEventListener('click', () => openShiftPick(dateStr, slot.id, lane.id, null));
    td.appendChild(gap);
  }

  // まだ入れていない希望の数。押す前に「あと何人いる」が分かるように、
  // 左の持ち場にだけ出します（両方に出すと二重に数えたように見えます）。
  // ★数えるのは「その日のどこにも入っていない人」です。立ち上げから
  //   ランチへ回した人まで数えると、いつまでも減らないためです
  const inDay = (n) => shiftSlotsOf(state.storeId).some((sl) => day[sl.id].some((e) => e.n === n));
  const rest = first
    ? shiftWishInto(wishes, dateStr, slot.id).filter((w) => !inDay(w.name)).length
    : 0;

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'shift-add' + (rest ? ' has-wish' : '');
  add.textContent = rest ? `＋${rest}` : '＋';
  add.title = rest ? `希望を出していて、まだ入っていない人が${rest}人います` : '人を足す';
  add.addEventListener('click', () => openShiftPick(dateStr, slot.id, lane.id, null));
  td.appendChild(add);

  return td;
}

/**
 * メモにすぐ足せる決まり文句のボタン
 *
 * ★社員の動きの連絡です。毎回おなじ言葉を打つので、ボタンにしています。
 *   押すたびに足す・外すが入れかわります。
 * ★**ここに例として名前を書かないでください。**このファイルも公開されます。
 *   中身はマネージで登録します（→ ShiftMemoTags）。
 * ★決まり文句が空の店舗では、呼ぶ側が行ごと出しません（shiftMemoTagsOf）。
 * ★印刷・PDF・JPEG にボタンは出ません（メモの中身だけが出ます）。
 */
function shiftMemoTagBox(dateStr, input) {
  const box = document.createElement('div');
  box.className = 'memo-tags';
  shiftMemoTagsOf(state.storeId).forEach((tag) => {
    const b = document.createElement('button');
    b.type = 'button';
    const on = shiftMemoHas(input.value, tag);
    b.className = 'memo-tag' + (on ? ' is-on' : '');
    b.textContent = tag;
    b.title = on ? 'もう一度押すと消えます' : 'メモに足す';
    b.addEventListener('click', () => {
      const now = shiftDayOf(shiftRec(), dateStr);
      now.memo = shiftMemoToggle(input.value, tag);
      saveShiftDay(dateStr, now);
      render();
    });
    box.appendChild(b);
  });
  return box;
}

/**
 * メモの下に置く、パティのボタン
 *
 * ★日とその枠に付くもので、人に付くものではないので、マスの中ではなく
 *   その日の下にまとめて置いています。
 * ★印刷・PDF・JPEG にはボタンは出ません（別に組み立てているため）。
 *   桃色のふちだけが出ます。
 */
function shiftPattyBox(day, dateStr) {
  const box = document.createElement('div');
  box.className = 'patty-box';

  const now = day.patty;
  const open = pattyOpen === dateStr;

  if (!open) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'shift-patty' + (now ? ' is-on' : '');
    b.textContent = now ? `パティ：${getShiftSlot(state.storeId, now).name}` : 'パティ';
    b.title = 'この日のパティの枠を選ぶ';
    b.addEventListener('click', () => { pattyOpen = dateStr; render(); });
    box.appendChild(b);
    return box;
  }

  // 押したあと：どの枠にするかを選びます
  SHIFT_PATTY_SLOTS.concat(['']).forEach((id) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'shift-patty' + (now === id ? ' is-on' : '');
    b.textContent = id ? getShiftSlot(state.storeId, id).name : 'なし';
    b.addEventListener('click', () => {
      const fresh = shiftDayOf(shiftRec(), dateStr);
      fresh.patty = id;
      saveShiftDay(dateStr, fresh);
      pattyOpen = '';
      render();
    });
    box.appendChild(b);
  });
  return box;
}


/* ============================================================
 *  シフトの名前を、つまんで動かす
 *
 *  ・名前を0.35秒押し続けると持ち上がります
 *    （すぐ動かしたときは、今までどおり画面のスクロールです）
 *  ・指を動かすと、その下のマスが青くなります
 *  ・離すと、そのマスへ移ります（キッチン⇄ホール、ランチ⇄ディナー、別の日も）
 *
 *  ★iPhone・iPadでは、ブラウザに元からある「ドラッグ」の仕組みが効きません。
 *    なので、指の位置を自分で追いかけています（マネージの並べ替えと同じ作りです）。
 *  ★枠が変わるときは、時刻をその枠のふだんの時刻に入れかえます。
 *    ランチの11:00をディナーに持っていっても、そのままでは意味が通らないためです。
 * ============================================================ */
const shiftDrag = {
  chip: null, from: null, ghost: null, cell: null,
  timer: null, x: 0, y: 0, active: false, raf: 0, justMoved: false,
};

function startShiftDrag(e, chip) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const td = chip.closest('.shift-cell');
  if (!td) return;

  cancelShiftDrag();
  shiftDrag.chip = chip;
  shiftDrag.from = {
    date: td.dataset.date,
    slot: td.dataset.slot,
    lane: td.dataset.lane,
    index: Number(chip.dataset.i),
    // ★誰を持ったかも覚えておきます。つまんでいるあいだに、ほかの端末の
    //   直しが届いて並びが変わることがあり、番号だけだと別人を動かしてしまいます
    name: chip.dataset.n || '',
  };
  shiftDrag.x = e.clientX;
  shiftDrag.y = e.clientY;
  shiftDrag.timer = setTimeout(() => beginShiftDrag(), 350);

  document.addEventListener('pointermove', onShiftDragMove, { passive: false });
  document.addEventListener('pointerup', endShiftDrag);
  document.addEventListener('pointercancel', cancelShiftDrag);
  document.addEventListener('touchmove', blockShiftScroll, { passive: false });
}

function beginShiftDrag() {
  const chip = shiftDrag.chip;
  if (!chip) return;
  shiftDrag.active = true;
  shiftDrag.timer = null;

  // 指について回る影。中身は名前そのままにして、どれを持っているか分かるようにします
  const box = chip.getBoundingClientRect();
  const ghost = chip.cloneNode(true);
  ghost.className = 'shift-chip shift-ghost';
  ghost.style.width = `${box.width}px`;
  ghost.style.left = `${box.left}px`;
  ghost.style.top = `${box.top}px`;
  document.body.appendChild(ghost);
  shiftDrag.ghost = ghost;

  chip.classList.add('is-moving');
  document.body.classList.add('is-dragging');
  if (navigator.vibrate) navigator.vibrate(15);
  moveShiftGhost(shiftDrag.x, shiftDrag.y);
}

function blockShiftScroll(e) {
  if (shiftDrag.active) e.preventDefault();
}

function onShiftDragMove(e) {
  if (!shiftDrag.active) {
    // 持ち上がる前に動いたら、スクロールしたいのだと見なして取りやめます
    const far = Math.abs(e.clientX - shiftDrag.x) > 8 || Math.abs(e.clientY - shiftDrag.y) > 8;
    if (far) cancelShiftDrag();
    return;
  }
  e.preventDefault();
  moveShiftGhost(e.clientX, e.clientY);
  shiftAutoScroll(e.clientY);
}

/** 影を指の位置へ運び、下にあるマスを光らせます */
function moveShiftGhost(x, y) {
  const g = shiftDrag.ghost;
  if (!g) return;
  const box = g.getBoundingClientRect();
  g.style.left = `${x - box.width / 2}px`;
  g.style.top = `${y - box.height / 2}px`;

  const under = document.elementFromPoint(x, y);
  const cell = under ? under.closest('.shift-cell') : null;
  if (cell === shiftDrag.cell) return;
  if (shiftDrag.cell) shiftDrag.cell.classList.remove('is-drop');
  shiftDrag.cell = cell;
  if (cell) cell.classList.add('is-drop');
}

/** 画面の端まで持っていったら、ゆっくりスクロールします */
function shiftAutoScroll(y) {
  cancelAnimationFrame(shiftDrag.raf);
  const margin = 80;
  const step = y < margin ? -9 : y > window.innerHeight - margin ? 9 : 0;
  if (!step) return;
  const tick = () => {
    if (!shiftDrag.active) return;
    window.scrollBy(0, step);
    shiftDrag.raf = requestAnimationFrame(tick);
  };
  shiftDrag.raf = requestAnimationFrame(tick);
}

function endShiftDrag() {
  const wasActive = shiftDrag.active;
  const from = shiftDrag.from;
  const cell = shiftDrag.cell;
  cancelShiftDrag();
  if (!wasActive || !from || !cell) return;

  // 動かした直後の click で「直す」が開かないようにします
  shiftDrag.justMoved = true;
  setTimeout(() => { shiftDrag.justMoved = false; }, 400);

  moveShiftChip(from, {
    date: cell.dataset.date,
    slot: cell.dataset.slot,
    lane: cell.dataset.lane,
  });
}

function cancelShiftDrag() {
  clearTimeout(shiftDrag.timer);
  cancelAnimationFrame(shiftDrag.raf);
  if (shiftDrag.ghost) shiftDrag.ghost.remove();
  if (shiftDrag.chip) shiftDrag.chip.classList.remove('is-moving');
  if (shiftDrag.cell) shiftDrag.cell.classList.remove('is-drop');
  document.body.classList.remove('is-dragging');
  shiftDrag.timer = null;
  shiftDrag.active = false;
  shiftDrag.chip = null;
  shiftDrag.from = null;
  shiftDrag.ghost = null;
  shiftDrag.cell = null;
  document.removeEventListener('pointermove', onShiftDragMove);
  document.removeEventListener('pointerup', endShiftDrag);
  document.removeEventListener('pointercancel', cancelShiftDrag);
  document.removeEventListener('touchmove', blockShiftScroll);
}

/**
 * 中身を作り直しても、見ている場所が動かないようにします
 *
 * ★シフトの表は、いったん空にしてから作り直しています。その一瞬だけ
 *   ページが短くなるので、ブラウザが「そこまで下げられない」と考えて
 *   一番上まで戻してしまいます。前の位置を覚えておいて、書き戻します。
 */
function renderKeepScroll() {
  const y = window.scrollY;
  render();
  if (window.scrollY !== y) window.scrollTo(0, y);
}

/**
 * 退勤時刻を選ぶところ
 *
 * ★時刻を入れる店舗（popo）だけに出します。
 * ★入れ物は index.html ではなく、ここで作って差し込みます。
 *   index.html は本部のファイルなので、部署からは触りません。
 * ★出勤より前の時刻は出しません（10:00出勤で9:00退勤は作れません）。
 */
function renderShiftEndTimes(使うか, dateStr, slotId, index, entry, 選べる時刻) {
  let box = document.getElementById('shiftPickEndField');
  if (!box) {
    if (!使うか) return;
    box = document.createElement('div');
    box.id = 'shiftPickEndField';
    box.className = 'field';
    const cap = document.createElement('span');
    cap.className = 'field__label';
    cap.textContent = '退勤時刻';
    const seg = document.createElement('div');
    seg.className = 'seg seg--wrap';
    seg.id = 'shiftPickEnds';
    box.append(cap, seg);
    // 出勤時刻のすぐ下に置きます
    el.shiftPickTimeField.parentNode.insertBefore(box, el.shiftPickTimeField.nextSibling);
  }
  box.classList.toggle('is-hidden', !使うか);
  if (!使うか) return;

  const seg = document.getElementById('shiftPickEnds');
  seg.innerHTML = '';
  const 出勤 = Number(entry ? entry.t : shiftPickAt.time);
  const いま = String((entry ? entry.e : shiftPickAt.end) || '');

  選べる時刻.forEach((t) => {
    // 出勤より前は出しません
    if (isFinite(出勤) && Number(t) <= 出勤) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'seg__btn' + (いま === t ? ' is-on' : '');
    b.textContent = shiftTimeText(t);
    b.addEventListener('click', () => {
      if (entry) {
        const now = shiftDayOf(shiftRec(), dateStr);
        now[slotId][index] = { ...now[slotId][index], e: t };
        now[slotId] = shiftSort(now[slotId]);
        saveShiftDay(dateStr, now);
        closeShiftPick();
        renderKeepScroll();
      } else {
        shiftPickAt.end = t;
        renderShiftPick();
      }
    });
    seg.appendChild(b);
  });
}

/** 名前を、別のマスへ移します */
function moveShiftChip(from, to) {
  if (from.date === to.date && from.slot === to.slot && from.lane === to.lane) return;

  const dayFrom = shiftDayOf(shiftRec(), from.date);
  // つまんだときの番号を先に見て、違う人になっていたら名前で探し直します
  let at = from.index;
  const same = (e) => e && e.n === from.name && shiftLaneOf(e) === from.lane;
  if (!same(dayFrom[from.slot][at])) {
    at = dayFrom[from.slot].findIndex(same);
  }
  const entry = at >= 0 ? dayFrom[from.slot][at] : null;
  if (!entry) return;   // 動かすあいだに、その人が消えていた

  const moved = { ...entry, p: to.lane };
  // 枠が変わったら、時刻はその枠のふだんの時刻に入れかえます
  if (from.slot !== to.slot) moved.t = shiftDefaultTime(state.storeId, to.slot);

  if (from.date === to.date) {
    dayFrom[from.slot].splice(at, 1);
    dayFrom[to.slot].push(moved);
    shiftFillShort(dayFrom, to.slot, to.lane);   // 赤いあきが1つ埋まります
    saveShiftDay(from.date, dayFrom);
  } else {
    dayFrom[from.slot].splice(at, 1);
    saveShiftDay(from.date, dayFrom);
    // ★書いたあとに読み直します（同じ人の分を二重に持たないため）
    const dayTo = shiftDayOf(shiftRec(), to.date);
    dayTo[to.slot].push(moved);
    shiftFillShort(dayTo, to.slot, to.lane);
    saveShiftDay(to.date, dayTo);
  }
  renderKeepScroll();
}

/* -------- 人を選ぶ・直す -------- */

function openShiftPick(dateStr, slotId, laneId, index) {
  shiftPickAt = { dateStr, slotId, laneId, index, time: '', end: '', full: undefined };
  const slot = getShiftSlot(state.storeId, slotId);
  const lane = SHIFT_LANES.find((l) => l.id === laneId) || SHIFT_LANES[0];
  const [, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(dateStr.replace(/-/g, '/')).getDay();

  el.shiftPickTitle.textContent = index === null ? '入る人を選ぶ' : '直す';
  el.shiftPickWhen.textContent = `${m}/${d}（${DOW[dow]}） ${slot.name} ・ ${lane.name}`;
  renderShiftPick();
  el.shiftPickModal.classList.remove('is-hidden');
}

function closeShiftPick() {
  el.shiftPickModal.classList.add('is-hidden');
  shiftPickAt = null;
}

/**
 * 直すときに出す「その人が、その日をどう出したか」
 *
 * ★名前を押したのに、こちらで入れた時刻しか見えないと
 *   「希望どおりなのか、ずらしたのか」が分かりませんでした（2026-09-10）。
 *   出してもらった枠・時刻・F・連絡と、**いつ出したか**をここに出します。
 * ★提出していない人（こちらで入れた人）も、そう分かるようにします。
 *   黙って何も出さないと、「読み込めていないのか」と迷います。
 * ★見た目は、いまある `wish-chip` と `shift-said` を借ります
 *   （`css/style.css` は本部のファイルなので、新しい見た目は足しません）。
 */
function shiftPickWishBox(dateStr, name) {
  const box = document.createElement('div');
  box.id = 'shiftPickWishBox';
  if (!name) return box;

  const w = shiftWishes(shiftRec()).find((x) => x.name === name);
  const list = (w && w.days[dateStr]) || [];

  const line = document.createElement('p');
  line.className = 'modal__note';
  if (!w || !w.sentAt) {
    // 提出そのものが無い人。こちらで入れた人です
    line.textContent = `${name}さんは、この半月をまだ提出していません（こちらで入れた人です）`;
    box.appendChild(line);
    return box;
  }
  const 出した日時 = new Date(w.sentAt);
  const いつ = Number.isNaN(出した日時.getTime())
    ? '' : `　提出 ${出した日時.toLocaleString('ja-JP')}`;
  line.textContent = list.length
    ? `${name}さんが出してくれた希望${いつ}`
    : `${name}さんは、この日は希望を出していません（希望なしで入れています）${いつ}`;
  box.appendChild(line);

  if (list.length) {
    const chips = document.createElement('p');
    chips.className = 'wish-legend__slots';
    list.forEach((e) => {
      const slot = getShiftSlot(state.storeId, e.s);
      const chip = document.createElement('span');
      chip.className = `wish-chip wish-chip--${e.s}`;
      const t = e.t !== '' && e.t !== undefined ? shiftTimeText(e.t) : '';
      const en = e.e !== '' && e.e !== undefined ? shiftTimeText(e.e) : '';
      // F は枠の名前が出ないので、字で出します
      const 名 = e.s === SHIFT_FULL_ID ? 'F（通し）' : (slot ? slot.name : e.s);
      chip.textContent = 名 + (t ? ` ${t}${en ? '〜' + en : ''}` : '');
      chips.appendChild(chip);
    });
    box.appendChild(chips);
  }

  if (w.notes[dateStr]) {
    const said = document.createElement('p');
    said.className = 'shift-said';
    said.textContent = `連絡「${w.notes[dateStr]}」`;
    box.appendChild(said);
  }
  return box;
}

function renderShiftPick() {
  if (!shiftPickAt) return;
  const { dateStr, slotId, index } = shiftPickAt;
  const slot = getShiftSlot(state.storeId, slotId);
  const rec = shiftRec();
  const day = shiftDayOf(rec, dateStr);
  const entry = index === null ? null : day[slotId][index];

  /* その人が、その日をどう出したか（直すときだけ） */
  // ★index.html は本部のファイルなので、置き場所を書き足さずに
  //   日付の行のうしろへ差し込みます。開き直すたびに入れかえます
  const 前の = document.getElementById('shiftPickWishBox');
  if (前の) 前の.remove();
  if (entry) {
    el.shiftPickWhen.insertAdjacentElement('afterend', shiftPickWishBox(dateStr, entry.n));
  }

  /* 出勤時刻 */
  // ★時刻を入れる店舗（popo）では、枠ごとの時刻ではなく
  //   「選べる時刻を全部」から選びます。枠は出勤時刻で決まるためです
  const 時刻で入れる = shiftUsesRange(state.storeId);
  const 選べる時刻 = 時刻で入れる ? shiftRangeTimes(state.storeId) : slot.times;
  el.shiftPickTimes.innerHTML = '';
  el.shiftPickTimeField.classList.toggle('is-hidden', !選べる時刻.length);
  el.shiftPickTimeLabel.textContent = entry
    ? (時刻で入れる ? '出勤時刻（押すと変わります）' : '開始時刻（押すと変わります）')
    : (時刻で入れる ? '出勤時刻（選ばなければ、その人の希望どおりに入ります）'
      : '開始時刻（選ばなければ、その人の希望どおりに入ります）');
  if (選べる時刻.length) {
    選べる時刻.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      // ★「足す」ときは、押されるまでどれも光らせません。
      //   既定の時刻を光らせておくと、希望を出した人（18:30など）を選んだときに
      //   「17:00が選ばれているのに18:30で入る」ことになり、食い違って見えます
      const on = entry ? String(entry.t || '') === t : shiftPickAt.time === t;
      b.className = 'seg__btn' + (on ? ' is-on' : '');
      b.textContent = shiftTimeText(t);
      b.addEventListener('click', () => {
        if (entry) {
          const now = shiftDayOf(shiftRec(), dateStr);
          const 直した = { ...now[slotId][index], t };
          // ★時刻を入れる店舗では、出勤時刻を変えたら入る行も変わります
          //   （10:30 は立ち上げ、11:00 はランチ…）。同じ行に置いたままだと
          //   「ランチの行に18時の人がいる」ことになって読みまちがえます
          const 行き先 = 時刻で入れる ? shiftSlotByTime(t) : slotId;
          now[slotId].splice(index, 1);
          now[行き先].push(直した);
          now[行き先] = shiftSort(now[行き先]);
          if (行き先 !== slotId) now[slotId] = shiftSort(now[slotId]);
          saveShiftDay(dateStr, now);
          closeShiftPick();
          renderKeepScroll();
        } else {
          shiftPickAt.time = t;
          renderShiftPick();
        }
      });
      el.shiftPickTimes.appendChild(b);
    });
  }

  /* 退勤時刻（時刻を入れる店舗だけ） */
  // ★退勤は、出勤とは別の幅から選びます（popo は 13:00〜27:00）。
  //   出勤の一覧をそのまま渡すと、深夜の時刻が出せません
  renderShiftEndTimes(時刻で入れる, dateStr, slotId, index, entry,
    時刻で入れる ? shiftRangeTimes(state.storeId, 'out') : 選べる時刻);

  /* --- ここまで --- */
  /* 持ち場（キッチン／ホール） */
  el.shiftPickLanes.innerHTML = '';
  const nowLane = entry ? shiftLaneOf(entry) : shiftPickAt.laneId;
  SHIFT_LANES.forEach((lane) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'seg__btn' + (lane.id === nowLane ? ' is-on' : '');
    b.textContent = lane.name;
    b.addEventListener('click', () => setShiftLane(lane.id));
    el.shiftPickLanes.appendChild(b);
  });

  /* 時刻をじかに書く */
  el.shiftPickFreeField.classList.toggle('is-hidden', !slot.times.length);
  el.shiftPickFree.value = entry && entry.t !== '' && entry.t !== undefined
    ? shiftTimeText(entry.t) : '';

  /* 通し（F）。ランチと立ち上げの枠で出します。
     ★立ち上げから通しで入る人がいるので、立ち上げでも選べるようにしてあります */
  // ★時刻を入れる店舗（popo）では、Fは出勤・退勤から毎回決まります。
  //   手で切り替えるものではないので、この欄は出しません
  const canFull = !時刻で入れる && (slotId === 'lunch' || slotId === 'open');
  el.shiftPickFullField.classList.toggle('is-hidden', !canFull);
  if (canFull) {
    el.shiftPickFullLabel.textContent = slotId === 'open'
      ? '立ち上げのあとは？'
      : 'ランチだけか、通し（F）か';
    const on = entry ? !!entry.f : !!shiftPickAt.full;
    el.shiftPickFullOff.classList.toggle('is-on', !on);
    el.shiftPickFullOn.classList.toggle('is-on', on);
  }

  /* 早上がり。もう入っている人なら、どの枠でも出します
     （立ち上げ・ランチ・ディナーでも早めに上がることがあるため） */
  el.shiftPickEarlyField.classList.toggle('is-hidden', index === null);
  if (entry) {
    el.shiftPickEarlyOff.classList.toggle('is-on', !entry.early);
    el.shiftPickEarlyOn.classList.toggle('is-on', !!entry.early);
  }

  /* 人が足りないマス。マスに付くものなので、人を足すときだけ出します */
  el.shiftPickShortField.classList.toggle('is-hidden', index !== null);
  if (index === null) {
    const n = shiftShortOf(day, slotId, shiftPickAt.laneId);
    el.shiftPickShort.value = n ? String(n) : '';
  }

  /* 名前 */
  el.shiftPickNames.innerHTML = '';
  el.shiftPickNameField.classList.toggle('is-hidden', index !== null);
  el.shiftPickRemove.classList.toggle('is-hidden', index === null);

  if (index === null) {
    // その日のどこかに入っている人は、もう出しません（二重に入れないため）
    const already = [];
    shiftSlotsOf(state.storeId).forEach((sl) => day[sl.id].forEach((e) => already.push(e.n)));
    const wish = shiftWishInto(shiftWishes(rec), dateStr, slotId)
      .filter((w) => !already.includes(w.name));
    const others = shiftBuildNames(state.storeId)
      .filter((n) => !already.includes(n) && !wish.some((w) => w.name === n));

    const addGroup = (title, list, isWish) => {
      if (!list.length) return;
      const h = document.createElement('p');
      h.className = 'shift-pick__group';
      h.textContent = title;
      el.shiftPickNames.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'doer-grid';
      list.forEach((item) => {
        const name = isWish ? item.name : item;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'doer-btn' + (isWish ? ' is-wish' : '') + (isWish && item.full ? ' is-full' : '');
        const when = isWish && item.t
          ? `（${shiftTimeText(item.t)}${item.e ? '〜' + shiftTimeText(item.e) : ''}）` : '';
        b.textContent = (isWish && item.full ? 'F ' : '') + name + when;
        b.addEventListener('click', () => {
          const now = shiftDayOf(shiftRec(), dateStr);
          const t = shiftPickAt.time || (isWish && item.t) || shiftDefaultTime(state.storeId, slotId);
          // 通しかどうかは、押した切り替え → その人の希望、の順で決めます
          const full = shiftPickAt.full !== undefined ? shiftPickAt.full : !!(isWish && item.full);
          const add = { n: name, t, p: shiftPickAt.laneId };
          if (slotId === 'lunch' && full) add.f = true;
          // ★退勤時刻。押した選び → その人の希望、の順です
          const 退勤 = shiftPickAt.end || (isWish && item.e) || '';
          if (退勤) add.e = 退勤;
          // ★出勤時刻で入る行が決まる店舗では、押した行ではなく時刻で決めます
          const 行き先 = shiftUsesRange(state.storeId) ? shiftSlotByTime(t) : slotId;
          now[行き先].push(add);
          now[行き先] = shiftSort(now[行き先]);
          shiftFillShort(now, 行き先, shiftPickAt.laneId);
          saveShiftDay(dateStr, now);
          closeShiftPick();
          renderKeepScroll();
        });
        grid.appendChild(b);

        // 立ち上げに希望を出した人には、時間をずらして入れる道も出します。
        // 立ち上げが多い日に、押すだけでランチへ回せるようにするためです。
        // ★ランチを使っていない店舗（夜だけのお店）では、回し先が無いので出しません
        const to = slotId === 'open' && isWish ? shiftSpillTo(state.storeId) : null;
        if (to) {
          const spill = document.createElement('button');
          spill.type = 'button';
          spill.className = 'shift-spill';
          spill.textContent = `${name}を ${to.label}`;
          spill.addEventListener('click', () => {
            const now = shiftDayOf(shiftRec(), dateStr);
            if (now[to.slot].some((e) => e.n === name)) { closeShiftPick(); return; }
            now[to.slot].push({ n: name, t: to.time, p: shiftPickAt.laneId });
            now[to.slot] = shiftSort(now[to.slot]);
            shiftFillShort(now, to.slot, shiftPickAt.laneId);
            saveShiftDay(dateStr, now);
            closeShiftPick();
            renderKeepScroll();
          });
          grid.appendChild(spill);
        }
      });
      el.shiftPickNames.appendChild(grid);
    };

    addGroup('希望を出している人', wish, true);
    addGroup('そのほかの人', others, false);

    if (!wish.length && !others.length) {
      el.shiftPickNames.innerHTML = '<p class="modal__note">入れられる人がいません。'
        + 'マネージの「シフトに入る人」で登録してください。</p>';
    }
  }
}

/** 持ち場を変える */
function setShiftLane(laneId) {
  if (!shiftPickAt) return;
  const { dateStr, slotId, index } = shiftPickAt;
  if (index === null) {
    shiftPickAt.laneId = laneId;
    renderShiftPick();
    return;
  }
  const now = shiftDayOf(shiftRec(), dateStr);
  now[slotId][index] = { ...now[slotId][index], p: laneId };
  saveShiftDay(dateStr, now);
  closeShiftPick();
  renderKeepScroll();
}

/**
 * 時刻をじかに書く
 *
 * ボタンに無い時刻（11:15 など）を入れるためのものです。
 * ★パソコンでもiPadでもiPhoneでも同じように使えます。
 */
function applyShiftFreeTime() {
  if (!shiftPickAt) return;
  const t = shiftTimeFrom(el.shiftPickFree.value);
  if (t === null) {
    el.shiftPickFree.classList.add('is-ng');
    return;
  }
  el.shiftPickFree.classList.remove('is-ng');
  const { dateStr, slotId, index } = shiftPickAt;
  if (index === null) {
    shiftPickAt.time = t;
    renderShiftPick();
    return;
  }

  const now = shiftDayOf(shiftRec(), dateStr);
  const entry = { ...now[slotId][index], t };

  // ★入れた時刻に合う枠へ、自動で移します。
  //   立ち上げの欄に「18:00」と書いてあるより、ディナーの欄に
  //   入っていた方が、表を見たときに読みまちがえません。
  //   立ち上げへは戻しません（立ち上げに入れたいときは、立ち上げの ＋ から）。
  let to = shiftSlotByTime(t);
  if (to === 'open') to = slotId;
  // ★F（通し）の人を17時以降にずらしたら、それはもう通しではありません。
  //   通しの印（灰色の塗り）を外して、ディナーの枠へ移します
  if (entry.f && to === 'dinner') delete entry.f;
  else if (entry.f) to = slotId;
  if (to && to !== slotId) {
    now[slotId].splice(index, 1);
    now[to].push(entry);
    now[to] = shiftSort(now[to]);
  } else {
    now[slotId][index] = entry;
    now[slotId] = shiftSort(now[slotId]);
  }

  saveShiftDay(dateStr, now);
  closeShiftPick();
  renderKeepScroll();
}

/** 「早上がり」を切り替える（Fで入れているが、早めに帰す人） */
function setShiftEarly(on) {
  if (!shiftPickAt || shiftPickAt.index === null) return;
  const { dateStr, slotId, index } = shiftPickAt;
  const now = shiftDayOf(shiftRec(), dateStr);
  const e = { ...now[slotId][index] };
  if (on) e.early = true;
  else delete e.early;
  now[slotId][index] = e;
  saveShiftDay(dateStr, now);
  closeShiftPick();
  renderKeepScroll();
}

/**
 * そのマスに1人入ったので、足りない人数を1つ減らします
 *
 * ★赤いあきを押して人を入れたときに、その赤が消えるようにするためです。
 *   外したときは戻しません（そのつもりで外すこともあるためです）。
 */
function shiftFillShort(day, slotId, laneId) {
  const key = shiftShortKey(slotId, laneId);
  const n = day.short[key] || 0;
  if (n > 1) day.short[key] = n - 1;
  else if (n === 1) delete day.short[key];
}

/** 「あと何人ほしいか」を書き入れる */
function applyShiftShort() {
  if (!shiftPickAt) return;
  const { dateStr, slotId, laneId } = shiftPickAt;
  // 全角の数字で打たれても読めるようにします
  const raw = toHalfWidthNumber(String(el.shiftPickShort.value || '')).trim();
  // 空っぽや0は「足りている」の意味にします
  const n = Math.min(SHIFT_SHORT_MAX, Math.max(0, Math.floor(Number(raw)) || 0));
  const now = shiftDayOf(shiftRec(), dateStr);
  const key = shiftShortKey(slotId, laneId);
  if (n > 0) now.short[key] = n;
  else delete now.short[key];
  saveShiftDay(dateStr, now);
  closeShiftPick();
  renderKeepScroll();
}

/** 「通し（F）」を切り替える */
function setShiftFull(on) {
  if (!shiftPickAt) return;
  const { dateStr, slotId, index } = shiftPickAt;
  if (index === null) {
    // 「足す」ときは、まだ入れていないので覚えておくだけ
    shiftPickAt.full = on;
    renderShiftPick();
    return;
  }
  const now = shiftDayOf(shiftRec(), dateStr);
  const e = { ...now[slotId][index] };
  if (on) e.f = true;
  else delete e.f;
  now[slotId][index] = e;
  saveShiftDay(dateStr, now);
  closeShiftPick();
  renderKeepScroll();
}

function removeShiftPick() {
  if (!shiftPickAt || shiftPickAt.index === null) return;
  const { dateStr, slotId, index } = shiftPickAt;
  const now = shiftDayOf(shiftRec(), dateStr);
  now[slotId].splice(index, 1);
  saveShiftDay(dateStr, now);
  closeShiftPick();
  render();
}

/* -------- 足りない日を、LINEに送る文にする -------- */

/**
 * その半月で、まだ人が足りない日
 *
 * ★赤い「あき」（マスの ＋）に入れた人数から作ります。押して人を入れれば
 *   その分だけ減るので、**表を直せば文も直ります**（別に打ち直しません）。
 * ★持ち場（キッチン／ホール）は分けません。枠ごとに足します。
 * ★**過ぎた日は入れません。**「9/1に来てください」とは頼めないためです。
 */
function shiftShortDays(rec) {
  const 今日 = TODAY_STR;   // ★過ぎた日は入れません
  const 枠一覧 = shiftSlotsOf(state.storeId);
  const out = [];
  shiftDays(state.y, state.m, shiftHalf).forEach((dateStr) => {
    if (dateStr < 今日) return;
    if (shiftClosedOn(dateStr)) return;
    const day = shiftDayOf(rec, dateStr);
    const 枠 = [];
    枠一覧.forEach((slot) => {
      const n = SHIFT_LANES.reduce((sum, lane) => sum + shiftShortOf(day, slot.id, lane.id), 0);
      if (n > 0) 枠.push({ name: slot.name, n });
    });
    if (枠.length) out.push({ dateStr, 枠 });
  });
  return out;
}

/** 上の一覧を、そのまま送れる文にします */
function shiftShortText(list) {
  const 行 = list.map(({ dateStr, 枠 }) => {
    const [, m, d] = dateStr.split('-').map(Number);
    const dow = new Date(dateStr.replace(/-/g, '/')).getDay();
    const 中身 = 枠.map((k) => `${k.name}${shiftZen(k.n)}人`).join('、');
    return `${m}/${d}(${DOW[dow]})${中身}`;
  });
  return `${SHIFT_SHORT_HEAD}\n${行.join('\n')}\n\n${SHIFT_SHORT_FOOT}`;
}

/**
 * 「足りない日をLINEにコピー」のボタン
 *
 * ★`index.html` は本部のファイルなので、置き場所を書き足さずに
 *   提出の集まりぐあいの下へ差し込みます。
 * ★足りない日が1日も無いときは、ボタンごと出しません。押しても何も起きない
 *   ボタンがあると、「壊れているのか」と迷います。
 */
function shiftShortCopyBox(rec) {
  const 前の = document.getElementById('shiftShortCopy');
  if (前の) 前の.remove();
  const list = shiftShortDays(rec);
  if (!list.length) return;

  const box = document.createElement('div');
  box.id = 'shiftShortCopy';
  box.className = 'shift-top__acts';

  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn';
  const 直す = () => { b.textContent = `足りない日をLINEにコピー（${list.length}日分）`; };
  直す();
  b.addEventListener('click', async () => {
    const text = shiftShortText(list);
    try {
      await navigator.clipboard.writeText(text);
      b.textContent = 'コピーしました';
      setTimeout(直す, 1800);
    } catch (e) {
      // コピーできない端末では、文をそのまま出して選べるようにします
      if (box.querySelector('textarea')) return;
      const ta = document.createElement('textarea');
      ta.readOnly = true;
      ta.rows = text.split('\n').length + 1;
      ta.style.width = '100%';
      ta.value = text;
      box.style.display = 'block';
      box.appendChild(ta);
      ta.select();
      b.textContent = 'ここから写してください';
    }
  });
  box.appendChild(b);
  el.shiftWishNote.insertAdjacentElement('afterend', box);
}

/* -------- 提出の一覧 -------- */

/**
 * 出してもらった希望を、名前×日付の表で見る
 *
 *  スマレジの提出一覧と同じ形です。誰がどの日に出しているかを
 *  ひと目で見くらべられるようにしています（縦に並べると、
 *  「この日は誰が出しているか」を数えるのに何度も往復することになります）。
 */
function openShiftWishes() {
  const rec = shiftRec();
  const names = shiftBuildNames(state.storeId);
  const wishes = shiftWishes(rec);
  const days = shiftDays(state.y, state.m, shiftHalf);
  const open = days.filter((d) => !shiftClosedOn(d));

  const sent = wishes.filter((w) => w.sentAt).length;
  el.shiftWishWhen.textContent =
    `${shiftRangeLabel(state.y, state.m, shiftHalf)}　提出 ${sent} / ${names.length}人`;

  el.shiftWishList.innerHTML = '';
  if (!names.length) {
    el.shiftWishList.innerHTML = '<p class="modal__note">'
      + 'マネージの「シフトに入る人」で名前を登録してください。</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'wish-table';
  // ★枠の一覧は**1回だけ**作ります。shiftSlotsOf は毎回 Store を読むので、
  //   名前×日（10人×15日＝150回）で呼ぶと、古い端末で目に見えて重くなります
  //   （shiftWishInto に書いてあるのと同じ理由です）
  const 枠一覧 = shiftSlotsOf(state.storeId);

  /* 見出し（日付） */
  const head = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'wish-table__name';
  corner.textContent = '名前';
  head.appendChild(corner);
  days.forEach((d) => {
    const [, m, dd] = d.split('-').map(Number);
    const [yy] = d.split('-').map(Number);
    const dow = new Date(d.replace(/-/g, '/')).getDay();
    const holi = isHoliday(yy, m, dd);
    const th = document.createElement('th');
    th.className = 'wish-table__day'
      + (dow === 0 || holi ? ' is-sun' : dow === 6 ? ' is-sat' : '')
      + (shiftClosedOn(d) ? ' is-closed' : '');
    th.innerHTML = `${dd}<br><span class="wish-table__dow">${DOW[dow]}${holi ? '祝' : ''}</span>`;
    head.appendChild(th);
  });
  table.appendChild(head);

  /* 1人ずつ。★組んだシフトと突き合わせて出します */
  names.forEach((name) => {
    const w = wishes.find((x) => x.name === name);
    const tr = document.createElement('tr');
    if (!w || !w.sentAt) tr.className = 'is-yet';

    // その人が「出した日」と「実際に入った日」を数えます
    let wished = 0;
    let placed = 0;
    open.forEach((d) => {
      if (((w && w.days[d]) || []).length) wished += 1;
      if (shiftPlacedOn(rec, d, name).length) placed += 1;
    });

    const th = document.createElement('th');
    th.className = 'wish-table__name';
    th.innerHTML = `${name}<br><span class="wish-table__count">`
      + (w && w.sentAt ? `出${wished} → 入${placed}` : 'まだ') + '</span>';
    tr.appendChild(th);

    days.forEach((d) => {
      const td = document.createElement('td');
      if (shiftClosedOn(d)) { td.className = 'is-closed'; tr.appendChild(td); return; }

      const mine = shiftPlacedOn(rec, d, name);
      const list = (w && w.days[d]) || [];

      // ★出したものと入れたものを、**枠ごとに突き合わせて**から出します。
      //   前は「1人でも入れたら、出した分は出さない」でした。そのため
      //   ランチだけ入れた日に、ディナーの希望が消えて見えていました。
      //   出方は4とおりあります（→ 下の「見かた」）：
      //     ① 出して、入れた（同じ時刻）      … 濃い　18:00
      //     ② 出して、入れた（時刻が違う）    … 濃い　17:00→18:00
      //     ③ 出したが、まだ入れていない      … 薄い　17:00
      //     ④ 出していないのに、入れた        … 濃い　＊18:00
      const 組 = [];
      枠一覧.forEach((sl) => {
        const 入れた = mine.filter((e) => e.slot === sl.id);
        const 出した = list.filter((e) => shiftSlotFor(e.s) === sl.id);
        if (入れた.length) {
          入れた.forEach((e, i) => 組.push({ 入: e, 出: 出した[i] || 出した[0] || null }));
        } else {
          出した.forEach((e) => 組.push({ 入: null, 出: e }));
        }
      });

      組.forEach(({ 入, 出 }) => {
        const chip = document.createElement('span');
        if (入) {
          const slot = getShiftSlot(state.storeId, 入.slot);
          // F（通し）は、ランチの枠にいても F の色で出します
          const kind = 入.f ? SHIFT_FULL_ID : 入.slot;
          const 入れた時刻 = 入.t !== '' && 入.t !== undefined ? shiftTimeText(入.t) : '';
          const 出した時刻 = 出 && 出.t !== '' && 出.t !== undefined ? shiftTimeText(出.t) : '';
          // ★希望なしで入れた人は、**字でも**印を付けます。
          //   ふちの線（is-extra）だけだと、濃い色のチップの上では
          //   ほとんど見えませんでした（2026-09-10、ko-dai の指摘）
          chip.className = `wish-chip wish-chip--${kind}` + (出 ? '' : ' is-extra');
          if (出 && 出した時刻 && 入れた時刻 && 出した時刻 !== 入れた時刻) {
            // ★出した時刻と入れた時刻の**両方**を出します。
            //   片方だけだと「希望どおりなのか、ずらしたのか」が分かりません
            chip.textContent = `${出した時刻}→${入れた時刻}`;
            chip.title = `${入.f ? 'F（通し）' : slot ? slot.name : ''}`
              + `　出してもらった時刻 ${出した時刻} → シフトに入れた時刻 ${入れた時刻}`;
          } else {
            chip.textContent = (出 ? '' : '＊')
              + (入れた時刻 || (slot ? slot.name : ''));
            chip.title = `${入.f ? 'F（通し）' : slot ? slot.name : ''}`
              + (入れた時刻 ? ' ' + 入れた時刻 : '')
              + (出 ? '（出してもらったとおりに入れました）' : '（希望なしで入れました）');
          }
        } else {
          const slot = getShiftSlot(state.storeId, 出.s);
          if (!slot) return;
          const 時刻 = 出.t !== '' && 出.t !== undefined ? shiftTimeText(出.t) : '';
          chip.className = `wish-chip wish-chip--${出.s} is-yet`;
          chip.textContent = 時刻 || slot.name;
          chip.title = `${slot.name}${時刻 ? ' ' + 時刻 : ''}（出してもらいましたが、まだ入れていません）`;
        }
        td.appendChild(chip);
      });

      if (w && w.notes[d]) {
        const note = document.createElement('span');
        note.className = 'wish-note';
        note.textContent = '連';
        note.title = w.notes[d];
        td.appendChild(note);
      }
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  const wrap = document.createElement('div');
  wrap.className = 'wish-wrap';
  wrap.appendChild(table);
  el.shiftWishList.appendChild(wrap);

  /* 見かた。★1つの印につき1行にします。
     つないで書くと、どの印がどの説明か分からなくなりました */
  const legend = document.createElement('div');
  legend.className = 'wish-legend';
  legend.innerHTML =
    '<p class="wish-legend__slots">'
    + shiftWishSlots(state.storeId)
      .map((sl) => `<span class="wish-chip wish-chip--${sl.id}">${sl.name}</span>`).join('')
    + '</p>'
    + [
      ['<span class="wish-chip wish-chip--lunch">濃い</span>',
        'シフトに入れた。出してもらった時刻と違うときは「17:00→18:00」と両方出ます'],
      ['<span class="wish-chip wish-chip--lunch is-extra">＊</span>',
        '希望なしで入れた（時刻の頭に ＊ が付きます）'],
      ['<span class="wish-chip wish-chip--lunch is-yet">薄い</span>',
        '出してもらったが、まだ入れていない'],
      ['<span class="wish-note">連</span>', '連絡あり（押すと中身が出ます）'],
    ].map(([mark, text]) => `<p class="wish-legend__row">${mark}<span>${text}</span></p>`).join('');
  el.shiftWishList.appendChild(legend);

  el.shiftWishModal.classList.remove('is-hidden');
}

/* -------- 表にする（印刷・PDF・JPEG） --------
 *
 *  画面と印刷で作りがずれないよう、いったん「表の中身」だけを作って、
 *  それを HTML と 画像（canvas）の両方から使います。
 *  1つのかたまりは8日分。今のスプレッドシートと同じ区切りです。
 */

/** 印刷やPDFに出す、表の中身 */
function shiftSheetModel(pageIndex) {
  const rec = shiftRec();
  const store = getStore(state.storeId);
  const days = shiftDays(state.y, state.m, shiftHalf);
  const blocks = [];

  const per = shiftPrintCols(days.length, state.storeId);
  for (let from = 0; from < days.length; from += per) {
    const part = days.slice(from, from + per);
    const head = part.map((s) => {
      const [, m, d] = s.split('-').map(Number);
      const dow = new Date(s.replace(/-/g, '/')).getDay();
      const [yy] = s.split('-').map(Number);
      const holi = isHoliday(yy, m, d);
      return {
        key: s, label: `${m}/${d}`,
        // 祝はかっこの外に出します（9/21（月）祝）
        dow: `（${DOW[dow]}）` + (holi ? '祝' : ''),
        sun: dow === 0 || holi, sat: dow === 6,
        closed: shiftClosedOn(s),
      };
    });

    const rows = shiftSlotsOf(state.storeId).map((slot) => ({
      label: slot.name,
      cells: part.flatMap((s) => {
        const day = shiftDayOf(rec, s);
        return SHIFT_LANES.map((lane) => ({
          closed: shiftClosedOn(s),
          patty: day.patty === slot.id,
          short: shiftShortOf(day, slot.id, lane.id),
          names: shiftClosedOn(s) ? [] : day[slot.id]
            .filter((e) => shiftLaneOf(e) === lane.id)
            .map((e) => ({
              text: shiftNameText(state.storeId, slot.id, e),
              parts: shiftNameParts(state.storeId, slot.id, e),
              full: shiftIsFull(state.storeId, e), early: !!e.early,
            })),
        }));
      }),
    }));

    const memo = part.map((s) => (shiftClosedOn(s) ? '' : shiftMemoOf(rec, s)));
    blocks.push({ head, rows, memo });
  }

  // ★1枚分だけを返します。2枚に分ける店舗（popo）は、
  //   前の段2つが1枚目、あとの2つが2枚目です
  const 枚数 = shiftPrintPages(state.storeId);
  const 段の数 = Math.ceil(blocks.length / 枚数);
  const 何枚目 = Number(pageIndex) > 0 ? Number(pageIndex) : 0;
  const この枚 = 枚数 > 1
    ? blocks.slice(何枚目 * 段の数, (何枚目 + 1) * 段の数)
    : blocks;

  const 見出し = `${shiftRangeLabel(state.y, state.m, shiftHalf)} ${store.name} シフト表`;
  return {
    // ★2枚に分けるときは「（1/2）」を付けます。どちらが先か分からないと、
    //   貼るときに前後が入れかわります
    title: 枚数 > 1 ? `${見出し}（${何枚目 + 1}/${枚数}）` : 見出し,
    // ★枠は店舗ごとに違います。絵を描くところは店舗を知らないので、ここで渡します
    slots: shiftSlotsOf(state.storeId),
    blocks: この枚,
  };
}

/** その店舗のシフト表を、1枚ずつのモデルにして返します */
function shiftSheetPages() {
  const 枚数 = shiftPrintPages(state.storeId);
  const out = [];
  for (let i = 0; i < 枚数; i += 1) out.push(shiftSheetModel(i));
  return out;
}

/* -------- 画面に出す表 -------- */
function renderShiftSheet() {
  const pages = shiftSheetPages();
  el.shiftSheetTitle.textContent = pages[0].title;
  el.shiftSheet.innerHTML = '';

  pages.forEach((model, i) => {
    // 2枚に分ける店舗（popo）は、2枚目の上に見出しを出します。
    // どこからが2枚目か、画面でも分かるようにするためです
    if (i > 0) {
      const cap = document.createElement('p');
      cap.className = 'shift-sheet__page';
      cap.textContent = model.title;
      // ★見た目は css を足さずに、ここで持たせます（css/style.css は本部のもの）
      cap.style.cssText = 'margin:14px 0 6px;font-weight:700;text-align:center;'
        + 'font-size:13px;' + cap.style.cssText;
      // ★紙では、ここで改ページします。指定は css/style.css（本部のファイル）に
      //   足さず、ここで直に入れます
      cap.style.breakBefore = 'page';
      cap.style.pageBreakBefore = 'always';   // 古いブラウザ向け
      el.shiftSheet.appendChild(cap);
    }
    // 列の幅は「一番多い日数」でそろえます。後ろの段が少ない半月でも、
    // 前の段と同じ幅にしておくと、続きの表として読めます
    const perDay = model.blocks.reduce((n, b) => Math.max(n, b.head.length), 1);
    const size = shiftSheetMetrics(model, perDay);
    model.blocks.forEach((b) => el.shiftSheet.appendChild(shiftSheetTable(b, perDay, size)));
  });
}

function shiftSheetTable(block, perDay, size) {
  const table = document.createElement('table');
  table.className = 'shift-sheet';
  // 日数の少ない段は、その分短くします（右はしが空くだけで、列の幅は同じ）
  if (perDay && block.head.length < perDay) {
    table.style.setProperty('--sheet-w', `${(block.head.length / perDay) * 100}%`);
  }
  if (size) {
    table.style.setProperty('--name-pt', `${size.pt}pt`);
    table.style.setProperty('--row-open', `${size.openMm}mm`);
    table.style.setProperty('--row-slot', `${size.slotMm}mm`);
  }

  const head = document.createElement('tr');
  head.appendChild(document.createElement('th'));
  block.head.forEach((d) => {
    const th = document.createElement('th');
    th.colSpan = SHIFT_LANES.length;
    th.className = d.sun ? 'is-sun' : d.sat ? 'is-sat' : '';
    th.textContent = `${d.label}${d.dow}`;
    head.appendChild(th);
  });
  table.appendChild(head);

  const lanes = document.createElement('tr');
  lanes.appendChild(document.createElement('th'));
  block.head.forEach(() => SHIFT_LANES.forEach((l) => {
    const th = document.createElement('th');
    th.className = 'shift-sheet__lane';
    th.textContent = l.name;
    lanes.appendChild(th);
  }));
  table.appendChild(lanes);

  block.rows.forEach((row, ri) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.className = 'shift-sheet__label';
    // ★枠名だけ縦書きにします。1文字分の幅で足りるので、
    //   その分日付の列を広くできます（メモは横書きのままです）。
    //   縦書きは中の span に付けます。マスに直に付けると、
    //   字が右のはしに寄って真ん中に来ません
    const vlab = document.createElement('span');
    vlab.className = 'shift-sheet__vlabel';
    vlab.textContent = row.label;
    th.appendChild(vlab);
    tr.appendChild(th);

    let i = 0;
    block.head.forEach((d) => {
      if (d.closed) {
        i += SHIFT_LANES.length;
        if (ri === 0) {
          const td = document.createElement('td');
          td.className = 'is-closed';
          td.colSpan = SHIFT_LANES.length;
          td.rowSpan = block.rows.length;
          td.textContent = '定休日';
          tr.appendChild(td);
        }
        return;
      }
      SHIFT_LANES.forEach((lane, li) => {
        const cell = row.cells[i];
        i += 1;
        const td = document.createElement('td');
        // ★人がたくさん入っているマスだけ、そのマスの中で小さくします
        if (size) {
          const room = ri === 0 ? size.openMm : size.slotMm;
          const one = shiftCellPt(size.pt, cell.names.length + cell.short, room);
          if (one < size.pt) td.style.setProperty('--name-pt', `${Math.floor(one * 10) / 10}pt`);
        }
        // パティの枠は、キッチンとホールをまとめて桃色のふちで囲みます
        if (cell.patty) {
          td.classList.add('is-patty');
          if (li === 0) td.classList.add('is-patty-first');
          if (li === SHIFT_LANES.length - 1) td.classList.add('is-patty-last');
        }
        // ★F（通し）は名前を灰色で塗ります。今のスプレッドシートで
        //   ランチのセルを塗りつぶしているのと同じ意味です。
        //   早上がりの人は、そのうえに橙のふちを付けます
        cell.names.forEach((n) => td.appendChild(shiftNameSpan(n)));
        // 足りない人数の分だけ、赤いあきを名前の下に出します
        for (let k = 0; k < cell.short; k += 1) {
          const gap = document.createElement('span');
          gap.className = 'shift-sheet__name is-short';
          gap.textContent = '\u00a0';
          td.appendChild(gap);
        }
        tr.appendChild(td);
      });
    });
    table.appendChild(tr);
  });

  const memo = document.createElement('tr');
  const memoTh = document.createElement('th');
  memoTh.className = 'shift-sheet__label';
  memoTh.textContent = 'メモ';
  memo.appendChild(memoTh);
  block.head.forEach((d, i) => {
    const td = document.createElement('td');
    td.colSpan = SHIFT_LANES.length;
    td.className = 'shift-sheet__memo' + (d.closed ? ' is-closed' : '');
    td.textContent = block.memo[i] || '';
    memo.appendChild(td);
  });
  table.appendChild(memo);

  return table;
}

/* ============================================================
 *  ★PDFのシフトを入れる仕掛けは、外しました（2026-09-05）
 *
 *  9/1〜9/15 のバグるの表を、そのまま12日分持っていました。
 *  **アルバイト22人の名前・持ち場・出勤時刻**が入っていて、
 *  公開したアプリの js に、そのまま乗っていました
 *  （`…/T3Works/js/app.js` を開けば誰でも読めました）。
 *
 *  「1回押したら外す」と書いてありましたが、外されないまま公開が続きました。
 *  ★同じ形のものを作らないでください。人の名前が入るデータを
 *    コードに直接書くと、公開した時点で誰でも読めます。
 *    入れたいものがあれば、貼り付ける欄を作って手元から読ませてください。
 * ============================================================ */

/* -------- これまでのシフト表 -------- */

/**
 * 確定ずみの半月を、新しい順に返します
 *
 * ★キーは '_shift/baguru-2026-09-1' の形なので、
 *   店舗の分だけ拾って、年・月・前後半に読み直します。
 */
function shiftBuiltPeriods() {
  const all = Store.adapter.dump() || {};
  const head = `${SHIFT_STORE}/${state.storeId}-`;
  const out = [];
  Object.keys(all).forEach((k) => {
    if (k.indexOf(head) !== 0) return;
    const hit = k.slice(head.length).match(/^(\d{4})-(\d{2})-([12])$/);
    if (!hit) return;
    if (shiftPhaseOf(all[k] || {}) !== SHIFT_BUILT) return;
    out.push({ y: Number(hit[1]), m: Number(hit[2]), half: Number(hit[3]) });
  });
  out.sort((a, b) => (b.y - a.y) || (b.m - a.m) || (b.half - a.half));
  return out;
}

function openShiftPast() {
  const list = shiftBuiltPeriods();
  el.shiftPastList.innerHTML = '';
  if (!list.length) {
    el.shiftPastList.innerHTML = '<p class="modal__note">確定したシフトは、まだありません。</p>';
  }
  list.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'past-item';
    const main = document.createElement('b');
    main.textContent = shiftRangeLabel(p.y, p.m, p.half);
    const sub = document.createElement('span');
    sub.textContent = `${p.y}年${p.m}月 ${p.half === 1 ? '前半' : '後半'}`;
    b.append(main, sub);
    b.addEventListener('click', () => {
      closeShiftPast();
      shiftGo(p.y, p.m, p.half);
      openShiftSheet();
    });
    el.shiftPastList.appendChild(b);
  });
  el.shiftPastModal.classList.remove('is-hidden');
}

function closeShiftPast() {
  el.shiftPastModal.classList.add('is-hidden');
}

/**
 * iPhone や iPad か
 *
 * ★iPadOS は「Macintosh」と名乗るので、指で触れるかどうかも見ます
 *   （指で触れる Mac はありません）。
 */
function isTouchApple() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod|iPad/.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * 印刷する
 *
 * ★iPhone・iPad で画面をそのまま刷ると、3つ困ったことが起きます。
 *   ・「このWebサイトから自動的に印刷することは禁止されています」と聞かれる
 *   ・向きが縦のままで始まる
 *   ・横にしても、幅の合わせ方がパソコンと違うので2枚に分かれる
 *   どれもこちらでは直せない（ブラウザが決めている）ので、
 *   A4横1枚のPDFを作って渡します。出てきた画面で「プリント」を選べば刷れます。
 */
function printShiftSheet() {
  if (isTouchApple()) return saveShiftFile('pdf');
  return window.print();
}

function openShiftSheet() {
  renderShiftSheet();
  el.shiftPrintNote.classList.toggle('is-hidden', !isTouchApple());
  // 印刷したときに、この表だけが紙に出るようにするための目印（css の @media print）
  document.body.classList.add('print-shift');
  el.shiftSheetModal.classList.remove('is-hidden');
}

function closeShiftSheet() {
  el.shiftSheetModal.classList.add('is-hidden');
  document.body.classList.remove('print-shift');
}

/** 画像（JPEG）で保存する */
function saveShiftImage() {
  return saveShiftFile('jpg');
}

/** PDFで保存する */
function saveShiftPdf() {
  return saveShiftFile('pdf');
}

/**
 * シフト表をファイルにして渡す
 *
 *  パソコン … 保存先を選ぶ画面が出ます。Finder のどこにでも置けます
 *             （前に保存した場所を覚えているので、2回目からは1回押すだけです）
 *  iPhone   … 共有の画面が出ます。そのままLINEに送るか、ファイルに保存できます
 *  それ以外 … ふだんのダウンロードになります
 *
 *  ★保存先を選ぶ画面は、押したその場で開きます。
 *    先に絵を作ってから開くと、ブラウザが「押した流れ」と見なさなくなり、
 *    画面が出ないことがあるためです。
 */
async function saveShiftFile(kind) {
  const isPdf = kind === 'pdf';
  const name = shiftFileName(isPdf ? 'pdf' : 'jpg');
  const type = isPdf ? 'application/pdf' : 'image/jpeg';

  const make = async () => {
    // ★2枚に分ける店舗（popo）は、1枚ずつ描きます
    const pages = shiftSheetPages();
    const canvases = pages.map((model) => {
      const c = document.createElement('canvas');
      drawShiftSheet(c, model);
      return c;
    });
    // ★細い線と小さい字がつぶれないよう、高めにします（0.92だと字のふちがにじみます）
    const 焼く = (c) => new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95));

    if (isPdf) {
      const jpegs = [];
      for (const c of canvases) {
        const one = await 焼く(c);
        if (!one) return null;
        jpegs.push(new Uint8Array(await one.arrayBuffer()));
      }
      return makePdf(jpegs, canvases[0].width, canvases[0].height);
    }

    // 画像は1つのファイルにしたいので、2枚目を下につなげます
    // （LINEに送るときに2つに分かれていると、片方だけ見て終わることがあります）
    if (canvases.length === 1) return 焼く(canvases[0]);
    const 縦 = document.createElement('canvas');
    縦.width = canvases[0].width;
    縦.height = canvases.reduce((h, c) => h + c.height, 0);
    const cx = 縦.getContext('2d');
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, 縦.width, 縦.height);
    let y = 0;
    canvases.forEach((c) => { cx.drawImage(c, 0, y); y += c.height; });
    return 焼く(縦);
  };

  if (window.showSaveFilePicker) {
    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: name,
        // id を付けておくと、前に保存した場所から開いてくれます
        id: 't3works-shift',
        startIn: 'documents',
        types: [{
          description: isPdf ? 'PDF' : 'JPEG画像',
          accept: isPdf ? { 'application/pdf': ['.pdf'] } : { 'image/jpeg': ['.jpg', '.jpeg'] },
        }],
      });
    } catch (e) {
      return;   // 「キャンセル」を押しただけなので、何も言いません
    }
    const blob = await make();
    if (!blob) return;
    const w = await handle.createWritable();
    await w.write(blob);
    await w.close();
    el.shiftWishNote.textContent = `${name} を保存しました`;
    return;
  }

  const blob = await make();
  if (!blob) return;
  await handOut(new File([blob], name, { type }), name);
}

function shiftFileName(ext) {
  const store = getStore(state.storeId);
  const [a, b] = shiftRangeLabel(state.y, state.m, shiftHalf).split('〜');
  return `${store.name}シフト_${state.y}_${a.replace('/', '-')}-${b.replace('/', '-')}.${ext}`;
}

/**
 * できたファイルを渡す（保存先を選ぶ画面が使えない端末むけ）
 *
 * iPhone では「共有」から、そのままLINEに送れます。
 * 共有が使えない端末では、ふだんのダウンロードにします。
 */
async function handOut(file, name) {
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (e) {
    // 共有をやめただけのこともあるので、ここでは何も言いません
    if (e && e.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}


/** さっき取りに行った「店舗/日付」。同じ日で何度も取りに行かないための目印 */
let lastDayPulled = '';

function render() {
  el.appTitle.textContent = APP_NAME;
  el.appCompany.textContent = APP.company;

  // 会社ロゴ（読めなければ枠ごと隠す）
  const logoSrc = APP.logo ? ASSET_BASE + APP.logo : '';
  if (logoSrc && el.appLogo.getAttribute('src') !== logoSrc) {
    el.appLogo.addEventListener('error', () => el.appLogo.parentElement.classList.add('is-hidden'), { once: true });
    el.appLogo.src = logoSrc;
  }

  const isStores = state.view === 'stores';
  const isTasks = state.view === 'tasks';
  const isReport = state.view === 'report';
  const isDay = state.view === 'day';
  const isWeek = state.view === 'week';
  const isWeekAll = state.view === 'weekall';
  const isExpense = state.view === 'expense';
  const isCatch = state.view === 'catch';
  const isSettle = state.view === 'settle';
  const isMeeting = state.view === 'meeting';
  const isShift = state.view === 'shift';
  const isCash = state.view === 'cash';
  const isTrain = state.view === 'train';

  /* お金の画面にいるあいだは body に印を付けます。
     入力画面や確認ダイアログは画面をまたいで使い回しているので、
     この印を見てボタンの色を青から緑に切り替えます */
  document.body.classList.toggle('is-money', isExpense || isCatch || isSettle || isMeeting);
  /* 会議資料は横に長い表を出すので、そのあいだだけページの幅をひろげます */
  document.body.classList.toggle('is-wide', isMeeting);

  /* ---- 業務選択画面：店舗の見出しだけ出して、業務の中身は出さない ---- */
  if (isTasks) {
    const store = getStore(state.storeId);
    document.documentElement.style.setProperty('--store', store.color);
    document.title = `${store.name}｜${APP_NAME}`;
    el.storeTabs.classList.remove('is-hidden');
    el.storeHead.classList.add('is-hidden');
    el.dayTabs.classList.add('is-hidden');
    document.body.classList.add('no-daytabs');
    el.viewStores.classList.add('is-hidden');
    el.viewDay.classList.add('is-hidden');
    el.viewWeek.classList.add('is-hidden');
    el.viewWeekAll.classList.add('is-hidden');
    el.viewMonth.classList.add('is-hidden');
    el.viewReport.classList.add('is-hidden');
    el.viewExpense.classList.add('is-hidden');
    el.viewCatch.classList.add('is-hidden');
    el.viewSettle.classList.add('is-hidden');
    el.viewMeeting.classList.add('is-hidden');
    el.viewShift.classList.add('is-hidden');
    el.viewCash.classList.add('is-hidden');
    el.viewTrain.classList.add('is-hidden');
    el.viewTasks.classList.remove('is-hidden');
    renderStoreTabs();
    renderTaskPicker();
    renderSyncStatus();
    return;
  }
  el.viewTasks.classList.add('is-hidden');

  /* ---- 店舗選択画面：店舗に属する部品はすべて隠す ---- */
  if (isStores) {
    document.documentElement.style.setProperty('--store', APP.accent || '#2b7fd4');
    document.title = APP_NAME;
    el.storeTabs.classList.add('is-hidden');
    el.storeHead.classList.add('is-hidden');
    el.dayTabs.classList.add('is-hidden');
    document.body.classList.add('no-daytabs'); // お知らせバーの位置を下げるため
    el.viewDay.classList.add('is-hidden');
    el.viewWeek.classList.add('is-hidden');
    el.viewWeekAll.classList.add('is-hidden');
    el.viewMonth.classList.add('is-hidden');
    el.viewReport.classList.add('is-hidden');
    el.viewExpense.classList.add('is-hidden');
    el.viewCatch.classList.add('is-hidden');
    el.viewSettle.classList.add('is-hidden');
    el.viewMeeting.classList.add('is-hidden');
    el.viewShift.classList.add('is-hidden');
    el.viewCash.classList.add('is-hidden');
    el.viewTrain.classList.add('is-hidden');
    el.viewStores.classList.remove('is-hidden');
    renderStorePicker();
    renderSyncStatus();
    return;
  }

  el.viewStores.classList.add('is-hidden');
  el.storeTabs.classList.toggle('is-hidden', isWeekAll || isExpense || isCatch || isSettle || isMeeting);
  // 週間掃除は週ごとに送って見る画面なので、日タブは出しません
  const noDays = isReport || isWeek || isWeekAll || isExpense || isCatch || isSettle
    || isMeeting || isShift || isTrain;
  el.dayTabs.classList.toggle('is-hidden', noDays);
  document.body.classList.toggle('no-daytabs', noDays);

  const store = getStore(state.storeId);
  document.documentElement.style.setProperty('--store', store.color);
  document.title = `${store.name}｜${APP_NAME}`;
  el.storeName.textContent = store.name;
  fillLogo(el.storeLogo, store);

  // 定休日をいつでも見えるように、店舗名の横に出しておく
  const closedDows = Closed.dows(store.id);
  el.storeClosedBadge.classList.toggle('is-hidden', closedDows.length === 0);
  if (closedDows.length) {
    el.storeClosedBadge.textContent = '毎週' + closedDows.map((n) => DOW[n]).join('・') + '曜定休';
  }

  renderStoreTabs();
  renderMonthTabs();
  renderDayTabs();

  // 全店舗の画面は店舗に属さないので、店舗見出しごと隠す
  el.storeHead.classList.toggle('is-hidden', isReport || isWeekAll || isExpense || isCatch || isSettle || isMeeting);
  // 週間掃除は2週間ずつ送るので、年・月タブは使いません
  el.storeHead.classList.toggle('is-weekview', isWeek || isShift || isTrain);
  // いま開いている業務の名前（タップで業務の一覧に戻ります）
  const task = getTask(state.view);
  if (task) el.taskBarName.textContent = task.name;

  el.viewDay.classList.toggle('is-hidden', !isDay);
  el.viewWeek.classList.toggle('is-hidden', !isWeek);
  el.viewWeekAll.classList.toggle('is-hidden', !isWeekAll);
  el.viewMonth.classList.toggle('is-hidden', state.view !== 'month');
  el.viewReport.classList.toggle('is-hidden', !isReport);
  el.viewExpense.classList.toggle('is-hidden', !isExpense);
  el.viewCatch.classList.toggle('is-hidden', !isCatch);
  el.viewSettle.classList.toggle('is-hidden', !isSettle);
  el.viewMeeting.classList.toggle('is-hidden', !isMeeting);
  el.viewShift.classList.toggle('is-hidden', !isShift);
  el.viewCash.classList.toggle('is-hidden', !isCash);
  el.viewTrain.classList.toggle('is-hidden', !isTrain);
  // ★シフトの画面だけ、横幅の上限（1100px）を外します。
  //   iPadやパソコンの広い画面で、横に並べる日数を増やすためです
  document.body.classList.toggle('is-shift-wide', isShift);

  // 精算履歴から離れたら、必ず「見るだけ」に戻します
  // （ブラウザの戻るで帰ってきたときも、開けっぱなしにしないため）
  if (!isSettle) settleUnlocked = false;

  // ★クローズの日を開いたら、その場で最新を取りに行きます。
  //   「アプリを開いたのに、さっき誰かが提出した分が出ない」を防ぎます
  if (isDay) {
    const here = `${state.storeId}/${ymd(state.y, state.m, state.d)}`;
    if (here !== lastDayPulled) {
      lastDayPulled = here;
      Sync.scheduleFlush(200);
    }
  }

  // ★今日のクローズを開いているあいだだけ、10秒おきに取りに行きます。
  //   同じ日を何人かで見るのはこの画面だけなので、ここだけ早くします
  //   （ずっと10秒おきにすると、Apps Script の1日の上限に当たります）
  const wasHot = Sync.hot;
  Sync.hot = isDay && ymd(state.y, state.m, state.d) === ymd(TODAY.y, TODAY.m, TODAY.d);
  if (Sync.hot !== wasHot && typeof Sync._loop === 'function') Sync._loop();

  if (isShift) renderShift();
  else if (isTrain) renderTrain();
  else if (isCash) renderCash();
  else if (isMeeting) renderMeeting();
  else if (isSettle) renderSettle();
  else if (isCatch) renderCatch();
  else if (isExpense) renderExpense();
  else if (isReport) renderReport();
  else if (isDay) renderDayView();
  else if (isWeek) renderWeekView();
  else if (isWeekAll) renderWeekAll();
  else renderMonthView();

  renderSyncStatus();
}

/* ============================================================
 *  セクションの折りたたみ状態（店舗ごとに記憶）
 * ============================================================ */
const FOLD_KEY = APP.storageKey + ':folded';

function foldedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FOLD_KEY) || '[]'));
  } catch (e) {
    return new Set();
  }
}
function isFolded(sectionId) {
  return foldedSet().has(`${state.storeId}:${sectionId}`);
}
function setFolded(sectionId, folded) {
  const set = foldedSet();
  const key = `${state.storeId}:${sectionId}`;
  if (folded) set.add(key);
  else set.delete(key);
  localStorage.setItem(FOLD_KEY, JSON.stringify([...set]));
}

/* ============================================================
 *  誤チェック防止の確認ダイアログ
 *  askConfirm(...).then(ok => ...) で使う
 * ============================================================ */
let confirmResolve = null;

function askConfirm({ item, message, okLabel, danger }) {
  el.confirmItem.textContent = item || '';
  el.confirmMessage.textContent = message || '';
  el.confirmOk.textContent = okLabel || 'はい';
  el.confirmOk.classList.toggle('btn--danger', !!danger);
  el.confirmDialog.classList.remove('is-hidden');
  setTimeout(() => el.confirmOk.focus(), 50);

  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
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
    // 文字は出さず、形と色だけで見せます（狭いヘッダーでも場所を取らないため）。
    // 「未送信 3件」などの詳しい説明は、設定の画面と長押しの吹き出しに出ます。
    el.syncChip.className = 'sync-chip sync-chip--' + st.kind;
    el.syncChip.innerHTML = Sync.iconSvg(st.kind);
    el.syncChip.title = st.text + '（タップで今すぐ同期）';
    el.syncChip.setAttribute('aria-label', '同期の状態：' + st.text);
  }

  // 設定画面の説明も、共有版かどうかで出し分ける
  el.syncField.classList.toggle('is-hidden', !Sync.enabled());
  if (Sync.enabled()) {
    const n = Sync.outbox().length;
    // 最終同期の時刻も出しておく。届かないときの切り分けに使えます
    const t = Sync.lastSyncAt;
    const at = t ? `（最終同期 ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}）` : '';
    el.syncInfo.textContent = Sync.lastError
      ? `${Sync.lastError}（未送信 ${n}件。つながり次第、自動で送られます）`
      : n
        ? `未送信 ${n}件。まもなく送信されます。${at}`
        : `全店舗と同期できています。${at}`;
  }
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
 *  設定モーダル
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

function openModal() {
  renderSyncStatus();
  // ヘッダーのしるしが何を表しているかの一覧（実物と同じ絵を並べます）
  el.syncLegend.innerHTML = Sync.legendHtml();
  // 版の番号。困ったときに「この番号を教えて」と聞くためのものです
  const v = Updater.current();
  el.appVersionText.innerHTML = v
    ? `いま入っているのは <b>${v}</b> です。`
    : '（手元で開いているため、版の番号はありません）';
  renderStoreUsage();
  el.modal.classList.remove('is-hidden');
  // スマホでいきなりキーボードが出ないよう、自動フォーカスはしない
}

function closeModal() {
  el.modal.classList.add('is-hidden');
}

/* ============================================================
 *  イベント登録
 * ============================================================ */
function bindEvents() {
  /* 業務の一覧へ戻る */
  $('taskBar').addEventListener('click', goTasks);
  // 業務のページから、店舗選択まで一気に戻る
  $('taskBarHome').addEventListener('click', goHome);
  $('tasksBackBtn').addEventListener('click', goHome);

  /* 年送り */
  $('prevYear').addEventListener('click', () => {
    state.y--;
    state.d = Math.min(state.d, daysInMonth(state.y, state.m));
    writeHash(); render();
  });
  $('nextYear').addEventListener('click', () => {
    state.y++;
    state.d = Math.min(state.d, daysInMonth(state.y, state.m));
    writeHash(); render();
  });
  $('todayBtn').addEventListener('click', () => {
    state.y = TODAY.y; state.m = TODAY.m; state.d = TODAY.d;
    goToDay();
    writeHash(); render();
  });

  /* その日の担当者 */
  el.staffSelect.addEventListener('change', () => {
    const dateStr = ymd(state.y, state.m, state.d);
    Store.setStaff(state.storeId, dateStr, el.staffSelect.value);
    el.staffSelect.classList.toggle('is-empty', !el.staffSelect.value);
    refreshProgress();
  });

  /* 申し送りメモ（入力が止まったら保存） */
  let noteTimer = null;
  const saveNote = () => {
    Store.setNote(state.storeId, ymd(state.y, state.m, state.d), el.note.value);
    refreshProgress();
  };
  el.note.addEventListener('input', () => {
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { noteTimer = null; saveNote(); }, 600);
  });
  el.note.addEventListener('blur', () => { clearTimeout(noteTimer); noteTimer = null; saveNote(); });

  /* 週間掃除の備考（2週間ごと。入力が止まったら保存） */
  let weekNoteTimer = null;
  const saveWeekNote = () => {
    Store.setNote(state.storeId, weekRecKey(currentPeriod()), el.weekNote.value);
    renderSyncStatus();
  };
  el.weekNote.addEventListener('input', () => {
    clearTimeout(weekNoteTimer);
    weekNoteTimer = setTimeout(() => { weekNoteTimer = null; saveWeekNote(); }, 600);
  });
  el.weekNote.addEventListener('blur', () => { clearTimeout(weekNoteTimer); weekNoteTimer = null; saveWeekNote(); });

  /* ------------------------------------------------------------
   *  アプリを閉じる・裏に回すとき
   *
   *  ★申し送りは「打ち終わって0.6秒」で保存しています。打った直後に
   *    閉じられると、その端末にすら残りません。ここで先に保存してから、
   *    ためている分をまとめて送り出します。
   *  ★打ちかけが無いときは何もしません（別の画面を見ているときに
   *    空の申し送りで上書きしてしまわないため）。
   * ---------------------------------------------------------- */
  const flushEdits = () => {
    if (noteTimer) { clearTimeout(noteTimer); noteTimer = null; saveNote(); }
    if (weekNoteTimer) { clearTimeout(weekNoteTimer); weekNoteTimer = null; saveWeekNote(); }
    if (typeof Sync !== 'undefined') Sync.flushNow();
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushEdits(); });
  window.addEventListener('pagehide', flushEdits);

  /* 週間掃除：やった人を選ぶ */
  el.doerModal.querySelectorAll('[data-doer-close]').forEach((n) =>
    n.addEventListener('click', closeDoerModal)
  );
  el.doerClear.addEventListener('click', clearDoer);

  /* 週間掃除：2週間ずつ送る */
  const shiftWeek = (dir) => {
    goToWeek(addDaysStr(currentPeriod(), dir * 14));
    writeHash();
    render();
  };
  $('weekPrev').addEventListener('click', () => shiftWeek(-1));
  $('weekNext').addEventListener('click', () => shiftWeek(1));
  $('weekToday').addEventListener('click', () => {
    state.y = TODAY.y; state.m = TODAY.m; state.d = TODAY.d;
    writeHash(); render();
  });

  /* 週間掃除：2週間分の提出（提出する人を選ぶまで押せません） */
  el.periodStaff.addEventListener('change', refreshPeriodSubmitBtn);
  el.periodSubmitBtn.addEventListener('click', submitPeriod);
  $('periodUnsubmitBtn').addEventListener('click', unsubmitPeriod);

  /* 6店舗の達成状況 */
  $('weekAllBtn').addEventListener('click', () => openAllStores('weekall'));
  $('weekAllBack').addEventListener('click', goHome);
  $('weekAllPrev').addEventListener('click', () => { goToWeek(addDaysStr(currentPeriod(), -14)); writeHash(); render(); });
  $('weekAllNext').addEventListener('click', () => { goToWeek(addDaysStr(currentPeriod(), 14)); writeHash(); render(); });
  /* 年の送り。その年の1つ目の期に移ります */
  $('weekAllYearPrev').addEventListener('click', () => shiftWeekAllYear(-1));
  $('weekAllYearNext').addEventListener('click', () => shiftWeekAllYear(1));
  $('weekAllToday').addEventListener('click', () => {
    state.y = TODAY.y; state.m = TODAY.m; state.d = TODAY.d;
    writeHash(); render();
  });
  $('storesWeekAllBtn').addEventListener('click', () => openAllStores('weekall'));

  /* 確認ダイアログ */
  el.confirmOk.addEventListener('click', () => closeConfirm(true));
  el.confirmDialog.querySelectorAll('[data-confirm-cancel]').forEach((n) =>
    n.addEventListener('click', () => closeConfirm(false))
  );

  /* 提出 */
  /* アルバイトの教育 */
  el.trainAdd.addEventListener('click', addTrainee);
  el.trainNewName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !imeEnter(e)) addTrainee();
  });
  el.trainBack.addEventListener('click', () => { trainPerson = ''; render(); });
  el.trainRemove.addEventListener('click', removeTrainee);
  el.trainDoneHead.addEventListener('click', () => { trainDoneOpen = !trainDoneOpen; render(); });

  /* 現金売上 */
  el.cashFile.addEventListener('change', onCashFile);
  el.cashToNippou.addEventListener('click', writeNippou);
  el.cashShot.addEventListener('click', openShot);
  el.cashSave.addEventListener('click', saveCash);
  el.cashTabDay.addEventListener('click', () => setCashTab('day'));
  el.cashTabWeek.addEventListener('click', () => setCashTab('week'));
  el.cashWeekPrev.addEventListener('click', () => moveCashWeek(-1));
  el.cashWeekNext.addEventListener('click', () => moveCashWeek(1));
  el.cashWeekThis.addEventListener('click', () => moveCashWeek(0));
  el.cashRedo.addEventListener('click', redoCash);
  bindHalfWidthInput(el.cashSales, 'number');
  el.shotModal.querySelectorAll('[data-shot-close]').forEach((n) =>
    n.addEventListener('click', () => el.shotModal.classList.add('is-hidden')));
  el.cashOcrLink.addEventListener('click', openOcrText);
  el.ocrCopy.addEventListener('click', copyOcrText);
  el.ocrModal.querySelectorAll('[data-ocr-close]').forEach((n) =>
    n.addEventListener('click', () => el.ocrModal.classList.add('is-hidden')));

  el.submitBtn.addEventListener('click', submitDay);
  el.unsubmitBtn.addEventListener('click', unsubmitDay);

  /* 全店舗提出記録（店舗に属さない画面なので、戻り先は店舗選択） */
  const openAllStores = (view) => {
    state.storeId = '';
    state.view = view;
    writeHash(); render(); window.scrollTo(0, 0);
  };
  $('reportBtn').addEventListener('click', () => openAllStores('report'));
  $('reportBack').addEventListener('click', goHome);
  $('homeBtn').addEventListener('click', goHome);
  $('storesReportBtn').addEventListener('click', () => openAllStores('report'));

  /* 立替金 */
  $('storesExpenseBtn').addEventListener('click', () => openAllStores('expense'));
  $('expenseBack').addEventListener('click', goHome);
  $('expenseAddBtn').addEventListener('click', () => openExpenseForm());
  /* -------- シフト -------- */
  el.shiftPrev.addEventListener('click', () => shiftGoStep(-1));
  el.shiftNext.addEventListener('click', () => shiftGoStep(1));
  el.shiftToday.addEventListener('click', shiftGoToday);
  el.shiftWishBtn.addEventListener('click', openShiftWishes);
  el.shiftTakeBtn.addEventListener('click', onShiftTake);
  el.shiftOpenBtn.addEventListener('click', openShiftRecruit);
  el.shiftOpenGo.addEventListener('click', startShiftRecruit);
  document.querySelectorAll('[data-shift-open-close]')
    .forEach((b) => b.addEventListener('click', () => el.shiftOpenModal.classList.add('is-hidden')));
  el.shiftBuildBtn.addEventListener('click', buildShiftDone);
  el.shiftSheetBtn.addEventListener('click', openShiftSheet);
  el.shiftPdfBtn.addEventListener('click', saveShiftPdf);
  el.shiftJpegBtn.addEventListener('click', saveShiftImage);
  el.shiftPickRemove.addEventListener('click', removeShiftPick);
  el.shiftPickFreeGo.addEventListener('click', applyShiftFreeTime);
  el.shiftPickFree.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !imeEnter(e)) applyShiftFreeTime(); });
  bindHalfWidthInput(el.shiftPickFree, 'code');
  el.shiftPickEarlyOn.addEventListener('click', () => setShiftEarly(true));
  el.shiftPickEarlyOff.addEventListener('click', () => setShiftEarly(false));
  el.shiftPickFullOn.addEventListener('click', () => setShiftFull(true));
  el.shiftPickFullOff.addEventListener('click', () => setShiftFull(false));
  el.shiftPickShortGo.addEventListener('click', applyShiftShort);
  el.shiftPickShort.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !imeEnter(e)) applyShiftShort(); });
  bindHalfWidthInput(el.shiftPickShort, 'code');
  el.shiftPrintBtn.addEventListener('click', printShiftSheet);
  el.shiftPastBtn.addEventListener('click', openShiftPast);
  // ★画面の幅が変わったら、並べる日数を決め直します。
  //   iPadを横にしたときや、窓の大きさを変えたときのためです。
  //   日数が変わったときだけ組み直します（毎回だと入力中に消えます）
  let lastCols = 0;
  window.addEventListener('resize', () => {
    if (!el.viewShift || el.viewShift.classList.contains('is-hidden')) return;
    const now = shiftCols(el.shiftDays.clientWidth || window.innerWidth);
    if (now === lastCols) return;
    lastCols = now;
    render();
  });
  document.querySelectorAll('[data-shift-past-close]')
    .forEach((b) => b.addEventListener('click', closeShiftPast));
  document.querySelectorAll('[data-shift-pick-close]')
    .forEach((b) => b.addEventListener('click', closeShiftPick));
  document.querySelectorAll('[data-shift-wish-close]')
    .forEach((b) => b.addEventListener('click', () => el.shiftWishModal.classList.add('is-hidden')));
  document.querySelectorAll('[data-shift-sheet-close]')
    .forEach((b) => b.addEventListener('click', closeShiftSheet));

  el.expenseSave.addEventListener('click', saveExpense);
  // 全角の数字で入れても半角に直します（日本語キーボードのままでも入力できる）
  bindNumericInput(el.expYen);
  bindNumericInput(el.expPeople);
  el.expenseModal.querySelectorAll('[data-close-expense]').forEach((n) =>
    n.addEventListener('click', () => el.expenseModal.classList.add('is-hidden'))
  );
  el.expReceiptSeg.addEventListener('click', (e) => {
    const b = e.target.closest('.seg__btn');
    if (!b) return;
    expReceipt = b.dataset.receipt === '1';
    renderReceiptSeg();
  });
  /* キャッチ集計 */
  $('storesCatchBtn').addEventListener('click', () => openAllStores('catch'));
  $('catchBack').addEventListener('click', goHome);
  $('catchPrev').addEventListener('click', () => shiftMonth(-1));
  $('catchNext').addEventListener('click', () => shiftMonth(1));
  /* ランキングの範囲を切り替える */
  $('rankRange').addEventListener('click', (e) => {
    const b = e.target.closest('.seg__btn');
    if (!b) return;
    rankRange = b.dataset.range;
    [...$('rankRange').children].forEach((n) => n.classList.toggle('is-on', n === b));
    renderCatchRank();
  });
  /* 渡した相手で「その他」を選んだら、名前を書く欄を出す */
  el.expWho.addEventListener('change', renderExpenseForm);
  /* 日付を動かすと「渡した相手」の要る・要らないが変わります（9月分から） */
  el.expDate.addEventListener('change', renderExpenseForm);
  el.expDate.addEventListener('input', renderExpenseForm);
  /* まとめた行を開いた「キャッチの明細」 */
  el.catchDetailModal.querySelectorAll('[data-close-catch-detail]').forEach((n) =>
    n.addEventListener('click', closeCatchDetail)
  );
  $('catchThisMonth').addEventListener('click', () => {
    state.y = TODAY.y; state.m = TODAY.m;
    writeHash(); render();
  });

  $('expensePrev').addEventListener('click', () => shiftMonth(-1));
  $('expenseNext').addEventListener('click', () => shiftMonth(1));
  $('expenseThisMonth').addEventListener('click', () => {
    state.y = TODAY.y; state.m = TODAY.m;
    writeHash(); render();
  });

  /* 会議資料。ひらいたときは、入っている月のうち 一番新しい月を出します */
  $('storesMeetingBtn').addEventListener('click', () => {
    const last = latestMeetingMonth();
    if (last) { state.y = last.y; state.m = last.m; }
    openAllStores('meeting');
  });
  $('meetingLastGo').addEventListener('click', () => {
    const to = el.meetingLastGoTo;
    if (!to) return;
    flushMeetingNotes();
    state.y = to.y; state.m = to.m;
    writeHash(); render();
  });
  $('meetingBack').addEventListener('click', () => { flushMeetingNotes(); goHome(); });
  $('meetingPrev').addEventListener('click', () => { flushMeetingNotes(); shiftMonth(-1); });
  $('meetingNext').addEventListener('click', () => { flushMeetingNotes(); shiftMonth(1); });
  $('meetingThisMonth').addEventListener('click', () => {
    flushMeetingNotes();
    state.y = TODAY.y; state.m = TODAY.m;
    writeHash(); render();
  });
  // アプリを閉じたり、ほかのアプリに移ったときも取りこぼしません
  window.addEventListener('pagehide', flushMeetingNotes);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushMeetingNotes();
  });
  /* iPadを回したときなど、幅が変わったら案内を出し直します。
     どちらか片方だけだと取りこぼす端末があったので、両方かけています
     （同じことを2回やっても害はありません） */
  const watchWidth = () => { if (state.view === 'meeting') updateMeetingScrollHint(); };
  window.addEventListener('resize', watchWidth);
  window.addEventListener('orientationchange', () => setTimeout(watchWidth, 200));
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(watchWidth).observe(el.meetingTableWrap);
  }
  /* 率と金額の切り替え */
  el.meetingModeSeg.addEventListener('click', (e) => {
    const b = e.target.closest('.seg__btn');
    if (!b) return;
    meetingMode = b.dataset.mode;
    [...el.meetingModeSeg.children].forEach((n) => n.classList.toggle('is-on', n === b));
    renderMeeting();
  });

  /* 日報からの取り込み */
  el.nippouPull.addEventListener('click', pullNippou);

  /* 光熱費の手入力 */
  el.utilEdit.addEventListener('click', openUtilForm);
  el.utilSave.addEventListener('click', saveUtilForm);
  el.utilYear.addEventListener('click', (e) => {
    const b = e.target.closest('.seg__btn');
    if (!b) return;
    utilSide = b.dataset.side;
    [...el.utilYear.children].forEach((n) => n.classList.toggle('is-on', n === b));
    fillUtilForm();
  });
  el.utilModal.querySelectorAll('[data-close-util]').forEach((n) => {
    n.addEventListener('click', () => el.utilModal.classList.add('is-hidden'));
  });

  /* 精算履歴。ひらくたびに「見るだけ」に戻します
     （SETTLE_PAGE_ON が false のあいだは、入口ごと出しません） */
  $('expenseSettleBtn').classList.toggle('is-hidden', !SETTLE_PAGE_ON);
  $('expenseSettleBtn').addEventListener('click', () => {
    settleUnlocked = false;
    openAllStores('settle');
  });
  $('settleBack').addEventListener('click', () => {
    settleUnlocked = false;
    openAllStores('expense');
  });
  el.settleLockBtn.addEventListener('click', () => {
    settleUnlocked = !settleUnlocked;
    renderSettle();
  });
  $('settlePrev').addEventListener('click', () => { state.y -= 1; writeHash(); render(); });
  $('settleNext').addEventListener('click', () => { state.y += 1; writeHash(); render(); });
  $('settleThisYear').addEventListener('click', () => {
    state.y = TODAY.y;
    writeHash(); render();
  });
  el.settleSave.addEventListener('click', saveSettle);
  el.settleClear.addEventListener('click', clearSettle);
  el.settleAccount.addEventListener('input', markSettleChips);
  el.settleModal.querySelectorAll('[data-close-settle]').forEach((n) =>
    n.addEventListener('click', () => el.settleModal.classList.add('is-hidden'))
  );
  $('reportPrev').addEventListener('click', () => shiftDay(-1));
  $('reportNext').addEventListener('click', () => shiftDay(1));
  /* カレンダーの月送り。日は、その月に入る範囲へ寄せます */
  $('reportMonthPrev').addEventListener('click', () => shiftReportMonth(-1));
  $('reportMonthNext').addEventListener('click', () => shiftReportMonth(1));
  /* ミスの記録（クローズと週間掃除で、同じ入力画面を使います） */
  bindMissRange('close', 'missRange');
  bindMissRange('week', 'wmissRange');
  el.missWho.addEventListener('change', renderMissWhoField);
  $('missAdd').addEventListener('click', () => openMissForm('close'));
  $('wmissAdd').addEventListener('click', () => openMissForm('week'));
  el.missSave.addEventListener('click', saveMiss);
  $('missDelete').addEventListener('click', removeMiss);
  el.missModal.querySelectorAll('[data-close-miss]').forEach((n) =>
    n.addEventListener('click', () => el.missModal.classList.add('is-hidden'))
  );
  $('reportToday').addEventListener('click', () => {
    state.y = TODAY.y; state.m = TODAY.m; state.d = TODAY.d;
    writeHash(); render();
  });

  /* この日だけ営業／休業 */
  el.closedToggle.addEventListener('click', toggleDayClosed);
  el.overrideReset.addEventListener('click', () => {
    Closed.setException(state.storeId, ymd(state.y, state.m, state.d), null);
    render();
  });

  /* 共有同期 */
  el.syncChip.addEventListener('click', () => Sync.flush());
  $('syncNow').addEventListener('click', () => Sync.flush());
  $('pinChange').addEventListener('click', () => { closeModal(); openPinModal(); });
  $('pinOk').addEventListener('click', submitPin);
  el.pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !imeEnter(e)) submitPin(); });
  bindHalfWidthInput(el.pinInput, 'code');
  // 貼り付けた内容が正しいか目で確かめられるようにする
  $('pinReveal').addEventListener('click', () => {
    const show = el.pinInput.type === 'password';
    el.pinInput.type = show ? 'text' : 'password';
    $('pinReveal').textContent = show ? '隠す' : '表示';
  });

  /* 設定（この端末の設定のみ。項目・担当者・定休日は管理アプリで） */
  el.settingsBtn.addEventListener('click', () => openModal());

  // 「今すぐ最新にする」…控えを捨てて読み直します
  el.forceUpdate.addEventListener('click', () => {
    el.forceUpdate.disabled = true;
    el.forceUpdate.textContent = '読み直しています…';
    Updater.force();
  });
  el.modal.querySelectorAll('[data-close]').forEach((n) => n.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!el.confirmDialog.classList.contains('is-hidden')) closeConfirm(false);
    else if (!el.doerModal.classList.contains('is-hidden')) closeDoerModal();
    else if (!el.catchDetailModal.classList.contains('is-hidden')) closeCatchDetail();
    else closeModal();
  });

  /* 戻る／進むボタン、直接URL入力 */
  window.addEventListener('hashchange', () => {
    readHash();
    writeHash(true); // 月間表オフのときなど、読み替えた結果をURLにも反映する
    render();
  });
}

/* ============================================================
 *  起動
 * ============================================================ */
async function init() {
  readHash();
  writeHash(true);
  bindEvents();

  // ★一番先に保存先を用意します。
  //   ここで待たないと、まだ読み込めていない状態で画面を描いてしまい、
  //   「記録が消えた」ように見えてしまいます。
  //   失敗しても、いままでの場所でそのまま動きます（storage.js の boot）
  Store.onError = showStoreError;
  await Store.boot();
  window.addEventListener('pagehide', () => Store.flushNow());

  // ★途中で終わった作業を、続きからやり直します。
  //   画面に戻ってきたときにも見ます（アプリを裏に回すと通信が切られるため）
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) cashResume();
  });
  window.addEventListener('pageshow', () => cashResume());

  render();

  // 新しい版が公開されたら画面下で知らせる（PINの有無に関係なく動かす）
  Updater.start();

  // 共有版のとき：PIN未入力なら先に聞く。入力済みならすぐ同期を始める
  if (Sync.enabled()) {
    Sync.onChange = () => { renderSyncStatus(); renderSyncWarn(); };
    if (!Sync.pin()) openPinModal();
    else { Sync.start(); cashResume(); }
    return;
  }

  // 担当者が1人も登録されていなければ、最初に設定を開く
  if (Staff.list().length === 0) openModal();
}

/* ------------------------------------------------------------
 *  端末に保存できなかったときの知らせ
 *
 *  一番こわいのは「チェックしたのに保存されていない」を
 *  誰も気づかないまま閉じてしまうことなので、必ず画面に出します。
 * ---------------------------------------------------------- */
function showStoreError(message) {
  let box = document.getElementById('storeError');
  if (!box) {
    box = document.createElement('div');
    box.id = 'storeError';
    box.className = 'store-error';
    document.body.appendChild(box);
  }
  box.textContent = `⚠ ${message}`;
  box.classList.remove('is-hidden');
}

init();
