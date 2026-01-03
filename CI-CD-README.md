# AI Task Manager CI/CD

## GitHub Actions自動化

### 機能
- **自動テスト実行**: Playwrightを使用したE2Eテスト
- **スクリーンショット自動取得**: 各タブ毎のスクリーンショット
- **Excel自動レポート**: テスト結果とスクリーンショットをExcelファイルに出力
- **自動デプロイ**: テスト成功時のみAWS環境にデプロイ

### セットアップ

1. **GitHub Secretsの設定**
   ```
   AWS_ACCESS_KEY_ID: AWSアクセスキー
   AWS_SECRET_ACCESS_KEY: AWSシークレットキー
   ```

2. **依存関係のインストール**
   ```bash
   npm install
   ```

3. **ローカルテスト実行**
   ```bash
   npm run test:e2e
   npm run test:report
   ```

### ワークフロー

1. **Push/PR時**: 自動テスト実行
2. **テスト成功**: mainブランチの場合、本番環境にデプロイ
3. **テスト失敗**: デプロイを停止、アーティファクトを保存

### 生成されるファイル
- `test-report.xlsx`: テスト結果とスクリーンショット
- `screenshots/`: 各タブのスクリーンショット画像
- `test-results/`: Playwrightテスト結果

### テスト内容
- アプリケーション読み込み
- タブ間ナビゲーション
- タスク作成機能
- タスク一覧表示
- ガントチャート表示
- プロジェクト作成機能