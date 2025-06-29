# 🕰️ Time Capsule App - Messages to the Future

A serverless application built with AWS Lambda that allows users to create time capsules with messages, schedule them for future delivery, and receive them via email at the perfect moment in time.

## 🎯 Features

- **User Authentication**: Secure signup and login with AWS Cognito
- **Time Capsule Creation**: Create messages with text, attachments, and metadata
- **Scheduled Delivery**: Automated email delivery using EventBridge and SES
- **Beautiful UI**: Modern, responsive frontend with glass morphism design
- **Secure Storage**: Messages stored in S3 and metadata in DynamoDB
- **Real-time Dashboard**: View and manage your time capsules
- **Smart Scheduling**: Prevent past dates and validate delivery times

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway    │    │   Lambda        │
│                 │────│                  │────│                 │
│ • React/HTML    │    │ • REST API       │    │ • Python        │
│ • Cognito Auth  │    │ • CORS Enabled   │    │ • CRUD Ops      │
│ • File Upload   │    │ • Authorizers    │    │ • Validation    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   EventBridge   │    │   DynamoDB       │    │      S3         │
│                 │    │                  │    │                 │
│ • Hourly Cron   │────│ • Capsule Meta   │    │ • Message Files │
│ • Trigger       │    │ • User Data      │    │ • Attachments   │
│ • Lambda Invoke │    │ • Scheduling     │    │ • Secure Access │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                       ┌──────────────────┐
                       │       SES        │
                       │                  │
                       │ • Email Delivery │
                       │ • HTML Templates │
                       │ • Delivery Status│
                       └──────────────────┘
```

## 🛠️ Tech Stack

### Backend
- **AWS Lambda**: Serverless compute for API endpoints and scheduled delivery
- **API Gateway**: RESTful API with CORS and authentication
- **DynamoDB**: NoSQL database for capsule metadata
- **S3**: Object storage for message content and attachments
- **SES**: Email delivery service for time capsule delivery
- **EventBridge**: Scheduled triggers for capsule delivery
- **Cognito**: User authentication and authorization

### Frontend
- **HTML/CSS/JavaScript**: Modern vanilla JS implementation
- **Tailwind CSS**: Utility-first CSS framework
- **Font Awesome**: Icon library
- **Amazon Cognito SDK**: Client-side authentication

### DevOps
- **Serverless Framework**: Infrastructure as Code
- **Python 3.9**: Runtime for Lambda functions
- **npm**: Package management for deployment tools

## 📋 Prerequisites

- AWS Account with appropriate permissions
- Node.js 16+ and npm
- Python 3.9+
- Serverless Framework CLI
- AWS CLI configured with credentials

## 🚀 Quick Start

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd time-capsule-app

# Install dependencies
npm install

# Install serverless globally if not already installed
npm install -g serverless
```

### 2. Configure AWS Services

#### Configure SES (Simple Email Service)
```bash
# Verify your sender email address
aws ses verify-email-identity --email-address noreply@yourdomain.com

# Request production access if needed (removes sandbox limitations)
# Go to AWS Console > SES > Account Dashboard > Request Production Access
```

#### Update Configuration
Edit `serverless.yml` and update:
- `FROM_EMAIL`: Your verified SES email address
- `region`: Your preferred AWS region
- Other environment variables as needed

### 3. Deploy Backend

```bash
# Deploy to development environment
npm run deploy:dev

# Deploy to production
npm run deploy:prod
```

After deployment, note the API Gateway URL and Cognito details from the output.

### 4. Configure Frontend

Update `frontend/app.js` with your deployment details:

```javascript
// Replace these values with your actual deployment outputs
this.apiUrl = 'https://your-api-id.execute-api.region.amazonaws.com/dev';
this.userPoolId = 'your-cognito-user-pool-id';
this.clientId = 'your-cognito-client-id';
```

### 5. Host Frontend

You can host the frontend using:

#### Option A: S3 Static Website
```bash
# Create S3 bucket for website hosting
aws s3 mb s3://your-time-capsule-website
aws s3 website s3://your-time-capsule-website --index-document index.html

# Upload frontend files
aws s3 sync frontend/ s3://your-time-capsule-website --acl public-read
```

#### Option B: Local Development
```bash
cd frontend
python3 -m http.server 8000
# Visit http://localhost:8000
```

## 📝 API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/capsules` | Create new time capsule | ✅ |
| GET | `/capsules` | Get user's capsules | ✅ |
| PUT | `/capsules/{id}` | Update existing capsule | ✅ |
| DELETE | `/capsules/{id}` | Delete capsule | ✅ |
| POST | `/upload` | Upload file attachment | ✅ |
| GET | `/upload` | Get presigned upload URL | ✅ |

