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

  export async function getTokensByAddressTonviewer(address: string) {
    const url = `https://testnet.toncenter.com/api/v2/getTransactions?address=${address}&limit=50`;
  
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  
      const data = await res.json();
  
      // The response includes an array of jettons with info and balances
      // Example shape: data.jettons = [{master: '...', balance: '...', decimals: 9, symbol: '...', ...}, ...]
  
      if (!data.jettons) return [];
  
      return data.jettons.map((jetton: any) => ({
        jettonMaster: jetton.master,
        balance: jetton.balance,
        decimals: jetton.decimals,
        symbol: jetton.symbol,
        name: jetton.name,
        image: jetton.image,
      }));
  
    } catch (e: any) {
      throw new Error(`Failed to get tokens: ${e.message}`);
    }
  }