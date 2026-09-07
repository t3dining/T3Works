#!/usr/bin/env python3
"""その日の分を Instagram のストーリーズに投稿する。

GitHub Actions から毎日呼ばれます。すでに公開してある画像のURLを Instagram に
渡すだけなので、Chromeもフォントも要りません（画像づくりは別の仕事）。

つかいかた
    python3 投稿する.py --試す      何を投稿するか出すだけ（投稿しない）
    python3 投稿する.py             その回の分を投稿する
    python3 投稿する.py --枚数 2    枚数を決め打ちする

    1日に2回（10:00と17:00）出します。★GitHubの予定は遅れたり流れたりするので、
    そのあと20分おきにも動かしてあり、「まだ足りないぶんだけ」出す作りにしてある。
    もう出ていれば0枚になるので、二重に出ることはない。

いる環境変数（GitHubのSecretsに入れておく）
    IG_USER_ID_BAGURU      バグるのInstagramユーザーID（店舗idを大文字にしたもの）
    IG_TOKEN_BAGURU        バグるのアクセストークン
    IG_USER_ID_POPO        popoのぶん。無い店舗は飛ばします
    IG_TOKEN_POPO          popoのぶん

店舗ごとに止める
    story/設定.json のその店舗に "自動投稿": false と書くと、その店舗は出しません。
    トークンはそのままにしておけるので、また出すときは true に戻して公開するだけです。

    ★店舗ごとにビジネスポートフォリオが分かれているので、トークンも店舗ごとです。
      1つのトークンで両方いける場合は、代わりに IG_ACCESS_TOKEN を1つ入れてもかまいません。

しくみ
    1. story/できあがり/一覧.json から、その店舗の画像を読む
    2. 投稿履歴.json を見て、一番長く出していないものから枚数分選ぶ
       （イベントの日は、その日の分を先に出す。同じ日に2回目のときは、
         1回目に出したものと同じ商品を出さない）
    3. きょうが休みの日（マネージで決めた定休日・臨時休業）なら、
       「本日定休日です」の知らせを1枚だけ出す
    4. コンテナを作る → 公開する、の2段階で投稿する
    5. 投稿履歴.json に書き戻す（Actionsがコミットして次回に引き継ぎます）
"""

import argparse
import datetime
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ここ = os.path.dirname(os.path.abspath(__file__))
ルート = os.path.dirname(ここ) if os.path.basename(ここ) == "自動投稿" else ここ

設定の場所 = os.path.join(ルート, "story", "設定.json")
一覧の場所 = os.path.join(ルート, "story", "できあがり", "一覧.json")
履歴の場所 = os.path.join(ルート, "投稿履歴.json")

API = "https://graph.facebook.com/v25.0"

# 一度出したら、この日数のあいだは同じ画像を出さない
あけたい日数 = 14

# 日本時間。GitHubの機械はUTCで動いているので、ここで直す
日本 = datetime.timezone(datetime.timedelta(hours=9))


def いまの目標枚数(共通, いま):
    """その時刻までに、その日「何枚出ているべきか」を返す。

    ★GitHubの予定どおりの実行は、遅れたり、そのまま流れたりする。
      そこで少しあとにも動かしておき、「まだ足りないぶんだけ出す」形にしてある。
      もう出ていれば0枚になるので、二重に出ることはない。
    """
    時刻 = [str(t).strip() for t in (共通.get("投稿する時刻") or []) if str(t).strip()]
    一日の枚数 = int(共通.get("1日の枚数", 2))
    if not 時刻:
        return 一日の枚数
    済んだ回 = sum(1 for t in sorted(時刻) if t <= いま)
    if 済んだ回 <= 0:
        return 0
    return max(1, int(round(一日の枚数 * 済んだ回 / len(時刻))))


def 読む(場所, 既定=None):
    if not os.path.exists(場所):
        if 既定 is None:
            raise SystemExit(f"ファイルがありません: {場所}")
        return 既定
    with open(場所, encoding="utf-8") as f:
        return json.load(f)


def 書く(場所, 中身):
    with open(場所, "w", encoding="utf-8") as f:
        f.write(json.dumps(中身, ensure_ascii=False, indent=2) + "\n")


