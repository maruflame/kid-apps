#!/bin/sh
# キラの テストを macOS の JavaScriptCore で うごかす：sh suuji-mori/tests/run.sh
# アプリと おなじ じゅんばんで ぜんぶ読むので、名前の かぶり（const の二重定義）も ここで わかる
cd "$(dirname "$0")/.." || exit 1
exec /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc \
  data.js kira-config.js kira.js lines.js glyphs.js nurie.js tests/kira.test.js
