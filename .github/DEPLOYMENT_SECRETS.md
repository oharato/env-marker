# Chrome Web Store Deployment - Quick Reference

## 必要な GitHub Secrets

GitHub Actions で自動デプロイを実行するために、以下の4つのシークレットをリポジトリに設定してください。

### 設定場所
`Settings` → `Secrets and variables` → `Actions` → `New repository secret`

### 必要なシークレット

| シークレット名 | 取得方法 |
|---------------|---------|
| `CHROME_EXTENSION_ID` | Chrome Web Store で拡張機能を登録後、URL から取得（32文字の英数字） |
| `CHROME_CLIENT_ID` | Google Cloud Console で OAuth クライアント ID を作成して取得 |
| `CHROME_CLIENT_SECRET` | Google Cloud Console で OAuth クライアント ID 作成時に取得 |
| `CHROME_REFRESH_TOKEN` | OAuth フローを実行して取得（詳細は CHROME_STORE_DEPLOYMENT.md を参照） |

## クイックスタート

1. **Chrome Web Store で拡張機能を初回登録**
   - 手動で ZIP をアップロードして拡張機能 ID を取得

2. **Google Cloud Platform でプロジェクトを作成**
   - Chrome Web Store API を有効化
   - OAuth クライアント ID を作成

3. **リフレッシュトークンを取得**
   - OAuth フローを実行（CHROME_STORE_DEPLOYMENT.md の手順4参照）

4. **GitHub Secrets を設定**
   - 上記4つのシークレットを追加

5. **master にマージ**
   - 自動デプロイが実行されます

詳細な手順は [CHROME_STORE_DEPLOYMENT.md](CHROME_STORE_DEPLOYMENT.md) を参照してください。
