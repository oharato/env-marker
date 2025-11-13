# Env Marker 開発ガイド

このドキュメントでは、Env Marker Chrome拡張機能の開発方法について説明します。

## 開発環境のセットアップ (wxt)

このプロジェクトでは、[wxt](https://wxt.dev/) を使用して、ファイルの変更を監視し、自動的にビルドする開発環境を構築しています。これにより、コードの変更が即座に拡張機能に反映され、効率的に開発を進めることができます。

### 1. 依存関係のインストール

プロジェクトのルートディレクトリで、以下のコマンドを実行して必要なパッケージをインストールします。

```bash
pnpm install
```

### 2. 開発サーバーの起動 (Watch Mode)

以下のコマンドを実行すると、wxtがファイルの変更を監視し、変更があるたびに`.output/chrome-mv3-dev`フォルダに自動的に再ビルドします。

```bash
pnpm dev
```

このコマンドを実行すると、`.output` フォルダが生成され、その中にビルドされた拡張機能のファイルが格納されます。このプロセスは、ターミナルを閉じるまで継続します。

**注意**: 開発モードでは `.output/chrome-mv3-dev`、本番ビルドでは `.output/chrome-mv3` フォルダが使用されます。

### 3. Chromeへの拡張機能の読み込み

初回のみ、Chromeに開発中の拡張機能を読み込む必要があります。

1.  Chromeで `chrome://extensions` を開きます。
2.  右上の「デベロッパーモード」をオンにします。
3.  もし以前に「Env Marker」を読み込んでいた場合は、一度削除してください。
4.  「パッケージ化されていない拡張機能を読み込む」ボタンをクリックし、プロジェクトルートに生成された **`.output/chrome-mv3-dev` フォルダ**を選択します（開発モード用）。

### 4. 開発フロー

`pnpm dev` を実行したままコードを編集・保存すると、wxtが変更を検知し、`.output/chrome-mv3-dev` フォルダ内のファイルが自動的に更新されます。

変更をChromeに反映させるには、`chrome://extensions` ページでEnv Marker拡張機能の**リロードボタン（円形の矢印）を押してください。**

**Tips**: 
- WXTは新しいエントリーポイント（popup、optionsなど）が追加された場合、開発サーバーの再起動が必要な場合があります
- TypeScriptの型エラーはビルドエラーになるため、VSCodeなどのエディタで事前に確認することをお勧めします

### ビルド

拡張機能を本番用にビルドするには、以下のコマンドを実行します。

```bash
pnpm build
```

これにより、`.output/chrome-mv3` フォルダに本番用のファイルが生成されます。ZIPファイルが必要な場合は、このフォルダを手動で圧縮してください。

### トラブルシューティング

#### 変更がChromeに反映されない、またはオプション画面が表示されない場合

wxtを導入した後は、Chromeに読み込む拡張機能のフォルダが **`.output/chrome-mv3-dev` フォルダ** になります（開発モード時）。

1.  `pnpm dev` が正常に実行されていることを確認してください。
2.  Chromeの拡張機能管理画面 (`chrome://extensions`) で、既存の「Env Marker」を一度削除し、**プロジェクトルートに生成された `.output/chrome-mv3-dev` フォルダ**を「パッケージ化されていない拡張機能を読み込む」で指定し直してください。
3.  wxtのキャッシュが原因で変更が反映されない場合は、`pnpm dev` を一度停止し、`.output` と `.wxt` ディレクトリを削除してから再度 `pnpm dev` を実行してみてください。
4.  **それでも反映されない場合は、Chromeブラウザ自体を一度終了し、再起動してください。**

#### TypeScriptの型エラー

- `Cannot find name 'chrome'` エラー: `tsconfig.json` に `"types": ["chrome"]` が含まれているか確認
- `moduleResolution` の非推奨警告: `tsconfig.json` で `"moduleResolution": "bundler"` を使用

#### 新しいエントリーポイントが認識されない

- popup や options などの新しいエントリーポイントを追加した場合、`pnpm dev` を再起動してください
- `entrypoints/` フォルダ内のファイル構造が正しいか確認（`popup/index.html` と `popup/index.ts` など）

### 画像操作コマンド

このプロジェクトでは、画像の操作に `sharp` ライブラリを使用しています。以下に、よく使用する画像操作コマンドをまとめます。

#### 画像のリサイズ

画像を特定のサイズにリサイズするには、以下のコマンドを使用します。

```bash
node -e "const sharp = require('sharp'); sharp('<入力画像パス>').resize(<幅>, <高さ>).toFile('<出力画像パス>', (err, info) => { if (err) console.error(err); else console.log(info); });"
```

例: `screenshot01.png` を 1280x800 にリサイズする場合

```bash
node -e "const sharp = require('sharp'); sharp('/home/oharato/workspace/tmp/env-color/public/screenshot01.png').resize(1280, 800).toFile('/home/oharato/workspace/tmp/env-color/public/screenshot01_resized.png', (err, info) => { if (err) console.error(err); else console.log(info); });"
```

リサイズ後、元のファイルに上書きするには以下を実行します。

```bash
mv /home/oharato/workspace/tmp/env-color/public/screenshot01_resized.png /home/oharato/workspace/tmp/env-color/public/screenshot01.png
```

## プロジェクト構成

```
env-color/
├── entrypoints/           # 拡張機能のエントリーポイント
│   ├── background.ts      # バックグラウンドスクリプト
│   ├── content.ts         # コンテンツスクリプト
│   └── options/           # 設定画面
│       ├── index.html
│       └── index.ts
├── src/                   # 共通コード（今後使用予定）
├── .output/               # ビルド出力（gitignore済み）
│   ├── chrome-mv3-dev/    # 開発ビルド
│   └── chrome-mv3/        # 本番ビルド
├── .wxt/                  # WXTのキャッシュ（gitignore済み）
├── wxt.config.ts          # WXT設定ファイル
├── tsconfig.json          # TypeScript設定
└── package.json           # 依存関係
```
