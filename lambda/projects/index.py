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
