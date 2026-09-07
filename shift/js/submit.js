/* ============================================================
 *  シフト提出ページ
 *
 *  アルバイトが半月分の希望を出すためだけの画面です。
 *  URLをLINEで配って開いてもらいます（アプリの導入もログインも要りません）。
 *
 *  番号について
 *    入口は「1人に1つの番号」です。現場用PINでも管理用PINでもありません。
 *    番号で誰なのかが決まるので、**ほかの人の名前では出せません**。
 *    名前の一覧も出しません（誰が働いているかを見せないため）。
 *    番号でできるのは、自分の希望を出すことと、出した内容を見ることだけです。
 *
 *  出す期間について
 *    **どの半月を出すかは、こちらでは決めません。**
 *    お店が「シフト募集をはじめる」を押した半月だけが、サーバーから返ってきます。
 *    募集していない先の月は出ませんし、確定したあとは出せなくなります。
 *
 *  枠と時刻の決まりは、アプリ本体と同じ config.js から読んでいます。
 *  ★時刻はマネージの「シフトの枠と時刻」で店舗ごとに直せます。
 *    初めの形は js/config.js の SHIFT_SLOTS_DEFAULT です。そこを直せば、
 *    この画面にも組む画面にも同時に反映されます。
 * ============================================================ */

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const SAVE = 't3d-shift-submit';

const el = (id) => document.getElementById(id);

/**
 * この端末の持ち主
 *
 * 覚えておくのは番号だけです。名前と店舗は、番号からサーバーが決めます。
 * （こちらで名前を持っていても、送るときには使いません。
 *   なりすましの余地をなくすため、サーバーは番号だけを見ます）
 */
/**
 * 社員が「アルバイトの画面を見る」から開いたときの番号
 *
 * ★`…/shift/?見本=xxxxxx` の形で来ます（xxxxxx が見本の番号）。**その場かぎり**で、
 *   端末には覚えません（社員の端末に見本の番号が残ると、
 *   次にその人が自分の番号で開けなくなります）。
 */
const 見本の番号 = (() => {
  try {
    const v = new URL(location.href).searchParams.get('見本');
    return v ? String(v).trim() : '';
  } catch (e) {
    return '';
  }
})();

const me = {
  code: 見本の番号 || localStorage.getItem(`${SAVE}:code`) || '',
  name: '',
  store: '',
  // その人が入っている店舗を全部（2つ以上なら切り替えられます）
  stores: [],
  // 見本（テスト用）で入っているか
  demo: false,
};

/**
 * 見本のとき、どちらの画面を見ているか
 *
 * ★見本は「募集の状態にかかわらず、入力も確定後も見られる」ようにします。
 *   社員が操作感を確かめるためのものなので、お店の都合で見えたり
 *   見えなかったりしては用をなしません。
 */
let demoView = 'entry';   // 'entry'（希望を入れる）／'built'（確定後）

/** サーバーが決めた、いま出す半月。null なら募集していません */
let period = null;
/** 'open'（募集中）／'built'（確定ずみ）／'' */
let phase = '';
/** 提出の期限（'YYYY-MM-DD'。決まっていなければ空） */
let due = '';
/** いま入れている希望。{ 'YYYY-MM-DD': [{ s, t }] } */
let picked = {};
/** 日ごとの連絡。{ 'YYYY-MM-DD': '文' } */
let notes = {};
/** 提出済みかどうか */
let sentAt = null;
/** 店舗の定休日（サーバーから取ります） */
let closed = { dows: [], ex: {} };
/** 確定したシフト。確定するまでは null（途中は見せません） */
let built = null;

/* -------- 店舗の切り替えを速くするための控え --------
 *
 *  サーバーに聞き直すのに**2秒ほど**かかります（実測 1.9〜2.3秒）。
 *  押してから2秒なにも変わらないと「押せていない」と思われるので、
 *    ① 押したことは待たずに画面へ出す
 *    ② ほかの店舗の分は、入ったあとに**裏で先に取っておく**
 *  の2つでしのぎます。
 *
 *  ★控えを使うのは「まだ何も選んでいないとき」だけです。
 *    選びかけの希望を、あとから届いた返事で消さないためです。
 */
const 店舗の控え = {};
/** 押した回数。古い返事を捨てるための番号です（速く2回押されたとき用） */
let 店舗の切替 = 0;

/* ============================================================
 *  サーバーとのやりとり
 * ============================================================ */
async function call(body) {
  if (!APP.syncUrl) return { ok: false, error: '接続先が設定されていません' };
  try {
    const res = await fetch(APP.syncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      // ★見ている店舗も送ります。2店舗以上に入っている人だけ効きます
      //   （サーバーは、その人が入っている店舗しか見ません）
      body: JSON.stringify({ code: me.code, action: 'shift', store: me.store, ...body }),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: '電波が届いていないようです。もう一度お試しください' };
  }
}

/** きょうから期限まで、あと何日か（すぎていたら負の数） */
function daysLeft(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = businessDate();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((new Date(y, m - 1, d) - today) / 86400000);
}

function isClosedOn(dateStr) {
  const ex = closed.ex[dateStr];
  if (ex === 'closed') return true;
  if (ex === 'open') return false;
  const dow = new Date(dateStr.replace(/-/g, '/')).getDay();
  return closed.dows.includes(dow);
}

/* ============================================================
 *  画面
 * ============================================================ */
