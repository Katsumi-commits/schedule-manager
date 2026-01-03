# CI/CD 運用手順書

## ブランチ構成
- `main`: 本番ブランチ（将来用）
- `dev`: 開発統合ブランチ（dev環境と連動）
- `feature/*`: 機能開発ブランチ

## 開発フロー

### 1. 機能開発
```bash
# feature ブランチ作成
git checkout dev
git pull origin dev
git checkout -b feature/task-management-improvement

# 開発作業
# ... コード変更 ...

# コミット & プッシュ
git add .
git commit -m "feat: タスク管理機能の改善"
git push origin feature/task-management-improvement
```

### 2. Pull Request 作成
- GitHub上で `feature/task-management-improvement` → `dev` へのPR作成
- **自動実行される処理**:
  - Lint チェック
  - TypeScript ビルド
  - Unit テスト (カバレッジ50%以上)
  - CDK synth 検証
  - Security スキャン

### 3. 自動マージ
- CI が成功 → **自動的に dev ブランチにマージ**
- CI が失敗 → PR はマージブロック、修正が必要

### 4. dev環境デプロイ
- dev ブランチへのマージ → **自動的にAWS dev環境にデプロイ**
- **実行される処理**:
  - 全スタックデプロイ (Database, Backend, Frontend)
  - ヘルスチェック
  - Integration テスト (API/DB)
  - E2E テスト (UI自動化)
  - Excel レポート生成

### 5. 結果確認
- **成功時**: dev環境で動作確認可能
- **失敗時**: 自動ロールバック + 通知

## 現在の運用

### 開発サイクル
```bash
# 1. feature ブランチで開発
git checkout -b feature/new-feature
# コード変更
git push origin feature/new-feature

# 2. PR作成 (feature → dev)
# GitHub UI で PR作成

# 3. 自動CI実行 → 成功時に自動マージ

# 4. dev環境に自動デプロイ
```

### 本番リリース（将来）
```bash
# main ブランチにマージ（手動）
git checkout main
git merge dev
git push origin main

# 手動承認後、本番デプロイ実行
```

## 必要な GitHub Secrets

### dev Environment
```
AWS_ACCESS_KEY_ID: dev環境のAWSアクセスキー
AWS_SECRET_ACCESS_KEY: dev環境のAWSシークレットキー
AWS_ACCOUNT_ID: dev環境のAWSアカウントID
```

### prod Environment（将来用）
```
AWS_ACCESS_KEY_ID: prod環境のAWSアクセスキー
AWS_SECRET_ACCESS_KEY: prod環境のAWSシークレットキー
AWS_ACCOUNT_ID: prod環境のAWSアカウントID
```

### Repository Secrets
```
SLACK_WEBHOOK_URL: 失敗通知用Slack Webhook URL
```

## モニタリング

### 成功指標
- CI 成功率: 95%以上
- デプロイ成功率: 98%以上
- テスト実行時間: 10分以内

### アラート
- デプロイ失敗 → Slack通知
- テスト失敗率 20%以上 → 開発チーム通知
- セキュリティ脆弱性検出 → 即座に修正