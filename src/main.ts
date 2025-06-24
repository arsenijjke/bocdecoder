import { TonClient, Cell, Address, address, Dictionary, Slice, beginCell} from "@ton/ton";
import { Buffer } from 'buffer';

async function getAccountInfoREST() {
  const url = `https://testnet.toncenter.com/api/v2/getAddressInformation?address=${globalAddress}`;
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

const TON_ENDPOINT =
  "https://testnet.toncenter.com/api/v2/jsonRPC?api_key=4b3188a7c67ca35e532bc09763b9e6f1434a105f9e019ea8c9e7e74a4fafad68";

const tonClient = new TonClient({ endpoint: TON_ENDPOINT });

 async function getAccountDataBoc() {
   const addr = address(globalAddress)
   const res = await tonClient.callGetMethod(addr, "getFullTreasuryState", []);
   console.log('Raw getFullTreasuryState result:', res);

   const stack = res.stack;

   // Read the values from the stack in the exact order they are returned:
   const int1 = Number(stack.readBigNumber()) / 1e6; // 1st integer
   const int2 = Number(stack.readBigNumber()) / 1e6; // 2nd integer
   const int3 = stack.readBigNumber(); // 3rd integer
   const cell = stack.readCell();      // the cell

   // If you need the cell as base64 BOC (e.g., to store or send somewhere):
   const cellBocBase64 = cell.toBoc({ idx: false }).toString('base64');

   return { int1, int2, int3, cell, cellBocBase64 };
 }

async function getInvestorInfoData(investorAddress: Address) {
  // Construct the exact cell the smart contract expects: just the address
  const argCell = beginCell().storeAddress(investorAddress).endCell();
  const addr = address(globalAddress)

  // Call the method with a slice containing that cell
  const res = await tonClient.callGetMethod(addr, 'getInvestorInfo', [
    {
      type: 'slice',
      cell: argCell
    }
  ]);

  const stack = res.stack;

  const investorCell = stack.readCell();            // Usually cell with investor info
  const pendingJettons = Number(stack.readBigNumber()) / 1e6;     // Usually int
  const share = Number(stack.readBigNumber()) / 1e6;              // Usually int

  const investorCellBocBase64 = investorCell.toBoc({ idx: false }).toString('base64');

  return {
    investorCell,
    investorCellBocBase64,
    pendingJettons,
    share
  };
}

function parseBoc2(buffer: Buffer): string {
  let root: Cell;
  try {
    root = Cell.fromBoc(buffer)[0];
  } catch (e) {
    return `<p>Error decoding BOC: ${(e as Error).message}</p>`;
  }

  // Dictionary with int32 keys, values are Cells (not parsed investor structs directly)
  let dict: Dictionary<number, Cell>;

  try {
    dict = Dictionary.loadDirect(
      Dictionary.Keys.Int(32),
      {
        parse: (src: Slice) => src.loadRef(),  // load the value as a Cell ref
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

  // Collect all investors decoded from all dictionary entries
  const allInvestors: { index: number; addr: Address; share: number; pendingJettons: number }[] = [];

  for (const [dictKey, cell] of dict) {
    const slice = cell.beginParse();
    let i = 0;

    while (slice.remainingBits >= (257 + 64 + 64)) { // addr(257 bits) + share(64) + pendingJettons(64)
      const addr = slice.loadAddress();
      const share = slice.loadUint(64);
      const pendingJettons = slice.loadUint(64);

      allInvestors.push({
        index: dictKey * 1000 + i, // generate unique index for display, or just use a flat counter if you prefer
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

  // Generate HTML table
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
document.getElementById("viewAddressBtn")!.onclick = () => {
  const address = globalAddress
  if (!address) return;
  const viewerUrl = `https://testnet.tonviewer.com/${address}`;
  window.open(viewerUrl, "_blank");
};

document.getElementById("checkStatusBtn")!.onclick = async () => {
  const address = globalAddress
  const statusDiv = document.getElementById("statusBalance")!;
  statusDiv.textContent = "Loading...";
  statusDiv.classList.remove("error");
  if (!address) {
    statusDiv.textContent = "Please enter a contract address";
    statusDiv.classList.add("error");
    return;
  }
  const info = await getAccountInfoREST();
  if (info.balance === null) {
    statusDiv.textContent = `Error: ${info.status}`;
    statusDiv.classList.add("error");
  } else {
    statusDiv.textContent = `Status: ${info.status} | Balance: ${info.balance} TON`;
  }
};

document.getElementById("decodeBtn")!.onclick = () => {
  const hex = (document.getElementById("bocInput") as HTMLTextAreaElement).value.trim();
  if (!hex) return;
  try {
    const buffer = Buffer.from(hex, "hex");
    const htmlContent = parseBoc2(buffer); // no extra args needed
    createCollapsibleResult("Manual BOC Decode", htmlContent);
  } catch (e: any) {
    createCollapsibleResult("Manual BOC Decode", `<p style="color:red;">Error parsing BOC: ${e.message}</p>`);
  }
};

async function onAutoDecodeBtnClick() {
  try {
    const { int1, int2, int3, cell } = await getAccountDataBoc();

    // Rename variables locally for clarity:
    const totalShares = int1;
    const totalPendingJettons = int2;
    const investorCount = Number(int3);  // make sure it's a number if needed

    // Parse the investors dictionary from the cell (using your parseBoc2 or adapted function)
    const investorsHtml = parseBoc2(cell.toBoc());

    // Compose your full HTML with totals and investor table
    const fullHtml = `
      <p>Total Shares: ${totalShares}</p>
      <p>Total Pending Jettons: ${totalPendingJettons}</p>
      <p>Investor Count: ${investorCount}</p>
      ${investorsHtml}
    `;

    createCollapsibleResult("Treasury Info", fullHtml);
  } catch (e) {
    createCollapsibleResult("Error", `<p style="color:red;">${(e as Error).message}</p>`);
  }
}

// Bind to button
document.getElementById("autoDecodeBtn")!.onclick = onAutoDecodeBtnClick;

document.getElementById('goBackBtn')?.addEventListener('click', () => {
  window.location.href = '/bocdecoder/index.html';
});

// Global variable
let globalAddress = '';

// Function to extract from query params
function getAddressFromQueryParam(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('address');
}

const processWalletBtn = document.getElementById('processWalletBtn');
const walletInput = document.getElementById('walletAddressInput');
const walletResult = document.getElementById('walletResult');

if (
  processWalletBtn instanceof HTMLButtonElement &&
  walletInput instanceof HTMLInputElement &&
  walletResult instanceof HTMLElement
) {
  processWalletBtn.addEventListener('click', async () => {
    const address = walletInput.value.trim();
    walletResult.textContent = '';

    if (!address) {
      walletResult.textContent = 'Please enter a wallet address.';
      return;
    }

    try {
      const data = await getInvestorInfoData(Address.parse(address));
      walletResult.innerHTML = `
        <strong>Wallet Address:</strong> ${address} <br />
        <strong>Shares:</strong> ${data.share} <br />
        <strong>Pending Jettons:</strong> ${data.pendingJettons}
      `;
    } catch (error) {
      walletResult.textContent = `Error: ${error instanceof Error ? error.message : error}`;
    }
  });
} else {
  console.error('One or more UI elements not found or wrong type');
}


// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    const address = getAddressFromQueryParam();
    if (address) {
      globalAddress = address;
        console.log("Treasury Address:", globalAddress);
        // You can now use `treasuryAddress` globally
        // e.g., display it on the page
        document.getElementById('address-display')!.textContent = globalAddress;
    } else {
        console.warn("No address passed to start.html");
    }
});