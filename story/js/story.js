'use strict';
/*
 * ストーリーズ作成（オーナーから開くページ。owner/index.html のカード）
 *
 * 画像は Mac（../ストーリーズ画像/つくる.py --アプリ用）で作って公開しています。
 * このページは、できあがった画像を並べて、長押しで写真に保存してもらうためのものです。
 *
 * ★なぜ端末で作らないか
 *   iPhoneのSafariは、HTMLをそのまま画像に変える仕組み（SVGのforeignObject）に
 *   対応していません。実機で作れなかったので、作るのはMacに寄せました。
 *   そのかわり、傾き・ぼかし・影といったデザインの制約がなくなりました。
 *
 *   story/できあがり/一覧.json       … 何がどれだけあるかの一覧
 *   story/できあがり/<店舗>/*.jpg     … そのまま投稿できる1080×1920の画像
 *   story/できあがり/<店舗>/小/*.jpg  … 一覧にならべる小さい写真
 */

const el = (id) => document.getElementById(id);

// 公開したときに付く版の印。古い読み込みが残らないようにする
const 版 = document.querySelector('meta[name="app-version"]')?.content || '';
const 印つき = (url) => (版 ? url + (url.includes('?') ? '&' : '?') + 'v=' + 版 : url);

let 設定 = null;
let 一覧 = { 作った日: '', 店舗: {} };
let いまの店舗 = null;

// ------------------------------------------------------------ 小さな道具

