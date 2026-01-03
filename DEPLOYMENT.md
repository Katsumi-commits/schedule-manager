# AI Issue Manager - Deployment Guide

## Prerequisites
- AWS CLI configured
- Node.js 18+ installed
- CDK CLI installed: `npm install -g aws-cdk`

## Project Setup
```bash
cd C:\Users\81704\ai-developer
npm install
```

## Environment Deployment

### Development Environment
```bash
cdk deploy -c env=dev
```

### Staging Environment
```bash
cdk deploy -c env=stg
```

### Production Environment
```bash
cdk deploy -c env=prod -c domain=yourdomain.com -c certificateArn=arn:aws:acm:...
```

## Context Parameters

| Parameter | Description | Required | Example |
|-----------|-------------|----------|---------|
| `env` | Environment name | Yes | `dev`, `stg`, `prod` |
| `domain` | Custom domain | No | `issues.company.com` |
| `certificateArn` | SSL certificate ARN | No | `arn:aws:acm:us-east-1:...` |

## Resource Naming Convention

All resources follow the pattern: `ai-issue-{env}-{service}-{identifier}`

Examples:
- `ai-issue-dev-issues` (DynamoDB table)
- `ai-issue-prod-chat` (Lambda function)
- `ai-issue-stg-api` (API Gateway)

## Post-Deployment

1. **Enable Bedrock Models**
   - Go to AWS Bedrock console
   - Enable Claude 3.5 Sonnet model access

2. **Test the Application**
   - Open the Website URL from CDK output
   - Try: "Create a high priority bug for login issues"

3. **Monitor Resources**
   - CloudWatch Logs for Lambda functions
   - DynamoDB metrics
   - CloudFront access logs

## Cost Optimization

### Development
- DynamoDB on-demand billing
- Lambda pay-per-use
- CloudFront free tier eligible

### Production
- Consider DynamoDB provisioned capacity
- Lambda provisioned concurrency for consistent performance
- CloudFront price class optimization

## Security Considerations

1. **API Gateway**
   - Rate limiting enabled
   - CORS properly configured
   - Request validation

2. **Lambda Functions**
   - Least privilege IAM roles
   - Environment variables for configuration
   - CloudWatch logging enabled

3. **DynamoDB**
   - Encryption at rest
   - Point-in-time recovery (production)
   - Fine-grained access control

## Troubleshooting

### Common Issues

1. **Bedrock Access Denied**
   - Ensure model access is enabled in Bedrock console
   - Check IAM permissions for Lambda execution role

2. **CORS Errors**
   - Verify API Gateway CORS configuration
   - Check CloudFront origin settings

3. **DynamoDB Throttling**
   - Monitor consumed capacity
   - Consider switching to provisioned mode

### Useful Commands

```bash
# View stack outputs
cdk list

# Check differences
cdk diff -c env=dev

# Destroy stack
cdk destroy -c env=dev

# View CloudFormation template
cdk synth -c env=dev
```