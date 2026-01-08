#!/bin/bash

# Deployment script for PDF support
# This script deploys the updated process function and verifies the deployment

set -e

echo "================================"
echo "PDF Support Deployment Script"
echo "================================"
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Check if logged in
echo "Checking Supabase authentication..."
if ! npx supabase functions list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please run:"
    echo "   npx supabase login"
    echo ""
    echo "Or set SUPABASE_ACCESS_TOKEN environment variable"
    exit 1
fi

echo "✅ Authenticated"
echo ""

# Deploy the process function
echo "📦 Deploying process function with PDF support..."
npx supabase functions deploy process

if [ $? -eq 0 ]; then
    echo "✅ Process function deployed successfully!"
else
    echo "❌ Failed to deploy process function"
    exit 1
fi

echo ""
echo "================================"
echo "Deployment Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Upload a PDF file at /files"
echo "2. Check function logs: npx supabase functions logs process --follow"
echo "3. Test in chat at /chat"
echo ""
echo "For detailed testing instructions, see PDF_SUPPORT_README.md"

