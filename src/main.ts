import { TonClient, Cell, Address, Dictionary, Slice } from "@ton/ton";
import { displayJettonDistribution } from './util/distribution_growth.ts';
import { renderPieChart, renderStakeGrowthChart, renderUnclaimedChart } from './chart.ts'
import { createCollapsibleResult, renderInvestorTable } from './util/parseBoc.ts';
import { getAccountDataBoc, getAccountInfoREST, getInvestorInfoData } from './util/request.ts';
import { loadTreasuryData } from './util/holders.ts';
import { updateValues } from './util/fiat.ts';

const TON_ENDPOINT =
  "https://testnet.toncenter.com/api/v2/jsonRPC?api_key=4b3188a7c67ca35e532bc09763b9e6f1434a105f9e019ea8c9e7e74a4fafad68";
const tonClient = new TonClient({ endpoint: TON_ENDPOINT });

let globalAddress = '';

// Load after navigating to start.html
window.addEventListener('DOMContentLoaded', async () => {
  const savedAddresses = getSavedAddresses();

  if (savedAddresses.length === 0) {
    alert("No saved treasury addresses found in localStorage under key 'treasuryAddresses'. Please add some.");
    return;
  }

  populateAddressSelect(savedAddresses);

  const addressFromQuery = getQueryParam('address');
  globalAddress = addressFromQuery && savedAddresses.includes(addressFromQuery)
    ? addressFromQuery
    : savedAddresses[0];

  const select = document.getElementById('treasurySelect') as HTMLSelectElement;
  select.value = globalAddress;

  setupSelectChangeListener();
  setupCheckStatusREST();
  setupViewOnTonviewer();
  onAutoDecodeBtnClick(globalAddress);
  const jettonMaster = await fetchJettonMasterAddress(globalAddress);
  displayJettonDistribution(jettonMaster);
  renderUnclaimedChart(jettonMaster);
  loadTreasuryData(jettonMaster);

  fetchTonPrice();
  setValuesAndUpdate();
  //updateFundSummary(jettonMaster);
  //setInterval(() => updateFundSummary(jettonMaster), 60_000);

  try {
    const transactions = await fetchTransactions(globalAddress, 50);
    setupTabs(transactions); // See below
  } catch (err) {
    console.error("Error setting up tabs:", err);
  }
});

function setupTabs(transactions: any[]) {
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

async function fetchTonPrice() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const tonPrice = json["the-open-network"]?.usd;

    const tonRateEl = document.getElementById("tonRate");
    if (tonRateEl) {
      tonRateEl.textContent = tonPrice ? `$${tonPrice.toFixed(2)}` : "N/A";
    }
  } catch (err) {
    console.error("Error fetching TON price:", err);
    const tonRateEl = document.getElementById("tonRate");
    if (tonRateEl) {
      tonRateEl.textContent = "Error";
    }
  }
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

async function onAutoDecodeBtnClick(address: string) {
  try {
    const { cell } = await getAccountDataBoc(address, tonClient);

    renderInvestorTable(cell.toBoc());

    const shareData = extractInvestorShares(cell.toBoc());
    renderPieChart(shareData);

  } catch (e) {
    createCollapsibleResult("Error", `<p style="color:red;">${(e as Error).message}</p>`);
  }
}

document.getElementById("autoDecodeBtn")!.onclick = () => {
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
async function setupCheckStatusREST() {
  if (!globalAddress) return alert('Select an address first');
  const statusDisplay = document.getElementById('statusBalance')!;
  statusDisplay.textContent = 'Checking...';
  const { status, balance } = await getAccountInfoREST(globalAddress);
  statusDisplay.textContent = `${status}${balance !== null ? ` (Balance: ${balance} TON)` : ''}`;
  updateValues(balance!);
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

async function fetchJettonMasterAddress(address: string): Promise<string> {
  console.log(globalAddress + " global address");
  const res = await tonClient.callGetMethod(Address.parse(address), "jettonMaster", []);
  if (!res) throw new Error("No response from callGetMethod");

  const tuple = res.stack;
  let jettonMasterAddress = "";

  // Assuming the jettonMaster address is the first element on the stack
  if (tuple.remaining > 0) {
    jettonMasterAddress = tuple.readAddress().toString();
  } else {
    throw new Error("No address found in response stack");
  }

  return jettonMasterAddress;
}

async function waitUntilBalancesReady(): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const usdtText = document.getElementById("jettonBalance")?.textContent ?? "";
      const statusText = document.getElementById("statusBalance")?.textContent ?? "";

      const usdt = parseFloat(usdtText.replace(/[^0-9.]/g, ""));
      const tonMatch = statusText.match(/Balance:\s*([\d.]+)\s*TON/i);
      const ton = tonMatch ? parseFloat(tonMatch[1]) : NaN;

      if (!isNaN(usdt) && !isNaN(ton)) {
        clearInterval(interval);
        resolve();
      }
    }, 200);
  });
}

async function setValuesAndUpdate(): Promise<void> {
  await waitUntilBalancesReady();

  const usdtText = document.getElementById("jettonBalance")?.textContent ?? "";
  const statusText = document.getElementById("statusBalance")?.textContent ?? "";

  const usdt = parseFloat(usdtText.replace(/[^0-9.]/g, ""));
  const tonMatch = statusText.match(/Balance:\s*([\d.]+)\s*TON/i);
  const ton = tonMatch ? parseFloat(tonMatch[1]) : 0;

  // Set values to the <td> elements
  const usdtValueEl = document.getElementById("usdtValue");
  const tonValueEl = document.getElementById("tonValue");

  if (usdtValueEl) usdtValueEl.textContent = `$${usdt.toFixed(2)}`;
  if (tonValueEl) tonValueEl.textContent = `${ton.toFixed(2)} TON`;

  // Call your function
  await updateValues(ton);
}


document.getElementById("processWalletBtn")!.onclick = () => {
  getWalletInfo();
};

async function getWalletInfo() {
  const treasuryAddressRaw = globalAddress
  const investorAddressRaw = (document.getElementById('walletAddressInput') as HTMLInputElement).value.trim();
  const resultDiv = document.getElementById('walletResult');

  if (!treasuryAddressRaw || !investorAddressRaw) {
    resultDiv!.textContent = 'Please enter both treasury and wallet addresses.';
    return;
  }

  try {
    const treasuryAddress = Address.parse(treasuryAddressRaw);
    const investorAddress = Address.parse(investorAddressRaw);

    resultDiv!.textContent = 'Fetching investor data...';

    const info = await getInvestorInfoData(tonClient, treasuryAddress, investorAddress);

    resultDiv!.innerHTML = `
      <strong>Pending Jettons:</strong> ${info.pendingJettons.toString()}<br />
      <strong>Share:</strong> ${info.share.toString()}<br />
      <strong>Investor Cell (base64):</strong><br />
      <textarea rows="4" style="width: 100%;">${info.investorCellBocBase64}</textarea>
    `;
  } catch (err: any) {
    console.error(err);
    resultDiv!.textContent = 'Error processing wallet address: ' + (err.message || err);
  }
}