function show(which) {
  ['boot', 'gate', 'form'].forEach((id) => el(id).classList.toggle('is-hidden', id !== which));
}

function setErr(id, msg) {
  el(id).textContent = msg || '';
  el(id).classList.toggle('is-hidden', !msg);
}

/* -------- 1. 自分の番号 -------- */
async function submitPin() {
  const code = el('gatePin').value.trim();
  if (!code) return setErr('gateErr', '番号を入れてください');

  el('gateGo').disabled = true;
  setErr('gateErr', '');
  me.code = code;
  const res = await call({ mode: 'open' });
  el('gateGo').disabled = false;

  if (!res.ok) {
    me.code = '';
    return setErr('gateErr', res.error || 'この番号は使えません');
  }
  localStorage.setItem(`${SAVE}:code`, code);
  applyOpen(res);
}

/** 番号から分かったこと（名前・店舗・期間・定休日・提出済みの内容）を受け取る */
function applyOpen(res) {
  me.name = res.name || '';
  me.store = res.store || '';
  me.stores = Array.isArray(res.stores) && res.stores.length ? res.stores : [me.store];
  me.demo = !!res.demo;
  // ★枠（立ち上げ・ランチ…）は店舗ごとに違い、マネージで直せます。
  //   このページは Store を持たないので、Apps Script が渡してくれたものを控えます。
  //   渡ってこなければ config.js の初めの形で動きます
  setShiftSlots(me.store, res.slots);
  // ★タブの名前を、その人のお店にします。このページは全店舗で同じURLなので、
  //   HTMLに店舗名を書いておけません（前は「バグる」と書いてありました）
  const mine = getStore(me.store);
  if (mine && mine.name) document.title = `${mine.name} シフト提出`;
  period = res.period || null;
  phase = res.phase || '';
  due = res.due || '';

  // 定休日はマネージで変えられます。変えていない店舗は null で返ってくるので、
  // そのときは config.js に書いてある初期値（バグるなら火曜）を使います。
  // ★毎回サーバーに聞きに行くので、マネージで直せばここもすぐ変わります
  const store = getStore(me.store);
  closed = {
    dows: Array.isArray(res.closedDows) ? res.closedDows : ((store && store.closedDays) || []),
    ex: res.closedEx && typeof res.closedEx === 'object' ? res.closedEx : {},
  };

  built = res.built && typeof res.built === 'object' ? res.built : null;

  const wish = res.wish || null;
  picked = wish && wish.days && typeof wish.days === 'object' ? wish.days : {};
  notes = wish && wish.notes && typeof wish.notes === 'object' ? wish.notes : {};
  sentAt = wish ? (wish.sentAt || null) : null;

  el('headTitle').textContent = `シフト提出｜${store ? store.name : ''}`;
  el('meName').textContent = me.name;
  // ★見本（テスト用）の番号で入ったときだけ、ホームに戻るボタンを出します。
  //   アルバイトの番号では出しません（オーナーの画面へ行けてしまうため）
  el('toOwnerBtn').classList.toggle('is-hidden', !isShiftTester(me.name));
  // 出し方のボタンは、番号が通ってから出します
  // （番号を入れる画面で出しても、まだ読むところがありません）
  el('helpBtn').classList.remove('is-hidden');
  show('form');
  renderPeriod();
  // ★2店舗以上の人は、ほかの店舗の分を裏で取っておきます（1回だけ）。
  //   切り替えたときの2秒の待ちが、これで無くなります
  先に取っておく();
}

/** 番号を入れ直す（端末を人に渡すときなど） */
function signOut() {
  localStorage.removeItem(`${SAVE}:code`);
  me.code = '';
  me.name = '';
  el('gatePin').value = '';
  show('gate');
}

/**
 * 切り替えのボタンを置く場所
 *
 * ★index.html には足さず、ここで作って差し込みます。
 *   出るのは「2店舗以上に入っている人」と「見本」だけなので、
 *   ふだんの画面には何も増えません。
 */
function switchBox(id, before) {
  let box = document.getElementById(id);
  if (box) return box;
  box = document.createElement('div');
  box.id = id;
  box.className = 'day__slots';
  box.style.cssText = 'margin:10px 0;';
  const at = el('periodMain').parentNode;
  at.parentNode.insertBefore(box, before ? at : at.nextSibling);
  return box;
}

/**
 * 店舗の切り替え（2店舗以上に入っている人だけ）
 *
 * ★同じ番号で、入っている店舗を行き来できます。
 *   押すとサーバーに聞き直して、その店舗の募集と枠に入れかわります。
 */