function エスケープ(値) {
  return String(値 ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

async function 取ってくる(url) {
  const res = await fetch(印つき(url), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} が読めませんでした（${res.status}）`);
  return res;
}

function しくじり(err) {
  console.error(err);
  const box = el('errorBox');
  box.textContent = 'うまくいきませんでした。\n' + (err && err.message ? err.message : err);
  box.classList.remove('is-hidden');
}

function 画面を出す(名前) {
  for (const id of ['viewStores', 'viewList', 'viewDone']) {
    el(id).classList.toggle('is-hidden', id !== 名前);
  }
  el('errorBox').classList.add('is-hidden');
  window.scrollTo(0, 0);
}

/** うるう年かどうか */
function うるう年(年) {
  return 年 % 4 === 0 && (年 % 100 !== 0 || 年 % 400 === 0);
}

/**
 * きょうが当たるイベント（肉の日など）
 *
 * 「毎月の日」が29のように、うるう年でない2月には来ない日のときは、
 * 「うるう年でない2月」に書いた日に読みかえる。
 */
function きょうのイベント(店舗, 日 = new Date()) {
  return (店舗['イベント'] || []).filter((イベント) => {
    const 毎月の日 = イベント['毎月の日'];
    const 代わり = イベント['うるう年でない2月'];
    if (日.getMonth() === 1 && 代わり && !うるう年(日.getFullYear())) {
      return 日.getDate() === Number(代わり);
    }
    return 毎月の日 && 日.getDate() === Number(毎月の日);
  });
}

// ------------------------------------------------------------ 画像の場所

function 大きい画像(店舗id, ファイル) {
  return `できあがり/${encodeURIComponent(店舗id)}/${encodeURIComponent(ファイル)}`;
}

function 小さい画像(店舗id, ファイル) {
  return `できあがり/${encodeURIComponent(店舗id)}/%E5%B0%8F/${encodeURIComponent(ファイル)}`;
}

// ------------------------------------------------------------ 店舗を選ぶ

function 店舗を並べる() {
  const 箱 = el('storeList');
  箱.innerHTML = '';

  for (const 店 of 設定['店舗']) {
    const 並び = 一覧['店舗'][店['id']] || [];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'story-store';
    btn.style.setProperty('--下地', (店['ブランド'] || {})['下地'] || '#ddd');

    const 印 = きょうのイベント(店)
      .map((イ) => `<span class="story-store__event">きょうは${エスケープ(イ['名前'])}</span>`)
      .join('');

    btn.innerHTML =
      `<img class="story-store__logo" src="${印つき(店['ロゴ'] || '')}" alt="">` +
      `<span class="story-store__text">` +
      `<span class="story-store__name">${エスケープ(店['名前'])}${印}</span>` +
      `<span class="story-store__sub">${エスケープ(店['説明'] || '')}｜${並び.length}枚</span>` +
      `</span><span class="story-store__arrow">›</span>`;
    btn.addEventListener('click', () => 店舗を選ぶ(店));
    箱.appendChild(btn);
  }

  el('madeOn').textContent = 一覧['作った日'] ? `${一覧['作った日']} に作った分` : '';
}

function 店舗を選ぶ(店舗) {
  いまの店舗 = 店舗;
  el('storeName').textContent = 店舗['名前'] || '';
  画像を並べる();
  画面を出す('viewList');
}

// ------------------------------------------------------------ 画像をならべる

function 画像を並べる() {
  const 並び = (一覧['店舗'][いまの店舗['id']] || []).slice();
  const 当日 = きょうのイベント(いまの店舗).map((イ) => イ['名前']);

  // きょうがイベントの日なら、その分を先に出す。期間限定はいつも上の方
  const 重み = (も) =>
    (当日.includes(も['イベント']) ? 2 : 0) + (も['区分'] ? 1 : 0);
  並び.sort((a, b) => 重み(b) - 重み(a));

  const ul = el('imageList');
  ul.innerHTML = '';

  for (const もの of 並び) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'story-card';

    const img = document.createElement('img');
    img.className = 'story-card__photo';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = '';
    img.src = 印つき(小さい画像(いまの店舗['id'], もの['ファイル']));
    img.addEventListener('error', function () { this.classList.add('is-dame'); });

    const body = document.createElement('div');
    body.className = 'story-card__body';
    const 名 = document.createElement('span');
    名.className = 'story-card__name';
    名.textContent = もの['商品名'];
    body.appendChild(名);

    for (const [文字, 種] of [[もの['区分'], 'kikan'],
                             [もの['イベント'], 'event'],
                             [もの['札'], 'label']]) {
      if (!文字) continue;
      const 印 = document.createElement('span');
      印.className = `story-card__chip story-card__chip--${種}`;
      印.textContent = 文字;
      body.appendChild(印);
    }

    btn.appendChild(img);
    btn.appendChild(body);
    btn.addEventListener('click', () => 大きく出す(もの));
    li.appendChild(btn);
    ul.appendChild(li);
  }

  el('listNote').textContent = `${並び.length}枚`;
}

// ------------------------------------------------------------ 1枚を大きく出す

function 大きく出す(もの) {
  const 道 = 大きい画像(いまの店舗['id'], もの['ファイル']);
  el('resultImg').src = 印つき(道);
  const そえ = もの['区分'] || もの['イベント'] || '';
  el('resultName').textContent = もの['商品名'] + (そえ ? `（${そえ}）` : '');

  const link = el('downloadLink');
  link.href = 印つき(道);
  link.download = `${いまの店舗['id']}_${もの['ファイル']}`;
  画面を出す('viewDone');
}

// ------------------------------------------------------------ 起動

async function 起動() {
  try {
    設定 = await (await 取ってくる('設定.json')).json();
    if (!(設定['店舗'] || []).length) throw new Error('設定.json に「店舗」がありません');

    try {
      一覧 = await (await 取ってくる('できあがり/一覧.json')).json();
    } catch (err) {
      一覧 = { 作った日: '', 店舗: {} };   // まだ1枚も作っていないとき
    }
    店舗を並べる();

    // オーナー（?from=owner）から開いたときだけ、ホームに戻るボタンを出す。
    // 前はマインの中にあったので、古いリンクの ?from=mine でも出るようにしてある
    if (/(^|[?&])from=(owner|mine)([&#]|$)/.test(location.search)) {
      el('toOwnerBtn').classList.remove('is-hidden');
    }
  } catch (err) {
    しくじり(err);
  }
}

el('backToStores').addEventListener('click', () => 画面を出す('viewStores'));
el('backToList').addEventListener('click', () => 画面を出す('viewList'));

// 起動の終わりを外から待てるようにしておく（確認用）
window.起動ずみ = 起動();
