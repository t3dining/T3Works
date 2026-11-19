/* ============================================================
 *  アプリの知らせを受け取る（ワークスとマインの「この端末の設定」の欄。2026-11-20、ko-dai さんの指示）
 *
 *  「明日からクローズとジャーナルの通知は LINE ではなくアプリからの通知で知らせてください。
 *    各社員の自分のスマホで通知を受け取りたいです」
 *
 *  ★ワークスにもマインにも出します（2026-11-21、ko-dai さん「マインは私しか使っていません。
 *    他の社員はワークスを使っているので、ワークスにも通知がいくようにしてください」）。
 *    ★どちらで登録したかを Cloudflare に伝えます（app）。2つは同じ住所の下にあるので、
 *      押したときに開く画面を、登録したアプリに合わせるためです（ワークスで受け取った人にマインを開かない）。
 *    お店のタブレットでも押せば受け取れます（押さなければ届きません）。
 *  ★画面（view）ではなく、設定の画面に1つ欄を足すだけです（js/app.js に触りません。js/share.js と同じ作り）。
 *  ★届けるのは Cloudflare（cloudflare/worker.js の「アプリの知らせ」）、画面に出すのは sw.js です。
 *    端末の登録は Sync.ask の cloud（Cloudflare へ。ふつうの合言葉と、その人の番号で通ります）。
 *  ★iPhone は、ホーム画面に追加したアプリからでないと通知を受け取れません（iOS 16.4 以降）。
 *    Safari で開いているだけのときは、ボタンを出さずに、そう書きます。
 *  ★iPhone は、ボタンを押した流れの中でないと「通知を許可しますか？」を聞けません。
 *    だから押したら、他の何より先に許可を聞きます。
 *  ★検算は .claude/skills/t3works-zentai/test_notify_ui.js（jsc）。
 * ============================================================ */
/* ---------- アイコンの数（2026-11-21、ko-dai さんの指示） ----------
 *  アプリを開いたら、届いた知らせは見たことにします（LINE やメールと同じ）。
 *  数を消し、通知の一覧からも下げます。★下げないと、次に届いたときに、見た分まで数え直してしまいます（sw.js の 数を出す）。
 *  ワークスにもマインにも効きます。数を出せない端末では、何もしません。 */
(() => {
  async function 見た() {
    try {
      if (typeof navigator.clearAppBadge === 'function') await navigator.clearAppBadge();
      if (!('serviceWorker' in navigator)) return;
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.getNotifications === 'function') (await reg.getNotifications()).forEach((x) => x.close());
    } catch (e) { /* 数を消せなくても、アプリはそのまま動きます */ }
  }
  見た();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) 見た(); });
})();

