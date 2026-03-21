---
name: orchestra
description: Claude Orchestraの操作 — コーディング中のBGM。音楽、BGM、オーケストラ、開始、停止、音量に関するリクエストで使用。
---

# Claude Orchestra

コーディング中のBGMを制御するスキルです。

## クイックリファレンス

| ユーザーの発言               | アクション       |
| ---------------------------- | ---------------- |
| 「音楽流して」「bgm on」     | セットアップ実行 |
| 「音楽止めて」「quiet」      | コンダクター停止 |
| 「曲変えて」                 | トラック切替     |
| 「音量上げて」「音量下げて」 | ボリューム調整   |
| 「何流れてる？」             | ステータス表示   |

## セットアップ

```bash
npx claude-orchestra setup
```

## 操作コマンド

```bash
npx claude-orchestra status              # 状態確認
npx claude-orchestra stop                # 停止
npx claude-orchestra volume 0.3          # 音量調整
npx claude-orchestra track list          # トラック一覧
npx claude-orchestra track use <name>    # トラック切替
npx claude-orchestra config set mode mixer  # モード変更
```
