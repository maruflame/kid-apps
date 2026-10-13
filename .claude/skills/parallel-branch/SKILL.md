---
name: parallel-branch
description: git worktree でブランチごとに作業フォルダを分け、VSCode の別ウィンドウで並行開発する。worktree の作成・VSCode で開く・ブランチのコミットと push・main の取り込みとコンフリクト解消・main へのマージ・後片付け・main の push を行う。「並行で開発」「別ブランチで同時に」「worktree を作って」「ブランチを push」「マージして」「コンフリクトを解消して」「worktree を片付けて」などで使う。
argument-hint: "new <branch> | push <branch> | sync <branch> | finish <branch>"
---

# parallel-branch

1つのフォルダでチェックアウトできるブランチは1つだけ。同じフォルダで複数の Claude セッションを動かすと同じブランチ・同じファイルを編集してしまうので、ブランチを分けて並行開発するときは必ず git worktree で作業フォルダを分ける。

引数: `$ARGUMENTS`

- `new <branch>` → 「作成＋VSCode で開く」
- `push <branch>` → 「worktree でコミット＋ブランチを push」
- `sync <branch>` → 「main の新しいコミットをブランチに取り込み、コンフリクトを worktree で解消」
- `finish <branch>` → 「（必要なら sync）→ main へマージ → 後片付け → 確認のうえ main を push」
- 引数なし → `git worktree list` を表示し、どれをするか（とブランチ名を）ユーザーに聞く

ブランチ名から worktree のパスを探すときは `git worktree list` を使う。以下 `<wt>` は worktree のパス、`<main-dir>` はメインの作業フォルダ（`git worktree list` の1行目）、`<base>` はそのブランチ（通常は main）。

## new <branch>: 作成＋VSCode で開く

1. `git rev-parse --show-toplevel` でリポジトリのルートを取得し、そのフォルダ名を `<repo>` とする。
2. ブランチ名が指定されていなければユーザーに聞く。
3. `git status --porcelain` で未コミットの変更があれば、「未コミットの変更は新しい worktree には引き継がれません（HEAD から作成します）」と一言伝えてから続ける。
4. 作業フォルダのパスを `<ルートの親>/<repo>-<branch の / を - に置換>` にする。
   例: `kid-apps` で `feature/hiragana` → `../kid-apps-feature-hiragana`
   既にそのパスが存在する場合は止めて報告する。
5. worktree を作る:
   - ブランチが既にある（`git show-ref --verify --quiet refs/heads/<branch>` が成功）→ `git worktree add <path> <branch>`
   - 新規 → `git worktree add <path> -b <branch>`（現在の HEAD から作成）
6. このセッションでそのまま実装まで頼まれている場合は、VSCode は開かずに `<wt>` の中のファイルを絶対パスで編集して作業する。
   そうでなければ `code <path>` で新しい VSCode ウィンドウを開く（`code` が無ければパスを伝えて「File > Open Folder で開いてください」と案内）し、「新しいウィンドウで Claude を開いて作業してください。終わったら `/parallel-branch finish <branch>` を実行してください」と案内する。

## push <branch>: コミット＋ブランチを push

1. `git -C <wt> status --short` と `git -C <wt> diff --stat` で変更内容を確認する。
2. 変更をステージしてコミットする（このスキルを呼ばれたこと自体がコミットの依頼）。
   - 関係ないファイル（`.DS_Store` など）は含めない。`git add -A` はリポジトリ全体ではなく対象のディレクトリに限る。
   - メッセージは変更の要約。会話で指定されたコミットの署名（Co-Authored-By など）があれば付ける。
3. `git -C <wt> push -u origin <branch>`。push 結果に出る PR 作成 URL をユーザーに伝える。
4. `<base>` に push はしない。

## sync <branch>: main をブランチに取り込んでコンフリクト解消

`<base>` がブランチ作成後に進んでいるとき、main 側でいきなりマージせず、まず worktree で解消してテストしてからにする（main を壊さない／main 側の未コミット作業を待たずに進められる）。