function renderStoreSwitch() {
  const box = switchBox('storeSwitch', true);
  const 出す = me.stores.length > 1;
  box.classList.toggle('is-hidden', !出す);
  if (!出す) return;
  box.innerHTML = '';
  me.stores.forEach((id) => {
    const store = getStore(id);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot' + (id === me.store ? ' is-on' : '');
    b.textContent = (store && store.name) || id;
    b.addEventListener('click', async () => {
      if (id === me.store) return;
      const 番 = (店舗の切替 += 1);
      me.store = id;
      // 選びかけの希望は持ち越しません（店舗ごとに別のシフトなので）
      picked = {};
      notes = {};
      built = null;

      const 控え = 店舗の控え[id];
      let 出したまま = null;
      if (控え) {
        // 裏で取ってあったので、待たずに出せます
        applyOpen(控え);
        // ★控えを出した直後の姿を控えます。あとで「人が触ったか」を見分けるためです
        //   （picked が空かどうかでは見分けられません。控えを当てた時点で入るので）
        出したまま = JSON.stringify([picked, notes]);
      } else {
        // ★押したことを、返事を待たずに画面へ出します。
        //   ここが無いと、2秒のあいだ何も変わらず、何度も押されます
        renderStoreSwitch();
        待ちを出す(true);
      }

      const res = await call({ mode: 'open' });
      // ★もっと新しい押しがあれば、古い返事は捨てます
      //   （速く2回押すと、返事の順番が入れかわることがあります）
      if (番 !== 店舗の切替) return;
      待ちを出す(false);
      if (!res.ok) { setErr('gateErr', res.error || 'つながりませんでした'); return; }
      店舗の控え[id] = res;
      // ★控えを出したあとに届いた返事は、**人が触っていないときだけ**当てます。
      //   触っていたら当てません。選びかけの希望が消えてしまうためです
      const 触っていない = 出したまま === null
        || JSON.stringify([picked, notes]) === 出したまま;
      if (触っていない) applyOpen(res);
      先に取っておく();
    });
    box.appendChild(b);
  });
}

/**
 * 待っていることを見せる／消す
 *
 * ★2秒のあいだ、押したボタンは光ったまま、下に小さくぐるぐるを出します。
 *   そのあいだは押せません（二重に押すと返事の順番が入れかわるため）。
 */
function 待ちを出す(いま) {
  const box = document.getElementById('storeSwitch');
  if (box) box.classList.toggle('is-waiting', !!いま);
  let 帯 = document.getElementById('storeWait');
  if (!帯) {
    if (!いま || !box) return;
    帯 = document.createElement('p');
    帯.id = 'storeWait';
    帯.className = 'switch-wait';
    const spin = document.createElement('span');
    spin.className = 'switch-wait__spin';
    const 字 = document.createElement('span');
    字.textContent = 'お店を切り替えています…';
    帯.append(spin, 字);
    box.parentNode.insertBefore(帯, box.nextSibling);
    return;
  }
  帯.classList.toggle('is-hidden', !いま);
}

/**
 * ほかの店舗の分を、裏で先に取っておきます
 *
 * ★2店舗以上に入っている人だけです。取っておけば、切り替えが**待ち時間なし**になります。
 *
 * ★**まとめて投げます。**1つずつ順に取ると、6店舗で12秒かかりました。
 *   まとめて投げれば2.4秒です（実測。2026-09-07）。
 *   Apps Script を呼ぶこと自体に2秒かかり、**中身の処理はほとんど時間を使っていません**
 *   （何も返さないGETでも2秒でした）。だから「軽くする」ではなく
 *   「**呼ぶ回数を減らす／重ねる**」しか効きません。
 * ★読むだけ（mode:'open'）なので、重ねても取り合いになりません。
 *   書き込み（提出）はここを通りません。
 * ★失敗しても何も言いません。**本番の切り替えのときに、もう一度ちゃんと取ります。**
 */
let 先に取った = false;
function 先に取っておく() {
  if (先に取った || me.stores.length < 2) return;
  先に取った = true;
  const いま = me.store;
  me.stores.forEach((id) => {
    if (id === いま || 店舗の控え[id]) return;
    call({ mode: 'open', store: id }).then((res) => {
      if (res && res.ok && res.store === id) 店舗の控え[id] = res;
    });
  });
}

/**
 * 見本のときの「希望を入れる／確定後」の切り替え
 *
 * ★見本で入った人は、お店が募集していてもいなくても、
 *   どちらの画面も見られます。操作感を確かめるためのものだからです。
 */
function renderDemoSwitch() {
  const box = switchBox('demoSwitch', false);
  box.classList.toggle('is-hidden', !me.demo);
  if (!me.demo) return;
  box.innerHTML = '';
  const cap = document.createElement('span');
  cap.textContent = '見本';
  cap.style.cssText = 'align-self:center;font-size:12px;color:var(--text-sub);margin-right:4px;';
  box.appendChild(cap);
  [
    { id: 'entry', name: '希望を入れる' },
    { id: 'built', name: '確定後' },
  ].forEach((v) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot' + (demoView === v.id ? ' is-on' : '');
    b.textContent = v.name;
    b.addEventListener('click', () => {
      demoView = v.id;
      // 確定後の見本が無ければ、その場で作ります（お店がまだ組んでいないとき）
      if (v.id === 'built' && !(built && Object.keys(built).length)) built = demoBuilt();
      renderPeriod();
    });
    box.appendChild(b);
  });
}

/**
 * 確定後の画面を見せるための、見本のシフト
 *
 * ★お店がまだ組んでいなくても「確定後に何が見えるか」を確かめられるように、
 *   その場で作ります。**送りも保存もしません。**画面に出すだけです。
 */
function demoBuilt() {
  const out = {};
  const slots = shiftSlotsOf(me.store);
  const 時刻で入れる = shiftUsesRange(me.store);
  shiftDays(period.y, period.m, period.half).forEach((d, i) => {
    if (isClosedOn(d)) return;
    const day = { open: [], lunch: [], dinner: [], memo: i === 0 ? '見本です' : '', patty: '', short: {} };
    slots.forEach((slot, si) => {
      // 自分を1日おきに入れて、「自分が入っている日」も見えるようにします
      const 入る = (i + si) % 2 === 0;
      const t = 時刻で入れる ? ['10', '11', '17'][si % 3] : (slot.pick || slot.times[0] || '');
      const one = { n: 入る ? me.name : '見本 花子', t, p: si % 2 ? 'h' : 'k' };
      if (時刻で入れる) one.e = ['15', '22', '22'][si % 3];
      day[slot.id].push(one);
    });
    out[d] = day;
  });
  return out;
}

