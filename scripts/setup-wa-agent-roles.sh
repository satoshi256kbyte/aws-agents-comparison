#!/usr/bin/env bash
# AWS Well-Architected Agentの実行ロールとアクセスロールを作る補助スクリプト。
# AWS WA AgentのAPIはIAMロールを自動作成しないため、必要な場合だけ APPLY=true で実行する。
set -euo pipefail

: "${AWS_ACCOUNT_ID:?AWS_ACCOUNT_ID is required}"
PROFILE_ACCOUNT_ID="${PROFILE_ACCOUNT_ID:-$AWS_ACCOUNT_ID}"
EXECUTION_ROLE_NAME="${EXECUTION_ROLE_NAME:-ExecutionRoleForWellArchitectedAgent}"
ACCESS_ROLE_NAME="${ACCESS_ROLE_NAME:-AccessRoleForWellArchitectedAgent}"
APPLY="${APPLY:-false}"

execution_role_arn="arn:aws:iam::${PROFILE_ACCOUNT_ID}:role/service-role/${EXECUTION_ROLE_NAME}"
access_role_arn="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ACCESS_ROLE_NAME}"

execution_trust='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"wellarchitected.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
execution_permissions=$(cat <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"sts:AssumeRole","Resource":"${access_role_arn}"}]}
JSON
)
access_trust=$(cat <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"${execution_role_arn}"},"Action":"sts:AssumeRole"}]}
JSON
)

if [[ "$APPLY" != true ]]; then
  echo 'Preview only. Set APPLY=true to create or attach the roles.'
  echo "Execution role: ${execution_role_arn}"
  echo "Access role:    ${access_role_arn}"
  exit 0
fi

if ! aws iam get-role --role-name "$EXECUTION_ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role \
    --path /service-role/ \
    --role-name "$EXECUTION_ROLE_NAME" \
    --assume-role-policy-document "$execution_trust"
fi
aws iam put-role-policy \
  --role-name "$EXECUTION_ROLE_NAME" \
  --policy-name WellArchitectedAgentAssumeAccessRole \
  --policy-document "$execution_permissions"

if ! aws iam get-role --role-name "$ACCESS_ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role \
    --role-name "$ACCESS_ROLE_NAME" \
    --assume-role-policy-document "$access_trust"
fi
aws iam update-assume-role-policy \
  --role-name "$ACCESS_ROLE_NAME" \
  --policy-document "$access_trust"
aws iam attach-role-policy \
  --role-name "$ACCESS_ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/WellArchitectedAgentResourceScanning

aws iam get-role --role-name "$EXECUTION_ROLE_NAME" --query 'Role.Arn' --output text
aws iam get-role --role-name "$ACCESS_ROLE_NAME" --query 'Role.Arn' --output text
