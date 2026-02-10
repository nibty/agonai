import { useContext } from "react";
import { WalletContext, type WalletContextState } from "./WalletContext";

export function useWallet(): WalletContextState {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
