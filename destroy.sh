#!/bin/bash

# Time Capsule App Destroy Script
# This script removes all AWS resources created by the Time Capsule App deployment

set -e  # Exit on any error

echo "💥 Time Capsule App Destroy Script"
echo "=================================="

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
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install AWS CLI to proceed."
        exit 1
    fi
    
    # Check if AWS credentials are configured
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials are not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    print_success "Prerequisites check passed!"
}

# List existing deployments
list_deployments() {
    print_status "Checking for existing Time Capsule App deployments..."
    
    echo ""
    echo "CloudFormation Stacks:"
    echo "======================"
    
    # List stacks that match our app pattern
    STACKS=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query 'StackSummaries[?contains(StackName, `time-capsule-app`)].{Name:StackName,Status:StackStatus,Created:CreationTime}' --output table 2>/dev/null || echo "No stacks found")
    
    if [[ "$STACKS" == "No stacks found" ]]; then
        print_warning "No Time Capsule App stacks found."
        return 1
    else
        echo "$STACKS"
        echo ""
        return 0
    fi
}

# Remove deployment by stage
remove_deployment() {
    local STAGE=${1:-dev}
    local STACK_NAME="time-capsule-app-$STAGE"
    
    print_status "Checking if stack '$STACK_NAME' exists..."
    
    # Check if stack exists
    if aws cloudformation describe-stacks --stack-name "$STACK_NAME" &> /dev/null; then
        print_warning "⚠️  DESTRUCTIVE OPERATION WARNING ⚠️"
        echo ""
        echo "This will permanently delete the following resources for stage '$STAGE':"
        echo ""
        echo "🔧 Core Infrastructure:"
        echo "  • CloudFormation Stack: $STACK_NAME"
        echo "  • IAM Roles and Policies"
        echo ""
        echo "⚡ Backend Services:"
        echo "  • Lambda Functions (createCapsule, getCapsules, deliverCapsules)"
        echo "  • API Gateway REST API and endpoints"
        echo "  • DynamoDB table 'TimeCapsules' (⚠️  ALL DATA)"
        echo ""
        echo "👥 Authentication:"
        echo "  • Cognito User Pool (⚠️  ALL USERS)"
        echo "  • Cognito User Pool Client"
        echo ""
        echo "📊 Monitoring:"
        echo "  • CloudWatch Log Groups"
        echo "  • CloudWatch Events/EventBridge rules"
        echo ""
        echo "📦 Optional Resources (if exist):"
        echo "  • S3 buckets"
        echo "  • CloudFront distributions"
        echo ""
        print_error "⚠️  ALL DATA WILL BE PERMANENTLY LOST! ⚠️"
        echo ""
        
        read -p "Are you absolutely sure you want to destroy the '$STAGE' deployment? (type 'DELETE' to confirm): " CONFIRMATION
        
        if [[ "$CONFIRMATION" == "DELETE" ]]; then
            print_status "Removing deployment for stage: $STAGE"
            
            # Use serverless remove command
            if serverless remove --stage "$STAGE" --verbose; then
                print_success "✅ Stage '$STAGE' has been successfully destroyed!"
                
                # Double-check that the stack is gone
                if aws cloudformation describe-stacks --stack-name "$STACK_NAME" &> /dev/null; then
                    print_warning "Stack still exists. Waiting for deletion to complete..."
                    aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME"
                    print_success "Stack deletion completed!"
                fi
                
            else
                print_error "❌ Failed to remove deployment. Check the error messages above."
                print_status "You may need to manually clean up resources in the AWS console."
                return 1
            fi
        else
            print_status "Destruction cancelled. Deployment remains intact."
            return 1
        fi
    else
        print_warning "Stack '$STACK_NAME' does not exist or has already been deleted."
        return 1
    fi
}

# Clean up SES verified emails (optional)
cleanup_ses() {
    print_status "Checking for SES verified email identities..."
    
    # List verified email identities
    VERIFIED_EMAILS=$(aws ses list-verified-email-addresses --query 'VerifiedEmailAddresses' --output text 2>/dev/null || echo "")
    
    if [[ -n "$VERIFIED_EMAILS" ]]; then
        echo ""
        echo "SES Verified Email Addresses:"
        echo "============================="
        echo "$VERIFIED_EMAILS" | tr '\t' '\n'
        echo ""
        
        read -p "Do you want to remove SES email verifications? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Removing SES email verifications..."
            
            echo "$VERIFIED_EMAILS" | tr '\t' '\n' | while read -r email; do
                if [[ -n "$email" ]]; then
                    print_status "Removing verification for: $email"
                    aws ses delete-verified-email-address --email-address "$email" || print_warning "Failed to remove $email"
                fi
            done
            
            print_success "SES cleanup completed!"
        else
            print_status "SES email verifications left intact."
        fi
    else
        print_status "No SES verified emails found."
    fi
}