def うるう年(年):
    return 年 % 4 == 0 and (年 % 100 != 0 or 年 % 400 == 0)


def その日のイベント(店舗, 日付):
    d = datetime.date.fromisoformat(日付)
    当たり = []
    for イベント in 店舗.get("イベント") or []:
        毎月の日 = イベント.get("毎月の日")
        代わり = イベント.get("うるう年でない2月")
        if d.month == 2 and 代わり and not うるう年(d.year):
            if d.day == int(代わり):
                当たり.append(イベント["名前"])
        elif 毎月の日 and d.day == int(毎月の日):
            当たり.append(イベント["名前"])
    return 当たり


def 何日前(履歴, 鍵, 日付):
    """最後に出した日から何日たったか。一度も出していなければ大きい数。"""
    前 = 履歴.get(鍵)
    if not 前:
        return 99999
    return (datetime.date.fromisoformat(日付) - datetime.date.fromisoformat(前)).days


曜日の字 = "月火水木金土日"


def 定休日の曜日(文字列):
    """「火曜日」「火曜日・水曜日」などから、休みの曜日の字だけを取り出す。

    ★「火曜日」には「日」も入っているので、ただ字をさがすと
      **日曜も定休日**になってしまう（2026年8月30日の日曜に、
      「本日定休日です」が出てしまった）。「〇曜」の形で取り出す。
    """
    文 = str(文字列 or "")
    見つけた = re.findall(r"([月火水木金土日])曜", 文)
    if 見つけた:
        return set(見つけた)
    # 「火,水」のように「曜」を書かないときのため
    return {字 for 字 in 文 if 字 in 曜日の字}


def 休みの店(文字列):
    """きょう休みの店を読む。

    Google側（gas/通知.gs）から `baguru=定休日,popo=臨時休業` の形で渡ってくる。
    定休日・臨時休業・臨時営業日はマネージ（管理アプリ）で決めていて、
    その判定はGoogle側がしている（こちらはスプレッドシートを読めないため）。
    """
    表 = {}
    for ひとつ in str(文字列 or "").replace("、", ",").split(","):
        ひとつ = ひとつ.strip()
        if not ひとつ:
            continue
        店, _, 種類 = ひとつ.partition("=")
        店 = 店.strip()
        if 店:
            表[店] = (種類.strip() or "定休日")
    return 表


def きょうの休み(店舗, 日付, 店舗情報, 知らせ):
    """きょうが休みなら、その種類（定休日／臨時休業）を返す。休みでなければ空。

    ・Google側（マネージの定休日・臨時休業・臨時営業）からの知らせが最優先。
      「営業」と言われたら、いつもの定休日でも開いている（臨時営業日）
    ・知らせが無いときは、営業時間.csv の定休日（曜日）で決める
    """
    言われた = (知らせ.get(店舗["id"]) or "").strip()
    if 言われた in ("営業", "臨時営業", "open"):
        return ""
    if 言われた:
        return 言われた
    定休日 = (店舗情報.get(店舗["id"], {}).get("定休日") or "")
    番号 = datetime.date.fromisoformat(日付).weekday()
    return "定休日" if 曜日の字[番号] in 定休日の曜日(定休日) else ""


def 休みの画像(並び, 種類):
    """その種類（定休日／臨時休業）の知らせの画像を探す。"""
    合う = [も for も in 並び
          if (も.get("区分") or "") == "おやすみ" and (も.get("しらせ") or "") == 種類]
    if 合う:
        return 合う[0]
    ほか = [も for も in 並び if (も.get("区分") or "") == "おやすみ"]
    return ほか[0] if ほか else None


def その日に出せるか(もの, 日付, 定休日):
    """商品リストの「出す曜日」に当てはまる日か。

    ・空 … いつでも
    ・平日 … 月〜金（その店の定休日はのぞく）
    ・土日 / 土日祝 … 土・日
    ・月,水,木,金 のように書けば、その曜日だけ
    """
    決まり = (もの.get("出す曜日") or "").strip()
    if not 決まり:
        return True
    番号 = datetime.date.fromisoformat(日付).weekday()   # 月=0 … 日=6
    字 = 曜日の字[番号]
    if 字 in 定休日の曜日(定休日):
        return False
    if "平日" in 決まり:
        return 番号 <= 4
    if "土日" in 決まり:
        return 番号 >= 5
    選んだ = [c for c in 曜日の字 if c in 決まり]
    return 字 in 選んだ if 選んだ else True


