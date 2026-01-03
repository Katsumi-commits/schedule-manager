import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { FrontendStack } from './stacks/frontend-stack';
import { BackendStack } from './stacks/backend-stack';
import { DatabaseStack } from './stacks/database-stack';

export interface AppConfig {
  env: string;
  domain?: string;
  certificateArn?: string;
}

export class AiDeveloperStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const config: AppConfig = {
      env: this.node.tryGetContext('env') || 'dev',
      domain: this.node.tryGetContext('domain'),
      certificateArn: this.node.tryGetContext('certificateArn')
    };

    // Database layer
    const database = new DatabaseStack(this, 'Database', {
      config,
      ...props
    });

    // Backend API layer
    const backend = new BackendStack(this, 'Backend', {
      config,
      issuesTable: database.issuesTable,
      projectsTable: database.projectsTable,
      ...props
    });

    // Frontend layer
    const frontend = new FrontendStack(this, 'Frontend', {
      config,
      apiUrl: backend.apiUrl,
      ...props
    });

    // Outputs
    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: frontend.websiteUrl,
      description: 'Website URL'
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: backend.apiUrl,
      description: 'API Gateway URL'
    });
  }
}