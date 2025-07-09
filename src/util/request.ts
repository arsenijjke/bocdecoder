import { Address, TonClient } from "@ton/ton";

// Call getFullTreasuryState get-method on smart contract and parse results
export async function getAccountDataBoc(address: string, client: TonClient) {
    const addr = Address.parse(address);
    const res = await client.callGetMethod(addr, "getFullTreasuryState", []);
    const stack = res.stack;
  
    const int1 = Number(stack.readBigNumber()) / 1e6; // totalShares
    const int2 = Number(stack.readBigNumber()) / 1e6; // totalPendingJettons
    const int3 = stack.readBigNumber();               // investorCount
    const cell = stack.readCell();                    
  
    return { int1, int2, int3, cell };
  }

  // Fetch account info from REST API
  export async function getAccountInfoREST(address: string) {
    const url = `https://testnet.toncenter.com/api/v2/getAddressInformation?address=${address}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!data.ok)
        return { status: "Error: " + (data.error?.message || "Unknown error"), balance: null };
      const acc = data.result;
      const balanceTON = Number(acc.balance) / 1e9;
      let statusText =
        acc.state === "active"
          ? "Account active"
          : acc.state === "uninitialized"
            ? "Account inactive"
            : acc.state === "frozen"
              ? "Account frozen"
              : acc.state;
      return { status: statusText, balance: balanceTON };
    } catch (e: any) {
      return { status: "Error: " + e.message, balance: null };
    }
  }