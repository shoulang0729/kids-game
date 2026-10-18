# 🎮 とみよこゲームランド

ようちゃん・こうちゃん・としくんが作ったゲームを集めて公開するサイトです。
ブラウザだけで遊べます（インストール不要）。

## 🌐 公開ページ

GitHub Pages で公開しています：

**https://shoulang0729.github.io/kids-game/**

遊び方は [せつめいしょ](https://shoulang0729.github.io/kids-game/wiki/) を見てください。

## 🕹️ ゲーム一覧

<!-- BEGIN GENERATED: catalog -->
公開トップページと同じ11件を、同じ順番で掲載しています（接続テスト用デモを含む）。

| ゲーム | せつめい | 作った人 | フォルダ |
|--------|----------|----------|----------|
| ☠️ 地獄基地防衛 | 基地をつくって、せめてくるてきからコアをまもれ！ | こうちゃん | `games/base-defense/` |
| 🐍 へびゲーム | りんごを食べてへびをのばそう！かべと自分に気をつけて | としくん | `games/snake/` |
| ⚔️ ようちゃんバトル | ストーリー・無限・防衛モードのRPGバトル！武器を強くして魔王をたおせ | ようちゃん | `games/youchan-battle/` |
| 🌌 惑星ぶっこわし3D | 惑星をタッチしてこわそう！お金をためて強い攻撃を解放。地球から宇宙皇帝まで18ステージ | ようちゃん | `games/planet-smash/` |
| 🍳 料理ゲーム | ミッションの料理を作ろう！食材を切ったり焼いたり。ショップ・図鑑・実績つき | こうちゃん | `games/cooking/` |
| 🐲 スネークバトル | 最大4人＆CPUと対戦するスネーク！顔やステージも自分で描ける本格バトル | こうちゃん | `games/snake-battle/` |
| 🌐 スネークバトルオンライン | 合言葉で友だちとオンライン対戦！CPUもまざって10匹でバトル。アイテムで逆転をねらえ | こうちゃん&としくん | `games/snake-battle-online/` |
| 🧪 オンラインちびデモ | オンラインのテスト！同じ合言葉を入れて、べつの端末と四角をいっしょに動かそう | — | `games/online-demo/` |
| 🌌 カオス世界大崩壊 ULTRA X INFINITE | 20形態に進化！ブラックホール・トリプルボス・無限ドローン・巨大戦艦で生き残れ！ | ようちゃん | `games/chaos-ultra-x/` |
| 🕹️ こうちゃんの3Dゲームセンター | 店内を歩いて全37種類！クレーン・ゴルフ・バスケ・レースなど。スポーツは直接タッチして遊べる | こうちゃん | `games/kochan-3d-arcade/` |
| 🎯 丸をタップ！ | 出てくる丸をタップ！20秒で何点とれるかな？最高記録に挑戦しよう | ようちゃん | `games/tap-circle/` |
<!-- END GENERATED: catalog -->

- 3Dゲームセンターの遊び方：左下のスティックで歩く、画面をスライドして見回す、⚡長押しでダッシュ。
  クレーンやビデオゲームは台のボタン、立体スポーツはコース・ボール・的に直接タッチして遊びます。
  景品・最高記録は使っているブラウザに保存されます。別のサイトや端末の保存とは共有されません。

## 📁 リポジトリ構成

<!-- BEGIN GENERATED: tree -->
```
kids-game/
├── index.html ← 入り口ページ（生成）
├── games/
│   ├── base-defense/index.html ← 地獄基地防衛
│   ├── snake/index.html ← へびゲーム
│   ├── youchan-battle/index.html ← ようちゃんバトル
│   ├── planet-smash/index.html ← 惑星ぶっこわし3D
│   ├── cooking/index.html ← 料理ゲーム
│   ├── snake-battle/index.html ← スネークバトル
│   ├── snake-battle-online/index.html ← スネークバトルオンライン
│   ├── online-demo/index.html ← オンラインちびデモ
│   ├── chaos-ultra-x/index.html ← カオス世界大崩壊 ULTRA X INFINITE
│   ├── kochan-3d-arcade/index.html ← こうちゃんの3Dゲームセンター
│   └── tap-circle/index.html ← 丸をタップ！
├── data/games.json ← ゲーム情報の正本
├── wiki/index.html ← せつめいしょ（目次を生成）
├── assets/ ← アイコン画像
├── online-server/ ← オンライン対戦サーバー
├── scripts/ ← 生成・整合性検査
├── tests/ ← ブラウザ・ゲームの回帰テスト
├── docs/refactoring.md ← 段階的な整理の計画
├── .github/workflows/ ← PR検査・オンラインサーバーの公開
├── package.json ← 開発用コマンド
├── CONTRIBUTING.md ← 修正・追加・PRのルール
└── README.md
```
<!-- END GENERATED: tree -->

- ルートの `index.html` がトップの「入り口ページ」です。
- ゲームは1つずつ `games/<ゲーム名>/` フォルダに入れます。画面のHTML・見た目のCSS・処理のJSを同じフォルダに置きます。
- タイトル・作者・説明・掲載順は `data/games.json` で管理します。配信時のビルドは不要です。
- オンライン対戦は別のサーバー（`online-server/`）も使います。静的ページの公開とサーバーの公開は別です。

## ➕ あたらしいゲームのふやしかた

作業は新しいブランチで行い、PRを作成します。詳しくは [CONTRIBUTING.md](CONTRIBUTING.md) を見てください。

1. `games/<ゲーム名>/` に `index.html`・`style.css`・`game.js` を用意する。
2. `data/games.json` にタイトル・絵文字・説明・作者・説明書のセクションIDを追加する。
3. `wiki/index.html` に遊び方を追加する。接続テスト用デモなど説明書を省く場合は、`manual: null` と `manualNote` に理由を書く。
4. `npm run generate` でトップページ・README・説明書の目次を更新する。`GENERATED` で囲まれた範囲は直接編集しない。
5. `npm test` を実行し、PRを作成する。新しいゲームには `tests/browser/run.cjs` に操作シナリオも追加する。

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

公開HTMLが実際に読み込むJavaScriptを使って、全37種類、景品のつかみ位置、無限生成・保存、スポーツの直接タッチ、キャンセル、再プレイをシミュレーションします。実際のWebGL描画やiPadでの操作感は別途実機で確認してください。

## 🧪 サイト全体の確認

初回は Node.js 22 以降で次を実行します。

```sh
npm ci
npx playwright install chromium
npm test
```

LinuxでブラウザのOS依存ライブラリがない場合は `npx playwright install --with-deps chromium` を使います。既存のChromiumを使う場合は `CHROMIUM_PATH=/path/to/chromium npm run test:browser` でも実行できます。

- `npm run generate`: 一覧・README・説明書の目次を生成
- `npm run check`: 生成漏れ、JavaScript構文、ゲーム登録漏れ、リンク・アンカー切れ、ID重複を検査
- `npm run test:arcade`: 3Dゲームセンターの既存の詳細テスト
- `npm run test:browser`: 全ゲームの起動・代表操作をスマホ幅390pxとPC幅1280pxで確認

PRでは高速な整合性検査が通った後にブラウザ検査が実行されます。オンライン2作品はWebSocket応答をテスト側で再現し、実サーバーへ接続せず入退室を確認します。実端末の操作感、全ステージ、実際の複数端末間通信を網羅するものではありません。

段階的な整理の進め方は [リファクタリング計画](docs/refactoring.md) を見てください。
