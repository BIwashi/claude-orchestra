---
name: orchestra
description: Claude Orchestraの操作 — コーディング中のBGM。音楽、BGM、オーケストラ、開始、停止、音量に関するリクエストで使用。
---

# Claude Orchestra

コーディング中のBGMを制御するスキルです。

## クイックリファレンス

| ユーザーの発言               | アクション                        |
| ---------------------------- | --------------------------------- |
| 「音楽流して」「bgm on」     | 依存チェック → 説明 → 確認 → 起動 |
| 「音楽止めて」「quiet」      | コンダクター停止                  |
| 「曲変えて」                 | トラック切替                      |
| 「音量上げて」「音量下げて」 | ボリューム調整                    |
| 「何流れてる？」             | ステータス表示                    |

## セットアップ

まず依存関係を確認:

```bash
command -v ffmpeg && echo "ffmpeg: ✅" || echo "ffmpeg: ❌"
command -v sox && echo "sox: ✅" || echo "sox: ❌"
command -v fluidsynth && echo "fluidsynth: ✅" || echo "fluidsynth: ❌"
```

**足りないものがある場合は、何を入れるか・なぜ必要かを説明してから確認を取る:**

> いくつかツールが必要です:
>
> **必須:**
>
> - `ffmpeg` / `ffplay` — 音声再生エンジン
> - `sox` — 複数パートのミックス
>
> **任意（MIDIから音源を作る場合）:**
>
> - `fluidsynth` — MIDI → WAV変換
> - `demucs` — AIパート分離
>
> どれをインストールしますか？（必須のみ / 全部 / なし）

ユーザーの選択に応じてインストール。何も入れなくてもsynthモードで動作可能。

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
