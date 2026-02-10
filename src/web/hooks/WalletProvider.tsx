import { useMemo, useCallback, useState, useEffect, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet as useSolanaWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider, useWalletModal } from "@solana/wallet-adapter-react-ui";
import { WalletContext, type WalletContextState } from "./WalletContext";

// Import wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

// X1 Network Configuration
const X1_RPC_ENDPOINT = "https://rpc.mainnet.x1.xyz/";

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
  const [userInitiatedConnect, setUserInitiatedConnect] = useState(false);

  // Reset flag when disconnected
  useEffect(() => {
    if (!connected) {
      setUserInitiatedConnect(false);
    }
  }, [connected]);

  const connect = useCallback(async (): Promise<void> => {
    setUserInitiatedConnect(true);
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
      userInitiatedConnect,
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
      userInitiatedConnect,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={X1_RPC_ENDPOINT} config={{ commitment: "confirmed" }}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletContextProvider>{children}</WalletContextProvider>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
