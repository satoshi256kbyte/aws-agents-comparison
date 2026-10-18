# GitHub Actions 2本構成のタスク

## フェーズ状態

- specify: 完了。`spec.md` を作成した。
- clarify: 完了。`spec.md` のClarify節に公式仕様との境界を記録した。
- plan: 完了。`plan.md` に実装方針と検証境界を記録した。
- tasks: 完了。このタスク一覧を作成した。
- analyze: 完了。要件カバレッジを確認し、Critical / Highの指摘はなかった。
- implement: 完了。workflow統合、README更新、不要workflow削除を実施した。

## 実装タスク

- [x] `cdk.yml` のmain push後にCDK deployとDevOps Agent release testingを接続する。
- [x] DevOps Agent Actionを公式入力と最小権限で設定する。
- [x] `devops-agent.yml` を削除し、workflowを2本にする。
- [x] `transform-custom.yml` を月次・手動起動へ変更する。
- [x] ATX CLIを公式手順と公式 `atx custom def exec` オプションで実行する。
- [x] 変換結果がある場合だけ `gh pr create` でPRを作成する。
- [x] READMEの説明、前提、Secrets / Variables、Mermaid図を2本構成へ更新する。

## Analyze（実装前）

### 要件カバレッジ

| 要件 | spec | plan | 実装タスク |
| --- | --- | --- | --- |
| workflowを2本にする | R1 | CDK + Transform統合 | 削除・統合タスク |
| main push後のrelease test | R2 | deploy依存のjob | cdk.ymlタスク |
| ContinuumのPR連携 | R3 | workflowから分離 | READMEタスク |
| 月次TransformとPR | R4 | ATX + gh方式 | Transformタスク |
| Mermaid更新 | R5 | 2本の図 | READMEタスク |
| 検証と非実行境界 | 受け入れ条件 | 最終検証 |

### Critical / High確認

- Critical: なし。公式に存在しないContinuum Actionを作らない境界を明記している。
- High: なし。DevOps Actionの必須 `test-profile-id`、deploy依存、staging/test URL前提を明記している。
- Medium: なし。ATXの変換定義名とバージョンを固定せず、入力またはVariablesで指定する。

### 判断

要求、公式仕様、実装タスクの対応関係に欠落はない。特にContinuumをmain pushのActions jobと
誤認しないこと、DevOps AgentをCDK deploy後に限定すること、Transformの可変値を固定しないことを
実装前の必須条件とする。以上により、実装へ進む。

## 実装後の検証記録

| 検証 | 結果 |
| --- | --- |
| `.github/workflows` のworkflow YAML数 | 2本。`cdk.yml` と `transform-custom.yml` |
| Ruby YAMLパース | 成功。2本とも `jobs` を確認 |
| 必須workflowアサーション | 成功。公式DevOps Action、`test-profile-id`、deploy依存、月次cron、ATX、gh PRを確認 |
| Continuumの架空Action確認 | 成功。workflowとREADMEに直接呼び出しを追加していない |
| `git diff --check` | 成功 |
| `actionlint` | 未実行。環境にコマンドが存在しない |
| Mermaid CLI | 未実行。環境に`mmdc`が存在しない |
| markdownlint | 未実行。環境に`markdownlint`が存在しない |
| AWS実行 | 未実行。リソース作成、デプロイ、ATX、DevOps Agentを実行していない |

## 未検証のAWS側前提

GitHub AppとAgent SpaceのAWS Security Agent設定、DevOps AgentのWebhookとTest Profile、
`AWS_ROLE_ARN`の信頼ポリシー、ATX CLIの利用権限 `transform-custom:*`、変換定義の存在は
リポジトリ外の設定であり、今回の検証対象外である。
