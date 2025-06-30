import { TonClient, Cell, Address, Dictionary, Slice } from "@ton/ton";
import { Chart, PieController, ArcElement, Tooltip, Legend } from 'chart.js';

const TON_ENDPOINT =
  "https://testnet.toncenter.com/api/v2/jsonRPC?api_key=4b3188a7c67ca35e532bc09763b9e6f1434a105f9e019ea8c9e7e74a4fafad68";
const tonClient = new TonClient({ endpoint: TON_ENDPOINT });

let globalAddress = '';

// Fetch account info from REST API
async function getAccountInfoREST(address: string) {
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

// Call getFullTreasuryState get-method on smart contract and parse results
export async function getAccountDataBoc(address: string) {
  const addr = Address.parse(address);
  const res = await tonClient.callGetMethod(addr, "getFullTreasuryState", []);
  const stack = res.stack;

  const int1 = Number(stack.readBigNumber()) / 1e6; // totalShares
  const int2 = Number(stack.readBigNumber()) / 1e6; // totalPendingJettons
  const int3 = stack.readBigNumber();               // investorCount
  const cell = stack.readCell();                    

  return { int1, int2, int3, cell };
}

// Parse the BOC of the dictionary of investors and render a HTML table
function parseBoc2(buffer: Buffer): string {
  let root: Cell;
  try {
    root = Cell.fromBoc(buffer)[0];
  } catch (e) {
    return `<p>Error decoding BOC: ${(e as Error).message}</p>`;
  }

  let dict: Dictionary<number, Cell>;
  try {
    dict = Dictionary.loadDirect(
      Dictionary.Keys.Int(32),
      {
        parse: (src: Slice) => src.loadRef(),
        serialize: () => { throw new Error("Not implemented"); }
      },
      root.beginParse()
    );
  } catch (e) {
    return `<p>Error parsing dictionary: ${(e as Error).message}</p>`;
  }

  if (dict.size === 0) {
    return "<p><em>No investors found</em></p>";
  }

  const allInvestors: { index: number; addr: Address; share: number; pendingJettons: number }[] = [];

  for (const [dictKey, cell] of dict) {
    const slice = cell.beginParse();
    let i = 0;

    while (slice.remainingBits >= (257 + 64 + 64)) {
      const addr = slice.loadAddress();
      const share = slice.loadUint(64);
      const pendingJettons = slice.loadUint(64);

      allInvestors.push({
        index: dictKey * 1000 + i,
        addr,
        share,
        pendingJettons,
      });

      i++;
    }
  }

  if (allInvestors.length === 0) {
    return "<p><em>No investors found in dictionary cells</em></p>";
  }

  let html = '<table border="1" cellspacing="0" cellpadding="4">';
  html += "<tr><th>#</th><th>Address</th><th>Shares</th><th>Pending Jettons</th></tr>";

  let totalShares = 0;
  let totalPendingJettons = 0;

  allInvestors.forEach(({ addr, share, pendingJettons }, idx) => {
    totalShares += share;
    totalPendingJettons += pendingJettons;

    html += `<tr>
      <td>${idx + 1}</td>
      <td>${addr.toString()}</td>
      <td>${share.toString()}</td>
      <td>${pendingJettons.toString()}</td>
    </tr>`;
  });

  html += `<tr style="font-weight:bold;">
    <td>${allInvestors.length} Investors</td>
    <td></td>
    <td>${totalShares.toString()}</td>
    <td>${totalPendingJettons.toString()}</td>
  </tr>`;
  html += "</table>";

  return html;
}

// Create a collapsible div block with title and content html, appended to #resultsContainer
function createCollapsibleResult(title: string, htmlContent: string) {
  const container = document.createElement("div");
  container.className = "result-block";

  const header = document.createElement("div");
  header.className = "result-header";
  header.textContent = title;
  header.onclick = () => container.classList.toggle("open");

  const content = document.createElement("div");
  content.className = "result-content";
  content.innerHTML = htmlContent;

  container.appendChild(header);
  container.appendChild(content);
  document.getElementById("resultsContainer")?.appendChild(container);
}

// Extract investor shares to be displayed on the pie chart
export function extractInvestorShares(buffer: Buffer): { label: string, value: number }[] {
  let root: Cell;
  try {
    root = Cell.fromBoc(buffer)[0];
  } catch (e) {
    console.error("BOC decode error:", e);
    return [];
  }

  let dict: Dictionary<number, Cell>;
  try {
    dict = Dictionary.loadDirect(
      Dictionary.Keys.Int(32),
      {
        parse: (src: Slice) => src.loadRef(),
        serialize: () => { throw new Error("Not implemented"); }
      },
      root.beginParse()
    );
  } catch (e) {
    console.error("Dict load error:", e);
    return [];
  }

  const allInvestors: { addr: Address; share: number }[] = [];

  for (const [, cell] of dict) {
    const slice = cell.beginParse();

    while (slice.remainingBits >= (257 + 64 + 64)) {
      const addr = slice.loadAddress();
      const share = slice.loadUint(64);
      slice.loadUint(64); // skip pendingJettons

      allInvestors.push({ addr, share });
    }
  }

  return allInvestors.map(inv => ({
    label: inv.addr.toString().slice(0, 10) + "...",
    value: inv.share,
  }));
}

Chart.register(PieController, ArcElement, Tooltip, Legend);

function renderPieChart(data: { label: string; value: number }[]) {
  const ctx = document.getElementById('investorPieChart') as HTMLCanvasElement;
  if (!ctx) {
    console.error("Canvas element with id 'investorPieChart' not found");
    return;
  }

  if ((window as any).investorChart) {
    (window as any).investorChart.destroy();
  }

  (window as any).investorChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Investor Shares',
        data: data.map(d => d.value),
        backgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
          '#FF9F40', '#66FF66', '#FF6666', '#66CCFF', '#CCCC66'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: false,
      plugins: {
        legend: { position: 'right' }
      }
    }
  });
}

