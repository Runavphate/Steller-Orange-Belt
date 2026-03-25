import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import * as freighterApi from '@stellar/freighter-api';

// Mock the freighter-api
vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  signTransaction: vi.fn(),
}));

describe('Crowdfund dApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the header and main layout', () => {
    render(<App />);
    expect(screen.getByText('DeFi Crowdfund')).toBeInTheDocument();
    expect(screen.getByText('Next-Gen Crowdfunding')).toBeInTheDocument();
  });

  it('initially displays Connect Freighter button', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /Connect Freighter/i })).toBeInTheDocument();
  });

  it('shows loading state when connecting', async () => {
    freighterApi.isConnected.mockResolvedValue(true);
    let resolveAccess;
    freighterApi.requestAccess.mockReturnValue(new Promise(resolve => {
        resolveAccess = resolve;
    }));

    render(<App />);
    const connectBtn = screen.getByRole('button', { name: /Connect Freighter/i });
    
    fireEvent.click(connectBtn);
    expect(screen.getByRole('button', { name: /Connecting\.\.\./i })).toBeInTheDocument();
    
    resolveAccess({ address: 'GBXC12345678TEST' });
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /GBXC1\.\.\.TEST/i })).toBeInTheDocument();
    });
  });

  it('displays Creator and Backer panels', () => {
    render(<App />);
    expect(screen.getByText('Creator Actions')).toBeInTheDocument();
    expect(screen.getByText('Backer Actions')).toBeInTheDocument();
  });

  it('initially disables the action buttons without wallet connected', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /Initialize Campaign/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Claim Funds/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Pledge to Campaign/i })).toBeDisabled();
  });
});
