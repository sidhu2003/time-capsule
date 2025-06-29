#!/bin/bash

# Time Capsule App Deployment Script
# This script automates the deployment process for the Time Capsule App

set -e  # Exit on any error

echo "🕰️  Time Capsule App Deployment Script"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 16+ and try again."
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install AWS CLI and configure it."
        exit 1
    fi
    
    # Check if AWS credentials are configured
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials are not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed. Please install Python 3.9+ and try again."
        exit 1
    fi
    
    print_success "All prerequisites are met!"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install npm dependencies
    npm install
    
    # Note: Using npx serverless instead of global installation to avoid permission issues
    print_status "Serverless Framework will be used via npx (no global installation needed)"
    
    print_success "Dependencies installed successfully!"
}

# Setup SES
setup_ses() {
    print_status "Setting up Amazon SES..."
    
    read -p "Enter your sender email address for SES verification: " SENDER_EMAIL
    
    if [[ -z "$SENDER_EMAIL" ]]; then
        print_error "Email address is required!"
        exit 1
    fi
    
    # Verify email identity
    print_status "Verifying email identity: $SENDER_EMAIL"
    aws ses verify-email-identity --email-address "$SENDER_EMAIL" || {
        print_warning "Email verification request sent. Please check your email and click the verification link."
        print_warning "You can continue with deployment, but email delivery won't work until verified."
    }
    
    # Update serverless.yml with the email
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/noreply@\${self:service}\.com/$SENDER_EMAIL/g" serverless.yml
    else
        # Linux
        sed -i "s/noreply@\${self:service}\.com/$SENDER_EMAIL/g" serverless.yml
    fi
    
    print_success "SES setup completed!"
}

# Deploy the application
deploy_app() {
    local STAGE=${1:-dev}
    
    print_status "Deploying Time Capsule App to $STAGE environment..."
    
    # Deploy using serverless
    npx serverless deploy --stage "$STAGE" --verbose
    
    if [[ $? -eq 0 ]]; then
        print_success "Deployment completed successfully!"
        
        # Get deployment outputs
        print_status "Retrieving deployment information..."
        npx serverless info --stage "$STAGE"
        
        # Extract important URLs and IDs
        API_URL=$(npx serverless info --stage "$STAGE" | grep -o 'https://[^[:space:]]*')
        
        print_status "Deployment Summary:"
        echo "==================="
        if [[ -n "$API_URL" ]]; then
            echo "API Gateway URL: $API_URL"
        fi
        echo "Stage: $STAGE"
        echo "Region: $(aws configure get region)"
        echo ""
        print_warning "Next Steps:"
        echo "1. Update frontend/app.js with the API Gateway URL and Cognito details"
        echo "2. Deploy frontend to S3 or serve locally for testing"
        echo "3. Test the application by creating a time capsule"
        
    else
        print_error "Deployment failed!"
        exit 1
    fi
}

# Setup frontend
setup_frontend() {
    print_status "Setting up frontend configuration..."
    
    # Get stack outputs
    API_URL=$(aws cloudformation describe-stacks --stack-name "time-capsule-app-dev" --query 'Stacks[0].Outputs[?OutputKey==`ServiceEndpoint`].OutputValue' --output text 2>/dev/null || echo "")
    USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name "time-capsule-app-dev" --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null || echo "")
    CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "time-capsule-app-dev" --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text 2>/dev/null || echo "")
    
    if [[ -n "$API_URL" ]] && [[ -n "$USER_POOL_ID" ]] && [[ -n "$CLIENT_ID" ]]; then
        print_status "Updating frontend configuration..."
        
        # Create a config file for the frontend
        cat > frontend/config.js << EOF
// Auto-generated configuration
const CONFIG = {
    apiUrl: '$API_URL',
    userPoolId: '$USER_POOL_ID',
    clientId: '$CLIENT_ID'
};

