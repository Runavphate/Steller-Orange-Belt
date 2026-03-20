import { useState } from 'react';
import { Shield, Wallet, Lock, Unlock, Send, Key } from 'lucide-react';
import { isConnected, requestAccess, signTransaction } from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';
import CryptoJS from 'crypto-js';
import './index.css';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const server = new StellarSdk.rpc.Server(RPC_URL);

function App() {
  const [wallet, setWallet] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [draft, setDraft] = useState('');
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptResult, setEncryptResult] = useState(null);

  const [decryptInput, setDecryptInput] = useState('');
  const [decryptKey, setDecryptKey] = useState('');
  const [decryptResult, setDecryptResult] = useState('');
  const [decryptError, setDecryptError] = useState('');

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

  const handleEncryptAndSend = async () => {
    if (!wallet || !draft.trim()) return;
    try {
      setIsEncrypting(true);
      setEncryptResult(null);
      
      const generatedHashKey = CryptoJS.lib.WordArray.random(16).toString();
      const encryptedPayload = CryptoJS.AES.encrypt(draft, generatedHashKey).toString();

      const account = await server.getAccount(wallet);
      
      const memoHash = CryptoJS.SHA256(encryptedPayload).toString(CryptoJS.enc.Hex).substring(0, 28);
      
      const op = StellarSdk.Operation.payment({
         destination: wallet,
         asset: StellarSdk.Asset.native(),
         amount: "0.0000001"
      });

      let tx = new StellarSdk.TransactionBuilder(account, { fee: "10000", networkPassphrase: NETWORK_PASSPHRASE })
      .addMemo(StellarSdk.Memo.text(memoHash))
      .addOperation(op)
      .setTimeout(180)
      .build();

      const { signedTxXdr, error: signError } = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
      if (signError) throw new Error(signError);

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
      const sendResponse = await server.sendTransaction(signedTx);
      
      if (sendResponse.status === "ERROR") {
        throw new Error(`TX failed: ${JSON.stringify(sendResponse.errorResult)}`);
      }

      setEncryptResult({
        payload: encryptedPayload,
        hashKey: generatedHashKey,
        memoHash: memoHash
      });
      setDraft('');

    } catch (err) {
      console.error(err);
      alert(`Encryption failed: ${err?.message || 'Check your testnet connection.'}`);
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleDecrypt = () => {
    setDecryptResult('');
    setDecryptError('');
    if (!decryptInput.trim() || !decryptKey.trim()) {
      setDecryptError("Please provide both the Encrypted Ciphertext and the correct HashKey.");
      return;
    }

    try {
      const bytes = CryptoJS.AES.decrypt(decryptInput, decryptKey);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!originalText) {
         throw new Error("Invalid key or corrupted ciphertext.");
      }
      
      setDecryptResult(originalText);
    } catch (err) {
      setDecryptError("Decryption failed. Ensure your HashKey and Ciphertext are exactly correct.");
    }
  };

  const displayWallet = wallet ? `${wallet.substring(0, 5)}...${wallet.substring(wallet.length - 4)}` : '';

  return (
    <div className="layout">
      <header className="header glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 className="gradient-text" style={{ margin: 0 }}>SafeBoxMessage</h1>
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
        <h2 style={{ fontSize: '2rem', marginTop: 0 }}>End-to-End Encrypted Messenger</h2>
        <p className="text-dim" style={{ marginBottom: '2rem' }}>
          Encrypt your message on the left to get a unique HashKey (AES). To decrypt, you must provide the exact HashKey (AES) and Ciphertext on the right.
        </p>
      </div>

      <div className="grid-2">
        <section className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginTop: 0 }}>
            <Lock size={20} /> Message Secret
          </h3>
          <textarea 
            placeholder="Type your sensitive message here..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button 
            style={{ width: '100%', padding: '1rem' }} 
            onClick={handleEncryptAndSend} 
            disabled={isEncrypting || !draft.trim() || !wallet}
          >
            {isEncrypting ? (
              <><div className="spinner" /> Encrypting...</>
            ) : (
              <><Send size={20}/> Encrypt & Broadcast</>
            )}
          </button>
          {!wallet && <p style={{ fontSize: '0.85rem', color: '#fbbf24', textAlign: 'center', marginTop: '1rem' }}>Connect wallet</p>}

          {encryptResult && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(59,130,246,0.1)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.2)' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#60a5fa' }}>Success! Keep this safe:</h4>
              
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Stellar Memo (SHA-256):</strong>
                <div style={{ fontSize: '0.8rem', color: '#fbbf24', wordBreak: 'break-all', marginTop: '0.25rem' }}>
                  {encryptResult.memoHash}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Encrypted Payload (Ciphertext):</strong>
                <div style={{ fontSize: '0.8rem', color: '#f8fafc', fontWeight: 'bold', wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.25rem', userSelect: 'all' }}>
                  {encryptResult.payload}
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Your Secret HashKey (AES):</strong>
                <div style={{ fontSize: '0.9rem', color: '#ef4444', fontWeight: 'bold', wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.25rem', userSelect: 'all' }}>
                  {encryptResult.hashKey}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)', margin: 0 }}>
              <Unlock size={20} /> Decrypt Message
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <textarea 
              placeholder="Paste the Encrypted Payload (Ciphertext) here..."
              value={decryptInput}
              onChange={(e) => setDecryptInput(e.target.value)}
              style={{ minHeight: '80px' }}
            />
            
            <div style={{ position: 'relative' }}>
              <Key size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="Enter HashKey (AES)..." 
                value={decryptKey}
                onChange={(e) => setDecryptKey(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none' }}
              />
            </div>

            <button 
              style={{ width: '100%', padding: '1rem', background: 'transparent', border: '1px solid var(--secondary)', color: 'white' }} 
              onClick={handleDecrypt} 
              disabled={!decryptInput.trim() || !decryptKey.trim()}
            >
              <Unlock size={18}/> Verify & Decrypt
            </button>

            {decryptError && (
              <p style={{ color: '#ef4444', fontSize: '0.9rem', textAlign: 'center' }}>{decryptError}</p>
            )}

            {decryptResult && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px' }}>
                <strong style={{ fontSize: '0.85rem', color: '#10b981' }}>Decrypted Original Message:</strong>
                <p style={{ margin: '0.5rem 0 0 0', color: 'white', whiteSpace: 'pre-wrap' }}>{decryptResult}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