1. `git -C <wt> status --porcelain` が空であることを確認（未コミットがあれば先に push の手順でコミットするか聞く）。
2. `git log <branch>..<base> --oneline` で取り込むコミットを確認し、`git show --stat` でその規模と内容（どんな仕組みに変わったか）を把握する。
3. `git -C <wt> merge --no-ff <base> -m "Merge <base> into <branch>"`。
4. コンフリクトしたら:
   - `git diff --name-only --diff-filter=U` と各ハンクを見て、**両方の変更の意図を残す**形で解消する。片方を捨てない。
   - `<base>` 側でリファクタリング（関数・表への集約など）が入っていたら、ブランチ側の新しいコードをその新しい仕組みに合わせて書き直す。
   - **自動生成ファイル**（一覧ファイル・ロックファイル・ビルド成果物など）は手で直さない。どちらか一方を `git checkout --ours/--theirs` で取り、元になるファイルを解消したあとに生成スクリプトで作り直す（例: `npm install`、プロジェクトの生成スクリプト）。生成に外部ツールが要る場合は動いているか確認し、無ければユーザーに伝える。
   - 解消後に `grep -n '^<<<<<<<\|^=======$\|^>>>>>>>'` でマーカーが残っていないか確認する。
   - 自信を持って解消できないハンク（仕様の判断が要るもの）だけはユーザーに相談する。
5. 動作確認する（テスト、またはアプリを起動して該当機能と `<base>` 側の新機能の両方を触る）。
6. `git -C <wt> add <対象>` → `git -C <wt> commit --no-edit`（マージコミット）。

## finish <branch>: マージ＋後片付け＋push

1. `git worktree list` で `<wt>`・`<main-dir>`・`<base>` を特定する。対象の worktree が見つからなければ報告して止める。
2. `git -C <wt> status --porcelain` に未コミットがあれば止めて報告する（push の手順でコミットするか聞く）。
3. `<base>` がブランチより進んでいて（`git log <branch>..<base>` が空でない）コンフリクトしそうなら、先に **sync** の手順を行う。
4. `<main-dir>` に未コミットの変更があれば止めて報告する。それが別セッションの進行中の作業かもしれないので、勝手にコミット・stash しない。選択肢（その作業を先にコミットしてもらう／stash／待つ）を示して聞く。
   ユーザーが「解決した」と言ったら `git status` で本当にきれいになったか確かめてから進む。
5. `git log <base>..<branch> --oneline` を見せ、マージしてよいか確認を取る（ユーザーが既に「マージして」と頼んでいれば確認は不要）。コミットが無ければその旨を伝え、worktree の削除だけするか聞く。
6. `<main-dir>` で `git merge --no-ff <branch>`。
   待っている間に `<base>` がさらに進んでいてコンフリクトしたら、`git merge --abort` はせず、sync と同じ方針（両方残す・生成ファイルは作り直す・動作確認）で `<main-dir>` 上で解消し、`git commit --no-edit`。
7. マージに成功したら `git -C <wt> status --porcelain` が空であることを確認して `git worktree remove <wt>`。他の worktree には触らない。
8. ブランチを削除するか聞く。了承されたら:
   - リモートにブランチがある（`git ls-remote --heads origin <branch>`）なら `git push origin --delete <branch>` を**先に**行う。リモート側が古いままだと `git branch -d` が「not fully merged」で失敗するため。
   - そのあと `git branch -d <branch>`。それでも失敗したら `-D` は使わず、`git log <base>..<branch>` で本当に取り込まれているか確認して報告する。
9. `<base>` を push するか聞き、了承されたら `git push origin <base>`。結果（`old..new` のハッシュ）を伝える。GitHub Pages などで公開しているなら反映に少し時間がかかると添える。

## 動作確認のヒント

- ブラウザで確認するときは worktree のフォルダをローカルサーバで配信する（`file://` は開けないことがある）。HTML に `<meta charset>` が無いと文字化けしてスクリプトが壊れるので、サーバ側で `text/html; charset=utf-8` を返す:
  `python3 -c "import http.server as h
class H(h.SimpleHTTPRequestHandler): extensions_map={**h.SimpleHTTPRequestHandler.extensions_map,'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8'}
h.ThreadingHTTPServer(('127.0.0.1',8765),H).serve_forever()"`（バックグラウンドで起動し、終わったら止める）
- worktree は HEAD から作られるので、main の未コミットの修正（CSS の修正など）は入っていない。その差で見た目がおかしいときは、自分の変更のせいか切り分けてからユーザーに伝える。

## 禁止事項

- `git worktree remove --force`、`git branch -D`、`git reset --hard`、`git push --force` は使わない。必要そうな場面ではユーザーに状況を説明して判断を仰ぐ。
- ユーザー（や別セッション）の未コミットの変更を勝手にコミット・stash・破棄しない。
- `<base>` への push はユーザーが頼んだときだけ。
