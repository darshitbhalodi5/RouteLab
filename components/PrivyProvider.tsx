"use client";

import { PrivyProvider as P } from "@privy-io/react-auth";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function PrivyProvider({ children }: { children: React.ReactNode }) {
	if (!APP_ID) return <>{children}</>;
	return (
		<P appId={APP_ID} config={{ appearance: { theme: "dark" }, embeddedWallets: { createOnLogin: "users-without-wallets" } }}>
			{children}
		</P>
	);
} 