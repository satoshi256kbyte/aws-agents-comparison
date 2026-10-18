# GitHub Actions 2本構成の実装計画

## フェーズ状態

- specify: 完了。対象範囲と受け入れ条件は `spec.md` に定義済み。
- clarify: 完了。公式ドキュメントとActionの入力契約を確認済み。
- plan: 完了。以下の構成、権限、検証境界を確定した。
- analyze: 完了。実装前にCritical / Highがないことを確認した。

## 方針

### CDKとリリーステストを統合する

既存の `cdk.yml` を維持し、PRではsynthだけ、mainへのpushではsynth後にdeployを実行する。
`release-test` jobは `deploy` に依存させ、pushイベントかつdeploy成功時だけ起動する。

DevOps Agentの対象はActionの `test-profile-id` で指定する。プロファイル側にstagingまたはtest URL、
UIまたはAPI種別、必要な認証情報を設定する。workflowに本番URLを直接書かない。

### Transform customを月次workflowにする

既存の `transform-custom.yml` を月次 + 手動起動へ変更する。ジョブは次の順序で実行する。

1. checkout
2. Node.js 22をセットアップする
3. OIDCでAWS_ROLE_ARNを引き受ける
4. 公式インストール手順でATX CLIを導入する
5. inputまたはRepository Variablesから変換定義名などを解決する
6. `atx custom def exec` を公式オプションで非対話実行する
7. 既存のNode.jsビルドとPythonコンパイルを検証する
8. 変更があればブランチをpushし、`gh pr create` でPRを作成する

変換定義名を空のまま実行しない。実際の対象バージョンを特定せず、入力の追加コンテキストで指定できる
ようにする。変換後に変更がなければPRを作成しない。

### Continuumをworkflowから分離する

Continuumのコードレビューは、GitHub App、Agent Space、接続リポジトリの設定で動作する。したがって
Actions workflowには追加せず、READMEのPRイベント説明と前提条件で扱う。これにより、未確認のActionや
CLIを導入せず、公式の実行モデルを保つ。

### READMEを実装と一致させる

READMEの構成表、CI/CD説明、Mermaidフローチャート、シーケンス図を2本構成へ更新する。図では
ContinuumをPR連携として描き、Actionsから直接呼び出す矢印を描かない。

## 変更対象

| ファイル | 変更 |
| --- | --- |
| `.github/workflows/cdk.yml` | DevOps Agent release test jobをdeploy後に追加 |
| `.github/workflows/devops-agent.yml` | 削除 |
| `.github/workflows/transform-custom.yml` | 月次・手動起動、ATX実行、テスト、PR作成へ変更 |
| `README.md` | 説明、Secrets / Variables、Mermaid 2本を更新 |
| `.kiro/specs/two-github-actions-workflows/spec.md` | 要求仕様とclarify結果を記録 |
| `.kiro/specs/two-github-actions-workflows/plan.md` | 技術方針と検証境界を記録 |
| `.kiro/specs/two-github-actions-workflows/tasks.md` | タスク、analyze結果、完了記録を記録 |

## 権限と設定

| workflow | 権限・設定 |
| --- | --- |
| `cdk.yml` synth | `contents: read` |
| `cdk.yml` deploy | `id-token: write`、`contents: read`、Secret `AWS_ROLE_ARN` |
| `cdk.yml` release test | `checks: write`、`contents: read`、`pull-requests: read`、Secrets `DEVOPS_AGENT_WEBHOOK_URL` / `DEVOPS_AGENT_WEBHOOK_SECRET`、Variable `DEVOPS_AGENT_TEST_PROFILE_ID` |
| `transform-custom.yml` | `id-token: write`、`contents: write`、`pull-requests: write`、Secret `AWS_ROLE_ARN`、Variables `ATX_TRANSFORMATION_NAME` など |

## 検証計画

- workflow YAMLをRubyまたはPythonのYAMLパーサーで読み、`on`、jobs、needs、if、permissionsを確認する。
- `actionlint` が利用可能なら実行する。利用できなければ未実行理由を報告する。
- READMEのMermaid構文をMermaid CLIが利用可能な場合に検証する。
- `markdownlint` が利用可能ならREADMEとSpec成果物を検証する。
- `git diff --check`を実行する。
- `npm`やPythonの既存テストは、workflow定義変更のため実行可能な範囲で既存コマンドを確認する。
- AWSリソース、CDKデプロイ、ATX実行、DevOps Agent、外部URLへのテストは実行しない。

## リスクと境界

ATX CLIの実行にはAWS側のCLI利用条件と `transform-custom:*` 権限が必要である。Repository Variablesが未設定の
場合、workflowは変換定義名の不足を明示して終了する。これは曖昧な変換を実行しないための安全な失敗である。
DevOps Agentは実際のHTTPリクエストを送るため、Test ProfileのURLがstagingまたはtestであることを運用上の前提とする。
