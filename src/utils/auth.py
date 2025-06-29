import jwt
import json

def get_user_from_event(event):
    """Extract user information from API Gateway event"""
    try:
        # Get user from authorizer context
        authorizer = event.get('requestContext', {}).get('authorizer', {})
        claims = authorizer.get('claims', {})
        
        user_id = claims.get('sub')
        email = claims.get('email')
        
        if not user_id:
            raise ValueError("User ID not found in token")
        
        return {
            'user_id': user_id,
            'email': email
        }
    except Exception as e:
        raise ValueError(f"Invalid or missing authentication: {str(e)}")

def validate_user_access(event, resource_user_id):
    """Validate that the authenticated user can access the resource"""
    try:
        user = get_user_from_event(event)
        if user['user_id'] != resource_user_id:
            raise ValueError("Access denied: User can only access their own resources")
        return user
    except Exception as e:
        raise ValueError(f"Access validation failed: {str(e)}") 