#!/bin/bash
# Supabase CLI Link Script
# Links to cloud Supabase project with direct connection (no pooler, no Docker)

PROJECT_REF="yzrwkznkfisfpnwzbwfw"

echo "Linking to Supabase project: $PROJECT_REF"
echo "Using direct connection (--skip-pooler)"

# Check if password is provided as environment variable
if [ -z "$SUPABASE_DB_PASSWORD" ]; then
    echo ""
    echo "Enter your Supabase database password:"
    read -s SUPABASE_DB_PASSWORD
fi

echo ""
echo "Linking project..."
npx supabase link --project-ref "$PROJECT_REF" --skip-pooler --password "$SUPABASE_DB_PASSWORD"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully linked to Supabase project!"
    echo ""
    echo "You can now run migrations with:"
    echo "  npm run supabase:db:push"
else
    echo ""
    echo "❌ Failed to link project. Please check your credentials."
    exit 1
fi

