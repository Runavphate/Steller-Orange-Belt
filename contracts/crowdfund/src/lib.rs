#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, symbol_short};

#[contracttype]
pub enum DataKey {
    TargetAmount,
    TotalPledged,
    Deadline,
    Creator,
    Pledge(Address),
    Claimed,
}

#[contract]
pub struct CrowdfundContract;

#[contractimpl]
impl CrowdfundContract {
    pub fn initialize(env: Env, creator: Address, target_amount: u64) {
        if env.storage().instance().has(&DataKey::Creator) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Creator, &creator);
        env.storage().instance().set(&DataKey::TargetAmount, &target_amount);
        env.storage().instance().set(&DataKey::TotalPledged, &0u64);
        env.storage().instance().set(&DataKey::Claimed, &false);
        // Simplified deadline by just setting a flag for now or ignoring time in this basic example
    }

    pub fn pledge(env: Env, backer: Address, amount: u64) {
        backer.require_auth();
        let total: u64 = env.storage().instance().get(&DataKey::TotalPledged).unwrap_or(0);
        
        let current_pledge: u64 = env.storage().persistent().get(&DataKey::Pledge(backer.clone())).unwrap_or(0);
        env.storage().persistent().set(&DataKey::Pledge(backer), &(current_pledge + amount));
        
        env.storage().instance().set(&DataKey::TotalPledged, &(total + amount));
    }

    pub fn claim(env: Env) {
        let creator: Address = env.storage().instance().get(&DataKey::Creator).unwrap();
        creator.require_auth();

        let total: u64 = env.storage().instance().get(&DataKey::TotalPledged).unwrap_or(0);
        let target: u64 = env.storage().instance().get(&DataKey::TargetAmount).unwrap();
        
        if total < target {
            panic!("Target amount not reached");
        }

        let claimed: bool = env.storage().instance().get(&DataKey::Claimed).unwrap_or(false);
        if claimed {
            panic!("Already claimed");
        }

        env.storage().instance().set(&DataKey::Claimed, &true);
        // In a real contract, we would transfer tokens here.
    }
}
