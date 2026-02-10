import { useState } from "react";
import { Wallet, Copy, LogOut, ExternalLink, Check, KeyRound } from "lucide-react";
import { Dropdown, DropdownItem, DropdownDivider } from "flowbite-react";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { useBalance } from "@/hooks/useBalance";
import { cn, truncateAddress, formatNumber } from "@/lib/utils";

interface WalletButtonProps {
  className?: string;
}

export function WalletButton({ className }: WalletButtonProps) {
  const { connected, connecting, publicKey, connect } = useWallet();
  const { isAuthenticated, isAuthenticating, authenticate, logout } = useAuth();
  const { balance } = useBalance(publicKey);
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  };

  const handleViewExplorer = () => {
    if (publicKey) {
      window.open(`https://explorer.x1.xyz/address/${publicKey.toBase58()}`, "_blank");
    }
  };

  const handleDisconnect = () => {
    logout();
  };

  // Not connected - show connect button
  if (!connected) {
    return (
      <Button
        variant="default"
        size="sm"
        onClick={() => void connect()}
        disabled={connecting}
        className={cn("gap-2", className)}
      >
        <Wallet className="h-4 w-4" />
        {connecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    );
  }

  // Connected but not authenticated - show sign in button
  if (!isAuthenticated) {
    return (
      <Button
        variant="default"
        size="sm"
        onClick={() => void authenticate()}
        disabled={isAuthenticating}
        className={cn("gap-2", className)}
      >
        <KeyRound className="h-4 w-4" />
        {isAuthenticating ? "Signing..." : "Sign In"}
      </Button>
    );
  }

  // Fully authenticated - show dropdown
  const address = publicKey?.toBase58() ?? "";
  const displayAddress = truncateAddress(address);
  const displayBalance = balance !== null ? formatNumber(balance) : "--";

  return (
    <Dropdown
      label=""
      dismissOnClick={true}
      renderTrigger={() => (
        <button
          className={cn(
            "flex h-auto items-center gap-2 rounded-lg border border-arena-border bg-arena-card px-3 py-2",
            "text-arena-text hover:bg-arena-border/50",
            "transition-colors focus:outline-none focus:ring-2 focus:ring-arena-accent",
            className
          )}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-arena-accent/20">
            <Wallet className="h-3.5 w-3.5 text-arena-accent" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs font-medium">{displayAddress}</span>
            <span className="text-[10px] text-arena-text-muted">{displayBalance} XNT</span>
          </div>
        </button>
      )}
    >
      {/* Balance display */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between rounded-md bg-arena-bg p-2">
          <span className="text-xs text-arena-text-muted">Balance</span>
          <span className="text-sm font-medium text-arena-text">{displayBalance} XNT</span>
        </div>
      </div>

      <DropdownDivider />

      <DropdownItem onClick={() => void handleCopyAddress()} className="flex items-center gap-2">
        {copied ? (
          <Check className="h-4 w-4 text-arena-pro" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        <span>{copied ? "Copied!" : "Copy Address"}</span>
      </DropdownItem>

      <DropdownItem onClick={handleViewExplorer} className="flex items-center gap-2">
        <ExternalLink className="h-4 w-4" />
        <span>View on Explorer</span>
      </DropdownItem>

      <DropdownDivider />

      <DropdownItem onClick={handleDisconnect} className="flex items-center gap-2 text-arena-con">
        <LogOut className="h-4 w-4" />
        <span>Disconnect</span>
      </DropdownItem>
    </Dropdown>
  );
}
