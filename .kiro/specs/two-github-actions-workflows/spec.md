# GitHub Actions 2本構成への再設計仕様

## フェーズ状態

- specify: 完了。既存の3本構成とユーザー要求から要求仕様を確定した。
- clarify: 完了。指定されたAWS公式ドキュメントを確認し、未決事項と出力契約を解消した。
- analyze: 完了。spec、plan、tasksの整合性を確認し、Critical / Highの指摘はない。

## 背景

このリポジトリには、CDKのCI/CD、AWS DevOps Agentのリリーステスト、AWS Transform customの
ワークフローが別々に存在する。最終的なGitHub Actions workflowを2本に統合し、READMEの図も
実際の動作と公式仕様に合わせる。

## 要求事項

### R1. workflowを2本にする

`.github/workflows` 配下のworkflow YAMLは最終的に次の2本だけにする。

| workflow | 役割 |
| --- | --- |
| `cdk.yml` | PRのsynth、mainへのpush後のCDKデプロイ、デプロイ後のリリーステスト |
| `transform-custom.yml` | 月次および手動起動のAWS Transform custom実行とPR作成 |

既存の `devops-agent.yml` は削除する。

### R2. mainへのpush後にDevOps Agentのリリーステストを行う

`cdk.yml` はmainへのpush時にsynth、deployの順で実行し、deploy成功後に
`aws-actions/devops-agent-qa@v1`を実行する。

Actionには公式入力の `webhook-url`、`webhook-secret`、`test-profile-id` を渡す。
任意の `test-requirement` も設定できる。テストプロファイルにはstagingまたはtest環境のURLを
登録し、本番URLを対象にしない。Actionのjob権限は公式例に合わせて
`checks: write`、`contents: read`、`pull-requests: read`とする。

### R3. Continuum / AWS Security Agentのセキュリティレビューを正しく表現する

AWS Security Agent（現行ドキュメント上のAWS Continuum）は、GitHub Appで接続されたリポジトリの
PR作成・更新などを契機にコードを分析し、PRへセキュリティレビューを投稿する。SASTに近い
脆弱性検査や組織のセキュリティ要件検証はこの連携で扱う。

公式のContinuum用GitHub Actions security actionやCLIは確認できないため、workflowから直接呼び出す
job、存在しないaction、推測したCLIは作成しない。READMEには、Continuumはmain push時の
Actions jobではなく、GitHub連携によるPRイベントで動作することを明記する。

### R4. 月次のTransform custom実行とPR作成

`transform-custom.yml` は毎月1日に起動し、`workflow_dispatch`でも実行できる。AWS Transform
customの `atx custom def exec` をrunner上で実行し、変更がある場合だけブランチをpushして
GitHub PRを作成する。

AWS管理 transformation name、変換対象バージョン、変換定義のバージョンはworkflowに根拠なく
固定しない。`workflow_dispatch` の入力値を優先し、未指定時はRepository Variablesから取得する。
少なくとも transformation name は `ATX_TRANSFORMATION_NAME` で上書きできるようにする。
AWS側のcontinuous modernizationにある月次スケジュールとPR remediationも代替設計として
READMEに記載し、今回の「Actionsを2本にする」という制約からrunner + ATX + gh方式を採用する。

対象リポジトリを確認した結果、CDKはNode.js 22、LambdaコードはPython 3.12を使っている。
ただし、実際に適用する変換定義や目標バージョンはRepository Variablesまたは手動入力で決め、
現在のコードから自動的に特定のアップグレードを強制しない。

### R5. READMEの図を2本構成へ更新する

READMEには、一般的なMermaid記法で次の2本のworkflowを説明する。

- workflowの起動条件、synth、deploy、DevOps Agent release testing、Transform custom、PR作成を含むフローチャート
- GitHub、Actions、AWS、DevOps Agent、AWS Transform、Continuumの連携を含むシーケンス図

Mermaidのノードラベルやシーケンス図のメッセージは特殊文字で構文エラーにならない安全な記法にする。

## Clarify

### 未決事項の解消

| 論点 | 解消した判断 | 根拠 |
| --- | --- | --- |
| Continuumをmain pushのjobにするか | しない。PR連携をREADMEで説明する | AWS Security AgentのGitHubコードレビュー仕様 |
| DevOps Agentの対象URLをどこで指定するか | Test Profile IDをRepository Variableで指定し、URLはAgent側のprofileに保持する | release testing公式Actionと公式ガイド |
| release testの起動条件 | CDK deploy成功後のmain push | ユーザー要求とActionのデプロイ後利用例 |
| release testで変更系HTTPリクエストを許可するか | stagingまたはtest URLに限定し、本番URLは使わない | release testing公式のPOST、PUT、DELETEに関する注意 |
| Transformの変換定義名と目標バージョン | 固定しない。入力またはRepository Variablesで指定する | ユーザー要求と対象コードの安全な取り扱い |
| Transformの実行方式 | Actions runnerでATX CLIを実行してghでPRを作る方式を採用する | workflowを2本にする制約。AWS側スケジュール方式は代替として文書化 |
| AWS認証 | 既存のOIDCと `AWS_ROLE_ARN` を維持する | 既存 `cdk.yml` の構成 |

### 公式仕様との境界

AWS Security Agentのコードレビューは、GitHub App接続とAgent Space側の設定が必要である。
workflowの `permissions` やSecretsだけで有効化する機能ではない。AWS Transform customも、ATX CLIの
インストール、AWS認証、`transform-custom:*` 権限、利用可能な変換定義の準備が必要である。
これらのAWS側設定はこの変更で作成・実行せず、READMEに前提条件として記載する。

## 出力契約

| 出力 | 契約 |
| --- | --- |
| `.github/workflows/cdk.yml` | PR synth、main pushのdeploy、deploy後の公式DevOps Agent Action |
| `.github/workflows/transform-custom.yml` | 月次・手動ATX実行、変更時のみGitHub PR作成 |
| `.github/workflows/devops-agent.yml` | 削除され、workflow総数に含まれない |
| `README.md` | 2本の図、Continuumの正しい境界、Secrets / Variables、staging注意事項 |
| `.kiro/specs/two-github-actions-workflows/*` | specify、clarify、plan、tasks、analyzeの判断記録 |

## 受け入れ条件

- `.github/workflows` にworkflow YAMLが2本だけ存在する。
- `cdk.yml` のrelease testがdeploy成功後のmain pushでのみ実行される。
- `aws-actions/devops-agent-qa@v1` に `test-profile-id` を含む公式入力を渡す。
- Continuum用の架空Action、CLI、直接呼び出しjobが存在しない。
- 月次Transform workflowが変換結果に変更がある場合だけPRを作成する。
- transformation nameなどの可変値を入力またはRepository Variablesで上書きできる。
- READMEのMermaid図が2本構成と実際の連携を説明する。
- YAMLパース、可能な静的検証、markdownlint、`git diff --check`を実施する。
- AWSリソース作成、デプロイ、外部サービスの実行は行わない。
