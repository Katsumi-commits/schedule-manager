# AI Task Manager - Architecture Diagrams

このディレクトリには、AI Task Managerアプリケーションの設計・構築図が含まれています。

## 📊 図表ファイル

### 1. アーキテクチャ図 (`architecture-diagram.mmd`)
- システム全体の構成要素と関係性
- AWS サービスの配置と接続
- フロントエンド、バックエンド、外部サービスの関係

### 2. データフロー図 (`data-flow-diagram.mmd`)
- ユーザーアクションから結果までの処理フロー
- タスク作成、更新、表示の流れ
- API呼び出しとレスポンスの詳細

### 3. データベース設計図 (`database-schema.mmd`)
- DynamoDBテーブル構造
- プロジェクトとタスクの関係性
- Backlog連携のデータ構造

## 🖼️ 画像生成方法

### オンラインツールを使用
1. **Mermaid Live Editor**: https://mermaid.live/
   - `.mmd`ファイルの内容をコピー&ペースト
   - PNG/SVG形式でダウンロード可能

2. **GitHub**: 
   - GitHubにファイルをアップロード
   - 自動的にMermaid図が表示される

### ローカルツールを使用
```bash
# Mermaid CLIをインストール
npm install -g @mermaid-js/mermaid-cli

# 画像生成
mmdc -i architecture-diagram.mmd -o architecture-diagram.png
mmdc -i data-flow-diagram.mmd -o data-flow-diagram.png
mmdc -i database-schema.mmd -o database-schema.png
```

### VS Code拡張機能
1. "Mermaid Markdown Syntax Highlighting" 拡張機能をインストール
2. "Mermaid Preview" 拡張機能をインストール
3. `.mmd`ファイルを開いてプレビュー表示

## 🏗️ システム概要

### フロントエンド
- **React SPA**: チャット、タスク管理、ガントチャート
- **S3 + CloudFront**: 静的ホスティング

### バックエンド
- **API Gateway**: RESTful API エンドポイント
- **Lambda Functions**: サーバーレス処理
- **DynamoDB**: NoSQLデータベース

### AI/ML
- **Amazon Bedrock**: 自然言語処理
- **Nova Pro Model**: タスク情報の抽出

### 外部連携
- **Backlog API**: 課題管理システム連携
- **SSM/Secrets Manager**: 設定・認証情報管理

## 🔄 主要機能フロー

1. **タスク作成**: 自然言語 → Bedrock解析 → DynamoDB保存 → Backlog連携
2. **ガントチャート**: DynamoDB読み込み → React表示 → ドラッグ&ドロップ更新
3. **プロジェクト管理**: 階層構造でタスクを整理
4. **リアルタイム更新**: API経由でデータ同期

## 📱 UI構成

- **チャットページ**: プロジェクト選択 + 自然言語入力
- **タスクページ**: プロジェクト別タスク一覧
- **ガントチャート**: インタラクティブなタイムライン表示