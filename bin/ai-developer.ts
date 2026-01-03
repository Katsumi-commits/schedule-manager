#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AiDeveloperStack } from '../lib/ai-developer-stack';

const app = new cdk.App();

const env = app.node.tryGetContext('env') || 'dev';

new AiDeveloperStack(app, `AiIssueManager-${env}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
  tags: {
    Environment: env,
    Project: 'AI-Issue-Manager'
  }
});

app.synth();
