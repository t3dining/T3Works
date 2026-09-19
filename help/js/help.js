/* 使い方（help/）の動き。4つの使い方で同じものを読みます（2026-09-19 に help/index.html の <script> から出しました）。
   ページの一番下で読みます（見出しや目次の元がそろってから動くため） */
/* ★「アプリに戻る」は、開いた元のアプリに戻します（2026-09-16、ko-dai さんの指摘）。
     前は `../`（ワークス）に決め打ちで、**マインから開いてもワークスに戻っていました。**
     アプリ側の入口（js/app.js の helpLink）は本部の持ち物なので、ここだけで直しています。
   ・元のページ（document.referrer）が同じサイトの T3Works の中なら、そこへ戻ります
     （マインなら mine/、ワークスなら T3Works/）
   ・元が分からないとき（URL を直接開いた・referrer が無い）は、HTML に書いた戻り先のまま（ワークスの使い方なら `../`）
   ・★元の URL の `?v=` などは付けません。古い版の印を付けて開き直すことになるためです
   ・★元の `#` （開いていた店舗や画面）は referrer に入らないので、戻ると入口の画面になります */
(function () {
  var back = document.getElementById('helpBack');
  if (!back || !document.referrer) return;
  try {
    var from = new URL(document.referrer);
    // T3Works/ の一番上。help/ の下のどの深さのページからでも同じになるよう、道の「/help/」の手前で切ります
    var i = location.pathname.lastIndexOf('/help/');
    if (i < 0) return;
    var home = location.pathname.slice(0, i + 1);
    if (from.origin !== location.origin) return;
    if (from.pathname.indexOf(home) !== 0) return;
    if (from.pathname.indexOf(home + 'help/') === 0) return;
    back.href = from.pathname;
  } catch (e) {
    // 読めないときは、今までどおりワークスへ
  }
})();

/* 印刷（PDF）の題名の下に、作った日と版を入れます。
   版は公開の道具が入れる <meta name="app-version">。手元のファイル（まだ公開していないもの）には無いので、日付だけになります */
(function () {
  var sub = document.getElementById('helpPrintSub');
  if (!sub) return;
  var d = new Date();
  var meta = document.querySelector('meta[name="app-version"]');
  var who = sub.textContent.trim();                 // 誰向けか（ページごとに HTML に書いてあります）
  sub.textContent = who + '　' + d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 時点'
    + (meta && meta.content ? '（版 ' + meta.content + '）' : '');
})();

/* ★各章の目次（2026-09-16、ko-dai さん「その章に何が書かれているか分かるように、押すとそこまで飛べるように」）。
     章の見出しのすぐ下に、その章の小見出しを並べます。押すと、その小見出しまで飛びます。
   ・拾うのは h3 と「困ったとき」の質問（.help-q__title）。**画面の絵（.help-shot）の中は拾いません**
     （絵の中にもアプリの見出しの h3 があるためです）
   ・飛び先の id は「章の id-何番目」（s3-2 など）。小見出しを足すと番号がずれますが、目次も一緒に作り直すので、
     ページの中のリンクは切れません
   ・小見出しが1つしかない章には出しません */
(function () {
  var secs = document.querySelectorAll('.help-sec');
  for (var k = 0; k < secs.length; k++) {
    var sec = secs[k];
    var head = sec.querySelector('.help-sec__head');
    if (!head || !sec.id) continue;
    var found = sec.querySelectorAll('h3, .help-q__title');
    var items = [];
    for (var i = 0; i < found.length; i++) {
      if (!found[i].closest('.help-shot')) items.push(found[i]);
    }
    if (items.length < 2) continue;

    var nav = document.createElement('nav');
    nav.className = 'help-sec-toc';
    nav.setAttribute('aria-label', 'この章の目次');
    var label = document.createElement('div');
    label.className = 'help-sec-toc__label';
    label.textContent = 'この章に書いてあること';
    var list = document.createElement('ul');
    list.className = 'help-sec-toc__list';
    for (var j = 0; j < items.length; j++) {
      var h = items[j];
      if (!h.id) h.id = sec.id + '-' + (j + 1);
      h.classList.add('help-jump');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.replace(/\s+/g, ' ').trim();
      var li = document.createElement('li');
      li.appendChild(a);
      list.appendChild(li);
    }
    nav.appendChild(label);
    nav.appendChild(list);
    head.parentNode.insertBefore(nav, head.nextSibling);
  }
  // 小見出しへのリンク（#s3-2 など）で開いたときは、作ったあとでそこへ移ります
  if (location.hash) {
    var to = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (to) to.scrollIntoView();
  }
})();
