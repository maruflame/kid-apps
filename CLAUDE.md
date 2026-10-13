# kid-apps 開発ルール

## ブランチ運用

- コードを生成・変更するときは、必ず main 以外のブランチを作成してから作業する。main で直接コードを書かない。
- ブランチの作成は `/parallel-branch` スキルで行う（git worktree で作業フォルダを分ける）。その worktree 内でコードを生成する。
- コミット・main への取り込み・マージ・後片付けも `/parallel-branch` の手順に従う。
