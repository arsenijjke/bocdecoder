import { renderStakeGrowthChart } from './chart.ts';

export function setupTabs(transactions: any[]) {
  const tabs = document.querySelectorAll('.tabs > div');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.getAttribute('data-tab');
      contents.forEach(content => {
        if (content.id === target) {
          content.classList.add('active');
          if (target === 'stake') {
            renderStakeGrowthChart(transactions);
          } else if (target === 'calls') {
            renderContractCalls(transactions);
          } else if (target === 'payout') {
            renderPayoutHistory(transactions);
          }
        } else {
          content.classList.remove('active');
        }
      });
    });
  });
}

export async function fetchTransactions(address: string, limit = 100) {
    const url = `https://testnet.tonapi.io/v2/blockchain/accounts/${address}/transactions?limit=${limit}`;
    
    try {
      const response = await fetch(url);
      const json = await response.json();
  
      // ✅ Corrected structure check
      if (!json.transactions || !Array.isArray(json.transactions)) {
        console.error('Unexpected response structure:', json);
        throw new Error(`Failed to fetch transactions: Unexpected response format`);
      }
  
      return json.transactions;
    } catch (e) {
      console.error('Fetch error:', e);
  
      if (e instanceof Error) {
        throw new Error(`Failed to fetch transactions: ${e.message}`);
      } else {
        throw new Error(`Failed to fetch transactions: ${String(e)}`);
      }
    }
  }
  
  export function fetchStakeGrowthFromToncenter(transactions: any[]) {
    const stakePoints = [];
    let totalShares = 0;
  
    for (const tx of transactions.slice().reverse()) {
      const inMsg = tx.in_msg;
      if (inMsg && inMsg.value && inMsg.source) {
        const tonAmount = Number(inMsg.value) / 1e9;
        const sharesAdded = tonAmount * 100; // Adjust logic if needed
        totalShares += sharesAdded;
  
        stakePoints.push({
          date: new Date(tx.utime * 1000).toISOString().split('T')[0],
          totalShares: Math.floor(totalShares),
        });
      }
    }
  
    return stakePoints;
  }
  
  // Contract calls tab
  
  export async function fetchContractCalls(txs: any[]) {
    const calls = [];
  
    for (const tx of txs) {
      // Adjust the path here
      const msg = tx.in_msg || tx.inMessage || tx.inMessageInfo;
  
      if (!msg) continue;                        // no inbound message
  
      const date  = new Date(tx.utime * 1000).toLocaleDateString();
  
      // Deal with source possibly being an object
      const src   = msg.source || msg.from || msg.src;
      const source = typeof src === 'string'
        ? src
        : src?.address || JSON.stringify(src);
  
      const value = Number(msg.value ?? msg.amount ?? 0) / 1e9;
  
      /* ------- decode body text, adjust field names ------- */
      const body  = msg.msg_data || msg.body || msg.data;
      let decodedBody = '';
  
      if (typeof body === 'string') {
        decodedBody = body;
      } else if (body?.text) {
        decodedBody = body.text;
      } else if (body?.decrypted_text) {
        decodedBody = body.decrypted_text;
      } else if (body?.type === 'raw') {
        decodedBody = '[Raw message]';
      } else if (body?.type) {
        decodedBody = `[${body.type}]`;
      } else {
        decodedBody = '[unknown]';
      }
  
      calls.push({ date, source, value, decodedBody });
    }
  
    console.log("✅ extracted", calls.length, "contract calls");
    return calls;
  }
  
  export async function renderContractCalls(transactions: any[]) {
    const data = await fetchContractCalls(transactions);
    const tableBody = document.querySelector('#contractCallsTable tbody');
    if (!tableBody) {
      console.warn('Contract calls table not found in DOM.');
      return;
    }
  
    tableBody.innerHTML = '';
  
    data.forEach(call => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${call.date}</td>
        <td>${call.source}</td>
        <td>${call.value.toFixed(2)}</td>
        <td>${call.decodedBody}</td>
      `;
      tableBody.appendChild(row);
    });
  
    makeContractCallsTableSortable(); // 👈 Add this here
  }

  export function makeContractCallsTableSortable() {
    document.querySelectorAll("#contractCallsTable th.sortable").forEach(header => {
      header.addEventListener("click", () => {
        const table = header.closest("table");
        const tbody = table?.querySelector("tbody");
        const columnIndex = parseInt(header.getAttribute("data-column") || "0");
        const type = header.getAttribute("data-type") || "string";
        const rows = Array.from(tbody?.querySelectorAll("tr") || []);
  
        const isCurrentlyAsc = header.classList.contains("asc");
        const isCurrentlyDesc = header.classList.contains("desc");
        const isAsc = !isCurrentlyAsc || isCurrentlyDesc;
  
        rows.sort((a, b) => {
          let aText = a.children[columnIndex].textContent || "";
          let bText = b.children[columnIndex].textContent || "";
  
          let aVal: number | string = aText;
          let bVal: number | string = bText;
  
          if (type === "number") {
            aVal = parseFloat(aText) || 0;
            bVal = parseFloat(bText) || 0;
          } else if (type === "date") {
            aVal = new Date(aText).getTime();
            bVal = new Date(bText).getTime();
          }
  
          return isAsc ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
        });
  
        // Clear previous sort state
        document.querySelectorAll("#contractCallsTable th.sortable").forEach(h => h.classList.remove("asc", "desc"));
        header.classList.add(isAsc ? "asc" : "desc");
  
        rows.forEach(row => tbody?.appendChild(row));
      });
    });
  }
  
  
  // Payout Tab
  
  export async function fetchPayoutHistory(transactions: any[]) {
    const payouts = [];
  
    for (const tx of transactions) {
      if (tx.out_msgs && tx.out_msgs.length > 0) {
        for (const out of tx.out_msgs) {
          if (out.destination && out.value > 0) {
            const date = new Date(tx.utime * 1000).toLocaleDateString();
            const destination = out.destination;
            const value = Number(out.value) / 1e9;
  
            payouts.push({
              date,
              destination,
              value,
            });
          }
        }
      }
    }
  
    return payouts;
  }
  
  export async function renderPayoutHistory(transactions: any[]) {
    const data = await fetchPayoutHistory(transactions);
    const tableBody = document.querySelector('#payoutHistoryTable tbody');
    if (!tableBody) {
      console.warn('Payout table not found in DOM.');
      return;
    }
  
    tableBody.innerHTML = '';
  
    data.forEach(payout => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${payout.date}</td>
        <td>${payout.destination.address}</td>
        <td>${payout.value.toFixed(2)}</td>
      `;
      tableBody.appendChild(row);
    });
  }