# 🎵 Claude Orchestra

[English](../README.md)

複数の Claude Code セッションをライブオーケストラに変えます。各セッションが楽器になり、ツール呼び出しが音楽を奏でます。

## 仕組み

```
Claude Code セッション A (ピアノ 🎹)  ──┐
Claude Code セッション B (チェロ 🎻)  ──┤── Hook Events ──→ コンダクター ──→ 音声出力
Claude Code セッション C (フルート 🎶) ──┘
```

- **セッション参加** → 上行アルペジオ（ウェルカム！）
- **ツール使用** → ツールの種類に応じた音（Read=主音、Bash=属音、Edit=中音…）
- **エラー** → 半音階パッシングトーン
- **アイドル** → アンビエントコード進行（クロスフェード付き）
- **セッション離脱** → 下行アルペジオ（さようなら）

コンダクターは Claude Code セッション開始時に自動起動し、最後のセッション終了で自動停止します。手動セットアップ不要。

## クイックスタート

### 前提条件

- Node.js >= 20
- macOS または Linux
- ffmpeg/ffplay（`brew install ffmpeg` / `apt install ffmpeg`）
- sox（`brew install sox` / `apt install sox`）

### Claude Code プラグインとしてインストール

```bash
claude plugin install claude-orchestra
```

これだけ！プラグインフックが自動でコンダクターを synth モードで起動します。フル体験（プリミックストラック）を使うには：

```
/orchestra setup
```

または手動で設定：

```bash
npx claude-orchestra config set mode mixer
npx claude-orchestra start --daemon
```

## モード

| モード     | 説明                                                                          | 依存関係                  |
| ---------- | ----------------------------------------------------------------------------- | ------------------------- |
| **mixer**  | sox でステムをプリミックス、ffplay で再生。グローバルクロック同期。最高品質。 | sox, ffplay, トラック音源 |
| **synth**  | ffmpeg の倍音合成でトーン生成。追加不要で即動作。                             | ffmpeg のみ               |
| **sample** | 録音済みステムを直接再生。レガシーモード、ドリフトする場合あり。              | afplay/paplay/aplay       |

## CLI リファレンス

```
claude-orchestra help                全コマンドを表示
claude-orchestra start [--daemon]    コンダクターを起動
claude-orchestra stop                コンダクターを停止
claude-orchestra status              アクティブセッション、モード、トラック表示

claude-orchestra volume [0.0-1.0]    ボリューム取得/設定（リアルタイム、再起動不要）

claude-orchestra track list          利用可能なトラック一覧
claude-orchestra track use <name>    トラック切替
claude-orchestra track add <dir>     トラックディレクトリを登録

claude-orchestra config show         現在の設定を表示
claude-orchestra config set <k> <v>  設定値を変更（mode, volume, track）
```

## ボリューム制御

再生中にリアルタイムでボリューム調整が可能です：

```bash
npx claude-orchestra volume 0.3    # 静かめのBGM
npx claude-orchestra volume 0.7    # 大きめ
```

## デモトラック

### バンドル済み

- **Ode to Joy** — ベートーヴェン交響曲第9番（MIDI, 8KB, パブリックドメイン）

### セットアップで利用可能

- **Orpheus in the Underworld** — オッフェンバック「天国と地獄」ギャロップ（要 fluidsynth + demucs）

## カスタムトラック作成

任意の音声ファイルから Claude Orchestra トラックを作成：

```bash
./bin/prepare-track.sh source.mp3 --name my-track --timestamps 0:00,1:30,3:00
```

demucs によるステム分離（利用可能な場合）、セクション分割、`manifest.json` + セクション音声ファイルの生成を行います。

マニフェスト形式のリファレンスは [`data/tracks/demo/`](../data/tracks/demo/) を参照してください。

## `/orchestra` スキル

プラグインインストール後、自然言語コマンドが使えます：

| こう言うと                                 | 実行される内容     |
| ------------------------------------------ | ------------------ |
| 「音楽スタート」「orchestra」「bgm on」    | セットアップ＆開始 |
| 「音楽停止」「quiet」                      | コンダクター停止   |
| 「曲変えて」「play ode to joy」            | トラック切替       |
| 「音量上げて」「音量下げて」「volume 30%」 | ボリューム調整     |
| 「何流れてる？」「status」                 | 現在の状態表示     |
| 「synth に切り替え」「mixer モード」       | エンジンモード変更 |

## ライセンス

MIT — [LICENSE](../LICENSE) を参照
