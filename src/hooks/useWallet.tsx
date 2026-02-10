import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet as useSolanaWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  useWalletModal,
} from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import type { PublicKey, Connection } from "@solana/web3.js";
import type { WalletName } from "@solana/wallet-adapter-base";
import type { Wallet } from "@solana/wallet-adapter-react";

// Import wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

// X1 Network Configuration
const X1_RPC_ENDPOINT = "https://rpc.mainnet.x1.xyz/";

interface WalletContextState {
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

const WalletContext = createContext<WalletContextState | null>(null);

interface WalletContextProviderProps {
  children: ReactNode;
}

function WalletContextProvider({ children }: WalletContextProviderProps) {
  const { connection } = useConnection();
  const {
    connected,
    connecting,
    publicKey,
    wallet,
    select,
    disconnect: solanaDisconnect,
    signMessage: solanaSignMessage,
  } = useSolanaWallet();
  const { setVisible } = useWalletModal();

  const connect = useCallback(async (): Promise<void> => {
    setVisible(true);
  }, [setVisible]);

  const disconnect = useCallback(async (): Promise<void> => {
    await solanaDisconnect();
  }, [solanaDisconnect]);

  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      if (!solanaSignMessage) {
        throw new Error("Wallet does not support message signing");
      }
      return solanaSignMessage(message);
    },
    [solanaSignMessage]
  );

  const value = useMemo(
    (): WalletContextState => ({
      connected,
      connecting,
      publicKey,
      wallet,
      walletName: wallet?.adapter.name ?? null,
      connection,
      connect,
      disconnect,
      signMessage,
      select,
    }),
    [
      connected,
      connecting,
      publicKey,
      wallet,
      connection,
      connect,
      disconnect,
      signMessage,
      select,
    ]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider
      endpoint={X1_RPC_ENDPOINT}
      config={{ commitment: "confirmed" }}
    >
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletContextProvider>{children}</WalletContextProvider>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

export function useWallet(): WalletContextState {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
