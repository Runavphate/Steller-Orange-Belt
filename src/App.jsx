import { useState } from 'react';
import { Shield, Wallet, Play, Plus, Gift, CheckCircle } from 'lucide-react';
import { isConnected, requestAccess, signTransaction } from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';
import './index.css';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const server = new StellarSdk.rpc.Server(RPC_URL);

// Using the contract ID from README, user can change if needed
const CONTRACT_ID = 'CCP4Z5BZG3VCWWGNIDRPFJK4CMFHXJDPKAGOVO4RF62QN7L4R7ZFJATM';

function App() {
  const [wallet, setWallet] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Initialize
  const [targetAmount, setTargetAmount] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  
  // Pledge
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [isPledging, setIsPledging] = useState(false);

  // Claim
  const [isClaiming, setIsClaiming] = useState(false);

  // UI feedback
  const [message, setMessage] = useState('');

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      if (!(await isConnected())) {
        alert("Freighter Wallet is not installed or not available. Please install the Freighter browser extension.");
        setIsConnecting(false);
        return;
      }
      const { address, error: accessError } = await requestAccess();
      if (accessError) throw new Error(accessError);
      setWallet(address);
    } catch (err) {
      console.error(err);
      alert("Failed to connect to Freighter.");
    } finally {
      setIsConnecting(false);
    }
  };

  const invokeContract = async (methodName, args) => {
    if (!wallet) throw new Error("Wallet not connected");
    const account = await server.getAccount(wallet);
    
    // Create the contract invocation operation
    const op = StellarSdk.Operation.invokeHostFunction({
      func: StellarSdk.xdr.HostFunction.hostFunctionTypeInvokeContract(
        new StellarSdk.xdr.InvokeContractArgs({
          contractAddress: new StellarSdk.Address(CONTRACT_ID).toScAddress(),
          functionName: methodName,
          args: args,
        })
      ),
      auth: [], // In basic cases, auth might be handled automatically by Soroban via `require_auth`
    });

    let tx = new StellarSdk.TransactionBuilder(account, { 
      fee: "10000", 
      networkPassphrase: NETWORK_PASSPHRASE 
    })
    .addOperation(op)
    .setTimeout(180)
    .build();

    // In soroban we need to prepare the transaction
    const preparedTx = await server.prepareTransaction(tx);

    const { signedTxXdr, error: signError } = await signTransaction(
      preparedTx.toXDR(), 
      { networkPassphrase: NETWORK_PASSPHRASE }
    );
    if (signError) throw new Error(signError);

    const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const sendResponse = await server.sendTransaction(signedTx);
    
    if (sendResponse.status === "ERROR") {
      throw new Error(`TX failed: ${JSON.stringify(sendResponse.errorResult)}`);
    }

    // Wait for transaction to complete in Soroban
    let txResponse = await server.getTransaction(sendResponse.hash);
    let attempts = 0;
    while (txResponse.status === "NOT_FOUND" && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      txResponse = await server.getTransaction(sendResponse.hash);
      attempts++;
    }

    if (txResponse.status !== "SUCCESS") {
       throw new Error(`Transaction failed or timed out. Status: ${txResponse.status}`);
    }

    return sendResponse.hash;
  };

  const handleInitialize = async () => {
    if (!wallet || !targetAmount) return;
    try {
      setIsInitializing(true);
      setMessage('');
      
      const args = [
        StellarSdk.nativeToScVal(wallet, { type: 'address' }),
        StellarSdk.nativeToScVal(Number(targetAmount), { type: 'u64' })
      ];

      const hash = await invokeContract("initialize", args);
      setMessage(`Successfully initialized campaign! TX: ${hash.substring(0,8)}...`);
      setTargetAmount('');
    } catch (err) {
      console.error(err);
      setMessage(`Initialization failed: ${err?.message}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const handlePledge = async () => {
     if (!wallet || !pledgeAmount) return;
     try {
       setIsPledging(true);
       setMessage('');
       
       const args = [
         StellarSdk.nativeToScVal(wallet, { type: 'address' }),
         StellarSdk.nativeToScVal(Number(pledgeAmount), { type: 'u64' })
       ];
 
       const hash = await invokeContract("pledge", args);
       setMessage(`Successfully pledged ${pledgeAmount} to campaign! TX: ${hash.substring(0,8)}...`);
       setPledgeAmount('');
     } catch (err) {
       console.error(err);
       setMessage(`Pledge failed: ${err?.message}`);
     } finally {
       setIsPledging(false);
     }
  };

  const handleClaim = async () => {
    if (!wallet) return;
    try {
      setIsClaiming(true);
      setMessage('');
      
      const args = []; // claim takes only env

      const hash = await invokeContract("claim", args);
      setMessage(`Successfully claimed funds! TX: ${hash.substring(0,8)}...`);
    } catch (err) {
      console.error(err);
      setMessage(`Claim failed: ${err?.message}`);
    } finally {
      setIsClaiming(false);
    }
  };

  const displayWallet = wallet ? `${wallet.substring(0, 5)}...${wallet.substring(wallet.length - 4)}` : '';

  return (
    <div className="layout">
      <header className="header glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 className="gradient-text" style={{ margin: 0 }}>DeFi Crowdfund</h1>
        </div>
        
        <button onClick={handleConnect} disabled={isConnecting || !!wallet}>
          {isConnecting ? (
            <><div className="spinner" /> Connecting...</>
          ) : wallet ? (
            <><Shield size={20} /> {displayWallet}</>
          ) : (
            <><Wallet size={20} /> Connect Freighter</>
          )}
        </button>
      </header>

      <div className="glass-panel" style={{ paddingBottom: '0.5rem' }}>
        <h2 style={{ fontSize: '2rem', marginTop: 0 }}>Next-Gen Crowdfunding</h2>
        <p className="text-dim" style={{ marginBottom: '2rem' }}>
          Create your campaign, pledge to visionary projects, and transparently claim funds upon reaching goals using Soroban smart contracts.
        </p>
      </div>

      {message && (
        <div className="glass-panel" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
           <p style={{ margin: 0, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <CheckCircle size={18} /> {message}
           </p>
        </div>
      )}

      <div className="grid-2">
        <section className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginTop: 0 }}>
            <Play size={20} /> Creator Actions
          </h3>
          
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ color: '#94a3b8', marginBottom: '0.5rem', marginTop: 0 }}>Initialize Campaign</h4>
            <input 
              type="number"
              placeholder="Target Amount (e.g. 1000)"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
            />
            <button 
              style={{ width: '100%', padding: '1rem' }} 
              onClick={handleInitialize} 
              disabled={isInitializing || !targetAmount.trim() || !wallet}
            >
              {isInitializing ? (
                <><div className="spinner" /> Initializing...</>
              ) : (
                <><Play size={20}/> Initialize Campaign</>
              )}
            </button>
          </div>

          <div>
             <h4 style={{ color: '#94a3b8', marginBottom: '0.5rem', marginTop: 0 }}>Claim Funds</h4>
             <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>Only the creator can claim funds once the target is reached.</p>
             <button 
              style={{ width: '100%', padding: '1rem', background: 'transparent', border: '1px solid var(--primary)', color: 'white' }} 
              onClick={handleClaim} 
              disabled={isClaiming || !wallet}
            >
              {isClaiming ? (
                <><div className="spinner" /> Claiming...</>
              ) : (
                <><Gift size={20}/> Claim Funds</>
              )}
            </button>
          </div>
        </section>

        <section className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)', margin: 0, marginBottom: '1rem' }}>
            <Plus size={20} /> Backer Actions
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: 0 }}>
               Support this project by pledging tokens. Your funds are secured by the smart contract until the goal is met.
            </p>
            
            <input 
              type="number" 
              placeholder="Pledge Amount" 
              value={pledgeAmount}
              onChange={(e) => setPledgeAmount(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none' }}
            />

            <button 
              style={{ width: '100%', padding: '1rem', background: 'var(--secondary)', color: 'white' }} 
              onClick={handlePledge} 
              disabled={isPledging || !pledgeAmount.trim() || !wallet}
            >
              {isPledging ? (
                <><div className="spinner" /> Pledging...</>
              ) : (
                <><Plus size={18}/> Pledge to Campaign</>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