def その時刻に出せるか(もの, 時刻たち, 節):
    """商品リストの「出す時刻」に当てはまる回か。

    ・空 … どの回でも
    ・朝 … 1回目、夕方/夜 … 最後の回
    ・10:00 のように書けば、その回だけ
    """
    決まり = (もの.get("出す時刻") or "").strip()
    if not 決まり or not 時刻たち:
        return True
    並び = sorted(時刻たち)
    いまの時刻 = 並び[min(max(節, 0), len(並び) - 1)]
    if 決まり in ("朝", "午前", "午前中"):
        return いまの時刻 == 並び[0]
    if 決まり in ("夕方", "夜", "午後"):
        return いまの時刻 == 並び[-1]
    return 決まり.replace("：", ":") == いまの時刻


def なかま名(もの):
    """その画像の「なかま」（ハンバーグ／アサイーボウル など）。無ければ商品名。"""
    return (もの.get("なかま") or もの.get("商品名") or "").strip()


def 最後の日(並び, 履歴, 店舗, 鍵にする):
    """まとまりごとに、最後に出した日を返す（なかま別・商品別に使う）。"""
    表 = {}
    for もの in 並び:
        日 = 履歴.get(f"{店舗['id']}/{もの['ファイル']}")
        if not 日:
            continue
        な = 鍵にする(もの)
        if な and 表.get(な, "") < 日:
            表[な] = 日
    return 表


def きょう出したもの(並び, 履歴, 店舗, 日付):
    """同じ日にすでに投稿したものを返す（ファイル名・商品名・なかま・区分ごとの数）。

    1日に2回（朝と夕方）動くので、朝に出したものが夕方にまた出ないようにする。
    """
    ファイル = set()
    商品 = set()
    なかま = {}      # ★なかまごとの「数」。1日にかならず出すなかまを数えるのに使う
    区分 = {}
    for もの in 並び:
        if 履歴.get(f"{店舗['id']}/{もの['ファイル']}") == 日付:
            ファイル.add(もの["ファイル"])
            商品.add(もの["商品名"])
            名前 = なかま名(もの)
            なかま[名前] = なかま.get(名前, 0) + 1
            名 = もの.get("区分") or ""
            if 名:
                区分[名] = 区分.get(名, 0) + 1
    return ファイル, 商品, なかま, 区分