/* -------- 2. 希望を入れる -------- */
function renderPeriod() {
  renderStoreSwitch();
  renderDemoSwitch();

  // ★見本は、押した方の画面だけを出します（募集の状態は見ません）
  const canSend = me.demo
    ? demoView === 'entry'
    : (!!period && phase === 'open');
  const hasBuilt = me.demo
    ? demoView === 'built'
    : !!(built && Object.keys(built).length);
  el('entry').classList.toggle('is-hidden', !canSend);
  el('closedBox').classList.toggle('is-hidden', canSend || hasBuilt);
  el('builtBox').classList.toggle('is-hidden', !hasBuilt);
  // 確定したシフトが出ているときは、出した控えは畳みます（同じ話が二度出るため）
  el('doneBox').classList.toggle('is-hidden', !sentAt || hasBuilt);

  if (!period) {
    el('periodMain').textContent = '—';
    el('periodSub').textContent = '';
    el('periodState').textContent = '';
    el('closedNote').textContent = '次のシフトの募集がはじまると、ここに出ます。しばらくお待ちください。';
    return;
  }

  el('periodMain').textContent = shiftRangeLabel(period.y, period.m, period.half);
  el('periodSub').textContent = `${period.y}年${period.m}月 ${period.half === 1 ? '前半' : '後半'}`;

  // 提出の期限。募集しているあいだだけ出します
  const showDue = canSend && due;
  el('periodDue').classList.toggle('is-hidden', !showDue);
  if (showDue) {
    const left = daysLeft(due);
    el('periodDue').textContent = `提出は ${shiftDueLabel(due, DOW)}`
      + (left === 0 ? '（きょうまでです）' : left > 0 ? `（あと${left}日）` : '（期限をすぎています）');
    el('periodDue').className = 'period__due' + (left <= 1 ? ' is-near' : '');
  }

  // ★定休日になった日の希望は落とします。マネージで定休日を足したあとに
  //   出し直されると、休みの日に入る希望が残ってしまうためです
  Object.keys(picked).forEach((s) => { if (isClosedOn(s)) delete picked[s]; });

  const days = shiftDays(period.y, period.m, period.half).filter((s) => !isClosedOn(s));
  const on = days.filter((s) => (picked[s] || []).length).length;

  if (!canSend) {
    el('periodState').textContent = hasBuilt ? 'シフトが決まりました'
      : sentAt ? '受け付けは終わりました' : '';
    el('closedNote').textContent = sentAt
      ? 'この期間の受け付けは終わりました。出した内容は下のとおりです。'
      : '次のシフトの募集がはじまると、ここに出ます。しばらくお待ちください。';
    renderDone();
    renderBuilt();
    return;
  }

  el('periodState').className = 'period__state' + (sentAt ? ' is-sent' : '');
  el('periodState').textContent = sentAt
    ? `提出済み（${on}日）。直したら、もう一度出してください`
    : `${days.length}日のうち ${on}日 選んでいます`;

  // ★時刻を入れる店舗（popo）は、枠を選ばないので枠の説明を出しません。
  //   ランチタイムの時間帯も**出しません**（お店の中の決めごとなので）
  el('slotHint').innerHTML = shiftUsesRange(me.store)
    ? '入る日の<b>出勤</b>と<b>退勤</b>を選んでください。'
      + '出勤を「—」のままにした日は「入れない日」です。'
      + '<br>連絡は日ごとに書けます。'
      + '例：<b>20時まで出れます</b>／<b>人がいれば削ってください</b>'
    : shiftWishSlots(me.store)
    .map((s) => {
      // ★時刻を選べない枠は、ふだんの時刻をここに出します。
      //   説明文の中に書き写しておくと、マネージで時刻だけ直したときに
      //   説明が古いまま残って、うそになります。
      //   F（通し）は出しません。始まりの時刻はお店が決めるからです
      const when = s.id !== SHIFT_FULL_ID && s.askTime === false && s.pick
        ? `（${shiftTimeText(s.pick)}）` : '';
      return `<b>${s.name}</b>${when}＝${s.hint}`;
    }).join('<br>')
    + '<br>入れる日の枠を押してください。押していない日は「入れない日」です。'
    // ★連絡の例は、ここにまとめて出します。マスの中の薄い字（placeholder）に
    //   入れると、スマホの幅では後ろが切れて読めません
    + '<br>連絡は日ごとに書けます。'
    + '例：<b>20時まで出れます</b>／<b>人がいれば削ってください</b>';

  renderDays();
  renderDone();
  renderBuilt();
}

/* -------- 決まったシフトを見る --------
 *
 *  お店が「シフトを確定する」を押すまでは出ません。
 *  組んでいる途中のものを見せると、変わるたびに混乱するためです。
 */
