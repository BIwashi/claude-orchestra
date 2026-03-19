# 🎵 Claude Orchestra

[English](../README.md)

複数の Claude Code セッションをライブオーケストラに変えるツール。各セッションに楽器が割り当てられ、ツール呼び出しのひとつひとつが音符になります。

## 仕組み

```
Claude Code セッション A (ピアノ 🎹)   ──┐
Claude Code セッション B (チェロ 🎻)   ──┤── フックイベント ──→ 指揮者 ──→ 音声出力
Claude Code セッション C (フルート 🎶) ──┘
```

- **セッション参加** → 上昇アルペジオ（ようこそ！）
- **ツール使用** → ツール種別に対応した音符（Read=主音, Bash=属音, Edit=中音…）
- **エラー** → 半音パッシングトーン
- **アイドル** → アンビエントコード進行
- **セッション離脱** → 下降アルペジオ（さようなら）

## モード

### シンセモード（デフォルト）

ffmpeg の倍音合成でトーンを生成。各楽器は固有の倍音構成を持ち、音色が異なります。外部音声ファイルは不要。

### サンプルモード

事前に録音した音源をセクション×パートに分けて再生:

- **セッション数 = 同時再生パート数**（1セッション=弦楽器のみ、3セッション=弦+管+打）
- **ツールイベントが再生ヘッドを進める** → セクションが切り替わる
- **アイドル = フェルマータ** — 現在のセクションをループまたはサステイン

## クイックスタート

### 前提条件

- macOS（音声再生に `afplay` を使用）
- Node.js ≥ 20
- ffmpeg（`brew install ffmpeg`）

### Claude Code プラグインとしてインストール

```bash
claude plugin install claude-orchestra
```

指揮者（conductor）を起動:

```bash
npx claude-orchestra start --daemon
```

または Claude Code 内でスキルを使用:

```
/claude-orchestra:orchestra setup
```

### npx で直接実行（インストール不要）

```bash
npx claude-orchestra start --daemon
```

> **注意**: npx でプラグインなしで使う場合、フックの手動設定が必要です。プラグインインストールでは自動的に設定されます。

### サンプルトラックの使用

```bash
npx claude-orchestra track list
npx claude-orchestra track use beethoven-9th
npx claude-orchestra config set mode synth   # シンセに戻す
```

## CLI リファレンス

```
claude-orchestra start [--daemon]    指揮者を起動
claude-orchestra stop                指揮者を停止
claude-orchestra status              アクティブセッションと設定を表示

claude-orchestra track list          利用可能なトラック一覧
claude-orchestra track use <name>    サンプルトラックに切替
claude-orchestra track add <dir>     トラックディレクトリを登録（シンボリックリンク）

claude-orchestra config show         現在の設定を表示
claude-orchestra config set <k> <v>  設定値を更新
```

## カスタムトラックの作成

### ディレクトリ構造

```
~/.claude-orchestra/tracks/my-track/
  manifest.json
  sections/
    00-intro/
      part-0.wav   (弦楽器)
      part-1.wav   (木管楽器)
      part-2.wav   (金管楽器)
    01-theme/
      part-0.wav
      ...
```

### manifest.json

```json
{
  "name": "My Track",
  "eventsPerSection": 8,
  "maxParts": 4,
  "sections": [
    {
      "id": "00-intro",
      "name": "Introduction",
      "loop": true,
      "parts": [
        { "file": "sections/00-intro/part-0.wav", "label": "Strings", "volume": 0.7 },
        { "file": "sections/00-intro/part-1.wav", "label": "Woodwinds", "volume": 0.5 }
      ]
    }
  ],
  "idle": { "strategy": "sustain", "fadeMs": 2000 }
}
```

### スライスヘルパー

ffmpeg で音源ファイルをセクションに分割:

```bash
npx claude-orchestra-slice input.mp3 \
  --timestamps 0:00,1:30,3:00,4:30 \
  --output ~/.claude-orchestra/tracks/my-track/
```

テンプレートは [`data/tracks/demo/`](../data/tracks/demo/) を参照。

## `/orchestra` スキル

プラグインインストール後、以下のスキルコマンドが利用可能:

| コマンド                                   | 説明                       |
| ------------------------------------------ | -------------------------- |
| `/claude-orchestra:orchestra`              | 前提チェックと指揮者の起動 |
| `/claude-orchestra:orchestra status`       | オーケストラの状態を表示   |
| `/claude-orchestra:orchestra stop`         | 指揮者を停止               |
| `/claude-orchestra:orchestra track <name>` | サンプルトラックに切替     |
| `/claude-orchestra:orchestra synth`        | シンセモードに切替         |

## 設定

`~/.claude-orchestra/config.json` に保存:

```json
{
  "mode": "synth",
  "track": null,
  "volume": 0.5
}
```

## アーキテクチャ

```
.claude-plugin/
  plugin.json        プラグインマニフェスト

bin/
  conductor.js       CLI + イベントループ（「指揮者」）
  hook-musician.sh   超軽量フック (<5ms) — イベント JSON を指揮者に渡す
  slice-track.sh     ffmpeg で音源をセクション分割するヘルパー

lib/
  engine.js          ファクトリ: createEngine(config) → SynthEngine | SampleEngine
  synth-engine.js    ffmpeg 生成の WAV による倍音合成
  sample-engine.js   セクション/パート管理による録音音源の再生
  audio-player.js    楽器ごとのボイスチャンネル。レートリミット付き (afplay)
  music-theory.js    音階、コード進行、ツール→音のマッピング
  activity-mapper.js ツールイベント → 音楽パラメータ（音名、音量、長さ）
  event-watcher.js   イベント JSON ファイルのファイルシステム監視
  registry.js        セッション → 楽器の割り当て管理（永続化）
  tone-cache.js      ffmpeg トーン生成とキャッシュ

skills/
  orchestra/         /orchestra スキル（セットアップと制御）

hooks/
  hooks.json         プラグインフック定義 (SessionStart, PostToolUse, SessionEnd)

data/
  instruments.json   楽器定義（倍音、アタック、ディケイ）
  tracks/demo/       サンプルトラックのテンプレート
```

## ライセンス

MIT
