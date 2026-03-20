#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    client.initialize(&creator, &1000);
}

#[test]
fn test_pledge() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    client.initialize(&creator, &1000);

    let backer1 = Address::generate(&env);
    client.pledge(&backer1, &500);

    let backer2 = Address::generate(&env);
    client.pledge(&backer2, &300);
}

#[test]
fn test_claim() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    client.initialize(&creator, &1000);

    let backer = Address::generate(&env);
    client.pledge(&backer, &1000);

    client.claim();
}

#[test]
#[should_panic(expected = "Target amount not reached")]
fn test_claim_fails_when_target_not_reached() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    client.initialize(&creator, &1000);

    let backer = Address::generate(&env);
    client.pledge(&backer, &500);

    client.claim();
}