function renderBuilt() {
  if (!built || !period) return;
  el('builtTitle').textContent =
    `${shiftRangeLabel(period.y, period.m, period.half)} のシフト`;
  el('builtList').innerHTML = '';

  shiftDays(period.y, period.m, period.half).forEach((dateStr) => {
    const [, m, d] = dateStr.split('-').map(Number);
    const dow = new Date(dateStr.replace(/-/g, '/')).getDay();
    const day = built[dateStr];

    const row = document.createElement('div');
    row.className = 'built-day'
      + (dow === 0 ? ' is-sun' : dow === 6 ? ' is-sat' : '');

    const date = document.createElement('span');
    date.className = 'built-day__date';
    date.textContent = `${m}/${d}（${DOW[dow]}）`;
    row.appendChild(date);

    const body = document.createElement('div');
    body.className = 'built-day__body';

    if (isClosedOn(dateStr)) {
      const p2 = document.createElement('p');
      p2.className = 'built-none';
      p2.textContent = '定休日';
      body.appendChild(p2);
    } else {
      let any = false;
      shiftSlotsOf(me.store).forEach((slot) => {
        // 見本（テスト用）の人は、決まったシフトにも出しません
        const list = ((day && day[slot.id]) || []).filter((e) => !isShiftTester(e.n));
        if (!list.length) return;
        any = true;
        const line = document.createElement('p');
        line.className = 'built-line';
        const tag = document.createElement('span');
        tag.className = `built-line__slot built-line__slot--${slot.id}`;
        tag.textContent = slot.name;
        line.appendChild(tag);

        list.forEach((e) => {
          const one = document.createElement('span');
          // 自分の名前は太く。自分の出番をひと目で見つけられるように
          one.className = 'built-name'
            + (e.n === me.name ? ' is-me' : '')
            + (e.f ? ' is-full' : '');
          one.textContent = shiftNameText(me.store, slot.id, e);
          line.appendChild(one);
        });
        body.appendChild(line);
      });
      if (!any) {
        const p2 = document.createElement('p');
        p2.className = 'built-none';
        p2.textContent = '—';
        body.appendChild(p2);
      }
      if (day && day.memo) {
        const memo = document.createElement('p');
        memo.className = 'built-memo';
        memo.textContent = day.memo;
        body.appendChild(memo);
      }
    }

    row.appendChild(body);
    el('builtList').appendChild(row);
  });
}

/* -------- 決まったシフトを、絵にして持ち帰る --------
 *
 *  ★ワークスの「JPEGで保存」と同じ絵です。描くところは js/shift-sheet.js に
 *    1つだけ置いて、こちらと共通にしてあります（2か所で別々に描くと、
 *    片方を直したときに見た目が食い違うためです）。
 *    ここでやるのは、届いた built を、その形（モデル）に組み直すことだけです。
 */
function builtSheetModel() {
  const days = shiftDays(period.y, period.m, period.half);
  const blocks = [];
  const per = shiftPrintCols(days.length);

  for (let from = 0; from < days.length; from += per) {
    const part = days.slice(from, from + per);
    const head = part.map((s) => {
      const [yy, m, d] = s.split('-').map(Number);
      const dow = new Date(s.replace(/-/g, '/')).getDay();
      const holi = isHoliday(yy, m, d);
      return {
        key: s,
        label: `${m}/${d}`,
        dow: `（${DOW[dow]}）` + (holi ? '祝' : ''),
        sun: dow === 0 || holi,
        sat: dow === 6,
        closed: isClosedOn(s),
      };
    });

    const rows = shiftSlotsOf(me.store).map((slot) => ({
      label: slot.name,
      cells: part.flatMap((s) => {
        const day = built[s] || {};
        // 見本（テスト用）の人は出しません。時刻の入っていない人は、その枠のふだんの時刻に
        const list = (day[slot.id] || [])
          .filter((e) => e && !isShiftTester(e.n))
          .map((e) => (e.t === '' || e.t === undefined || e.t === null
            ? { ...e, t: shiftDefaultTime(me.store, slot.id) } : e))
          .sort((a, b) => Number(a.t) - Number(b.t));
        const short = shiftShortMap(day.short);
        return SHIFT_LANES.map((lane) => ({
          closed: isClosedOn(s),
          patty: day.patty === slot.id,
          short: short[shiftShortKey(slot.id, lane.id)] || 0,
          names: isClosedOn(s) ? [] : list
            .filter((e) => (SHIFT_LANES.some((l) => l.id === e.p) ? e.p : SHIFT_LANES[0].id) === lane.id)
            .map((e) => ({
              text: shiftNameText(me.store, slot.id, e),
              parts: shiftNameParts(me.store, slot.id, e),
              full: !!e.f,
              early: !!e.early,
            })),
        }));
      }),
    }));

    const memo = part.map((s) => (isClosedOn(s) ? '' : ((built[s] || {}).memo || '')));
    blocks.push({ head, rows, memo });
  }

  return {
    // ★店舗の名前は焼き込みません。前は「バグる」と書いてあったので、
    //   ほかの店舗の人にも「バグる シフト表」と出るところでした
    title: `${shiftRangeLabel(period.y, period.m, period.half)} `
      + `${(getStore(me.store) || {}).name || ''} シフト表`,
    slots: shiftSlotsOf(me.store),
    blocks,
  };
}

/** その日の連絡。枠の下に置いて、日ごとに書けるようにしています */
function dayNote(dateStr) {
  const note = document.createElement('input');
  note.type = 'text';
  note.className = 'day__note';
  note.maxLength = 120;
  note.placeholder = '連絡（あれば）';
  note.value = notes[dateStr] || '';
  note.addEventListener('input', () => {
    const v = note.value.trim();
    if (v) notes[dateStr] = v;
    else delete notes[dateStr];
  });
  return note;
}

