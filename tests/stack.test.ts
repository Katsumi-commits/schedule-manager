import { Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import { AiDeveloperStack } from '../lib/ai-developer-stack';

describe('AiDeveloperStack', () => {
  test('Stack creates successfully', () => {
    const app = new cdk.App();
    const stack = new AiDeveloperStack(app, 'TestStack');
    const template = Template.fromStack(stack);
    
    // Basic validation that stack has resources
    expect(template.toJSON()).toBeDefined();
  });
});