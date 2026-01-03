import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { BackendStack } from '../lib/stacks/backend-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';

describe('AI Task Manager Stacks', () => {
  let app: cdk.App;
  
  beforeEach(() => {
    app = new cdk.App();
  });

  test('Database Stack creates DynamoDB tables', () => {
    const stack = new DatabaseStack(app, 'TestDatabaseStack', {
      envName: 'test'
    });
    
    const template = Template.fromStack(stack);
    
    // Check if Issues table is created
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST'
    });
  });

  test('Backend Stack creates Lambda functions', () => {
    const databaseStack = new DatabaseStack(app, 'TestDatabaseStack', {
      envName: 'test'
    });
    
    const stack = new BackendStack(app, 'TestBackendStack', {
      envName: 'test',
      issuesTable: databaseStack.issuesTable,
      projectsTable: databaseStack.projectsTable
    });
    
    const template = Template.fromStack(stack);
    
    // Check if Lambda functions are created
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'python3.9'
    });
  });

  test('Frontend Stack creates S3 and CloudFront', () => {
    const stack = new FrontendStack(app, 'TestFrontendStack', {
      envName: 'test',
      apiUrl: 'https://test-api.example.com'
    });
    
    const template = Template.fromStack(stack);
    
    // Check if S3 bucket is created
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      }
    });
    
    // Check if CloudFront distribution is created
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Enabled: true
      }
    });
  });
});