/**
 * 出勤〜退勤を選ぶ行（時刻を入れる店舗だけ）
 *
 * ★「入らない日」は、出勤を空にしておくだけです。押して消す操作は要りません。
 * ★退勤は、出勤より後の時刻しか出しません。
 * ★どの枠（立ち上げ・ランチ・ディナー）に入るかは**お店の側で決まります**。
 *   ここでは見せません。出勤時刻から自動で決まるためです。
 */
function rangeRow(dateStr, entry) {
  const times = shiftRangeTimes(me.store);
  const row = document.createElement('div');
  row.className = 'range';

  const make = (name, いま, onPick, より後) => {
    const wrap = document.createElement('label');
    wrap.className = 'range__one';
    const cap = document.createElement('span');
    cap.className = 'range__label';
    cap.textContent = name;
    const sel = document.createElement('select');
    sel.className = 'range__sel';
    const から = document.createElement('option');
    から.value = '';
    から.textContent = '—';
    sel.appendChild(から);
    times.forEach((t) => {
      if (より後 !== undefined && より後 !== '' && Number(t) <= Number(より後)) return;
      const o = document.createElement('option');
      o.value = t;
      o.textContent = shiftTimeText(t);
      if (String(いま) === t) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => onPick(sel.value));
    wrap.append(cap, sel);
    return wrap;
  };

  const from = entry ? String(entry.t || '') : '';
  const to = entry ? String(entry.e || '') : '';

  row.appendChild(make('出勤', from, (v) => setRange(dateStr, v, to), undefined));
  row.appendChild(make('退勤', to, (v) => setRange(dateStr, from, v), from));
  return row;
}

/**
 * 出勤〜退勤を入れる
 *
 * ★出勤が空なら「その日は入らない」です。
 * ★退勤が出勤より前になったら、退勤を捨てます（出勤を後ろにずらしたとき）。
 * ★入る枠は、出勤時刻から決めます（10:30なら立ち上げ、11:00ならランチ…）。
 *   お店の表がその行に入るので、ここで決めておきます。
 */
function setRange(dateStr, from, to) {
  if (!from) {
    delete picked[dateStr];
    renderPeriod();
    return;
  }
  const owari = to && Number(to) > Number(from) ? to : '';
  const one = { s: shiftSlotByTime(from), t: from };
  if (owari) one.e = owari;
  picked[dateStr] = [one];
  renderPeriod();
}

/** 絵にして、共有か保存に渡します */
async function saveBuiltImage() {
  if (!built || !period) return;
  const btn = el('builtSave');
  const before = btn.textContent;
  btn.disabled = true;
  btn.textContent = '作っています…';
  try {
    const canvas = document.createElement('canvas');
    drawShiftSheet(canvas, builtSheetModel());
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.95));
    if (!blob) throw new Error('絵が作れませんでした');
    const name = `シフト_${shiftRangeLabel(period.y, period.m, period.half).replace(/[/〜]/g, '-')}.jpg`;
    const file = new File([blob], name, { type: 'image/jpeg' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e) {
    el('builtSaveNote').textContent = '保存できませんでした。もう一度おためしください。';
  } finally {
    btn.disabled = false;
    btn.textContent = before;
  }
}

function renderDays() {
  el('days').innerHTML = '';
  shiftDays(period.y, period.m, period.half).forEach((dateStr) => {
    el('days').appendChild(dayCard(dateStr));
  });
}

function dayCard(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(dateStr.replace(/-/g, '/')).getDay();
  const shut = isClosedOn(dateStr);
  const mine = picked[dateStr] || [];

  const card = document.createElement('div');
  card.className = 'day'
    + (shut ? ' is-closed' : '')
    + (mine.length ? ' is-on' : '')
    + (dow === 0 ? ' is-sun' : dow === 6 ? ' is-sat' : '');

  const head = document.createElement('div');
  head.className = 'day__head';
  const date = document.createElement('span');
  date.className = 'day__date';
  date.textContent = `${m}/${d}（${DOW[dow]}）`;
  head.appendChild(date);

  if (shut) {
    const badge = document.createElement('span');
    badge.className = 'day__closed';
    badge.textContent = '定休日';
    head.appendChild(badge);
    card.appendChild(head);
    return card;
  }
  card.appendChild(head);

  // ★時刻を入れる店舗（popo）は、枠を選ばずに出勤〜退勤を入れてもらいます。
  //   30分刻みで8時から24時までだと33個になるので、ボタンではなく
  //   プルダウンにします（iPhoneでは時計のホイールのように出ます）
  if (shiftUsesRange(me.store)) {
    card.appendChild(rangeRow(dateStr, mine[0] || null));
    card.appendChild(dayNote(dateStr));
    return card;
  }

  // 枠は4つ（立ち上げ・F・ランチ・ディナー）あるので、日付の下に1行使って並べます。
  // 日付と同じ行に押し込むと、iPhoneではボタンが小さくなりすぎて押しまちがえます
  // 光らせるのは1つだけ。立ち上げのときは、対で入るランチ／Fは光らせません
  //   （「立ち上げのあとは？」の方で見せます）
  const main = mine.some((e) => e.s === 'open') ? 'open' : ((mine[0] || {}).s || '');

  const slots = document.createElement('div');
  slots.className = 'day__slots';
  shiftWishSlots(me.store).forEach((slot) => {
    const on = slot.id === main;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `slot slot--${slot.id}` + (on ? ' is-on' : '');
    b.textContent = slot.name;
    b.title = slot.hint;
    b.addEventListener('click', () => toggleSlot(dateStr, slot.id));
    slots.appendChild(b);
  });
  card.appendChild(slots);

  // ★立ち上げを押した人には、そのあとを聞きます。
  //   立ち上げだけ出して帰る人はいないので、ランチだけか通しかを
  //   ここで決めてもらいます（あとから組むときの聞き直しが減ります）
  // ★聞くのは F（通し）がある店舗だけです。仕込み／営業の4店舗には
  //   ランチが無いので F も無く、仕込みのあとは営業しかありません。
  //   その場合は押した時点で営業も入っているので、聞くことがありません
  const 立ち上げ = getShiftSlot(me.store, 'open');
  const ランチ = getShiftSlot(me.store, 'lunch');
  if (main === 'open' && ランチ && getShiftSlot(me.store, SHIFT_FULL_ID)) {
    const row = document.createElement('div');
    row.className = 'after';
    const label = document.createElement('span');
    label.className = 'after__label';
    // ★名前は枠から取ります。マネージで呼び名を変えても、ここが古く残りません
    label.textContent = `${立ち上げ ? 立ち上げ.name : '立ち上げ'}のあとは？`;
    row.appendChild(label);

    const btns = document.createElement('div');
    btns.className = 'after__btns';
    [
      { id: 'lunch', name: `${ランチ.name}だけ` },
      { id: SHIFT_FULL_ID, name: 'F（通し）' },
    ].forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'after__btn' + (mine.some((e) => e.s === a.id) ? ' is-on' : '');
      b.textContent = a.name;
      b.addEventListener('click', () => setAfterOpen(dateStr, a.id));
      btns.appendChild(b);
    });
    row.appendChild(btns);
    card.appendChild(row);
  }

  // 選んだ枠だけ、開始時刻を出します。
  // F と立ち上げは、こちらで決めるので出しません（askTime: false）
  mine.forEach((entry) => {
    const slot = getShiftSlot(me.store, entry.s);
    if (!slot || !slot.times.length || slot.askTime === false) return;
    // ★立ち上げから続けて入る人は、ランチの時刻を聞きません。
    //   10時に来ているので、そのまま続くだけだからです
    if (main === 'open') return;
    const row = document.createElement('div');
    row.className = 'times';
    const label = document.createElement('span');
    label.className = `times__label times__label--${slot.id}`;
    label.textContent = `${slot.name} は何時から？`;
    row.appendChild(label);

    const btns = document.createElement('div');
    btns.className = 'times__btns';
    slot.times.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'time' + (String(entry.t) === t ? ' is-on' : '');
      b.textContent = shiftTimeText(t);
      b.addEventListener('click', () => setTime(dateStr, slot.id, t));
      btns.appendChild(b);
    });
    row.appendChild(btns);
    card.appendChild(row);
  });

  card.appendChild(dayNote(dateStr));

  return card;
}