### Request/Response Examples

#### Create Capsule
```bash
POST /capsules
Content-Type: application/json
Authorization: Bearer <cognito-jwt-token>

{
  "title": "Future Me Motivation",
  "message": "Remember why you started this journey...",
  "recipient_email": "future@me.com",
  "scheduled_date": "2025-01-01T00:00:00Z",
  "occasion": "new-year",
  "tags": ["motivation", "personal"]
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "message": "Time capsule created successfully",
    "scheduled_date": "2025-01-01T00:00:00Z"
  }
}
```

## 🎮 Usage Guide

### For Users

1. **Sign Up**: Create account with email verification
2. **Create Capsule**: 
   - Write your message
   - Set recipient email
   - Choose delivery date
   - Add optional occasion and tags
3. **Manage Capsules**: View, edit, or delete pending capsules
4. **Receive Delivery**: Get beautiful HTML email at scheduled time

### For Developers

#### Local Testing
```bash
# Test individual Lambda function
serverless invoke -f createCapsule --data '{"body": "{...}"}'

# View logs
serverless logs -f deliverCapsules -t

# Test delivery function manually
serverless invoke -f deliverCapsules
```

#### Environment Variables
```bash
# Set in serverless.yml or via CLI
export DYNAMODB_TABLE=time-capsule-app-dev-capsules
export S3_BUCKET=time-capsule-app-dev-storage
export FROM_EMAIL=noreply@yourdomain.com
```

## 🔧 Configuration Options

### Serverless.yml Customization

```yaml
# Custom domain (optional)
custom:
  domain: api.yourcustomdomain.com
  
# Different environments
provider:
  stage: ${opt:stage, 'dev'}
  environment:
    STAGE: ${self:provider.stage}
    
# Monitoring and alerting
functions:
  createCapsule:
    alarms:
      - name: functionErrors
        threshold: 5
```

### Frontend Customization

- **Branding**: Update colors, logos, and text in `index.html`
- **Features**: Enable/disable features in `app.js`
- **Styling**: Modify Tailwind classes or add custom CSS

## 📊 Monitoring and Analytics

### CloudWatch Metrics
- Lambda execution duration and errors
- API Gateway request counts and latency
- DynamoDB read/write capacity
- SES delivery rates

### Custom Logging
```python
import logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# In your Lambda functions
logger.info(f"Processing capsule delivery: {capsule_id}")
```

## 🔒 Security Best Practices

### AWS IAM Roles
- Principle of least privilege
- Separate roles for each Lambda function
- Resource-specific permissions

### Data Protection
- S3 bucket encryption enabled
- DynamoDB encryption at rest
- Secure API Gateway with Cognito authorizers

### Frontend Security
- HTTPS enforcement
- CORS properly configured
- JWT token validation

## 🧪 Testing

### Unit Tests (Future Enhancement)
```bash
# Install testing dependencies
pip install pytest moto

# Run tests
pytest tests/
```

### Integration Testing
```bash
# Test API endpoints
curl -X POST https://your-api.com/capsules \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title": "Test", ...}'
```

## 🚨 Troubleshooting

### Common Issues

1. **SES Sandbox Limitations**
   - Solution: Request production access or use verified email addresses

2. **CORS Errors**
   - Solution: Check API Gateway CORS configuration in serverless.yml

3. **Lambda Timeout**
   - Solution: Increase timeout in function configuration

4. **Authentication Failures**
   - Solution: Verify Cognito User Pool and Client configurations

### Debug Commands
```bash
# Check deployment status
serverless info

# View CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/time-capsule

# Test Cognito authentication
aws cognito-idp admin-get-user --user-pool-id <pool-id> --username <email>
```

## 📈 Performance Optimization

- **DynamoDB**: Use proper indexing for queries
- **S3**: Enable CloudFront for static assets
- **Lambda**: Optimize memory allocation and cold starts
- **API Gateway**: Enable caching for GET requests

## 🛣️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Voice message support
- [ ] Video attachments
- [ ] Social media integration
- [ ] Analytics dashboard
- [ ] Multi-language support
- [ ] Calendar integration
- [ ] Bulk operations

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Email**: support@timecapsuleapp.com
- **Issues**: [GitHub Issues](https://github.com/yourusername/time-capsule-app/issues)
- **Documentation**: [Wiki](https://github.com/yourusername/time-capsule-app/wiki)

## 🙏 Acknowledgments

- AWS for providing robust serverless infrastructure
- Serverless Framework for excellent deployment tooling
- Tailwind CSS for beautiful utility-first styling
- Font Awesome for comprehensive icon library

---

**Made with ❤️ for preserving memories and connecting across time** 