import json
import boto3
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
    """Delete a time capsule"""
    
    # Handle CORS preflight
    if event['httpMethod'] == 'OPTIONS':
        return cors_response()
    
    try:
        # Authenticate user
        user = get_user_from_event(event)
        
        # Get capsule ID from path
        capsule_id = event['pathParameters']['id']
        
        # Get existing capsule
        response = table.get_item(Key={'id': capsule_id})
        if 'Item' not in response:
            return error_response("Capsule not found", 404)
        
        capsule = response['Item']
        
        # Verify user owns this capsule
        if capsule['user_id'] != user['user_id']:
            return error_response("Access denied", 403)
        
        # Check if capsule is already delivered
        if capsule.get('status') == 'delivered':
            return error_response("Cannot delete delivered capsule", 400)
        
        # Delete S3 objects if they exist
        if capsule.get('s3_key'):
            try:
                # Delete the specific file
                s3.delete_object(Bucket=bucket, Key=capsule['s3_key'])
                
                # Also try to delete any attachments in the capsule folder
                prefix = f"capsules/{user['user_id']}/{capsule_id}/"
                objects_response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
                
                if 'Contents' in objects_response:
                    delete_objects = [{'Key': obj['Key']} for obj in objects_response['Contents']]
                    s3.delete_objects(
                        Bucket=bucket,
                        Delete={'Objects': delete_objects}
                    )
            except Exception as e:
                print(f"Error deleting S3 objects: {str(e)}")
                # Continue with DynamoDB deletion even if S3 deletion fails
        
        # Delete from DynamoDB
        table.delete_item(Key={'id': capsule_id})
        
        return success_response({
            'id': capsule_id,
            'message': 'Time capsule deleted successfully'
        })
        
    except ValueError as e:
        return error_response(str(e), 401)
    except Exception as e:
        print(f"Error deleting capsule: {str(e)}")
        return error_response("Internal server error", 500) 