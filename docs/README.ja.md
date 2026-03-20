# 🎵 Claude Orchestra

[English](../README.md)

複数の Claude Code セッションをライブオーケストラに変えるツールです。各セッションに楽器が割り当てられ、ツール呼び出しのひとつひとつが音符になります。

## 仕組み

```
Claude Code セッション A (ピアノ 🎹)   ──┐
Claude Code セッション B (チェロ 🎻)   ──┤── フックイベント ──→ 指揮者 ──→ 音声出力
Claude Code セッション C (フルート 🎶) ──┘
```

- **セッション参加** → 上昇アルペジオ
- **ツール使用** → ツール種別に対応した音符（Read=主音, Bash=属音, Edit=中音…）
- **エラー** → 半音のパッシングトーン
- **アイドル** → アンビエントなコード進行
- **セッション離脱** → 下降アルペジオ

## モード

### Mixer モード（推奨）

sox でステムを事前ミックスし、ffplay で再生します。グローバルクロックで全パートを同期するため、トラック系モードの中では最も安定しており、常に完全同期します。

### Synth モード

ffmpeg の倍音合成でトーンを生成します。各楽器は固有の倍音構成を持ち、外部の音声ファイルは不要です。

### Sample モード

事前に用意したステムをそのまま再生する旧来のトラックモードです。パート間で同期ずれが起きることがあるため、特別な理由がなければ Mixer モードを使ってください。

## クイックスタート

### 前提条件

- macOS
- Node.js >= 20
- ffmpeg / ffplay（`brew install ffmpeg`）
- sox（`brew install sox`）

### Claude Code プラグインとしてインストール

```bash
claude plugin install claude-orchestra
```

推奨設定の Mixer モードに切り替えてから指揮者を起動します。

```bash
npx claude-orchestra config set mode mixer
npx claude-orchestra start --daemon
```

または Claude Code 内でスキルを使います。

```
/claude-orchestra:orchestra setup
```

### npx で直接実行（インストール不要）

```bash
npx claude-orchestra config set mode mixer
npx claude-orchestra start --daemon
```

> **注意**: プラグインなしで npx を使う場合は、フックを手動設定する必要があります。プラグイン経由のインストールでは自動で設定されます。

### 同梱デモトラックを使う

Claude Orchestra には Offenbach の **Galop Infernal**（*Orpheus in the Underworld*）を元にしたデモトラックが同梱されています。

```bash
npx claude-orchestra track list
npx claude-orchestra track use orpheus-underworld
npx claude-orchestra config set mode mixer
```

## カスタムトラックの準備

`./bin/prepare-track.sh` を使うと、手元の音源から Claude Orchestra 用トラックを生成できます。

1. 音源を用意します。
   MIDI をレンダリングした音源、DAW 書き出し、YouTube 由来の音源、パブリックドメイン録音など、ローカルの音声ファイルであれば利用できます。
2. トラックを生成します。

```bash
./bin/prepare-track.sh source.mp3 --name my-track --timestamps 0:00,1:30,3:00
```

3. 生成したトラックに切り替え、Mixer モードで使います。

```bash
npx claude-orchestra track use my-track
npx claude-orchestra config set mode mixer
```

`prepare-track.sh` は demucs が利用可能ならステム分離を行い、その後セクション分割と `manifest.json` の生成までまとめて実行し、`~/.claude-orchestra/tracks/<name>/` に配置します。

レイアウトの参考としては [`data/tracks/demo/`](../data/tracks/demo/) を参照してください。同梱の `orpheus-underworld` トラックは、Offenbach の *Galop Infernal* を元にした完成例です。

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
      part-0.wav   (弦)
      part-1.wav   (木管)
      part-2.wav   (金管)
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

ffmpeg で単一音源をセクション単位に分割できます。

```bash
npx claude-orchestra-slice input.mp3 \
  --timestamps 0:00,1:30,3:00,4:30 \
  --output ~/.claude-orchestra/tracks/my-track/
```

## `/orchestra` スキル

プラグインインストール後、以下のスキルコマンドが使えます。

| コマンド                                         | 説明                                      |
| ------------------------------------------------ | ----------------------------------------- |
| `/claude-orchestra:orchestra`                    | 前提確認後、Mixer モードで起動            |
| `/claude-orchestra:orchestra status`             | オーケストラの状態を表示                  |
| `/claude-orchestra:orchestra stop`               | 指揮者を停止                              |
| `/claude-orchestra:orchestra track <name>`       | トラックに切り替え                        |
| `/claude-orchestra:orchestra track prepare ...`  | 音源からカスタムトラックを生成            |
| `/claude-orchestra:orchestra mixer`              | Mixer モードに切り替え                    |
| `/claude-orchestra:orchestra synth`              | Synth モードに切り替え                    |

## 設定

`~/.claude-orchestra/config.json` に保存されます。

```json
{
  "mode": "mixer",
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
  hook-musician.sh   超軽量フック (<5ms) - イベント JSON を指揮者に渡す
  prepare-track.sh   demucs + ffmpeg によるカスタムトラック生成ヘルパー
  slice-track.sh     ffmpeg によるセクション分割ヘルパー

lib/
  engine.js          ファクトリ: createEngine(config) → SynthEngine | SampleEngine
  synth-engine.js    ffmpeg 生成 WAV による倍音合成
  sample-engine.js   セクション/パート管理による録音音源の再生
  audio-player.js    楽器ごとのボイスチャンネル。レート制限付き
  music-theory.js    音階、コード進行、ツール→音の対応
  activity-mapper.js ツールイベント → 音楽パラメータ（音名、音量、長さ）
  event-watcher.js   イベント JSON ファイルの監視
  registry.js        セッション → 楽器割り当て管理（永続化）
  tone-cache.js      ffmpeg トーン生成とキャッシュ

skills/
  orchestra/         /orchestra スキル（セットアップと制御）

hooks/
  hooks.json         プラグインフック定義 (SessionStart, PostToolUse, SessionEnd)

data/
  instruments.json   楽器定義（倍音、アタック、ディケイ）
  tracks/demo/       manifest 形式のテンプレート
```

## ライセンス

MIT
