import { createContext } from "react";
import type { PublicKey, Connection } from "@solana/web3.js";
import type { WalletName } from "@solana/wallet-adapter-base";
import type { Wallet } from "@solana/wallet-adapter-react";

export interface WalletContextState {
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  wallet: Wallet | null;
  walletName: WalletName | null;
  connection: Connection;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  select: (walletName: WalletName) => void;
}

export const WalletContext = createContext<WalletContextState | null>(null);
