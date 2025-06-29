import json
import boto3
import os
import sys
from datetime import datetime
from email_validator import validate_email, EmailNotValidError
from boto3.dynamodb.conditions import Key

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
    """Update an existing time capsule"""
    
    # Handle CORS preflight
    if event['httpMethod'] == 'OPTIONS':
        return cors_response()
    
    try:
        # Authenticate user
        user = get_user_from_event(event)
        
        # Get capsule ID from path
        capsule_id = event['pathParameters']['id']
        
        # Parse request body
        body = json.loads(event['body'])
        
        # Get existing capsule
        response = table.get_item(Key={'id': capsule_id})
        if 'Item' not in response:
            return error_response("Capsule not found", 404)
        
        existing_capsule = response['Item']
        
        # Verify user owns this capsule
        if existing_capsule['user_id'] != user['user_id']:
            return error_response("Access denied", 403)
        
        # Check if capsule is already delivered
        if existing_capsule.get('status') == 'delivered':
            return error_response("Cannot update delivered capsule", 400)
        
        # Prepare update expression
        update_expression = "SET updated_at = :updated_at"
        expression_values = {':updated_at': datetime.utcnow().isoformat()}
        
        # Update allowed fields
        updatable_fields = ['title', 'message', 'recipient_email', 'scheduled_date', 'occasion', 'tags']
        
        for field in updatable_fields:
            if field in body:
                if field == 'recipient_email':
                    # Validate email
                    try:
                        valid = validate_email(body[field])
                        value = valid.email
                    except EmailNotValidError:
                        return error_response("Invalid recipient email address")
                elif field == 'scheduled_date':
                    # Validate scheduled date
                    try:
                        scheduled_datetime = datetime.fromisoformat(body[field].replace('Z', '+00:00'))
                        if scheduled_datetime <= datetime.now(scheduled_datetime.tzinfo):
                            return error_response("Scheduled date must be in the future")
                        
                        # Update both scheduled_date and scheduled_time
                        update_expression += f", scheduled_date = :scheduled_date, scheduled_time = :scheduled_time"
                        expression_values[':scheduled_date'] = body[field]
                        expression_values[':scheduled_time'] = scheduled_datetime.isoformat()
                        continue
                    except ValueError:
                        return error_response("Invalid date format. Use ISO 8601 format")
                else:
                    value = body[field]
                
                update_expression += f", {field} = :{field}"
                expression_values[f':{field}'] = value
        
        # Handle message updates (S3 storage logic)
        if 'message' in body:
            message_content = body['message']
            s3_key = existing_capsule.get('s3_key')
            
            if len(message_content) > 1000:
                # Store in S3
                if not s3_key:
                    s3_key = f"capsules/{user['user_id']}/{capsule_id}/message.txt"
                
                s3.put_object(
                    Bucket=bucket,
                    Key=s3_key,
                    Body=message_content.encode('utf-8'),
                    ContentType='text/plain'
                )
                
                # Remove message from DynamoDB, keep S3 key
                update_expression += ", s3_key = :s3_key"
                update_expression += " REMOVE message"
                expression_values[':s3_key'] = s3_key
            else:
                # Store in DynamoDB, remove from S3 if exists
                if s3_key:
                    try:
                        s3.delete_object(Bucket=bucket, Key=s3_key)
                    except:
                        pass  # Ignore if file doesn't exist
                    update_expression += " REMOVE s3_key"
        
        # Update the capsule
        table.update_item(
            Key={'id': capsule_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values,
            ReturnValues='ALL_NEW'
        )
        
        return success_response({
            'id': capsule_id,
            'message': 'Time capsule updated successfully'
        })
        
    except ValueError as e:
        return error_response(str(e), 401)
    except Exception as e:
        print(f"Error updating capsule: {str(e)}")
        return error_response("Internal server error", 500) 