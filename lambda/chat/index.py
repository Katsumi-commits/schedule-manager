import json, boto3, os, uuid, re
from datetime import datetime

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
                    - "today + 3 days" = 3 business days from today
                    - "1/28 + 3 days" = 3 business days from Jan 28
                    - "tomorrow + 2 days" = 2 business days from tomorrow
                    
                    Return ONLY valid JSON: {{"title": "task name", "assignee": "person", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}}'''
                }]
            })
        )
        
        result = json.loads(response['body'].read())
        content = result['content'][0]['text']
        print(f"Bedrock response: {content}")
        
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
    
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}
    
    try:
        body = json.loads(event['body'])
        message = body.get('message', '')
        priority = body.get('priority', 'Medium')
        
        parsed = parse_with_bedrock(message)
        
        if not parsed or not all(k in parsed for k in ['title', 'assignee', 'startDate', 'endDate']):
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'success': False, 'message': 'Failed to parse task'})
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