const NotifyView = (() => {
  const マイン = document.body.dataset.mode === 'mine';
  // ★iPhone の「設定」→「通知」に出る名前（ホーム画面のアイコンの名前。index.html の apple-mobile-web-app-title）
  const アプリの名 = マイン ? 'T3 Works Mine' : 'T3 Works';
  const 保存の欄 = document.getElementById('storeUsage');
  const 設定 = document.getElementById('modal');
  if (!保存の欄 || !設定 || !保存の欄.closest('.field')) return null;

  const 欄 = document.createElement('div');
  欄.className = 'field';
  欄.id = 'pushField';
  欄.innerHTML = `
    <span class="field__label">通知（クローズ・ジャーナル）</span>
    <p class="sync-info" id="pushInfo"></p>
    <div class="modal__actions">
      <button type="button" class="btn" id="pushOn">通知を受け取る</button>
      <button type="button" class="btn" id="pushTest">試しに送る</button>
      <button type="button" class="btn" id="pushOff">受け取るのをやめる</button>
    </div>`;
  保存の欄.closest('.field').before(欄);
  const 字 = 欄.querySelector('#pushInfo');
  const 受け取る = 欄.querySelector('#pushOn');
  const 試す = 欄.querySelector('#pushTest');
  const やめる = 欄.querySelector('#pushOff');

  /** 出すボタン（それ以外は隠します） */
  function 見せる(文, ボタン) {
    字.textContent = 文;
    // ★hidden ではなく display で隠します（.btn の display の決まりが hidden に勝つことがあるため）
    [受け取る, 試す, やめる].forEach((b) => { b.style.display = ボタン.indexOf(b) < 0 ? 'none' : ''; b.disabled = false; });
  }

  function 使える() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  /** 世話係（sw.js）を待ちます。返事が来ないときは null（★待ちっぱなしにしません） */
  function 世話係() {
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise((ok) => setTimeout(() => ok(null), 10000)),
    ]);
  }

  function 鍵の並び(b64) {
    const s = String(b64).replace(/-/g, '+').replace(/_/g, '/');
    const b = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
    return Uint8Array.from(b, (c) => c.charCodeAt(0));
  }

  function 同じ鍵(登録, 鍵) {
    const 今の = 登録 && 登録.options && 登録.options.applicationServerKey;
    if (!今の) return false;
    const a = new Uint8Array(今の), b = 鍵の並び(鍵);
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }

  function 頼む(op, extra) {
    return Sync.ask('push', { op, ...(extra || {}) }, { cloud: true, ms: 20000 });
  }

  /** いまの様子を出します（設定の画面を開いたとき） */
  async function 様子() {
    if (!使える()) {
      見せる('この開き方では、通知を受け取れません。iPhone は iOS 16.4 以降で、ホーム画面に追加したアプリ（' + アプリの名 + '）から開いてください。', []);
      return;
    }
    if (Notification.permission === 'denied') {
      見せる('通知が切られています。iPhone の「設定」→「通知」→「' + アプリの名 + '」で「通知を許可」をオンにしてから、もう一度開いてください。', []);
      return;
    }
    if (!Sync.enabled() || !Sync.pin()) {
      見せる('先に PIN を入れてください。', []);
      return;
    }
    const reg = await 世話係();
    const 登録 = reg ? await reg.pushManager.getSubscription() : null;
    if (!登録 || Notification.permission !== 'granted') {
      見せる('この端末は、まだ受け取っていません。クローズとジャーナルの未提出を、この端末に知らせます。', [受け取る]);
      return;
    }
    字.textContent = '確かめています…';
    const r = await 頼む('state', { sub: { endpoint: 登録.endpoint } });
    if (r.ok && r.on) {
      見せる('この端末は受け取ります（クローズとジャーナルの未提出）。', [試す, やめる]);
    } else if (r.ok) {
      見せる('この端末は、いまは受け取っていません。もう一度「通知を受け取る」を押してください。', [受け取る]);
    } else {
      見せる('いまは確かめられませんでした（' + (r.error || '通信できませんでした') + '）。', [受け取る]);
    }
  }

  受け取る.addEventListener('click', async () => {
    受け取る.disabled = true;
    // ★押した流れの中で、一番先に聞きます（iPhone の決まり）
    const 許可 = await Notification.requestPermission();
    if (許可 !== 'granted') {
      見せる('通知が許可されませんでした。iPhone の「設定」→「通知」→「' + アプリの名 + '」で「通知を許可」をオンにしてから、もう一度押してください。', [受け取る]);
      return;
    }
    字.textContent = '登録しています…';
    try {
      const 鍵 = await 頼む('key');
      if (!鍵.ok || !鍵.key) throw new Error(鍵.error || '鍵を受け取れませんでした');
      const reg = await 世話係();
      if (!reg) throw new Error('アプリの準備ができていません。アプリを開き直してください');
      let 登録 = await reg.pushManager.getSubscription();
      if (登録 && !同じ鍵(登録, 鍵.key)) { await 登録.unsubscribe(); 登録 = null; }
      if (!登録) 登録 = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: 鍵の並び(鍵.key) });
      const r = await 頼む('add', { sub: 登録.toJSON(), app: マイン ? 'mine' : 'works' });
      if (!r.ok) throw new Error(r.error || '登録できませんでした');
      見せる('この端末は受け取ります。「試しに送る」を押して、届くか確かめてください。', [試す, やめる]);
    } catch (e) {
      見せる('登録できませんでした（' + ((e && e.message) || e) + '）。電波の良いところで、もう一度押してください。', [受け取る]);
    }
  });

  試す.addEventListener('click', async () => {
    試す.disabled = true;
    字.textContent = '送っています…';
    const reg = await 世話係();
    const 登録 = reg ? await reg.pushManager.getSubscription() : null;
    if (!登録) { 見せる('この端末は、まだ受け取っていません。', [受け取る]); return; }
    const r = await 頼む('test', { sub: { endpoint: 登録.endpoint } });
    if (r.ok) 見せる('送りました。数秒で届きます。届かないときは、iPhone の「設定」→「通知」で、' + アプリの名 + ' の通知がオンか見てください。', [試す, やめる]);
    else if (r.on === false) 見せる(r.error || 'この端末にはもう届きません。もう一度「通知を受け取る」を押してください。', [受け取る]);
    else 見せる(r.error || '送れませんでした。少したってから、もう一度お試しください。', [試す, やめる]);
  });

  やめる.addEventListener('click', async () => {
    やめる.disabled = true;
    字.textContent = 'やめています…';
    const reg = await 世話係();
    const 登録 = reg ? await reg.pushManager.getSubscription() : null;
    if (登録) {
      const r = await 頼む('del', { sub: { endpoint: 登録.endpoint } });
      if (!r.ok) { 見せる('やめられませんでした（' + (r.error || '通信できませんでした') + '）。もう一度押してください。', [試す, やめる]); return; }
      await 登録.unsubscribe().catch(() => {});
    }
    見せる('この端末は受け取りません。', [受け取る]);
  });

  // 設定の画面を開くたびに、いまの様子を出し直します
  const 歯車 = document.getElementById('settingsBtn');
  if (歯車) 歯車.addEventListener('click', () => { 様子().catch(() => 見せる('いまの様子を読めませんでした。', [受け取る])); });
  様子().catch(() => 見せる('いまの様子を読めませんでした。', [受け取る]));
  return { 様子 };
})();
