# 🎮 とみよこゲームランド

ようちゃん・こうちゃん・としおが作ったゲームを集めて公開するサイトです。
ブラウザだけで遊べます（インストール不要）。

## 🌐 公開ページ

GitHub Pages で公開しています：

**https://shoulang0729.github.io/kids-game/**

（GitHub Pages を有効にすると、上のURLで遊べるようになります。手順は下の「公開のしかた」を見てください。）

## 🕹️ ゲーム一覧

| ゲーム | せつめい | 作った人 | フォルダ |
|--------|----------|----------|----------|
| ☠️ 地獄基地防衛 | 基地をつくって、せめてくるてきからコアをまもる | こうちゃん | `games/base-defense/` |
| 🐍 へびゲーム | りんごを食べてへびをのばす。かべと自分に注意 | としお | `games/snake/` |
| ⚔️ ようちゃんバトル | ストーリー・無限・防衛モードのRPGバトル | ようちゃん | `games/youchan-battle/` |
| 🌌 惑星ぶっこわし3D | 惑星をタッチして破壊。お金で強い攻撃を解放する | - | `games/planet-smash/` |

## 📁 リポジトリ構成

```
kids-game/
├── index.html              ← 入り口ページ（ゲーム一覧）
├── games/
│   ├── base-defense/
│   │   └── index.html      ← 地獄基地防衛（こうちゃん）
│   ├── snake/
│   │   └── index.html      ← へびゲーム（としお）
│   ├── youchan-battle/
│   │   └── index.html      ← ようちゃんバトル（ようちゃん）
│   └── planet-smash/
│       └── index.html      ← 惑星ぶっこわし3D
├── wiki/
│   └── index.html          ← せつめいしょ
└── README.md
```

- ルートの `index.html` がトップの「入り口ページ」です。
- ゲームは1つずつ `games/<ゲーム名>/` フォルダに入れます。

## ➕ あたらしいゲームのふやしかた

1. `games/` の中にあたらしいフォルダを作る（例：`games/maze/`）
2. その中に `index.html` を置く
3. ルートの `index.html` の `games` リストに1ブロック追加する：

   ```js
   {
     title: "めいろ",
     emoji: "🌀",
     desc: "ゴールをめざそう！",
     url: "games/maze/index.html",
     ready: true
   }
   ```

これだけで入り口ページに新しいゲームのカードが出ます。

## 🚀 公開のしかた（GitHub Pages）

1. GitHub のこのリポジトリを開く
2. **Settings** → **Pages** を開く
3. **Build and deployment** の **Source** を **Deploy from a branch** にする
4. **Branch** を `main`（公開したいブランチ）、フォルダを `/ (root)` にして **Save**
5. 少し待つと `https://shoulang0729.github.io/kids-game/` で公開されます
