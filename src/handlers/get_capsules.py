import json
import boto3
import os
import sys
from boto3.dynamodb.conditions import Key

# Add src to path for imports
sys.path.append('/opt/python')
sys.path.append(os.path.join(os.environ.get('LAMBDA_TASK_ROOT', ''), 'src'))

from utils.responses import success_response, error_response, cors_response
from utils.auth import get_user_from_event

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DYNAMODB_TABLE'])

def handler(event, context):
    """Get user's time capsules"""
    
    # Handle CORS preflight
    if event['httpMethod'] == 'OPTIONS':
        return cors_response()
    
    try:
        # Authenticate user
        user = get_user_from_event(event)
        
        # Get query parameters
        query_params = event.get('queryStringParameters') or {}
        status_filter = query_params.get('status')
        limit = int(query_params.get('limit', 50))
        last_key = query_params.get('last_key')
        
        # Query user's capsules
        query_kwargs = {
            'IndexName': 'UserIdIndex',
            'KeyConditionExpression': Key('user_id').eq(user['user_id']),
            'Limit': limit,
            'ScanIndexForward': False  # Most recent first
        }
        
        if last_key:
            query_kwargs['ExclusiveStartKey'] = json.loads(last_key)
        
        response = table.query(**query_kwargs)
        
        capsules = response['Items']
        
        # Filter by status if specified
        if status_filter:
            capsules = [c for c in capsules if c.get('status') == status_filter]
        
        # Remove sensitive information and format response
        formatted_capsules = []
        for capsule in capsules:
            formatted_capsule = {
                'id': capsule['id'],
                'title': capsule['title'],
                'recipient_email': capsule['recipient_email'],
                'scheduled_date': capsule['scheduled_date'],
                'status': capsule.get('status', 'pending'),
                'created_at': capsule['created_at'],
                'occasion': capsule.get('occasion'),
                'tags': capsule.get('tags', [])
            }
            
            # Include message preview (first 100 chars)
            if capsule.get('message'):
                formatted_capsule['message_preview'] = capsule['message'][:100] + '...' if len(capsule['message']) > 100 else capsule['message']
            elif capsule.get('s3_key'):
                formatted_capsule['message_preview'] = "Message stored as attachment"
            
            formatted_capsules.append(formatted_capsule)
        
        # Prepare response
        result = {
            'capsules': formatted_capsules,
            'count': len(formatted_capsules)
        }
        
        # Add pagination info
        if 'LastEvaluatedKey' in response:
            result['last_key'] = json.dumps(response['LastEvaluatedKey'])
        
        return success_response(result)
        
    except ValueError as e:
        return error_response(str(e), 401)
    except Exception as e:
        print(f"Error retrieving capsules: {str(e)}")
        return error_response("Internal server error", 500) 