// On clicking auto decode button or on page load with address
async function onAutoDecodeBtnClick(address: string) {
  try {
    const { int1, int2, int3, cell } = await getAccountDataBoc(address);

    const totalShares = int1;
    const totalPendingJettons = int2;
    const investorCount = Number(int3);

    const investorsHtml = parseBoc2(cell.toBoc());

    const fullHtml = `
      <p>Total Shares: ${totalShares}</p>
      <p>Total Pending Jettons: ${totalPendingJettons}</p>
      <p>Investor Count: ${investorCount}</p>
      ${investorsHtml}
    `;

    createCollapsibleResult("Treasury Info", fullHtml);

    const shareData = extractInvestorShares(cell.toBoc());
    renderPieChart(shareData);

  } catch (e) {
    createCollapsibleResult("Error", `<p style="color:red;">${(e as Error).message}</p>`);
  }
}

document.getElementById("autoDecodeBtn")!.onclick = (event) => {
  onAutoDecodeBtnClick(globalAddress);
};

// Helper to get saved addresses from localStorage
function getSavedAddresses(): string[] {
  const saved = localStorage.getItem('savedTreasuryAddresses');
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

// Helper to populate the select element with saved addresses
function populateAddressSelect(addresses: string[]) {
  const select = document.getElementById('treasurySelect') as HTMLSelectElement;
  select.innerHTML = '';
  addresses.forEach(addr => {
    const opt = document.createElement('option');
    opt.value = addr;
    opt.textContent = addr;
    select.appendChild(opt);
  });
}

// Get query param by name
function getQueryParam(name: string): string | null {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

// When user selects different address from dropdown
function setupSelectChangeListener() {
  const select = document.getElementById('treasurySelect') as HTMLSelectElement;
  const selectedDisplay = document.getElementById('selectedAddress') as HTMLParagraphElement;

  select.addEventListener('change', () => {
    globalAddress = select.value;
    selectedDisplay.textContent = `Selected Address: ${globalAddress}`;
    // Clear previous results
    const resultsContainer = document.getElementById('resultsContainer')!;
    resultsContainer.innerHTML = '';
    onAutoDecodeBtnClick(globalAddress);
  });
}

// Button to open TON viewer with address
function setupViewOnTonviewer() {
  const btn = document.getElementById('viewAddressBtn')!;
  btn.addEventListener('click', () => {
    if (!globalAddress) return alert('Select an address first');
    window.open(`https://testnet.tonviewer.com/address/${globalAddress}`, '_blank');
  });
}

// Button to check account status REST API
function setupCheckStatusREST() {
  const btn = document.getElementById('checkStatusBtn')!;
  btn.addEventListener('click', async () => {
    if (!globalAddress) return alert('Select an address first');
    const statusDisplay = document.getElementById('statusBalance')!;
    statusDisplay.textContent = 'Checking...';
    const { status, balance } = await getAccountInfoREST(globalAddress);
    statusDisplay.textContent = `${status}${balance !== null ? ` (Balance: ${balance} TON)` : ''}`;
  });
}

// On page load setup
window.addEventListener('DOMContentLoaded', () => {
  const savedAddresses = getSavedAddresses();

  if (savedAddresses.length === 0) {
    alert("No saved treasury addresses found in localStorage under key 'treasuryAddresses'. Please add some.");
    return;
  }

  populateAddressSelect(savedAddresses);

  const addressFromQuery = getQueryParam('address');
  if (addressFromQuery && savedAddresses.includes(addressFromQuery)) {
    globalAddress = addressFromQuery;
  } else {
    globalAddress = savedAddresses[0];
  }

  const select = document.getElementById('treasurySelect') as HTMLSelectElement;
  select.value = globalAddress;

  setupSelectChangeListener();
  setupCheckStatusREST();
  setupViewOnTonviewer();
});

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  const savedAddresses = getSavedAddresses();

  if (savedAddresses.length === 0) {
    alert("No saved treasury addresses found in localStorage under key 'treasuryAddresses'. Please add some.");
    return;
  }

  populateAddressSelect(savedAddresses);

  const addressFromQuery = getQueryParam('address');
  if (addressFromQuery && savedAddresses.includes(addressFromQuery)) {
    globalAddress = addressFromQuery;
  } else {
    globalAddress = savedAddresses[0];
  }

  const select = document.getElementById('treasurySelect') as HTMLSelectElement;
  select.value = globalAddress;

  setupSelectChangeListener();
  onAutoDecodeBtnClick(globalAddress);
});