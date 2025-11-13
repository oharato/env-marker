# Chrome Web Store デプロイメント設定ガイド

このドキュメントでは、GitHub Actions を使用して Chrome Web Store に自動デプロイするための設定方法を説明します。

## 概要

`master` ブランチにコードがマージされると、自動的に以下の処理が実行されます：
1. 拡張機能をビルド
2. ZIP パッケージを作成
3. Chrome Web Store にアップロード・公開

## 事前準備

### 1. Chrome Web Store Developer アカウントの作成

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/) にアクセス
2. Google アカウントでログイン
3. 初回の場合は、開発者登録料（5ドル）を支払う必要があります

### 2. 拡張機能の初回登録

自動デプロイを設定する前に、一度手動で拡張機能を Chrome Web Store に登録する必要があります。

1. Chrome Web Store Developer Dashboard にアクセス
2. 「新しいアイテム」をクリック
3. 以下のコマンドで作成した ZIP ファイルをアップロード：
   ```bash
   npm install
   npm run build
   cd dist
   zip -r ../extension.zip .
   ```
4. 拡張機能の詳細情報を入力：
   - 名前：Env Marker
   - 説明：指定したURLやIPアドレスのサイトに目印をつけます
   - カテゴリ：開発者ツール
   - スクリーンショット（最低1枚必要）
   - アイコン画像（128x128px）
5. 「下書きを保存」または「審査に提出」
6. アップロード完了後、URL に表示される拡張機能 ID（32文字の英数字）をメモしてください
   - 例：`abcdefghijklmnopqrstuvwxyz123456`

### 3. Google Cloud Platform での OAuth クライアント設定

Chrome Web Store API を使用するために、Google Cloud Platform で OAuth クライアントを作成します。

#### 3.1 Google Cloud プロジェクトの作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成（例：env-marker-deploy）
3. プロジェクトを選択

#### 3.2 Chrome Web Store API の有効化

1. 左側のメニューから「API とサービス」→「ライブラリ」を選択
2. "Chrome Web Store API" を検索
3. 「有効にする」をクリック

#### 3.3 OAuth 同意画面の設定

1. 「API とサービス」→「OAuth 同意画面」を選択
2. ユーザータイプで「外部」を選択して「作成」
3. 必須項目を入力：
   - アプリ名：env-marker-deploy（任意の名前）
   - ユーザーサポートメール：あなたのメールアドレス
   - デベロッパーの連絡先情報：あなたのメールアドレス
4. 「保存して次へ」をクリック
5. スコープの追加画面では何も追加せず「保存して次へ」
6. テストユーザーにあなたのメールアドレスを追加
7. 「保存して次へ」をクリック

#### 3.4 OAuth クライアント ID の作成

1. 「API とサービス」→「認証情報」を選択
2. 「認証情報を作成」→「OAuth クライアント ID」をクリック
3. アプリケーションの種類：「デスクトップ アプリ」を選択
4. 名前：任意の名前（例：GitHub Actions）
5. 「作成」をクリック
6. 表示されたクライアント ID とクライアントシークレットをメモ：
   - クライアント ID：`123456789-abcdefg.apps.googleusercontent.com` の形式
   - クライアントシークレット：ランダムな文字列

### 4. リフレッシュトークンの取得

リフレッシュトークンは、API アクセスを継続的に行うために必要です。

#### 4.1 認証コードの取得

1. 以下の URL にアクセス（プレースホルダーを実際の値に置き換えてください）：

```
https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=YOUR_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob
```

- `YOUR_CLIENT_ID` を先ほど取得したクライアント ID に置き換えます

2. Google アカウントでログイン（Chrome Web Store Developer アカウントと同じアカウント）
3. アクセス許可を求められたら「許可」をクリック
4. 表示された認証コード（Authorization Code）をコピー

#### 4.2 リフレッシュトークンの取得

以下のコマンドを実行してリフレッシュトークンを取得します（プレースホルダーを実際の値に置き換えてください）：

```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_AUTH_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob"
```

レスポンスから `refresh_token` の値をメモしてください。

### 5. GitHub Secrets の設定

GitHub リポジトリに以下のシークレットを設定します。

1. GitHub リポジトリページにアクセス
2. 「Settings」→「Secrets and variables」→「Actions」を選択
3. 「New repository secret」をクリックして、以下の4つを追加：

| シークレット名 | 説明 | 例 |
|---------------|------|-----|
| `CHROME_EXTENSION_ID` | Chrome Web Store の拡張機能 ID | `abcdefghijklmnopqrstuvwxyz123456` |
| `CHROME_CLIENT_ID` | Google Cloud の OAuth クライアント ID | `123456789-abcdefg.apps.googleusercontent.com` |
| `CHROME_CLIENT_SECRET` | Google Cloud の OAuth クライアントシークレット | `GOCSPX-abc123...` |
| `CHROME_REFRESH_TOKEN` | OAuth リフレッシュトークン | `1//0abc123...` |

## デプロイの実行

設定完了後、以下の流れで自動デプロイが実行されます：

1. 開発ブランチで作業
2. Pull Request を作成してレビュー
3. `master` ブランチにマージ
4. GitHub Actions が自動的に実行される
5. Chrome Web Store に新しいバージョンがアップロードされ、公開される

## デプロイ状況の確認

1. GitHub リポジトリの「Actions」タブにアクセス
2. 「Deploy to Chrome Web Store」ワークフローの実行状況を確認
3. エラーが発生した場合は、ログを確認して対処

## トラブルシューティング

### ビルドエラー

- `npm ci` が失敗する場合：`package-lock.json` が最新か確認
- ビルドが失敗する場合：ローカルで `npm run build` を実行して問題を特定

### アップロードエラー

- 認証エラーの場合：シークレットの値が正しいか確認
- API エラーの場合：Chrome Web Store API が有効になっているか確認
- リフレッシュトークンの有効期限切れ：手順4を再度実行して新しいトークンを取得

### 公開エラー

- 拡張機能が審査中の場合、新しいバージョンは自動的に公開されず、審査待ちになります
- `manifest.json` の `version` を更新する必要がある場合があります

## バージョン管理

Chrome Web Store にアップロードするには、`manifest.json` のバージョン番号を更新する必要があります。

現在のバージョン：`1.0`

新しいバージョンをリリースする場合：
1. `manifest.json` の `version` を更新（例：`1.0` → `1.1` または `1.0.1`）
2. 変更を `master` にマージ
3. 自動デプロイが実行されます

## 参考リンク

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
- [Chrome Web Store API Documentation](https://developer.chrome.com/docs/webstore/using_webstore_api/)
- [Google Cloud Console](https://console.cloud.google.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