def 選ぶ(並び, 履歴, 店舗, 日付, 枚数, かならず区分="", かならず枚数=1, なかをあける=2,
        時刻たち=None, 節=0, 定休日="", かならずなかま="", かならずなかま枚数=1):
    """その日に出す画像を選ぶ。

    ・イベントの日は、その日の画像を先に
    ・商品リストの「出す曜日」「出す時刻」に合うものだけ
    ・同じ「なかま」（ハンバーグなど）は日をまたいで散らす。
      同じ日の朝と夕方が同じなかまになるのはかまわない（商品がちがえばよい）
    ・そのうえで「長く出していない商品」から順に
    ・「かならず区分」（期間限定など）は、1日に決めた枚数を必ず出す
    ・「かならずなかま」（ハンバーグなど）は、1日に決めた枚数を必ず出す。
      朝と夕方の2回のうち、少なくともその枚数はこのなかまになる。
      両方が同じなかまでも、商品がちがえばかまわない
    ・そのあとは「長く出していないもの」から順に
    ・最近出したもの（あけたい日数のうち）は、足りないとき以外は使わない
    """
    なかまをあける日数 = max(1, int(なかをあける))
    きょうのイベント = その日のイベント(店舗, 日付)
    # ★きょう出したぶんは数えない。朝と夕方で同じなかま（ハンバーグなど）に
    #   なってもよい、というのが本人の考え。日をまたいだ散らばりだけ見る
    きのうまで = {鍵: 日 for 鍵, 日 in 履歴.items() if 日 < 日付}
    なかま最終 = 最後の日(並び, きのうまで, 店舗, なかま名)
    商品最終 = 最後の日(並び, 履歴, 店舗, lambda も: (も.get("商品名") or "").strip())

    def たった日数(表, 鍵):
        日 = 表.get(鍵)
        if not 日:
            return 99999
        return (datetime.date.fromisoformat(日付)
                - datetime.date.fromisoformat(日)).days

    def ばらつき(もの):
        """まだ一度も出していないものの並び順を、日によって変える"""
        種 = f"{日付}/{店舗['id']}/{もの['ファイル']}"
        return int(hashlib.md5(種.encode("utf-8")).hexdigest()[:8], 16)

    def 順番(もの):
        鍵 = f"{店舗['id']}/{もの['ファイル']}"
        イベント優先 = 0 if もの.get("イベント") and もの["イベント"] in きょうのイベント else 1
        # イベント用の画像は、その日以外は出さない
        よけい = 1 if もの.get("イベント") and もの["イベント"] not in きょうのイベント else 0
        # ★同じ「なかま」（アサイーボウルなど）が続かないようにする。
        #   これが無いと、写真の多いアサイーボウルばかりになる（8月に実際そうなった）。
        #   そのうえで「長く出していない商品」から順に出す
        # 「出す時刻」でこの回に決めてある商品（ハンバーグ・ランチなど）を先に。
        # そうしないと、いつでも出せる商品にその回をとられてしまう
        この回むけ = 0 if (もの.get("出す時刻") or "").strip() else 1
        なかま続き = 0 if たった日数(なかま最終, なかま名(もの)) >= なかまをあける日数 else 1
        return (よけい, イベント優先, この回むけ, なかま続き,
                -たった日数(商品最終, (もの.get("商品名") or "").strip()),
                -何日前(履歴, 鍵, 日付), ばらつき(もの))

    候補 = sorted(並び, key=順番)
    候補 = [も for も in 候補
            if not (も.get("イベント") and も["イベント"] not in きょうのイベント)]
    # 商品リストの「出す曜日」「出す時刻」で絞る。
    # 「おやすみ」の知らせは、休みの日にだけ別に出すのでここには混ぜない
    候補 = [も for も in 候補
            if (も.get("区分") or "") != "おやすみ"
            and その日に出せるか(も, 日付, 定休日)
            and その時刻に出せるか(も, 時刻たち or [], 節)]

    # 朝と夕方で2回動くので、今日もう出したものは外しておく
    済みファイル, 済み商品, 済みなかま, 済み区分 = きょう出したもの(並び, 履歴, 店舗, 日付)
    候補 = [も for も in 候補 if も["ファイル"] not in 済みファイル]

    # ★1日にかならず出すなかま（ハンバーグなど）。
    #   きょうまだ足りていなければ、そのなかまを先頭に持ってくる。
    #   これが無いと、枚数の多いなかま（アサイーボウルは42枚中23枚）に
    #   朝も夕方も取られる（2026年9月5日と7日に実際そうなった）
    なかま足りない = 0
    if かならずなかま:
        なかま足りない = max(0, int(かならずなかま枚数)
                        - 済みなかま.get(かならずなかま, 0))
        if なかま足りない:
            その仲間 = [も for も in 候補 if なかま名(も) == かならずなかま][:なかま足りない]
            # ★「出す時刻」でこの回に決めてある商品（朝だけのランチなど）は、
            #   かならず出すなかまより前に置く。ここを飛ばすと、朝しか出せない
            #   商品が永久に出なくなる（ハンバーグに朝の枠を毎日取られるため）。
            #   ハンバーグは夕方の回でも確保できるので、朝はゆずってよい
            この回むけ = [も for も in 候補
                      if (も.get("出す時刻") or "").strip() and も not in その仲間]
            のこり = [も for も in 候補
                    if も not in その仲間 and も not in この回むけ]
            候補 = この回むけ + その仲間 + のこり

    # 期間限定のポスターなど、1日にかならず出す区分。
    # 足りていなければ先頭に置き、足りていればその日はもう出さない
    if かならず区分:
        その区分 = [も for も in 候補 if (も.get("区分") or "") == かならず区分]
        ほか = [も for も in 候補 if (も.get("区分") or "") != かならず区分]
        足りない = max(0, int(かならず枚数) - 済み区分.get(かならず区分, 0))
        候補 = (その区分[:足りない] + ほか) if 足りない else ほか

    選ぶ = []
    出した商品 = set(済み商品)
    足した仲間 = 0     # この回で「かならず出すなかま」を何枚入れたか

    def 足す(もの):
        選ぶ.append(もの)
        出した商品.add(もの["商品名"])

    # 1回目：最近出したものと、同じ日に同じ商品が重なるのを避ける。
    # ★同じ「なかま」（朝も夜もハンバーグ）は、商品がちがえばかまわない
    for もの in 候補:
        if len(選ぶ) >= 枚数:
            break
        鍵 = f"{店舗['id']}/{もの['ファイル']}"
        if もの["商品名"] in 出した商品:
            continue
        仲間か = bool(かならずなかま) and なかま名(もの) == かならずなかま
        かならずのもの = (bool(かならず区分)
                    and (もの.get("区分") or "") == かならず区分)
        # ★かならず出す区分・なかまは、14日あけるの決まりから外す。
        #   外さないと出せない。ハンバーグは10枚しかないので毎日1枚出すと
        #   10日で一周し、14日の決まりに全部引っかかってしまう
        if 仲間か and 足した仲間 < なかま足りない:
            かならずのもの = True
        if not かならずのもの and 何日前(履歴, 鍵, 日付) < あけたい日数 and len(候補) > 枚数:
            continue
        足す(もの)
        if 仲間か:
            足した仲間 += 1

    # 2回目：それでも足りなければ、なかまの重なりは許して埋める
    for もの in 候補:
        if len(選ぶ) >= 枚数:
            break
        if もの not in 選ぶ and もの["商品名"] not in 出した商品:
            足す(もの)

    # 3回目：商品が少ない店舗のときは、重なりも許して埋める
    for もの in 候補:
        if len(選ぶ) >= 枚数:
            break
        if もの not in 選ぶ:
            足す(もの)
    return 選ぶ


