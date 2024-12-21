import {
    $query,
    $update,
    StableBTreeMap,
    Vec,
    Result,
    nat64,
    ic,
    Principal,
} from 'azle';

// Type definitions
type SavingsError = {
    kind: 'InsufficientFunds'
    | 'InvalidPlanDuration'
    | 'PlanNotFound'
    | 'UnauthorizedAccess'
    | 'InvalidAmount'
    | 'WithdrawalBeforeMaturity';
    message: string;
};

type PlanType = {
    kind: 'Fixed' | 'Flexible';
};

type SavingsPlan = {
    id: string;
    owner: Principal;
    planType: PlanType;
    amount: nat64;
    interestRate: nat64;
    startTime: nat64;
    duration: nat64;
    isActive: boolean;
    maturityDate: nat64;
};

type CreatePlanInput = {
    planType: PlanType;
    amount: nat64;
    duration: nat64;
};

// Initialize stable storage
const savingsPlans: StableBTreeMap<string, SavingsPlan> = new StableBTreeMap<string, SavingsPlan>(0, 44, 1024);

// Query functions
$query;
export function getUserPlans(): Result<SavingsPlan[], SavingsError> {
    const caller = ic.caller();
    const plans: SavingsPlan[] = [];
    
    for (const [_, plan] of savingsPlans.entries()) {
        if (plan.owner.toString() === caller.toString()) {
            plans.push(plan);
        }
    }
    
    return Result.Ok(plans);
}

// Update functions
$update;
export function createSavingsPlan(input: CreatePlanInput): Result<SavingsPlan, SavingsError> {
    if (input.amount <= BigInt(0)) {
        return Result.Err({
            kind: 'InvalidAmount',
            message: "Amount must be greater than 0"
        });
    }

    if (input.planType.kind === 'Fixed' && input.duration < BigInt(1)) {
        return Result.Err({
            kind: 'InvalidPlanDuration',
            message: "Fixed plans require minimum 1 day duration"
        });
    }

    const planId = generatePlanId();
    const currentTime = ic.time();
    const interestRate = calculateInterestRate(input.planType, input.duration);
    const durationNanos = input.duration * BigInt(24) * BigInt(60) * BigInt(60) * BigInt(1_000_000_000);
    
    const newPlan: SavingsPlan = {
        id: planId,
        owner: ic.caller(),
        planType: input.planType,
        amount: input.amount,
        interestRate,
        startTime: currentTime,
        duration: durationNanos,
        isActive: true,
        maturityDate: currentTime + durationNanos
    };

    savingsPlans.insert(planId, newPlan);
    return Result.Ok(newPlan);
}

$update;
export function withdrawFromPlan(planId: string): Result<nat64, SavingsError> {
    const plan = savingsPlans.get(planId);
    if (!plan) {
        return Result.Err({
            kind: 'PlanNotFound',
            message: "Savings plan not found"
        });
    }

    if (plan.owner.toString() !== ic.caller().toString()) {
        return Result.Err({
            kind: 'UnauthorizedAccess',
            message: "You are not the owner of this plan"
        });
    }
    
    if (!plan.isActive) {
        return Result.Err({
            kind: 'PlanNotFound',
            message: "Plan is no longer active"
        });
    }

    const currentTime: nat64 = ic.time();
    let withdrawalAmount: nat64 = plan.amount;

    if (plan.planType.kind === 'Fixed' && currentTime < plan.maturityDate) {
        const interestEarned: nat64 = calculateInterest(plan);
        withdrawalAmount = withdrawalAmount + (interestEarned / BigInt(2));
        
        return Result.Err({
            kind: 'WithdrawalBeforeMaturity',
            message: "Early withdrawal will incur penalties"
        });
    }

    const finalInterest: nat64 = calculateInterest(plan);
    withdrawalAmount = withdrawalAmount + finalInterest;
    
    const updatedPlan: SavingsPlan = { 
        ...plan, 
        isActive: false 
    };
    savingsPlans.insert(planId, updatedPlan);
    
    return Result.Ok(withdrawalAmount);
}

// Helper functions
function generatePlanId(): string {
    return `PLAN-${ic.time().toString()}`;
}

function calculateInterestRate(planType: PlanType, duration: nat64): nat64 {
    if (planType.kind === 'Fixed') {
        return BigInt(500) + (duration * BigInt(100));
    }
    return BigInt(300);
}

function calculateInterest(plan: SavingsPlan): nat64 {
    const currentTime = ic.time();
    const timeElapsed = currentTime - plan.startTime;
    const yearInNanos = BigInt(365) * BigInt(24) * BigInt(60) * BigInt(60) * BigInt(1_000_000_000);
    return (plan.amount * plan.interestRate * timeElapsed) / (yearInNanos * BigInt(10000));
}
