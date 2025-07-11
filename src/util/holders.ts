type Holder = {
    address: string;
    balance: number;
  };
  
  function truncateAddress(address: string): string {
    return `${address.slice(0, 5)}...${address.slice(-4)}`;
  }
  
  export async function fetchJettonHolders(masterAddress: string): Promise<Holder[]> {
    const url = `https://testnet.tonapi.io/v2/jettons/${masterAddress}/holders?limit=100`;
  
    try {
      const response = await fetch(url);
      const json = await response.json();
  
      if (!json.holders || !Array.isArray(json.holders)) {
        throw new Error('Invalid holders response');
      }
  
      return json.holders.map((holder: any) => {
        const address = holder.owner?.address || holder.address || null;
        const rawBalance = holder.balance ?? holder.jetton_balance ?? null;
  
        if (!address || rawBalance === null) {
          throw new Error('Missing holder address or balance');
        }
  
        return {
          address,
          balance: Number(rawBalance) / 1e9, // convert from nano if needed
        };
      });
    } catch (e) {
      console.error('Failed to fetch jetton holders:', e);
      throw e;
    }
  }
  
  function calculateSharePercentages(holders: Holder[]): { address: string; percentage: number }[] {
    const total = holders.reduce((sum, h) => sum + h.balance, 0);
  
    return holders.map(h => ({
      address: h.address,
      percentage: (h.balance / total) * 100,
    }));
  }
  
  function updateTreasuryCard(
    masterAddress: string,
    shares: { address: string; percentage: number }[],
    recentTx?: string
  ) {
    const card = document.querySelector('.card');
    if (!card) return;
  
    // Update the first <p> (master address)
    const addrP = card.querySelector('p');
    if (addrP) {
      addrP.textContent = truncateAddress(masterAddress);
    }
  
    // Update the table rows dynamically:
    const table = card.querySelector('table.owners-list');
    if (table) {
      table.innerHTML = ''; // Clear existing rows
  
      shares.forEach(({ address, percentage }) => {
        const row = document.createElement('tr');
  
        const addrTd = document.createElement('td');
        addrTd.textContent = truncateAddress(address);
  
        const percentTd = document.createElement('td');
        percentTd.textContent = `${percentage.toFixed(1)}%`;
  
        row.appendChild(addrTd);
        row.appendChild(percentTd);
        table.appendChild(row);
      });
    }
  
    // Update the second <p> (recent transactions)
    const pTags = card.querySelectorAll('p');
    if (pTags.length > 1) {
      pTags[1].textContent = recentTx || 'No recent transactions';
    }
  }

  export async function loadTreasuryData(masterAddress: string) {
    try {
      const holders = await fetchJettonHolders(masterAddress);
      const shares = calculateSharePercentages(holders);
      updateTreasuryCard(masterAddress, shares, "Claim 0 →");
    } catch (e) {
      console.error('Error loading treasury data:', e);
    }
  }