import json
import boto3
import uuid
from datetime import datetime
from email_validator import validate_email, EmailNotValidError
import os
import sys

# Add src to path for imports
sys.path.append('/opt/python')
sys.path.append(os.path.join(os.environ.get('LAMBDA_TASK_ROOT', ''), 'src'))

from utils.responses import success_response, error_response, cors_response
from utils.auth import get_user_from_event

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')
table = dynamodb.Table(os.environ['DYNAMODB_TABLE'])
bucket = os.environ['S3_BUCKET']

def handler(event, context):
    """Create a new time capsule"""
    
    # Handle CORS preflight
    if event['httpMethod'] == 'OPTIONS':
        return cors_response()
    
    try:
        # Authenticate user
        user = get_user_from_event(event)
        
        # Parse request body
        body = json.loads(event['body'])
        
        # Validate required fields
        required_fields = ['title', 'message', 'recipient_email', 'scheduled_date']
        for field in required_fields:
            if field not in body:
                return error_response(f"Missing required field: {field}")
        
        # Validate email
        try:
            valid = validate_email(body['recipient_email'])
            recipient_email = valid.email
        except EmailNotValidError:
            return error_response("Invalid recipient email address")
        
        # Validate scheduled date
        try:
            scheduled_datetime = datetime.fromisoformat(body['scheduled_date'].replace('Z', '+00:00'))
            if scheduled_datetime <= datetime.now(scheduled_datetime.tzinfo):
                return error_response("Scheduled date must be in the future")
        except ValueError:
            return error_response("Invalid date format. Use ISO 8601 format")
        
        # Generate unique ID
        capsule_id = str(uuid.uuid4())
        
        # Store message content in S3 if it's large or contains attachments
        message_content = body['message']
        s3_key = None
        
        if len(message_content) > 1000 or body.get('has_attachments', False):
            s3_key = f"capsules/{user['user_id']}/{capsule_id}/message.txt"
            s3.put_object(
                Bucket=bucket,
                Key=s3_key,
                Body=message_content.encode('utf-8'),
                ContentType='text/plain'
            )
            message_content = None  # Don't store in DynamoDB if in S3
        
        # Create capsule record
        capsule = {
            'id': capsule_id,
            'user_id': user['user_id'],
            'title': body['title'],
            'message': message_content,
            's3_key': s3_key,
            'recipient_email': recipient_email,
            'scheduled_date': body['scheduled_date'],
            'scheduled_time': scheduled_datetime.isoformat(),
            'status': 'pending',
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Add optional fields
        if 'occasion' in body:
            capsule['occasion'] = body['occasion']
        if 'tags' in body:
            capsule['tags'] = body['tags']
        
        # Save to DynamoDB
        table.put_item(Item=capsule)
        
        return success_response({
            'id': capsule_id,
            'message': 'Time capsule created successfully',
            'scheduled_date': body['scheduled_date']
        }, 201)
        
    except ValueError as e:
        return error_response(str(e), 401)
    except Exception as e:
        print(f"Error creating capsule: {str(e)}")
        return error_response("Internal server error", 500) 