/**
 * その日の枠を選ぶ
 *
 * ★1日に選べるのは1つだけです。押すと前の選びは消えます。
 *   立ち上げ・F・ランチ・ディナーは、どれも「その日の入り方」なので、
 *   重ねて選ぶ意味がありません。
 * ★立ち上げだけは、そのあとのランチ／Fと対で持ちます
 *   （立ち上げただけで帰る人はいないため）。
 */
function toggleSlot(dateStr, slotId) {
  const now = picked[dateStr] || [];
  const main = now.some((e) => e.s === 'open') ? 'open' : ((now[0] || {}).s || '');

  if (main === slotId) {          // 同じものをもう一度 → その日は入れない
    delete picked[dateStr];
    renderPeriod();
    return;
  }

  const list = [{ s: slotId, t: shiftDefaultTime(me.store, slotId) }];
  // 立ち上げ（仕込み）は、そのまま続けて入る枠を先に入れておきます。
  //   バグる            … ランチ（通しの人は「F（通し）」を押せば入れかわります）
  //   仕込み／営業の4店舗 … 営業
  // ★枠の名前ではなく並び順で決めます（→ shiftAfterOpen）
  if (slotId === 'open') {
    const 次 = shiftAfterOpen(me.store);
    if (次) list.push({ s: 次.id, t: shiftDefaultTime(me.store, 次.id) });
  }

  picked[dateStr] = list;
  renderPeriod();
}

/** 立ち上げのあと、ランチだけか通しかを決める */
function setAfterOpen(dateStr, pickId) {
  picked[dateStr] = [
    { s: 'open', t: shiftDefaultTime(me.store, 'open') },
    { s: pickId, t: shiftDefaultTime(me.store, pickId) },
  ];
  renderPeriod();
}

function setTime(dateStr, slotId, t) {
  const list = (picked[dateStr] || []).slice();
  const i = list.findIndex((e) => e.s === slotId);
  if (i < 0) return;
  list[i] = { s: slotId, t };
  picked[dateStr] = list;
  renderPeriod();
}

