# Time Capsule App - Deployment Scripts

This directory contains scripts to deploy and destroy the Time Capsule App on AWS.

## AWS Resources Overview

This deployment will create the following AWS resources:

### 🏗️ Core Infrastructure
- **CloudFormation Stack** - Manages all resources
- **IAM Roles & Policies** - Security and permissions
- **Lambda Functions** (3-4) - Backend API logic
- **API Gateway** - REST API endpoints
- **DynamoDB Table** - Data storage
- **Cognito User Pool** - User authentication
- **SES Email Service** - Time capsule delivery

### 💰 Estimated Costs
- **Free Tier**: $0/month (sufficient for testing)
- **Light Usage**: $5-20/month
- **Heavy Usage**: $20-100+/month

*Most personal/development usage stays within AWS Free Tier limits.*

## Quick Reference

### 📋 Prerequisites
- AWS CLI configured (`aws configure`)
- Node.js 16+ and npm
- Python 3.9+

### 🚀 Deploy the App

#### Interactive Mode (Recommended)
```bash
./deploy.sh
```
Then select option 1 for full deployment.

#### Command Line Mode
```bash
./deploy.sh deploy dev    # Deploy to dev environment
./deploy.sh deploy prod   # Deploy to production
```

### 💥 Destroy/Remove the App

#### Interactive Mode
```bash
./destroy.sh
```

#### Command Line Mode
```bash
./destroy.sh dev          # Remove dev environment
./destroy.sh prod         # Remove production environment
./destroy.sh -a           # Remove ALL environments (dangerous!)
./destroy.sh -l           # List existing deployments
```

### 📁 Files

- **`deploy.sh`** - Main deployment script with full setup
- **`destroy.sh`** - Dedicated destruction script with safety checks
- **`DEPLOYMENT_GUIDE.md`** - Comprehensive deployment guide

### ⚡ Quick Start

1. **First-time deployment:**
   ```bash
   cd time-capsule-app
   ./deploy.sh
   # Select option 1
   # Follow prompts for email verification
   ```

2. **Test locally:**
   ```bash
   ./deploy.sh
   # Select option 5 to serve frontend locally
   # Visit http://localhost:8000
   ```

3. **When done testing:**
   ```bash
   ./destroy.sh
   # Select option 2, enter 'dev'
   # Type 'DELETE' to confirm
   ```

### ⚠️ Important Notes

- **Destruction is permanent** - all data will be lost
- **Email verification** required for SES to work
- **AWS costs** may apply outside free tier limits
- **Backup data** before destroying deployments

For detailed instructions, see `DEPLOYMENT_GUIDE.md`. 