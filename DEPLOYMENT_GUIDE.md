# Time Capsule App Deployment Guide

This guide will walk you through deploying the Time Capsule App to AWS using the automated deployment scripts.

## AWS Resources Created

The deployment will create the following AWS resources in your account:

### Core Infrastructure
- **CloudFormation Stack** - Infrastructure as Code management
- **IAM Roles & Policies** - Service permissions and access control
- **Lambda Execution Role** - Allows Lambda functions to access other AWS services

### Backend Services
- **AWS Lambda Functions** (3-4 functions):
  - `createCapsule` - Handle time capsule creation
  - `getCapsules` - Retrieve user's capsules
  - `deliverCapsules` - Scheduled email delivery
  - `authorizerFunction` - JWT token validation (if custom auth)

- **Amazon API Gateway**:
  - REST API with multiple endpoints
  - CORS configuration
  - JWT authorization
  - Rate limiting and throttling

- **Amazon DynamoDB**:
  - `TimeCapsules` table - Stores capsule data
  - Global Secondary Indexes (GSI) for queries
  - Auto-scaling configuration

### Authentication & User Management
- **Amazon Cognito User Pool**:
  - User registration and login
  - Email verification
  - Password policies
  - JWT token generation

- **Cognito User Pool Client**:
  - Application configuration
  - Authentication flows

### Email Services
- **Amazon SES (Simple Email Service)**:
  - Verified sender identity
  - Email sending capabilities
  - Bounce and complaint handling

### Monitoring & Logging
- **CloudWatch Log Groups** - Lambda function logs
- **CloudWatch Events/EventBridge** - Scheduled triggers for delivery
- **X-Ray Tracing** (optional) - Function performance monitoring

### Storage & CDN (if frontend deployed to S3)
- **S3 Bucket** - Static website hosting (optional)
- **CloudFront Distribution** - CDN for frontend (optional)

## Prerequisites

Before deploying, ensure you have the following installed and configured:

### Required Software
- **Node.js 16+** and **npm**
- **Python 3.9+**
- **AWS CLI** (v2 recommended)
- **Git** (for cloning the repository)

### AWS Setup
1. **AWS Account**: You need an active AWS account
2. **AWS CLI Configuration**: Run `aws configure` and provide:
   - AWS Access Key ID
   - AWS Secret Access Key
   - Default region (e.g., `us-east-1`)
   - Default output format (e.g., `json`)

3. **AWS Permissions**: Your AWS user needs permissions for:
   - Lambda functions
   - API Gateway
   - DynamoDB
   - SES (Simple Email Service)
   - CloudFormation
   - IAM roles
   - S3 buckets

## Quick Start Deployment

### Option 1: Interactive Deployment (Recommended for beginners)

1. **Navigate to the project directory:**
   ```bash
   cd time-capsule-app
   ```

2. **Make the deploy script executable:**
   ```bash
   chmod +x deploy.sh
   ```

3. **Run the interactive deployment:**
   ```bash
   ./deploy.sh
   ```

4. **Select option 1** for "Full deployment (recommended for first time)"

5. **Follow the prompts:**
   - Enter your email address for SES verification
   - Check your email and click the verification link when prompted

### Option 2: Command Line Deployment

For automated/scripted deployments:

```bash
cd time-capsule-app
chmod +x deploy.sh
./deploy.sh deploy dev
```

## What Happens During Deployment

### 1. Prerequisites Check
The script verifies:
- Node.js and npm installation
- AWS CLI installation and configuration
- Python 3 availability

### 2. Dependencies Installation
- Installs npm packages
- Installs Serverless Framework globally (if not present)

### 3. SES (Email Service) Setup
- Prompts for your sender email address
- Sends verification request to AWS SES
- Updates configuration with your email

### 4. Backend Deployment
- Deploys Lambda functions
- Creates API Gateway endpoints
- Sets up DynamoDB tables
- Configures Cognito User Pool
- Creates necessary IAM roles

