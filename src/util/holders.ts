interface Transaction {
  in_msg: {
    source: string | null;
    destination: string | null;
    value: string; // in nanoTON
  } | null;
  utime: number;
  hash: string;
}

export function renderSentTransactions(transactions: Transaction[], contractAddress: string) {
  const table = document.querySelector('.owners-list') as HTMLTableElement;
  const emptyMsg = document.querySelector('.card p:nth-of-type(2)') as HTMLElement;

  if (!table || !emptyMsg) {
    console.warn('Table or message paragraph not found');
    return;
  }

  // Clear any existing rows
  table.innerHTML = '';

  // Add table headers
  const headerRow = document.createElement('tr');
  headerRow.innerHTML = `
    <th>Date</th>
    <th>To</th>
    <th>Amount (TON)</th>
    <th>Tx Hash</th>
  `;
  table.appendChild(headerRow);

  // Filter for outgoing transactions
  const sentTxs = transactions.filter(tx => {
    const source = getAddressField(tx.in_msg?.source);
    const destination = getAddressField(tx.in_msg?.destination);
  
    const isSourceValid = typeof source === 'string';
    const isDestinationValid = typeof destination === 'string';
  
    const isSent = isSourceValid &&
                   isDestinationValid &&
                   source.toLowerCase() === contractAddress.toLowerCase() &&
                   destination.toLowerCase() !== contractAddress.toLowerCase();
  
    console.log(`[Tx]:`, {
      hash: tx.hash,
      source,
      destination,
      value: tx.in_msg?.value,
      isSent,
    });
  
    return isSent;
  });
  

  if (sentTxs.length === 0) {
    console.info('No sent transactions found from contract:', contractAddress);
    emptyMsg.textContent = 'No recent transactions were made';
    return;
  }

  // Clear empty message
  emptyMsg.textContent = '';

  for (const tx of sentTxs) {
    const row = document.createElement('tr');
    const date = new Date(tx.utime * 1000).toLocaleString();
    const dest = tx.in_msg!.destination!;
    const amountTon = (parseFloat(tx.in_msg!.value) / 1e9).toFixed(3);
    const hashShort = tx.hash.slice(0, 8) + '…';

    row.innerHTML = `
      <td>${date}</td>
      <td>${dest}</td>
      <td>${amountTon}</td>
      <td><a href="https://testnet.tonscan.org/tx/${tx.hash}" target="_blank">${hashShort}</a></td>
    `;
    table.appendChild(row);
  }
}

function getAddressField(input: any): string | undefined {
  if (!input) return undefined;
  if (typeof input === 'string') return input;
  if (typeof input === 'object' && typeof input.address === 'string') return input.address;
  return undefined;
}