// Update the app configuration
if (typeof window !== 'undefined' && window.app) {
    window.app.apiUrl = CONFIG.apiUrl;
    window.app.userPoolId = CONFIG.userPoolId;
    window.app.clientId = CONFIG.clientId;
}
EOF
        
        # Update the HTML to include the config
        if ! grep -q "config.js" frontend/index.html; then
            sed -i.bak 's|<script src="app.js"></script>|<script src="config.js"></script>\n    <script src="app.js"></script>|' frontend/index.html
        fi
        
        print_success "Frontend configuration updated!"
        echo "Configuration details:"
        echo "API URL: $API_URL"
        echo "User Pool ID: $USER_POOL_ID"
        echo "Client ID: $CLIENT_ID"
    else
        print_warning "Could not automatically configure frontend. Please update frontend/app.js manually."
    fi
}

# Test deployment
test_deployment() {
    print_status "Testing deployment..."
    
    # Test the delivery function
    print_status "Testing delivery function..."
    npx serverless invoke -f deliverCapsules --stage dev
    
    if [[ $? -eq 0 ]]; then
        print_success "Delivery function test passed!"
    else
        print_warning "Delivery function test failed. Check logs for details."
    fi
}

# Serve frontend locally
serve_frontend() {
    print_status "Starting local development server..."
    echo "Frontend will be available at http://localhost:8000"
    echo "Press Ctrl+C to stop the server"
    
    cd frontend
    python3 -m http.server 8000
}

# Main menu
show_menu() {
    echo ""
    echo "Time Capsule App Deployment Options:"
    echo "===================================="
    echo "1. Full deployment (recommended for first time)"
    echo "2. Deploy backend only"
    echo "3. Setup frontend configuration"
    echo "4. Test deployment"
    echo "5. Serve frontend locally"
    echo "6. Remove deployment"
    echo "7. Exit"
    echo ""
}

# Remove deployment
remove_deployment() {
    local STAGE=${1:-dev}
    
    print_warning "This will remove the entire Time Capsule App deployment!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Removing deployment..."
        npx serverless remove --stage "$STAGE"
        print_success "Deployment removed successfully!"
    else
        print_status "Removal cancelled."
    fi
}

# Main execution
main() {
    if [[ $# -eq 0 ]]; then
        # Interactive mode
        while true; do
            show_menu
            read -p "Choose an option (1-7): " CHOICE
            
            case $CHOICE in
                1)
                    check_prerequisites
                    install_dependencies
                    setup_ses
                    deploy_app "dev"
                    setup_frontend
                    print_success "Full deployment completed!"
                    ;;
                2)
                    check_prerequisites
                    install_dependencies
                    deploy_app "dev"
                    ;;
                3)
                    setup_frontend
                    ;;
                4)
                    test_deployment
                    ;;
                5)
                    serve_frontend
                    ;;
                6)
                    remove_deployment "dev"
                    ;;
                7)
                    print_status "Goodbye!"
                    exit 0
                    ;;
                *)
                    print_error "Invalid option. Please choose 1-7."
                    ;;
            esac
            
            echo ""
            read -p "Press Enter to continue..."
        done
    else
        # Command line mode
        case $1 in
            "deploy")
                STAGE=${2:-dev}
                check_prerequisites
                install_dependencies
                setup_ses
                deploy_app "$STAGE"
                setup_frontend
                ;;
            "remove")
                STAGE=${2:-dev}
                remove_deployment "$STAGE"
                ;;
            "test")
                test_deployment
                ;;
            "serve")
                serve_frontend
                ;;
            *)
                echo "Usage: $0 [deploy|remove|test|serve] [stage]"
                echo "  deploy [stage] - Deploy the application (default: dev)"
                echo "  remove [stage] - Remove the deployment (default: dev)"
                echo "  test          - Test the deployment"
                echo "  serve         - Serve frontend locally"
                echo ""
                echo "Run without arguments for interactive mode."
                exit 1
                ;;
        esac
    fi
}

# Run main function with all arguments
main "$@" 