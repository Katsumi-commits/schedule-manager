import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { AppConfig } from '../ai-developer-stack';

export interface BackendStackProps extends cdk.StackProps {
  config: AppConfig;
  issuesTable: dynamodb.Table;
  projectsTable: dynamodb.Table;
}

export class BackendStack extends cdk.NestedStack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const { config, issuesTable, projectsTable } = props;

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ],
      inlinePolicies: {
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['bedrock:InvokeModel'],
              resources: ['*']
            })
          ]
        })
      }
    });

    // Grant DynamoDB permissions
    issuesTable.grantReadWriteData(lambdaRole);
    projectsTable.grantReadWriteData(lambdaRole);

    // Chat Lambda function with Bedrock
    const chatFunction = new lambda.Function(this, 'ChatFunction', {
      functionName: `ai-issue-${config.env}-chat`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/chat'),
      environment: {
        ISSUES_TABLE: issuesTable.tableName
      },
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      logGroup: new logs.LogGroup(this, 'ChatFunctionLogGroup', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      })
    });

    // Projects CRUD Lambda
    const projectsFunction = new lambda.Function(this, 'ProjectsFunction', {
      functionName: `ai-issue-${config.env}-projects`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/projects'),
      environment: {
        PROJECTS_TABLE: projectsTable.tableName
      },
      role: lambdaRole,
      timeout: cdk.Duration.seconds(15),
      logGroup: new logs.LogGroup(this, 'ProjectsFunctionLogGroup', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      })
    });

    // Issues CRUD Lambda
    const issuesFunction = new lambda.Function(this, 'IssuesFunction', {
      functionName: `ai-issue-${config.env}-issues`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/issues'),
      environment: {
        ISSUES_TABLE: issuesTable.tableName
      },
      role: lambdaRole,
      timeout: cdk.Duration.seconds(15),
      logGroup: new logs.LogGroup(this, 'IssuesFunctionLogGroup', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      })
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: `ai-issue-${config.env}-api`,
      description: 'AI Issue Management API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization']
      }
    });

    // Chat endpoint
    const chat = api.root.addResource('chat');
    chat.addMethod('POST', new apigateway.LambdaIntegration(chatFunction));

    // Health check endpoint
    const health = api.root.addResource('health');
    health.addMethod('GET', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseTemplates: {
          'application/json': JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() })
        }
      }],
      requestTemplates: {
        'application/json': JSON.stringify({ statusCode: 200 })
      }
    }), {
      methodResponses: [{
        statusCode: '200',
        responseModels: {
          'application/json': apigateway.Model.EMPTY_MODEL
        }
      }]
    });

    // Projects endpoints
    const projects = api.root.addResource('projects');
    projects.addMethod('GET', new apigateway.LambdaIntegration(projectsFunction));
    projects.addMethod('POST', new apigateway.LambdaIntegration(projectsFunction));
    
    const projectById = projects.addResource('{id}');
    projectById.addMethod('PUT', new apigateway.LambdaIntegration(projectsFunction));

    // Issues endpoints
    const issues = api.root.addResource('issues');
    issues.addMethod('GET', new apigateway.LambdaIntegration(issuesFunction));
    
    const issueById = issues.addResource('{id}');
    issueById.addMethod('PUT', new apigateway.LambdaIntegration(issuesFunction));
    issueById.addMethod('DELETE', new apigateway.LambdaIntegration(issuesFunction));

    this.apiUrl = api.url;

    // Output API URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'API Gateway URL'
    });
  }
}