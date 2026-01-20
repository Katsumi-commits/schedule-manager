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
