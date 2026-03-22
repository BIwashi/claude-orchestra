---
name: orchestra
description: Claude Orchestraの操作 — コーディング中のBGM。音楽、BGM、オーケストラ、開始、停止、音量に関するリクエストで使用。
---

# Claude Orchestra

コーディング中のBGMを制御するスキルです。

## クイックリファレンス

| ユーザーの発言               | アクション                     |
| ---------------------------- | ------------------------------ |
| 「音楽流して」「bgm on」     | 状態確認 → 確認 → セットアップ |
| 「音楽止めて」「quiet」      | コンダクター停止               |
| 「曲変えて」                 | トラック切替                   |
| 「音量上げて」「音量下げて」 | ボリューム調整                 |
| 「何流れてる？」             | ステータス表示                 |

## セットアップ

**重要: 音楽を開始する前に必ずユーザーに確認してください。**

まず状態を確認:

```bash
npx claude-orchestra status 2>&1
```

その後、何が起きるかを説明して確認を取る:

> 「Orchestra を起動します。バックグラウンドで音楽が流れますが、よろしいですか？
>
> - 🎵 トラック: [現在のトラック]
> - 🔊 ボリューム: [現在のボリューム]%
>
> 起動しますか？（トラックやボリュームの変更も可能です）」

**ユーザーが了承してから**:

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

## トラック対応表

| 言い方                    | トラック名           | 作曲家           |
| ------------------------- | -------------------- | ---------------- |
| 「第九」「ode to joy」    | `ode-to-joy`         | ベートーヴェン   |
| 「新世界」「dvorak」      | `new-world`          | ドヴォルザーク   |
| 「朝」「peer gynt」       | `morning-mood`       | グリーグ         |
| 「ダッタン人」「borodin」 | `polovtsian-dances`  | ボロディン       |
| 「天国と地獄」「can-can」 | `orpheus-underworld` | オッフェンバック |
