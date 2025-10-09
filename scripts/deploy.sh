#!/bin/bash

# Deployment Script for Dify Workflow Frontend
# Usage: ./scripts/deploy.sh [environment] [options]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="production"
SKIP_TESTS=false
SKIP_BUILD=false
DRY_RUN=false
VERBOSE=false

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

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [environment] [options]

Environments:
    development     Deploy to development environment
    staging         Deploy to staging environment
    production      Deploy to production environment (default)

Options:
    --skip-tests    Skip running tests before deployment
    --skip-build    Skip building the application
    --dry-run       Show what would be deployed without actually deploying
    --verbose       Enable verbose output
    --help          Show this help message

Examples:
    $0 production                    # Deploy to production
    $0 staging --skip-tests          # Deploy to staging without tests
    $0 development --dry-run         # Dry run for development
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        development|staging|production)
            ENVIRONMENT="$1"
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Function to run command with optional dry run
run_command() {
    local cmd="$1"
    local description="$2"
    
    if [ "$VERBOSE" = true ]; then
        print_status "Running: $cmd"
    fi
    
    if [ "$DRY_RUN" = true ]; then
        print_warning "[DRY RUN] Would run: $description"
        return 0
    fi
    
    if [ "$VERBOSE" = true ]; then
        eval "$cmd"
    else
        eval "$cmd" > /dev/null 2>&1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required (current: $(node --version))"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run this script from the project root."
        exit 1
    fi
    
    # Check environment file
    local env_file=".env.${ENVIRONMENT}"
    if [ ! -f "$env_file" ]; then
        print_warning "Environment file $env_file not found"
    fi
    
    print_success "Prerequisites check passed"
}

# Function to validate environment variables
validate_environment() {
    print_status "Validating environment configuration for $ENVIRONMENT..."
    
    local env_file=".env.${ENVIRONMENT}"
    if [ -f "$env_file" ]; then
        # Source the environment file
        set -a
        source "$env_file"
        set +a
    fi
    
    # Required environment variables
    local required_vars=(
        "VITE_AZURE_CLIENT_ID"
        "VITE_GITHUB_CLIENT_ID"
        "VITE_GOOGLE_CLIENT_ID"
        "VITE_DIFY_API_BASE_URL"
        "VITE_OAUTH_REDIRECT_URI"
    )
    
    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    print_success "Environment validation passed"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    if [ -f "package-lock.json" ]; then
        run_command "npm ci" "Install dependencies with npm ci"
    else
        run_command "npm install" "Install dependencies with npm install"
    fi
    
    print_success "Dependencies installed"
}

# Function to run tests
run_tests() {
    if [ "$SKIP_TESTS" = true ]; then
        print_warning "Skipping tests (--skip-tests flag provided)"
        return 0
    fi
    
    print_status "Running tests..."
    
    # Run unit tests
    run_command "npm run test -- --run" "Run unit tests"
    
    # Run integration tests
    run_command "npm run test:integration -- --run" "Run integration tests"
    
    # Run type checking
    run_command "npm run type-check" "Run TypeScript type checking"
    
    # Run linting
    run_command "npm run lint" "Run ESLint"
    
    print_success "All tests passed"
}

# Function to build application
build_application() {
    if [ "$SKIP_BUILD" = true ]; then
        print_warning "Skipping build (--skip-build flag provided)"
        return 0
    fi
    
    print_status "Building application for $ENVIRONMENT..."
    
    # Set environment variables
    export NODE_ENV="production"
    export VITE_MODE="$ENVIRONMENT"
    
    # Add git commit hash if available
    if command -v git &> /dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
        export VITE_GIT_COMMIT=$(git rev-parse HEAD)
    fi
    
    # Build the application
    case $ENVIRONMENT in
        development)
            run_command "npm run build" "Build for development"
            ;;
        staging)
            run_command "npm run build" "Build for staging"
            ;;
        production)
            run_command "npm run build" "Build for production"
            ;;
    esac
    
    # Verify build output
    if [ ! -d "dist" ]; then
        print_error "Build failed: dist directory not found"
        exit 1
    fi
    
    if [ ! -f "dist/index.html" ]; then
        print_error "Build failed: index.html not found in dist directory"
        exit 1
    fi
    
    print_success "Application built successfully"
}

# Function to analyze bundle
analyze_bundle() {
    print_status "Analyzing bundle size..."
    
    if command -v du &> /dev/null; then
        local bundle_size=$(du -sh dist | cut -f1)
        print_status "Total bundle size: $bundle_size"
    fi
    
    # Show largest files
    if command -v find &> /dev/null && command -v sort &> /dev/null; then
        print_status "Largest files in bundle:"
        find dist -type f -name "*.js" -o -name "*.css" | xargs ls -lh | sort -k5 -hr | head -5 | while read line; do
            echo "  $line"
        done
    fi
}