### 5. Frontend Configuration
- Automatically updates frontend with API URLs
- Configures Cognito settings
- Creates configuration files

## Post-Deployment

After successful deployment, you'll see:

```
Deployment Summary:
===================
API Gateway URL: https://xxxxxxxxxx.execute-api.region.amazonaws.com/dev
Stage: dev
Region: us-east-1

Next Steps:
1. Update frontend/app.js with the API Gateway URL and Cognito details
2. Deploy frontend to S3 or serve locally for testing
3. Test the application by creating a time capsule
```

### Testing Your Deployment

1. **Test the backend:**
   ```bash
   ./deploy.sh
   # Select option 4: "Test deployment"
   ```

2. **Serve frontend locally:**
   ```bash
   ./deploy.sh
   # Select option 5: "Serve frontend locally"
   ```
   
   Then visit `http://localhost:8000` in your browser.

## Deployment Options Menu

When running `./deploy.sh` interactively, you'll see:

1. **Full deployment** - Complete setup (recommended for first time)
2. **Deploy backend only** - Just update Lambda functions and API
3. **Setup frontend configuration** - Update frontend config with latest URLs
4. **Test deployment** - Run deployment tests
5. **Serve frontend locally** - Start local development server
6. **Remove deployment** - Delete all AWS resources
7. **Exit** - Quit the script

## Environment Stages

You can deploy to different stages:

- **Development**: `./deploy.sh deploy dev`
- **Production**: `./deploy.sh deploy prod`
- **Custom stage**: `./deploy.sh deploy mystage`

## Troubleshooting

### Common Issues

1. **AWS CLI not configured:**
   ```bash
   aws configure
   ```

2. **SES email not verified:**
   - Check your email for verification link
   - Verify in AWS SES console

3. **Permission errors:**
   - Ensure your AWS user has necessary permissions
   - Check IAM policies

4. **Node.js version issues:**
   ```bash
   node --version  # Should be 16+
   npm --version
   ```

### Logs and Debugging

- Check CloudFormation console for stack deployment status
- View Lambda function logs in CloudWatch
- Use `serverless logs -f functionName` for specific function logs

## Cost Considerations

The deployment creates AWS resources that may incur costs:
- Lambda functions (free tier: 1M requests/month)
- DynamoDB (free tier: 25GB storage)
- API Gateway (free tier: 1M requests/month)
- SES (free tier: 62,000 emails/month)
- CloudWatch logs

Most usage falls within AWS free tier limits for development/testing.

## Cost Estimation

### AWS Free Tier Coverage
Most resources fall within AWS Free Tier limits for development/testing:

| Service | Free Tier Limit | Typical Usage |
|---------|----------------|---------------|
| Lambda | 1M requests/month | Low for personal use |
| DynamoDB | 25GB storage, 25 RCU/WCU | Adequate for testing |
| API Gateway | 1M requests/month | Sufficient for development |
| SES | 62,000 emails/month | More than enough |
| Cognito | 50,000 MAU | Plenty for small apps |
| CloudWatch | 10 custom metrics | Basic monitoring covered |

### Estimated Monthly Costs (Beyond Free Tier)
- **Development/Testing**: $0-5/month
- **Light Production Use**: $5-20/month
- **Heavy Production Use**: $20-100+/month

*Costs depend on usage patterns, data storage, and email volume.*

## Security Notes

- The app uses Cognito for user authentication
- API endpoints are secured with JWT tokens
- Database access is restricted to authenticated users
- Email addresses are verified through SES
- **IAM roles follow least-privilege principle**
- **All data encrypted in transit and at rest**
- **No hardcoded credentials in code**

## Next Steps

After deployment:
1. Customize the frontend styling
2. Test all features (create capsules, schedule delivery)
3. Monitor CloudWatch logs
4. Set up custom domain (optional)
5. Configure production email settings

## Support

If you encounter issues:
1. Check the AWS CloudFormation console for deployment errors
2. Review CloudWatch logs for runtime errors
3. Ensure all prerequisites are properly installed and configured 