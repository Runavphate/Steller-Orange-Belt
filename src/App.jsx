import { useState } from 'react';
import { Shield, Wallet, Play, Plus, Gift, CheckCircle, XCircle } from 'lucide-react';
import { isConnected, requestAccess, signTransaction } from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';
import './index.css';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const server = new StellarSdk.rpc.Server(RPC_URL);

const CONTRACT_ID = 'CCP4Z5BZG3VCWWGNIDRPFJK4CMFHXJDPKAGOVO4RF62QN7L4R7ZFJATM';

// Helper: encode an Address correctly as ScVal
const addressToScVal = (address) => new StellarSdk.Address(address).toScVal();

// Helper: encode a u64 correctly as ScVal (contract uses u64)
const u64ToScVal = (value) =>
  StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(BigInt(value)));

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
  const [isError, setIsError] = useState(false);

  const showMessage = (text, error = false) => {
    setIsError(error);
    setMessage(text);
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      // Freighter v6: isConnected() returns { isConnected: boolean }
      const connectionResult = await isConnected();
      const connected = connectionResult?.isConnected ?? connectionResult;
      if (!connected) {
        alert('Freighter Wallet is not installed. Please install the Freighter browser extension.');
        return;
      }
      // requestAccess() resolves with { address } or rejects on denial
      const accessResult = await requestAccess();
      const address = accessResult?.address ?? accessResult;
      if (!address) throw new Error('No address returned from Freighter.');
      setWallet(address);
      showMessage('Wallet connected successfully!');
    } catch (err) {
      console.error('Connect error:', err);
      alert(`Failed to connect Freighter: ${err?.message ?? err}`);
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Core function: build → prepareTransaction (simulation + auth) → sign → send → poll
   */
  const invokeContract = async (methodName, args) => {
    if (!wallet) throw new Error('Wallet not connected');

    const account = await server.getAccount(wallet);

    // Build the contract invocation — do NOT pass auth: [] here
    // prepareTransaction will populate auth entries from simulation
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: '10000',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(methodName, ...args))
      .setTimeout(180)
      .build();

    // Simulate + populate auth entries
    const preparedTx = await server.prepareTransaction(tx);

    // Freighter v6: signTransaction returns a plain signed XDR string, not { signedTxXdr }
    const signResult = await signTransaction(preparedTx.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    // Handle both v5 ({ signedTxXdr }) and v6 (plain string) return shapes
    const signedXdr = typeof signResult === 'string'
      ? signResult
      : signResult?.signedTxXdr;

    if (!signedXdr) throw new Error('Signing failed or was rejected.');

    const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    const sendResponse = await server.sendTransaction(signedTx);

    if (sendResponse.status === 'ERROR') {
      const errDetail = sendResponse.errorResult
        ? JSON.stringify(sendResponse.errorResult)
        : 'Unknown error';
      throw new Error(`Transaction submission failed: ${errDetail}`);
    }

    // Poll until SUCCESS, FAILED, or timeout (max 20 attempts × 2 s = 40 s)
    let txResponse;
    let attempts = 0;
    do {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      txResponse = await server.getTransaction(sendResponse.hash);
      attempts++;
    } while (
      (txResponse.status === 'NOT_FOUND' || txResponse.status === 'PENDING') &&
      attempts < 20
    );

    if (txResponse.status !== 'SUCCESS') {
      const errDetail = txResponse.resultXdr
        ? `Result XDR: ${txResponse.resultXdr}`
        : `Status: ${txResponse.status}`;
      throw new Error(`Transaction did not succeed. ${errDetail}`);
    }

    return sendResponse.hash;
  };

  const handleInitialize = async () => {
    if (!wallet || !targetAmount) return;
    try {
      setIsInitializing(true);
      showMessage('');

      // initialize(env, creator: Address, target_amount: u64)
      const args = [
        addressToScVal(wallet),
        u64ToScVal(targetAmount),
      ];

      const hash = await invokeContract('initialize', args);
      showMessage(`Campaign initialized! TX: ${hash.substring(0, 12)}…`);
      setTargetAmount('');
    } catch (err) {
      console.error('Initialize error:', err);
      showMessage(`Initialization failed: ${err?.message ?? err}`, true);
    } finally {
      setIsInitializing(false);
    }
  };

  const handlePledge = async () => {
    if (!wallet || !pledgeAmount) return;
    try {
      setIsPledging(true);
      showMessage('');

      // pledge(env, backer: Address, amount: u64)
      const args = [
        addressToScVal(wallet),
        u64ToScVal(pledgeAmount),
      ];

      const hash = await invokeContract('pledge', args);
      showMessage(`Pledged ${pledgeAmount} successfully! TX: ${hash.substring(0, 12)}…`);
      setPledgeAmount('');
    } catch (err) {
      console.error('Pledge error:', err);
      showMessage(`Pledge failed: ${err?.message ?? err}`, true);
    } finally {
      setIsPledging(false);
    }
  };

  const handleClaim = async () => {
    if (!wallet) return;
    try {
      setIsClaiming(true);
      showMessage('');

      // claim(env) — no extra args; creator auth resolved via simulation
      const hash = await invokeContract('claim', []);
      showMessage(`Funds claimed successfully! TX: ${hash.substring(0, 12)}…`);
    } catch (err) {
      console.error('Claim error:', err);
      showMessage(`Claim failed: ${err?.message ?? err}`, true);
    } finally {
      setIsClaiming(false);
    }
  };

  const displayWallet = wallet
    ? `${wallet.substring(0, 5)}...${wallet.substring(wallet.length - 4)}`
    : '';

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
          Create your campaign, pledge to visionary projects, and transparently claim
          funds upon reaching goals using Soroban smart contracts.
        </p>
      </div>

      {message && (
        <div
          className="glass-panel"
          style={{
            background: isError
              ? 'rgba(239, 68, 68, 0.08)'
              : 'rgba(16, 185, 129, 0.08)',
            border: `1px solid ${isError ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
          }}
        >
          <p style={{
            margin: 0,
            color: isError ? '#f87171' : '#10b981',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            {isError ? <XCircle size={18} /> : <CheckCircle size={18} />}
            {message}
          </p>
        </div>
      )}

      <div className="grid-2">
        {/* Creator Panel */}
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
              style={{
                width: '100%', padding: '0.75rem', marginBottom: '1rem',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', color: 'white',
              }}
            />
            <button
              style={{ width: '100%', padding: '1rem' }}
              onClick={handleInitialize}
              disabled={isInitializing || !targetAmount.trim() || !wallet}
            >
              {isInitializing ? (
                <><div className="spinner" /> Initializing...</>
              ) : (
                <><Play size={20} /> Initialize Campaign</>
              )}
            </button>
          </div>

          <div>
            <h4 style={{ color: '#94a3b8', marginBottom: '0.5rem', marginTop: 0 }}>Claim Funds</h4>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              Only the creator can claim funds once the target is reached.
            </p>
            <button
              style={{ width: '100%', padding: '1rem', background: 'transparent', border: '1px solid var(--primary)', color: 'white' }}
              onClick={handleClaim}
              disabled={isClaiming || !wallet}
            >
              {isClaiming ? (
                <><div className="spinner" /> Claiming...</>
              ) : (
                <><Gift size={20} /> Claim Funds</>
              )}
            </button>
          </div>
        </section>

        {/* Backer Panel */}
        <section className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)', margin: 0, marginBottom: '1rem' }}>
            <Plus size={20} /> Backer Actions
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: 0 }}>
              Support this project by pledging tokens. Your funds are secured by the smart
              contract until the goal is met.
            </p>

            <input
              type="number"
              placeholder="Pledge Amount"
              value={pledgeAmount}
              onChange={(e) => setPledgeAmount(e.target.value)}
              style={{
                width: '100%', padding: '0.75rem',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', color: 'white', outline: 'none',
              }}
            />

            <button
              style={{ width: '100%', padding: '1rem', background: 'var(--secondary)', color: 'white' }}
              onClick={handlePledge}
              disabled={isPledging || !pledgeAmount.trim() || !wallet}
            >
              {isPledging ? (
                <><div className="spinner" /> Pledging...</>
              ) : (
                <><Plus size={18} /> Pledge to Campaign</>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