# Complete cleanup
complete_cleanup() {
    print_warning "🔥 COMPLETE CLEANUP MODE 🔥"
    echo ""
    echo "This will attempt to remove ALL Time Capsule App resources across ALL stages!"
    echo ""
    
    read -p "Are you sure you want to perform a complete cleanup? (type 'DESTROY-ALL' to confirm): " CONFIRMATION
    
    if [[ "$CONFIRMATION" == "DESTROY-ALL" ]]; then
        print_status "Starting complete cleanup..."
        
        # Find all time-capsule-app stacks
        STACK_NAMES=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query 'StackSummaries[?contains(StackName, `time-capsule-app`)].StackName' --output text 2>/dev/null || echo "")
        
        if [[ -n "$STACK_NAMES" ]]; then
            echo "$STACK_NAMES" | tr '\t' '\n' | while read -r stack; do
                if [[ -n "$stack" ]]; then
                    # Extract stage from stack name
                    STAGE=${stack#time-capsule-app-}
                    print_status "Removing stack: $stack (stage: $STAGE)"
                    remove_deployment "$STAGE"
                fi
            done
        else
            print_warning "No Time Capsule App stacks found."
        fi
        
        # Offer to clean up SES
        cleanup_ses
        
        print_success "Complete cleanup finished!"
    else
        print_status "Complete cleanup cancelled."
    fi
}

# Show help
show_help() {
    echo ""
    echo "Time Capsule App Destroy Script"
    echo "==============================="
    echo ""
    echo "Usage: $0 [options] [stage]"
    echo ""
    echo "Options:"
    echo "  -h, --help        Show this help message"
    echo "  -l, --list        List existing deployments"
    echo "  -s, --stage STAGE Remove specific stage deployment (default: dev)"
    echo "  -a, --all         Remove ALL deployments (dangerous!)"
    echo "  --ses-cleanup     Clean up SES email verifications"
    echo ""
    echo "Examples:"
    echo "  $0                    # Interactive mode"
    echo "  $0 -s dev            # Remove dev stage"
    echo "  $0 -s prod           # Remove prod stage"
    echo "  $0 -a                # Remove all deployments"
    echo "  $0 -l                # List deployments"
    echo ""
}

# Interactive menu
show_menu() {
    echo ""
    echo "Time Capsule App Destroy Options:"
    echo "================================="
    echo "1. List existing deployments"
    echo "2. Remove specific stage (dev, prod, etc.)"
    echo "3. Remove ALL deployments (dangerous!)"
    echo "4. Clean up SES email verifications"
    echo "5. Exit"
    echo ""
}

# Main execution
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -l|--list)
                check_prerequisites
                list_deployments
                exit 0
                ;;
            -s|--stage)
                if [[ -n "$2" ]]; then
                    STAGE="$2"
                    shift 2
                    check_prerequisites
                    remove_deployment "$STAGE"
                    exit 0
                else
                    print_error "Stage name required after -s/--stage"
                    exit 1
                fi
                ;;
            -a|--all)
                check_prerequisites
                complete_cleanup
                exit 0
                ;;
            --ses-cleanup)
                check_prerequisites
                cleanup_ses
                exit 0
                ;;
            *)
                # Treat as stage name if no flags
                if [[ "$1" =~ ^[a-zA-Z0-9-]+$ ]]; then
                    STAGE="$1"
                    shift
                    check_prerequisites
                    remove_deployment "$STAGE"
                    exit 0
                else
                    print_error "Unknown option: $1"
                    show_help
                    exit 1
                fi
                ;;
        esac
    done
    
    # Interactive mode if no arguments
    check_prerequisites
    
    while true; do
        show_menu
        read -p "Choose an option (1-5): " CHOICE
        
        case $CHOICE in
            1)
                list_deployments
                ;;
            2)
                read -p "Enter stage name to remove (e.g., dev, prod): " STAGE
                if [[ -n "$STAGE" ]]; then
                    remove_deployment "$STAGE"
                else
                    print_error "Stage name cannot be empty!"
                fi
                ;;
            3)
                complete_cleanup
                ;;
            4)
                cleanup_ses
                ;;
            5)
                print_status "Goodbye!"
                exit 0
                ;;
            *)
                print_error "Invalid option. Please choose 1-5."
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
    done
}

# Run main function with all arguments
main "$@" 