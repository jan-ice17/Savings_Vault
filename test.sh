#!/bin/bash

echo "Testing Savings Vault Functionality..."

# Deploy the canister (if not already deployed)
dfx deploy

# Store the canister ID
CANISTER_ID=$(dfx canister id savingvault_backend)

echo "1. Testing Fixed Plan Creation..."
# Create a fixed savings plan with 1000 tokens for 30 days
dfx canister call $CANISTER_ID createSavingsPlan '(record { 
    "planType" = variant { "Fixed" = null }; 
    "amount" = 1000; 
    "duration" = 30 
})'

echo -e "\n2. Testing Flexible Plan Creation..."
# Create a flexible savings plan with 500 tokens
dfx canister call $CANISTER_ID createSavingsPlan '(record { 
    "planType" = variant { "Flexible" = null }; 
    "amount" = 500; 
    "duration" = 0 
})'

echo -e "\n3. Getting User Plans..."
# Get all plans for the current user
dfx canister call $CANISTER_ID getUserPlans

echo -e "\n4. Testing Withdrawal (should show penalty warning for fixed plan)..."
# Try to withdraw from the first plan (replace PLAN_ID with actual ID from getUserPlans output)
# dfx canister call $CANISTER_ID withdrawFromPlan '("PLAN-ID-HERE")' 