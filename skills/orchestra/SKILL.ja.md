---
name: orchestra
description: Claude Orchestraの操作 — コーディング中のBGM。音楽、BGM、オーケストラ、開始、停止、音量に関するリクエストで使用。
---

# Claude Orchestra

コーディング中のBGMを制御するスキルです。各セッションが楽器になり、ツール呼び出しが音楽を駆動します。

## クイックリファレンス

| ユーザーの発言               | アクション                         |
| ---------------------------- | ---------------------------------- |
| 「音楽流して」「bgm on」     | 依存チェック → 確認 → セットアップ |
| 「音楽止めて」「quiet」      | コンダクター停止                   |
| 「曲変えて」                 | トラック切替                       |
| 「音量上げて」「音量下げて」 | ボリューム調整                     |
| 「何流れてる？」             | ステータス表示                     |

## セットアップ

### Step 1: 依存関係とステータスを確認

```bash
npx claude-orchestra status 2>&1
```

```bash
echo "=== 依存関係チェック ==="
for cmd in ffmpeg ffplay sox fluidsynth; do
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "✓ $cmd: $(command -v $cmd)"
  else
    echo "✗ $cmd: 未インストール"
  fi
done
TRACK_COUNT=$(ls ~/.claude-orchestra/tracks/*/manifest.json 2>/dev/null | wc -l | tr -d ' ')
echo "=== 準備済みトラック: $TRACK_COUNT ==="
```

### Step 2: 結果を報告し、確認を取る

**ルール:**

- **インストール前に必ずユーザーの確認を取る**
- 各依存関係の用途を説明する
- synth モード（依存なし、ffmpeg のみ）を代替手段として提示
- Linux では `apt install` を提案

### Step 3: セットアップ実行（ユーザー承認後）

全ての必須依存関係がある場合、自動セットアップを実行:

```bash
npx claude-orchestra setup
```

このコマンドは以下を自動実行:

- 依存関係チェック
- サウンドフォント取得（MIDI レンダリング用）
- デフォルトトラック（第九）を MIDI からレンダリング
- mixer モード設定 + conductor daemon 起動

依存関係が足りない場合:

```bash
# macOS
brew install ffmpeg sox fluid-synth

# その後セットアップ
npx claude-orchestra setup
```

### Step 4: 動作確認

```bash
npx claude-orchestra status
```

## 操作コマンド

```bash
npx claude-orchestra status              # 状態確認
npx claude-orchestra stop                # 停止
npx claude-orchestra volume 0.3          # 音量調整（即時反映）
npx claude-orchestra track list          # トラック一覧
npx claude-orchestra track use <name>    # トラック切替
npx claude-orchestra config set mode mixer  # モード変更
```

## トラック対応表

| 言い方                    | トラック名           | 作曲家           |
| ------------------------- | -------------------- | ---------------- |
| 「第九」「ode to joy」    | `ode-to-joy`         | ベートーヴェン   |
| 「新世界」「dvorak」      | `new-world`          | ドヴォルザーク   |
| 「朝」「peer gynt」       | `morning-mood`       | グリーグ         |
| 「天国と地獄」「can-can」 | `orpheus-underworld` | オッフェンバック |

## モード

- **mixer**（推奨）: MIDI レンダリングされた楽器パート。sox + ffplay + fluidsynth 必要。
- **synth**: リアルタイム電子音生成。追加依存なし。

## トラブルシューティング

| 問題         | 解決策                                                |
| ------------ | ----------------------------------------------------- |
| 音が出ない   | `npx claude-orchestra status` で起動確認              |
| sox 未検出   | `brew install sox`                                    |
| トラックなし | `npx claude-orchestra setup` で MIDI からレンダリング |
| 音量         | `npx claude-orchestra volume 0.3`                     |
