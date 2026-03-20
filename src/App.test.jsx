import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

vi.mock('@stellar/stellar-sdk', () => ({
  rpc: { Server: vi.fn() },
  Networks: { TESTNET: 'testnet' },
  Contract: vi.fn(),
  Address: vi.fn(),
  ScInt: vi.fn(),
  Memo: { text: vi.fn() },
  Asset: { native: vi.fn() },
  Operation: { payment: vi.fn() },
  TransactionBuilder: vi.fn()
}));

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn().mockResolvedValue(true),
  requestAccess: vi.fn().mockResolvedValue({ address: 'GTESTWALLET123' }),
  signTransaction: vi.fn()
}));

describe('Mini-dApp Messenger', () => {
  it('renders the header and main layout', () => {
    render(<App />);
    expect(screen.getByText(/SafeBoxMessage/i)).toBeInTheDocument();
  });

  it('initially displays Connect Freighter button', () => {
    render(<App />);
    expect(screen.getByText(/Connect Freighter/i)).toBeInTheDocument();
  });

  it('shows loading state when connecting wallet', async () => {
    render(<App />);
    const connectBtn = screen.getByText(/Connect Freighter/i);
    fireEvent.click(connectBtn);
    
    await waitFor(() => {
      expect(screen.getByText(/Connecting.../i)).toBeInTheDocument();
    });
  });

  it('displays the Message Secret and Decrypt Message panels', () => {
    render(<App />);
    expect(screen.getByText(/Message Secret/i)).toBeInTheDocument();
    expect(screen.getByText(/Decrypt Message/i)).toBeInTheDocument();
  });

  it('initially disables the Verify & Decrypt button', () => {
    render(<App />);
    const decryptBtn = screen.getByRole('button', { name: /Verify & Decrypt/i });
    expect(decryptBtn).toBeDisabled();
  });
});
