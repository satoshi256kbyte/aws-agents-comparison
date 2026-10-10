import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class SampleApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../apps/lambda-api')),
      description: 'Small Lambda API used to verify the deployed sample',
    });

    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'aws-agents-comparison-sample-api',
    });
    httpApi.addRoutes({
      path: '/health',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('ApiIntegration', apiFunction),
    });

    new cdk.CfnOutput(this, 'LambdaApiUrl', {
      value: `${httpApi.apiEndpoint}/health`,
      description: 'URL used by the Lambda smoke test',
    });
  }
}
