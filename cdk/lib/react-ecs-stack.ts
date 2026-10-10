import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

export class ReactEcsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });
    const bpaExclusion = new ec2.CfnVPCBlockPublicAccessExclusion(this, 'BpaExclusion', {
      internetGatewayExclusionMode: 'allow-bidirectional',
      vpcId: vpc.vpcId,
    });

    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: 'aws-agents-comparison-sample-cluster',
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    const page = `<!doctype html><html><head><meta charset="utf-8"><title>AWS agents sample</title></head><body><div id="root"></div><script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script><script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script><script>const e=React.createElement;ReactDOM.createRoot(document.getElementById('root')).render(e('main',null,e('h1',null,'AWS agents comparison sample'),e('p',null,'React is running on Amazon ECS.')))</script></body></html>`;
    const pageBase64 = Buffer.from(page).toString('base64');
    const serverScript = [
      "const http=require('http');",
      `const html=Buffer.from('${pageBase64}','base64').toString();`,
      "http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(html)}).listen(3000,'0.0.0.0');",
    ].join('');

    const container = taskDefinition.addContainer('ReactContainer', {
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/docker/library/node:22-alpine'),
      command: ['node', '-e', serverScript],
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'react-sample' }),
    });
    container.addPortMappings({ containerPort: 3000 });

    const service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      circuitBreaker: { rollback: true },
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });
    service.connections.allowFromAnyIpv4(ec2.Port.tcp(3000), 'Temporary public smoke-test endpoint');
    service.node.addDependency(bpaExclusion);

    new cdk.CfnOutput(this, 'EcsClusterName', { value: cluster.clusterName });
    new cdk.CfnOutput(this, 'EcsServiceName', { value: service.serviceName });
  }
}
