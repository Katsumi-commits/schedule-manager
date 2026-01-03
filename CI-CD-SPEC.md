# CI/CD Pipeline Specification

## 概要
GitHub ActionsとAWS CDKを使用したPRベースのCI/CDパイプライン

## アーキテクチャ

```
Feature Branch → PR → dev Branch → AWS dev Environment
     ↓              ↓         ↓            ↓
   Lint/Test    Auto Merge   Deploy   Integration/E2E Test
```

## ブランチ戦略

- `main`: 安定ブランチ（将来のprod環境用）
- `dev`: 開発統合ブランチ（dev環境と連動）
- `feature/*`: 機能開発ブランチ

## CI/CD フロー詳細

### Phase 1: CI (Pull Request)
**トリガー**: feature/* → dev への PR作成/更新

**実行内容**:
1. Lint チェック (ESLint, TypeScript)
2. Unit Test (Jest)
3. Build 検証 (CDK synth)
4. Security Scan (CodeQL)

**成功時**: PR自動マージ可能
**失敗時**: PR マージブロック

### Phase 2: CD (Deploy to dev)
**トリガー**: dev ブランチへのマージ

**実行内容**:
1. AWS CDK Deploy (全スタック)
2. デプロイ完了待機
3. ヘルスチェック

### Phase 3: Post-Deploy Testing
**実行内容**:
1. Integration Test (API/DB)
2. E2E Test (Playwright)
3. Excel レポート生成

**成功時**: パイプライン完了
**失敗時**: 自動ロールバック + 通知

## 環境構成

### dev環境
- AWS Account: 開発用
- Region: ap-northeast-1
- スタック: 
  - Database Stack
  - Backend Stack  
  - Frontend Stack

### prod環境（将来用）
- AWS Account: 本番用（別アカウント推奨）
- Region: ap-northeast-1
- 手動承認フロー付き

## 品質ゲート

1. **Code Quality**: Lint + Unit Test (95%以上)
2. **Security**: CodeQL + Dependency Check
3. **Integration**: API Response + DB Persistence
4. **E2E**: UI Automation + Screenshot Validation

## 通知・レポート

- Slack通知（成功/失敗）
- Excel テストレポート（Artifacts保存）
- CloudWatch メトリクス連携