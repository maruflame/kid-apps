#!/bin/bash
# main ブランチ上のファイル編集をブロックする（worktree の別ブランチは許可）
file_path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
[ -z "$file_path" ] && exit 0

dir=$(dirname "$file_path")
while [ ! -d "$dir" ]; do dir=$(dirname "$dir"); done

branch=$(git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
if [ "$branch" = "main" ]; then
  echo "main ブランチ上では編集できません。/parallel-branch でブランチ（worktree）を作成してから作業してください。" >&2
  exit 2
fi
exit 0
