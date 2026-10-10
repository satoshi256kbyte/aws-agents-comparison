#!/usr/bin/env bash
# AWS Well-Architected Agentのアーキテクチャレビューを手動で実行する。
# このスクリプトはCI/CDではなく、数ヶ月に一度のレビュー用途を想定する。
set -euo pipefail

: "${PROFILE_ARN:?PROFILE_ARN is required}"
: "${S3_URI:?S3_URI is required}"

aws wellarchitected start-agent-recommendation-generation \
  --profile-arn "$PROFILE_ARN" \
  --types ARCHITECTURE \
  --name "${REVIEW_NAME:-blog-agents-review}" \
  --scope '{"pillars":["COST_OPTIMIZATION","SECURITY","RESILIENCE","PERFORMANCE"]}' \
  --additional-context "$(python3 -c 'import json, os; print(json.dumps({"s3Uri": os.environ["S3_URI"], "lensArns": ["arn:aws:wellarchitected::aws:lens/wellarchitected"]}))')"

echo 'Review generations:'
aws wellarchitected list-agent-recommendation-generations \
  --profile-arn "$PROFILE_ARN"

echo 'Recommendations:'
aws wellarchitected list-agent-recommendations \
  --profile-arn "$PROFILE_ARN"

# 対応済みの指摘をクローズする場合:
# aws wellarchitected update-agent-recommendation-status \
#   --recommendation-arn "$RECOMMENDATION_ARN" \
#   --status COMPLETED \
#   --update-reason "対応済み"
