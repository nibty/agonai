import { useState } from "react";
import { Wallet, ChevronDown, Copy, LogOut, ExternalLink, Check, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-auto gap-2 px-3 py-2", className)}>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-arena-accent/20">
              <Wallet className="h-3.5 w-3.5 text-arena-accent" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium">{displayAddress}</span>
              <span className="text-[10px] text-arena-text-muted">{displayBalance} XNT</span>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-arena-text-muted" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none text-white">Connected Wallet</p>
            <p className="text-xs leading-none text-arena-text-muted">{displayAddress}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-2">
          <div className="flex items-center justify-between rounded-md bg-arena-bg p-2">
            <span className="text-xs text-arena-text-muted">Balance</span>
            <span className="text-sm font-medium text-white">{displayBalance} XNT</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleCopyAddress()}>
          {copied ? (
            <Check className="mr-2 h-4 w-4 text-arena-pro" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          <span>{copied ? "Copied!" : "Copy Address"}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleViewExplorer}>
          <ExternalLink className="mr-2 h-4 w-4" />
          <span>View on Explorer</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDisconnect}
          className="text-arena-con focus:text-arena-con"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
