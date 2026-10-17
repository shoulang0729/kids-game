# 🎮 とみよこゲームランド

ようちゃん・こうちゃん・としくんが作ったゲームを集めて公開するサイトです。
ブラウザだけで遊べます（インストール不要）。

## 🌐 公開ページ

GitHub Pages で公開しています：

**https://shoulang0729.github.io/kids-game/**

遊び方は [せつめいしょ](https://shoulang0729.github.io/kids-game/wiki/) を見てください。

## 🕹️ ゲーム一覧

公開トップページと同じ11件を、同じ順番で掲載しています（接続テスト用デモを含む）。

| ゲーム | せつめい | 作った人 | フォルダ |
|--------|----------|----------|----------|
| ☠️ 地獄基地防衛 | 基地をつくって、せめてくるてきからコアをまもる | こうちゃん | `games/base-defense/` |
| 🐍 へびゲーム | りんごを食べてへびをのばす。かべと自分に注意 | としくん | `games/snake/` |
| ⚔️ ようちゃんバトル | ストーリー・無限・防衛モードのRPGバトル | ようちゃん | `games/youchan-battle/` |
| 🌌 惑星ぶっこわし3D | 惑星をタッチして破壊。お金で強い攻撃を解放する | ようちゃん | `games/planet-smash/` |
| 🍳 料理ゲーム | ミッションの料理を作る。食材の調理・ショップ・図鑑・実績 | こうちゃん | `games/cooking/` |
| 🐲 スネークバトル | 最大4人とCPUで対戦。顔やステージも自分で描ける | こうちゃん | `games/snake-battle/` |
| 🌐 スネークバトルオンライン | 同じ合言葉でオンライン対戦。CPUを含めて10匹でバトル | こうちゃん＆としくん | `games/snake-battle-online/` |
| 🧪 オンラインちびデモ | 同じ合言葉で入り、別の端末と四角を動かす接続テスト | — | `games/online-demo/` |
| 🌌 カオス世界大崩壊 ULTRA X INFINITE | 20形態に進化するサバイバルバトル。ブラックホール・ドローン・巨大戦艦で生き残る | ようちゃん | `games/chaos-ultra-x/` |
| 🕹️ こうちゃんの3Dゲームセンター | 全37種類のクレーン・スポーツ・ビデオゲームを一人称3Dで遊ぶ | こうちゃん | `games/kochan-3d-arcade/` |
| 🎯 丸をタップ！ | 20秒で丸をタップ。最高記録を保存 | ようちゃん | `games/tap-circle/` |

- 3Dゲームセンターの遊び方：左下のスティックで歩く、画面をスライドして見回す、⚡長押しでダッシュ。
  クレーンやビデオゲームは台のボタン、立体スポーツはコース・ボール・的に直接タッチして遊びます。
  景品・最高記録は使っているブラウザに保存されます。別のサイトや端末の保存とは共有されません。

## 📁 リポジトリ構成

```
kids-game/
├── index.html                         ← 入り口ページ（ゲーム一覧）
├── games/
│   ├── base-defense/index.html        ← 地獄基地防衛
│   ├── snake/index.html               ← へびゲーム
│   ├── youchan-battle/index.html      ← ようちゃんバトル
│   ├── planet-smash/index.html        ← 惑星ぶっこわし3D
│   ├── cooking/index.html             ← 料理ゲーム
│   ├── snake-battle/index.html        ← スネークバトル
│   ├── snake-battle-online/index.html ← スネークバトルオンライン
│   ├── online-demo/index.html         ← オンラインちびデモ
│   ├── chaos-ultra-x/index.html       ← カオス世界大崩壊
│   ├── kochan-3d-arcade/index.html     ← 3Dゲームセンター
│   └── tap-circle/index.html          ← 丸をタップ！
├── wiki/index.html                    ← せつめいしょ
├── assets/                            ← アイコン画像
├── online-server/                     ← オンライン対戦サーバー
├── tests/kochan-3d-arcade/             ← 3Dゲームセンターの確認スクリプト
├── .github/workflows/
│   └── deploy-online-server.yml       ← オンラインサーバーの自動公開
├── CONTRIBUTING.md                    ← 修正・追加・PRのルール
└── README.md
```

- ルートの `index.html` がトップの「入り口ページ」です。
- ゲームは1つずつ `games/<ゲーム名>/` フォルダに入れます。
- オンライン対戦は別のサーバー（`online-server/`）も使います。静的ページの公開とサーバーの公開は別です。

## ➕ あたらしいゲームのふやしかた

作業は新しいブランチで行い、PRを作成します。詳しくは [CONTRIBUTING.md](CONTRIBUTING.md) を見てください。

1. `games/` の中にあたらしいフォルダを作る（例：`games/maze/`）
2. その中に `index.html` を置く
3. ルートの `index.html` の `games` リストに1ブロック追加する。前後の項目をカンマ（`,`）で区切る：

   ```js
   {
     title: "めいろ",
     emoji: "🌀",
     desc: "ゴールをめざそう！",
     url: "games/maze/index.html",
     ready: true
   }
   ```

4. このREADMEのゲーム一覧・フォルダ構成と、`wiki/index.html` の遊び方を更新する。
5. ブラウザでスマホ・PCの表示とリンクを確認し、PRを作成する。

PRを `main` にマージすると、公開処理のあとに入り口ページへ反映されます。

## 🚀 公開のしかた（GitHub Pages）

1. GitHub のこのリポジトリを開く
2. **Settings** → **Pages** を開く
3. **Build and deployment** の **Source** を **Deploy from a branch** にする
4. **Branch** を `main`（公開したいブランチ）、フォルダを `/ (root)` にして **Save**
5. 少し待つと `https://shoulang0729.github.io/kids-game/` で公開されます


## 🧪 3Dゲームセンターの確認

Node.js があれば、リポジトリのルートで次を実行できます（追加ライブラリ不要）。

```sh
node tests/kochan-3d-arcade/fields.cjs
node tests/kochan-3d-arcade/videogames.cjs
node tests/kochan-3d-arcade/regression.cjs
```

公開する単体HTMLからスクリプトを取り出して、全37種類、景品のつかみ位置、無限生成・保存、スポーツの直接タッチ、キャンセル、再プレイをシミュレーションします。実際のWebGL描画やiPadでの操作感は別途実機で確認してください。
