import json
import boto3
import os
import sys
import uuid
from urllib.parse import unquote

# Add src to path for imports
sys.path.append('/opt/python')
sys.path.append(os.path.join(os.environ.get('LAMBDA_TASK_ROOT', ''), 'src'))

from utils.responses import success_response, error_response, cors_response
from utils.auth import get_user_from_event

# Initialize AWS clients
s3 = boto3.client('s3')
bucket = os.environ['S3_BUCKET']

def handler(event, context):
    """Generate presigned URL for file upload or handle direct upload"""
    
    # Handle CORS preflight
    if event['httpMethod'] == 'OPTIONS':
        return cors_response()
    
    try:
        # Authenticate user
        user = get_user_from_event(event)
        
        if event['httpMethod'] == 'POST':
            # Handle direct file upload (base64 encoded)
            body = json.loads(event['body'])
            
            if 'file_data' not in body or 'file_name' not in body:
                return error_response("Missing file_data or file_name")
            
            # Validate file size (limit to 10MB)
            import base64
            file_data = body['file_data']
            if file_data.startswith('data:'):
                # Remove data URL prefix
                file_data = file_data.split(',')[1]
            
            try:
                decoded_data = base64.b64decode(file_data)
            except:
                return error_response("Invalid base64 file data")
            
            if len(decoded_data) > 10 * 1024 * 1024:  # 10MB limit
                return error_response("File size exceeds 10MB limit")
            
            # Generate unique file key
            file_extension = os.path.splitext(body['file_name'])[1]
            file_key = f"uploads/{user['user_id']}/{uuid.uuid4()}{file_extension}"
            
            # Determine content type
            content_type = body.get('content_type', 'application/octet-stream')
            
            # Upload to S3
            s3.put_object(
                Bucket=bucket,
                Key=file_key,
                Body=decoded_data,
                ContentType=content_type,
                Metadata={
                    'original_name': body['file_name'],
                    'uploaded_by': user['user_id']
                }
            )
            
            return success_response({
                'file_key': file_key,
                'file_name': body['file_name'],
                'file_size': len(decoded_data),
                'message': 'File uploaded successfully'
            })
        
        else:
            # Generate presigned URL for upload
            query_params = event.get('queryStringParameters') or {}
            file_name = query_params.get('file_name')
            content_type = query_params.get('content_type', 'application/octet-stream')
            
            if not file_name:
                return error_response("Missing file_name parameter")
            
            # Generate unique file key
            file_extension = os.path.splitext(file_name)[1]
            file_key = f"uploads/{user['user_id']}/{uuid.uuid4()}{file_extension}"
            
            # Generate presigned URL for PUT
            presigned_url = s3.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': bucket,
                    'Key': file_key,
                    'ContentType': content_type,
                    'Metadata': {
                        'original_name': file_name,
                        'uploaded_by': user['user_id']
                    }
                },
                ExpiresIn=3600  # 1 hour
            )
            
            return success_response({
                'presigned_url': presigned_url,
                'file_key': file_key,
                'file_name': file_name,
                'expires_in': 3600
            })
        
    except ValueError as e:
        return error_response(str(e), 401)
    except Exception as e:
        print(f"Error handling file upload: {str(e)}")
        return error_response("Internal server error", 500) 