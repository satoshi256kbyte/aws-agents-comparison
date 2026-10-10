# AWSエージェント比較用の検証コード

Issue #2の記事で使う、AWS CDKとGitHub Actionsのサンプルです。

## 構成

| サンプル | 実装 | 確認方法 |
|----------|------|----------|
| Lambda API | Python 3.12 + API Gateway HTTP API | `curl`で`/health`を確認 |
| Reactデモ | React + Amazon ECS on Fargate | ECSタスクの公開IPへHTTPアクセス |
| DevOps Agent | 公式GitHub Action | デプロイ後に手動workflowでリリーステスト |
| Well-Architected Agent | AWS CLIスクリプト | 数ヶ月に一度の手動アーキテクチャレビュー |
| Transform Custom | 公式CLIを使うworkflowの設計 | 実行には変換定義と`atx`のセットアップが必要 |
| Continuum | PR連携の設計メモ | コードスキャン等の専用Actionは未確認。推測でCLIを実行しない |

AWSエージェントのプレビュー機能や有料機能は、アカウントの契約・権限・リージョンによって利用できません。
このリポジトリのCDKデプロイとアプリの疎通確認と、各サービスの呼び出しサンプルは分けて扱います。

## デプロイ

AWS CLIの認証とリージョン設定が済んでいることを前提にします。

```bash
cd cdk
npm ci
npm run build
npx cdk synth
npx cdk deploy --all --require-approval never
```

ECSサンプルは専用のVPCを作成し、パブリックサブネットにFargateタスクを配置します。
アカウントでVPC Block Public Accessが有効なため、CDKで対象VPCの除外を作成します。
この除外はECSタスクの公開IPへ到達するために必要です。

ECSサービスは公開IP付きのFargateタスクを1つ起動します。
検証後は、不要な課金を避けるために次のコマンドで削除してください。

```bash
npx cdk destroy --all
```

## スモークテスト

Lambda APIのURLはCDKのOutput `SampleApiStack.LambdaApiUrl`から取得します。

```bash
curl --fail "$LAMBDA_API_URL"
```

ECSタスクの公開IPは、次のように取得できます。

```bash
TASK_ARN=$(aws ecs list-tasks \
  --cluster aws-agents-comparison-sample-cluster \
  --service-name ReactEcsStack-Service \
  --query 'taskArns[0]' --output text)

ENI_ID=$(aws ecs describe-tasks \
  --cluster aws-agents-comparison-sample-cluster \
  --tasks "$TASK_ARN" \
  --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
  --output text)

PUBLIC_IP=$(aws ec2 describe-network-interfaces \
  --network-interface-ids "$ENI_ID" \
  --query 'NetworkInterfaces[0].Association.PublicIp' \
  --output text)

curl --fail "http://${PUBLIC_IP}:3000/"
```

## Well-Architected Agent

ここでいうエージェントプロファイルは、レビュー対象のAWSアカウント
そのものではありません。
レビュー対象のアカウントやリージョン、対象の柱、利用するIAMロールなどをまとめた
レビュー設定です。

プロファイルの集約設定に、1つまたは複数のレビュー対象アカウントを指定します。
1アカウントだけをレビューする場合も、エージェントプロファイルは必要です。

AWS WA AgentのAPIはIAMロールを自動作成しません。
プロファイル側の実行ロールと、分析対象アカウント側のアクセスロールを事前に用意します。

`scripts/setup-wa-agent-roles.sh` は、ロールの作成とポリシー設定をCLIで行う補助スクリプトです。
デフォルトはプレビューだけで、作成する場合だけ `APPLY=true` を指定します。

```bash
export AWS_ACCOUNT_ID=202633084296
export APPLY=true
./scripts/setup-wa-agent-roles.sh
```

実行ロールには `wellarchitected.amazonaws.com` の信頼ポリシーと、アクセスロールを引き受ける `sts:AssumeRole` が必要です。
アクセスロールには、実行ロールを信頼するポリシーと、AWS管理ポリシー `WellArchitectedAgentResourceScanning` を設定します。

公式ドキュメント:

- [Getting started with AWS Well-Architected Agent][wa-getting-started]
- [AWS Well-Architected Agent access model][wa-access-model]
- [AWS managed policy: WellArchitectedAgentResourceScanning][wa-managed-policy]
- [API quickstart][wa-api-quickstart]
- [Conducting architecture reviews][wa-architecture-reviews]
- [API actions][wa-api-actions]
- [UpdateAgentRecommendationStatus][wa-update-status]

プロファイル作成後は、次のスクリプトを使います。

```bash
export PROFILE_ARN='arn:aws:wellarchitected:<region>:<account-id>:agent-profile/<name>'
export S3_URI='s3://<bucket>/<cdk-template>.zip'
./scripts/run-wa-review.sh
```

レビュー結果は`list-agent-recommendations`で確認します。
対応済みの指摘は、レコメンデーションARNを指定して次のようにクローズします。

```bash
aws wellarchitected update-agent-recommendation-status \
  --recommendation-arn "$RECOMMENDATION_ARN" \
  --status COMPLETED \
  --update-reason '対応済み'
```

## CI/CDの位置づけ

- CDKのsynthはPRごとに実行します。
- アプリのデプロイはmainへのpush後に実行します。
- DevOps Agentのリリーステストは、デプロイ後の手動workflowで実行します。
- Well-Architected Agentは、数ヶ月に一度の手動レビューとして扱います。
- Transform CustomとContinuumは、公式の利用条件や連携方法を確認した上で有効化します。未確認のCLI呼び出しはworkflowに追加しません。

[wa-getting-started]: https://docs.aws.amazon.com/wellarchitected/latest/userguide/agent-getting-started.html
[wa-access-model]: https://docs.aws.amazon.com/wellarchitected/latest/userguide/security-iam-agent.html
[wa-managed-policy]: https://docs.aws.amazon.com/aws-managed-policy/latest/reference/WellArchitectedAgentResourceScanning.html
[wa-api-quickstart]: https://docs.aws.amazon.com/wellarchitected/latest/userguide/agent-api-quickstart.html
[wa-architecture-reviews]: https://docs.aws.amazon.com/wellarchitected/latest/userguide/agent-architecture-reviews.html
[wa-api-actions]: https://docs.aws.amazon.com/wellarchitected/latest/userguide/wa-api-actions.html
[wa-update-status]: https://docs.aws.amazon.com/wellarchitected/latest/APIReference/API_UpdateAgentRecommendationStatus.html
