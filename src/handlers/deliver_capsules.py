import json
import boto3
import os
import sys
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key, Attr

# Add src to path for imports
sys.path.append('/opt/python')
sys.path.append(os.path.join(os.environ.get('LAMBDA_TASK_ROOT', ''), 'src'))

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')
ses = boto3.client('ses')
table = dynamodb.Table(os.environ['DYNAMODB_TABLE'])
bucket = os.environ['S3_BUCKET']
from_email = os.environ['FROM_EMAIL']

def handler(event, context):
    """Deliver time capsules that are due"""
    
    try:
        current_time = datetime.now(timezone.utc)
        current_time_iso = current_time.isoformat()
        
        print(f"Checking for capsules due before: {current_time_iso}")
        
        # Scan for capsules that are due for delivery
        # Note: In production, you might want to use a more efficient query structure
        response = table.scan(
            FilterExpression=Attr('status').eq('pending') & Attr('scheduled_time').lte(current_time_iso)
        )
        
        capsules = response['Items']
        delivered_count = 0
        failed_count = 0
        
        print(f"Found {len(capsules)} capsules due for delivery")
        
        for capsule in capsules:
            try:
                # Get message content
                message_content = capsule.get('message', '')
                
                # If message is stored in S3, retrieve it
                if capsule.get('s3_key') and not message_content:
                    try:
                        s3_response = s3.get_object(Bucket=bucket, Key=capsule['s3_key'])
                        message_content = s3_response['Body'].read().decode('utf-8')
                    except Exception as e:
                        print(f"Error retrieving message from S3: {str(e)}")
                        message_content = "Your time capsule message could not be retrieved."
                
                # Create email content
                subject = f"Time Capsule: {capsule.get('title', 'Your Message from the Past')}"
                
                # HTML email body
                html_body = f"""
                <html>
                <head>
                    <style>
                        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                        .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                        .message-box {{ background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }}
                        .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🕰️ Time Capsule Delivery</h1>
                            <p>A message from your past has arrived!</p>
                        </div>
                        <div class="content">
                            <h2>{capsule.get('title', 'Your Time Capsule')}</h2>
                            
                            <p><strong>Scheduled for:</strong> {capsule.get('scheduled_date', 'N/A')}</p>
                            <p><strong>Created on:</strong> {capsule.get('created_at', 'N/A')}</p>
                            {f"<p><strong>Occasion:</strong> {capsule.get('occasion')}</p>" if capsule.get('occasion') else ""}
                            
                            <div class="message-box">
                                <h3>Your Message:</h3>
                                <p style="white-space: pre-wrap;">{message_content}</p>
                            </div>
                            
                            <p style="margin-top: 30px;">
                                <em>This time capsule was created to be delivered at this exact moment. 
                                We hope it brings back wonderful memories or provides the guidance you were seeking.</em>
                            </p>
                        </div>
                        <div class="footer">
                            <p>Delivered by Time Capsule App</p>
                            <p>This is an automated delivery - please do not reply to this email.</p>
                        </div>
                    </div>
                </body>
                </html>
                """
                
                # Text version
                text_body = f"""
                TIME CAPSULE DELIVERY
                
                {capsule.get('title', 'Your Time Capsule')}
                
                Scheduled for: {capsule.get('scheduled_date', 'N/A')}
                Created on: {capsule.get('created_at', 'N/A')}
                {f"Occasion: {capsule.get('occasion')}" if capsule.get('occasion') else ""}
                
                Your Message:
                {message_content}
                
                This time capsule was created to be delivered at this exact moment.
                We hope it brings back wonderful memories or provides the guidance you were seeking.
                
                Delivered by Time Capsule App
                """
                
                # Send email via SES
                ses.send_email(
                    Source=from_email,
                    Destination={'ToAddresses': [capsule['recipient_email']]},
                    Message={
                        'Subject': {'Data': subject},
                        'Body': {
                            'Text': {'Data': text_body},
                            'Html': {'Data': html_body}
                        }
                    }
                )
                
                # Update capsule status to delivered
                table.update_item(
                    Key={'id': capsule['id']},
                    UpdateExpression='SET #status = :status, delivered_at = :delivered_at, updated_at = :updated_at',
                    ExpressionAttributeNames={'#status': 'status'},
                    ExpressionAttributeValues={
                        ':status': 'delivered',
                        ':delivered_at': current_time_iso,
                        ':updated_at': current_time_iso
                    }
                )
                
                delivered_count += 1
                print(f"Successfully delivered capsule {capsule['id']} to {capsule['recipient_email']}")
                
            except Exception as e:
                print(f"Failed to deliver capsule {capsule['id']}: {str(e)}")
                
                # Mark as failed
                try:
                    table.update_item(
                        Key={'id': capsule['id']},
                        UpdateExpression='SET #status = :status, error_message = :error, updated_at = :updated_at',
                        ExpressionAttributeNames={'#status': 'status'},
                        ExpressionAttributeValues={
                            ':status': 'failed',
                            ':error': str(e),
                            ':updated_at': current_time_iso
                        }
                    )
                except:
                    pass  # Ignore errors when updating failed status
                
                failed_count += 1
        
        result = {
            'processed': len(capsules),
            'delivered': delivered_count,
            'failed': failed_count,
            'timestamp': current_time_iso
        }
        
        print(f"Delivery run completed: {json.dumps(result)}")
        return result
        
    except Exception as e:
        print(f"Error in delivery function: {str(e)}")
        raise e 