/* -------- 出した内容の控え -------- */
function renderDone() {
  if (!sentAt || !period) return;
  el('doneTitle').textContent = `${shiftRangeLabel(period.y, period.m, period.half)} を出しました`;
  if (due && phase === 'open') {
    el('doneTitle').textContent += `（${shiftDueLabel(due, DOW)}直せます）`;
  }
  el('doneList').innerHTML = '';

  const days = shiftDays(period.y, period.m, period.half)
    .filter((s) => (picked[s] || []).length || notes[s]);

  if (!days.length) {
    const li = document.createElement('li');
    li.className = 'done-none';
    li.textContent = 'この期間は「入れる日なし」で出しました。';
    el('doneList').appendChild(li);
    return;
  }

  days.forEach((s) => {
    const [, m, d] = s.split('-').map(Number);
    const dow = new Date(s.replace(/-/g, '/')).getDay();
    const li = document.createElement('li');
    li.className = 'done-row';

    const date = document.createElement('span');
    date.className = 'done-row__date';
    date.textContent = `${m}/${d}（${DOW[dow]}）`;
    li.appendChild(date);

    const body = document.createElement('span');
    body.className = 'done-row__body';
    const marks = (picked[s] || []).map((e) => {
      // ★時刻を入れる店舗は、枠の名前を出しません（選んでいないので）。
      //   出した時間帯をそのまま返します
      if (shiftUsesRange(me.store)) {
        const from = String(e.t || '');
        if (!from) return '';
        const to = String(e.e || '');
        return shiftTimeText(from) + (to ? `〜${shiftTimeText(to)}` : '〜');
      }
      const slot = getShiftSlot(me.store, e.s);
      if (!slot) return '';
      // ★F は時刻を出しません。何時からになるかはお店が決めるので、
      //   ここに時刻を出すと「その時間で決まった」と読めてしまいます
      if (slot.askTime === false && e.s === SHIFT_FULL_ID) return slot.name;
      const t = String(e.t || '');
      return slot.name + (t && slot.times.length ? ` ${shiftTimeText(t)}〜` : '');
    }).filter(Boolean);
    body.textContent = marks.join('・') || '（入れません）';
    li.appendChild(body);

    if (notes[s]) {
      const note = document.createElement('span');
      note.className = 'done-row__note';
      note.textContent = notes[s];
      li.appendChild(note);
    }
    el('doneList').appendChild(li);
  });
}

/* -------- 出し方 --------
 *
 *  ★ふだんは出しません。分からなくなった人が「？出し方」を押したときだけ
 *    出します。いつも画面に置くと、慣れた人には毎回じゃまになるためです。
 *  ★中身は index.html に直に書いてあります（#help の中）。
 *    文を変えたいときは、そちらを書きかえてください。
 */
function openHelp() {
  el('help').classList.remove('is-hidden');
  document.body.classList.add('is-help');
  el('helpClose').focus();
}

function closeHelp() {
  el('help').classList.add('is-hidden');
  document.body.classList.remove('is-help');
}

/* -------- 出す -------- */
async function send() {
  setErr('sendErr', '');
  el('send').disabled = true;

  const res = await call({ mode: 'put', days: picked, notes });
  el('send').disabled = false;

  if (!res.ok) return setErr('sendErr', res.error || '出せませんでした');
  sentAt = res.sentAt || new Date().toISOString();
  renderPeriod();
  // 出した内容の一覧まで画面を送って、届いたことが目で分かるようにします
  el('doneBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ============================================================
 *  はじめの1回
 * ============================================================ */
async function boot() {
  el('gateGo').addEventListener('click', submitPin);
  el('gatePin').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !imeEnter(e)) submitPin(); });
  // 日本語キーボードのままだと「８１５」のように全角で入ってしまうので、半角に直します
  bindHalfWidthInput(el('gatePin'), 'code');
  el('send').addEventListener('click', send);
  el('signOut').addEventListener('click', signOut);
  el('builtSave').addEventListener('click', saveBuiltImage);
  el('helpBtn').addEventListener('click', openHelp);
  el('helpClose').addEventListener('click', closeHelp);
  el('helpClose2').addEventListener('click', closeHelp);
  el('helpBack').addEventListener('click', closeHelp);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el('help').classList.contains('is-hidden')) closeHelp();
  });
  el('bootRetry').addEventListener('click', () => {
    el('bootText').textContent = '読み込んでいます…';
    el('bootSpin').classList.remove('is-hidden');
    el('bootRetry').classList.add('is-hidden');
    boot();
  });

  // 番号を覚えていない人には、待たせずにすぐ聞きます
  if (!me.code) return show('gate');

  // 覚えているときは、返事が返るまで「読み込んでいます」のままにします。
  // ★ここで番号の画面を出してしまうと、毎回それが一瞬見えて
  //   「また入れるのか」と思わせてしまいます
  show('boot');
  const res = await call({ mode: 'open' });
  if (res.ok) { applyOpen(res); return; }

  // ★番号そのものが違うと言われたときだけ、覚えているものを忘れます。
  //   電波が届かなかっただけで忘れてしまうと、外で開くたびに
  //   番号を入れ直すことになります（それが起きていました）
  if (res.bad) {
    me.code = '';
    localStorage.removeItem(`${SAVE}:code`);
    show('gate');
    setErr('gateErr', res.error || 'もう一度、番号を入れてください');
    return;
  }

  // つながらなかっただけ。番号はそのままにして、やり直せるようにします
  showRetry(res.error || 'つながりませんでした');
}

/** つながらなかったときの画面（番号は覚えたままです） */
function showRetry(message) {
  show('boot');
  el('bootText').textContent = message;
  el('bootSpin').classList.add('is-hidden');
  el('bootRetry').classList.remove('is-hidden');
}

boot();
