#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SampleApiStack } from '../lib/sample-api-stack';
import { ReactEcsStack } from '../lib/react-ecs-stack';

const app = new cdk.App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
};

new SampleApiStack(app, 'SampleApiStack', { env });
new ReactEcsStack(app, 'ReactEcsStack', { env });
