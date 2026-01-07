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
      code: lambda.Code.fromInline(`
import json, boto3, os, uuid, re
from datetime import datetime, timedelta

bedrock = boto3.client('bedrock-runtime')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['ISSUES_TABLE'])

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
}

def parse_with_bedrock(message):
    try:
        response = bedrock.invoke_model(
            modelId='anthropic.claude-3-haiku-20240307-v1:0',
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 500,
                'messages': [{
                    'role': 'user',
                    'content': f'''Parse this Japanese task and return JSON with startDate/endDate in YYYY-MM-DD format.
                    
                    Input: {message}
                    Today: {datetime.utcnow().strftime('%Y-%m-%d')}
                    
                    Calculate business days (exclude weekends and Japanese holidays).
                    Examples:
                    - "今日から3日" = 3 business days from today
                    - "1/28から3日" = 3 business days from Jan 28
                    - "明日から2日" = 2 business days from tomorrow
                    
                    Return ONLY valid JSON: {{"title": "task name", "assignee": "person", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}}'''
                }]
            })
        )
        
        result = json.loads(response['body'].read())
        content = result['content'][0]['text']
        print(f"Bedrock response: {content}")
        
        # JSON抽出を改善
        json_match = re.search(r'\{[^{}]*"title"[^{}]*"assignee"[^{}]*"startDate"[^{}]*"endDate"[^{}]*\}', content)
        if json_match:
            parsed_json = json.loads(json_match.group())
            print(f"Parsed JSON: {parsed_json}")
            return parsed_json
    except Exception as e:
        print(f"Bedrock parsing error: {e}")
    
    return None

def handler(event, context):
    print(f"Chat function called: {json.dumps(event)}")
    print(f"Context: {context}")
    print(f"Environment: ISSUES_TABLE={os.environ.get('ISSUES_TABLE')}")
    
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}
    
    try:
        body = json.loads(event['body'])
        message = body.get('message', '')
        priority = body.get('priority', 'Medium')
        
        # Bedrockで自然言語処理
        parsed = parse_with_bedrock(message)
        
        if not parsed or not all(k in parsed for k in ['title', 'assignee', 'startDate', 'endDate']):
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'success': False, 'message': 'タスク情報を正しくパースできませんでした'})
            }
        
        item = {
            'id': str(uuid.uuid4()),
            'createdAt': datetime.utcnow().isoformat(),
            'title': parsed['title'],
            'description': message,
            'priority': {'Low': 1, 'Medium': 2, 'High': 3}.get(priority, 2),
            'status': 'Open',
            'assigneeId': parsed['assignee'],
            'startDate': parsed['startDate'],
            'endDate': parsed['endDate'],
            'projectId': body.get('projectId', 'default')
        }
        
        table.put_item(Item=item)
        
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'success': True, 'issueId': item['id']})
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': str(e)})
        }
      `),
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
      code: lambda.Code.fromInline(`
import json, boto3, os, uuid
from datetime import datetime
from decimal import Decimal

def decimal_default(obj):
    return int(obj) if isinstance(obj, Decimal) and obj % 1 == 0 else float(obj) if isinstance(obj, Decimal) else None

dynamodb = boto3.resource('dynamodb')
projects_table = dynamodb.Table(os.environ['PROJECTS_TABLE'])

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
}

def handler(event, context):
    print(f"Projects function called: {json.dumps(event)}")
    print(f"Method: {event.get('httpMethod')}")
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}
    
    method = event['httpMethod']
    
    try:
        if method == 'GET':
            response = projects_table.scan()
            projects = response['Items'] or [{'id': 'default', 'name': 'Default Project', 'createdAt': datetime.utcnow().isoformat()}]
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps(projects, default=decimal_default)}
        
        elif method == 'POST':
            body = json.loads(event['body'])
            project_id = str(uuid.uuid4())
            
            projects_table.put_item(Item={
                'id': project_id,
                'name': body['name'],
                'createdAt': datetime.utcnow().isoformat()
            })
            
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'success': True, 'id': project_id})}
        
        elif method == 'PUT':
            body = json.loads(event['body'])
            project_id = event['pathParameters']['id']
            
            projects_table.update_item(
                Key={'id': project_id},
                UpdateExpression='SET #name = :name',
                ExpressionAttributeNames={'#name': 'name'},
                ExpressionAttributeValues={':name': body['name']}
            )
            
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'success': True})}
            
    except Exception as e:
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': str(e)})}
      `),
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
      code: lambda.Code.fromInline(`
import json, boto3, os
from decimal import Decimal

def decimal_default(obj):
    return int(obj) if isinstance(obj, Decimal) and obj % 1 == 0 else float(obj) if isinstance(obj, Decimal) else None

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['ISSUES_TABLE'])

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
}

def handler(event, context):
    print(f"Issues function called: {json.dumps(event)}")
    print(f"Method: {event.get('httpMethod')}")
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}
    
    method = event['httpMethod']
    
    try:
        if method == 'GET':
            response = table.scan()
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps(response['Items'], default=decimal_default)}
        
        elif method == 'PUT':
            body = json.loads(event['body'])
            issue_id = event['pathParameters']['id']
            
            update_expression = 'SET #status = :status'
            expression_names = {'#status': 'status'}
            expression_values = {':status': body.get('status', 'Open')}
            
            for field in ['startDate', 'endDate', 'priority']:
                if field in body:
                    update_expression += f', {field} = :{field}'
                    expression_values[f':{field}'] = body[field]
            
            table.update_item(
                Key={'id': issue_id, 'createdAt': body['createdAt']},
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expression_names,
                ExpressionAttributeValues=expression_values
            )
            
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'success': True})}
        
        elif method == 'DELETE':
            body = json.loads(event['body'])
            issue_id = event['pathParameters']['id']
            
            table.delete_item(Key={'id': issue_id, 'createdAt': body['createdAt']})
            
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'success': True})}
            
    except Exception as e:
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': str(e)})}
      `),
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