def のぞく(url):
    """GETで確かめる（投稿はしない）。"""
    try:
        with urllib.request.urlopen(url, timeout=30) as 返事:
            return json.loads(返事.read().decode("utf-8")), None
    except urllib.error.HTTPError as e:
        return None, e.read().decode("utf-8", "ignore")[:400]
    except Exception as e:
        return None, str(e)


def つながりを確かめる(ig_id, トークン):
    """そのIDとトークンで、本当にそのInstagramが見えるか確かめる。"""
    url = (f"{API}/{ig_id}?fields=username,name&access_token="
           + urllib.parse.quote(トークン))
    出来, しくじり = のぞく(url)
    if 出来:
        名 = 出来.get("username") or 出来.get("name") or ig_id
        return f"つながりました（@{名}）"
    return f"つながりません → {しくじり}"


def たたく(url, データ):
    体 = urllib.parse.urlencode(データ).encode("utf-8")
    お願い = urllib.request.Request(url, data=体, method="POST")
    try:
        with urllib.request.urlopen(お願い, timeout=60) as 返事:
            return json.loads(返事.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        中身 = e.read().decode("utf-8", "ignore")
        raise SystemExit(f"Instagramが受け付けませんでした（{e.code}）\n{中身}")


def 投稿する(ig_id, トークン, 画像URL):
    """コンテナを作って、公開する（2段階）。"""
    出来 = たたく(f"{API}/{ig_id}/media", {
        "image_url": 画像URL,
        "media_type": "STORIES",
        "access_token": トークン,
    })
    容器 = 出来.get("id")
    if not 容器:
        raise SystemExit(f"コンテナが作れませんでした: {出来}")

    # 画像の取り込みに少し時間がかかることがあるので、少し待って公開する
    最後 = None
    for 回 in range(5):
        time.sleep(3 if 回 else 1)
        try:
            結果 = たたく(f"{API}/{ig_id}/media_publish", {
                "creation_id": 容器,
                "access_token": トークン,
            })
            return 結果.get("id")
        except SystemExit as e:
            最後 = e
    raise 最後


def main():
    p = argparse.ArgumentParser(description="その日の分をInstagramのストーリーズに投稿します。")
    p.add_argument("--試す", dest="dry", action="store_true", help="投稿せず、何を出すかだけ見る")
    p.add_argument("--日付", dest="date", default=None, help="YYYY-MM-DD（既定は今日）")
    p.add_argument("--枚数", dest="count", type=int, default=None,
                   help="この回に出す枚数（既定は、その時刻までに出ているべき枚数から足りないぶん）")
    p.add_argument("--時刻", dest="time", default=None,
                   help="HH:MM（既定はいまの日本時間）。試すときに使う")
    引数 = p.parse_args()

    # ★日付も日本時間で決める。GitHubの機械はUTCなので、そのままだと
    #   日本の深夜（UTCの昼すぎ）に「きのうの日付」で数えてしまう
    日付 = 引数.date or datetime.datetime.now(日本).date().isoformat()
    設定 = 読む(設定の場所)
    一覧 = 読む(一覧の場所, {"店舗": {}})
    履歴 = 読む(履歴の場所, {})
    共通トークン = os.environ.get("IG_ACCESS_TOKEN", "").strip()
    もと = (設定.get("共通", {}).get("公開の場所") or "").rstrip("/")
    共通 = 設定.get("共通", {})
    いま = 引数.time or datetime.datetime.now(日本).strftime("%H:%M")
    # その時刻までに出ているべき枚数。足りないぶんだけ出す
    目標 = いまの目標枚数(共通, いま)
    時刻たち = sorted(str(t).strip() for t in (共通.get("投稿する時刻") or []) if str(t).strip())
    節 = max(0, sum(1 for t in 時刻たち if t <= いま) - 1)
    店舗情報 = 一覧.get("店舗情報", {})
    きょう休み = 休みの店(os.environ.get("CLOSED_TODAY", ""))
    # 期間限定のポスターなど、1日にかならず出す区分（設定.json の共通）
    かならず区分 = (共通.get("毎日かならず出す区分") or "").strip()
    かならず枚数 = int(共通.get("毎日かならず出す枚数", 1) or 1)
    # 同じなかま（アサイーボウルなど）を何日あけるか
    なかまをあける = int(共通.get("なかまをあける日数", 2) or 2)
    # 1日にかならず出すなかま（バグるのハンバーグなど）。店舗ごとに上書きできます
    かならずなかま = (共通.get("毎日かならず出すなかま") or "").strip()
    かならずなかま枚数 = int(共通.get("毎日かならず出すなかまの枚数", 1) or 1)

    if not もと:
        raise SystemExit("設定.json の共通に「公開の場所」（公開URL）を書いてください")

    出した = 0
    用意できている = False
    もう出ている = False
    for 店舗 in 設定.get("店舗", []):
        大文字 = 店舗["id"].upper()
        鍵 = f"IG_USER_ID_{大文字}"
        ig_id = os.environ.get(鍵, "").strip()
        トークン = os.environ.get(f"IG_TOKEN_{大文字}", "").strip() or 共通トークン
        並び = 一覧.get("店舗", {}).get(店舗["id"], [])

        print(f"\n■ {店舗['名前']}")
        # ★店舗ごとの入り切り。story/設定.json でその店舗に
        #   "自動投稿": false と書いておくと、ここで止まります。
        #   トークンを消さずに休められるので、また出すときは true に戻すだけです
        if 店舗.get("自動投稿") is False:
            print("  自動投稿はいまお休みです（story/設定.json の「自動投稿」）")
            continue
        if not 並び:
            print("  画像がありません（先に画像を作って公開してください）")
            continue
        if not ig_id:
            print(f"  {鍵} が無いので飛ばします")
            continue
        用意できている = True

        if 引数.dry and トークン:
            print(f"  {つながりを確かめる(ig_id, トークン)}")

        済みファイル = きょう出したもの(並び, 履歴, 店舗, 日付)[0]

        # ---- きょうが休みの日なら、知らせを1枚だけ出して終わり ----
        休み種類 = きょうの休み(店舗, 日付, 店舗情報, きょう休み)
        if 休み種類:
            if 目標 <= 0:
                print(f"  {いま} は、まだ投稿する時刻ではありません")
                continue
            if 節 != 0:
                # 休みの日は朝の1枚だけ。夕方は何も出さない（本人の指示）
                print(f"  きょうは休み（{休み種類}）なので、夕方は出しません")
                もう出ている = True
                continue
            if 済みファイル:
                print(f"  きょうは「{休み種類}」の知らせを出しています")
                もう出ている = True
                continue
            もの = 休みの画像(並び, 休み種類)
            if not もの:
                print(f"  「{休み種類}」の画像がありません（つくる.py で作ってください）")
                continue
            道 = f"story/できあがり/{店舗['id']}/{もの['ファイル']}"
            画像URL = もと + "/" + urllib.parse.quote(道)
            print(f"  {もの['商品名']}（{休み種類}）")
            print(f"    {画像URL}")
            if 引数.dry:
                continue
            if not トークン:
                raise SystemExit(f"IG_TOKEN_{大文字}（またはIG_ACCESS_TOKEN）がありません")
            投稿id = 投稿する(ig_id, トークン, 画像URL)
            履歴[f"{店舗['id']}/{もの['ファイル']}"] = 日付
            出した += 1
            print(f"    投稿しました（{投稿id}）")
            continue

        枚数 = 引数.count if 引数.count is not None else max(0, 目標 - len(済みファイル))
        if 枚数 <= 0:
            if 目標 <= 0:
                print(f"  {いま} は、まだ投稿する時刻ではありません")
            else:
                もう出ている = True
                print(f"  {いま} の分は、もう出しています（きょう {len(済みファイル)}枚）")
            continue

        定休日 = (店舗情報.get(店舗["id"], {}).get("定休日") or "")
        この店のなかま = (店舗.get("毎日かならず出すなかま", かならずなかま) or "").strip()
        この店の枚数 = int(店舗.get("毎日かならず出すなかまの枚数",
                                かならずなかま枚数) or 1)
        for もの in 選ぶ(並び, 履歴, 店舗, 日付, 枚数, かならず区分, かならず枚数,
                       なかまをあける, 時刻たち, 節, 定休日,
                       この店のなかま, この店の枚数):
            道 = f"story/できあがり/{店舗['id']}/{もの['ファイル']}"
            画像URL = もと + "/" + urllib.parse.quote(道)
            しるし = f"・{もの['イベント']}" if もの.get("イベント") else ""
            if もの.get("区分"):
                しるし = f"・{もの['区分']}" + しるし
            print(f"  {もの['商品名']}（{もの['デザイン']}{しるし}）")
            print(f"    {画像URL}")

            if 引数.dry:
                continue
            if not トークン:
                raise SystemExit(f"IG_TOKEN_{大文字}（またはIG_ACCESS_TOKEN）がありません")
            投稿id = 投稿する(ig_id, トークン, 画像URL)
            履歴[f"{店舗['id']}/{もの['ファイル']}"] = 日付
            出した += 1
            print(f"    投稿しました（{投稿id}）")

    if 引数.dry:
        print("\n（--試す なので、投稿はしていません）")
        return
    if 出した:
        書く(履歴の場所, 履歴)
        print(f"\n{日付} に {出した}枚 投稿しました")
        return

    if not 用意できている:
        # まだ Secrets を入れていないだけ。毎日エラーを出さないよう、これは失敗にしない
        print("\nまだ投稿の設定ができていません（自動投稿/はじめかた.md を見てください）")
        return

    if 目標 <= 0:
        print(f"\n{いま} は、まだ投稿する時刻ではありません")
        return

    if もう出ている:
        # 追いつくために何回も動かしているので、ここに来るのがふつう。失敗にしない
        print(f"\n{日付} のぶんは、もう出ています")
        return

    print("\n投稿できるものがありませんでした")
    sys.exit(1)


if __name__ == "__main__":
    main()