# Function to deploy to different environments
deploy_to_environment() {
    print_status "Deploying to $ENVIRONMENT environment..."
    
    case $ENVIRONMENT in
        development)
            deploy_to_development
            ;;
        staging)
            deploy_to_staging
            ;;
        production)
            deploy_to_production
            ;;
        *)
            print_error "Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
}

# Function to deploy to development
deploy_to_development() {
    print_status "Starting development server..."
    
    if [ "$DRY_RUN" = true ]; then
        print_warning "[DRY RUN] Would start development server"
        return 0
    fi
    
    # Start development server
    npm run dev
}

# Function to deploy to staging
deploy_to_staging() {
    print_status "Deploying to staging environment..."
    
    # Example: Deploy to staging server via rsync
    if [ -n "$STAGING_SERVER" ] && [ -n "$STAGING_PATH" ]; then
        run_command "rsync -avz --delete dist/ $STAGING_SERVER:$STAGING_PATH" "Sync files to staging server"
    else
        print_warning "STAGING_SERVER and STAGING_PATH environment variables not set"
        print_status "Build files are ready in ./dist directory"
    fi
    
    # Example: Deploy to AWS S3 staging bucket
    if [ -n "$STAGING_S3_BUCKET" ] && command -v aws &> /dev/null; then
        run_command "aws s3 sync dist/ s3://$STAGING_S3_BUCKET --delete" "Deploy to S3 staging bucket"
        
        if [ -n "$STAGING_CLOUDFRONT_ID" ]; then
            run_command "aws cloudfront create-invalidation --distribution-id $STAGING_CLOUDFRONT_ID --paths '/*'" "Invalidate CloudFront cache"
        fi
    fi
    
    print_success "Deployment to staging completed"
}

# Function to deploy to production
deploy_to_production() {
    print_status "Deploying to production environment..."
    
    # Production deployment confirmation
    if [ "$DRY_RUN" != true ]; then
        echo -n "Are you sure you want to deploy to PRODUCTION? (yes/no): "
        read -r confirmation
        if [ "$confirmation" != "yes" ]; then
            print_warning "Production deployment cancelled"
            exit 0
        fi
    fi
    
    # Example: Deploy to production server via rsync
    if [ -n "$PRODUCTION_SERVER" ] && [ -n "$PRODUCTION_PATH" ]; then
        run_command "rsync -avz --delete dist/ $PRODUCTION_SERVER:$PRODUCTION_PATH" "Sync files to production server"
    else
        print_warning "PRODUCTION_SERVER and PRODUCTION_PATH environment variables not set"
        print_status "Build files are ready in ./dist directory"
    fi
    
    # Example: Deploy to AWS S3 production bucket
    if [ -n "$PRODUCTION_S3_BUCKET" ] && command -v aws &> /dev/null; then
        run_command "aws s3 sync dist/ s3://$PRODUCTION_S3_BUCKET --delete" "Deploy to S3 production bucket"
        
        if [ -n "$PRODUCTION_CLOUDFRONT_ID" ]; then
            run_command "aws cloudfront create-invalidation --distribution-id $PRODUCTION_CLOUDFRONT_ID --paths '/*'" "Invalidate CloudFront cache"
        fi
    fi
    
    print_success "Deployment to production completed"
}

# Function to run post-deployment checks
post_deployment_checks() {
    print_status "Running post-deployment checks..."
    
    # Check if deployment URL is accessible
    if [ -n "$DEPLOYMENT_URL" ]; then
        if command -v curl &> /dev/null; then
            if curl -f -s "$DEPLOYMENT_URL" > /dev/null; then
                print_success "Deployment URL is accessible: $DEPLOYMENT_URL"
            else
                print_error "Deployment URL is not accessible: $DEPLOYMENT_URL"
            fi
        fi
    fi
    
    # Additional health checks can be added here
    print_success "Post-deployment checks completed"
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up..."
    
    # Remove temporary files if any
    # This can be customized based on your needs
    
    print_success "Cleanup completed"
}

# Main deployment function
main() {
    print_status "Starting deployment process for $ENVIRONMENT environment"
    
    # Run deployment steps
    check_prerequisites
    validate_environment
    install_dependencies
    run_tests
    build_application
    
    if [ "$ENVIRONMENT" != "development" ]; then
        analyze_bundle
    fi
    
    deploy_to_environment
    
    if [ "$ENVIRONMENT" != "development" ]; then
        post_deployment_checks
    fi
    
    cleanup
    
    print_success "Deployment completed successfully!"
    
    # Show deployment summary
    echo
    echo "=== Deployment Summary ==="
    echo "Environment: $ENVIRONMENT"
    echo "Build time: $(date)"
    if [ -n "$VITE_GIT_COMMIT" ]; then
        echo "Git commit: $VITE_GIT_COMMIT"
    fi
    if [ -n "$DEPLOYMENT_URL" ]; then
        echo "Deployment URL: $DEPLOYMENT_URL"
    fi
    echo "=========================="
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"