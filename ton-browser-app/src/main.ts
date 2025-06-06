import { TonClient, Cell, Address, beginCell } from "@ton/ton";
import { Buffer } from 'buffer';

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

const TON_ENDPOINT =
  "https://testnet.toncenter.com/api/v2/jsonRPC?api_key=4b3188a7c67ca35e532bc09763b9e6f1434a105f9e019ea8c9e7e74a4fafad68";

const tonClient = new TonClient({ endpoint: TON_ENDPOINT });

async function getAccountDataBoc(address: Address) {
  const res = await tonClient.callGetMethod(address, "getFullTreasuryState", []);
  console.log('Raw getFullTreasuryState result:', res);

  const stack = res.stack;

  // Read the values from the stack in the exact order they are returned:
  const int1 = stack.readBigNumber(); // 1st integer
  const int2 = stack.readBigNumber(); // 2nd integer
  const int3 = stack.readBigNumber(); // 3rd integer
  const cell = stack.readCell();      // the cell

  // If you need the cell as base64 BOC (e.g., to store or send somewhere):
  const cellBocBase64 = cell.toBoc({ idx: false }).toString('base64');

  return { int1, int2, int3, cell, cellBocBase64 };
}

async function getInvestorInfoData(treasuryAddress: Address, investorAddress: Address) {
  // Construct the exact cell the smart contract expects: just the address
  const argCell = beginCell().storeAddress(investorAddress).endCell();

  // Call the method with a slice containing that cell
  const res = await tonClient.callGetMethod(treasuryAddress, 'getInvestorInfo', [
    {
      type: 'slice',
      cell: argCell
    }
  ]);

  const stack = res.stack;

  const investorCell = stack.readCell();            // Usually cell with investor info
  const pendingJettons = stack.readBigNumber();     // Usually int
  const share = stack.readBigNumber();              // Usually int

  const investorCellBocBase64 = investorCell.toBoc({ idx: false }).toString('base64');

  return {
    investorCell,
    investorCellBocBase64,
    pendingJettons,
    share
  };
}

function parseBoc(
  buffer: Buffer,
  totalShares?: bigint,
  totalPendingJettons?: bigint,
  investorCount?: bigint
): string {
  const cells = Cell.fromBoc(buffer);
  let html = "";

  const formatTotals = () => {
    if (
      totalShares !== undefined &&
      totalPendingJettons !== undefined &&
      investorCount !== undefined
    ) {
      return `
        <div style="font-size: 0.9em; margin-bottom: 5px;">
          <p><strong>Total Shares:</strong> ${totalShares.toString()}</p>
          <p><strong>Total Pending Jettons:</strong> ${totalPendingJettons.toString()}</p>
          <p><strong>Investor Count:</strong> ${investorCount.toString()}</p>
        </div>
      `;
    }
    return "";
  };

  if (cells.length === 0) {
    return `
      ${formatTotals()}
      <p style="color:red;">Warning: No cells found in BOC, investor list is empty.</p>
      <table border="1" cellspacing="0" cellpadding="4">
        <tr><th>Address</th><th>Shares</th><th>Pending Jettons</th></tr>
        <tr><td colspan="3"><em>No data</em></td></tr>
      </table>
    `;
  }

  try {
    const root = cells[0];
    const slice = root.beginParse();

    type Investor = {
      addr: any;
      share: bigint;
      pendingJettons: bigint;
    };

    const investors: Investor[] = [];
    let totalShare = 0n;
    let totalPending = 0n;

    while (slice.remainingBits > 0) {
      try {
        const addr = slice.loadAddress();
        const share = slice.loadIntBig(64); // Use consistent bit size
        const pendingJettons = slice.loadIntBig(64);

        investors.push({ addr, share, pendingJettons });

        totalShare += share;
        totalPending += pendingJettons;
      } catch (e) {
        console.error("Error while parsing investor entry:", e);
        break;
      }
    }

    html += formatTotals();

    if (investors.length > 0) {
      html += '<table border="1" cellspacing="0" cellpadding="4">';
      html += "<tr><th>Address</th><th>Shares</th><th>Pending Jettons</th></tr>";
      for (const { addr, share, pendingJettons } of investors) {
        html += `<tr>
          <td>${addr.toString()}</td>
          <td>${share.toString()}</td>
          <td>${pendingJettons.toString()}</td>
        </tr>`;
      }

      // Add total row
      html += `<tr style="font-weight: bold;">
        <td>Total (calculated)</td>
        <td>${totalShare.toString()}</td>
        <td>${totalPending.toString()}</td>
      </tr>`;

      html += "</table>";
    } else {
      html += "<p><em>No investors found</em></p>";
    }

    return html;
  } catch (e) {
    console.error("Failed to parse BOC:", e);
    return `
      ${formatTotals()}
      <p style="color:red;">Investor List is empty or invalid.</p>
    `;
  }
}

function parseBoc2(buffer: Buffer) {
  const root = Cell.fromBoc(buffer)[0];
  const investorListSlice = root.beginParse(); // No loadRef()

  const investors = [];
  let totalSharesCalc = 0n;
  let totalPendingJettonsCalc = 0n;

  while (investorListSlice.remainingBits > 0) {
    try {
      const addr = investorListSlice.loadAddress();
      const share = investorListSlice.loadIntBig(64);
      const pendingJettons = investorListSlice.loadIntBig(64);

      investors.push({ addr, share, pendingJettons });

      totalSharesCalc += share;
      totalPendingJettonsCalc += pendingJettons;
    } catch (e) {
      console.error("Error while parsing investor entry:", e);
      break;
    }
  }

  // Build HTML
  let html = ``;

  if (investors.length === 0) {
    html += "<p><em>No investors found</em></p>";
    return html;
  }

  html += '<table border="1" cellspacing="0" cellpadding="4">';
  html += "<tr><th>Address</th><th>Shares</th><th>Pending Jettons</th></tr>";

  for (const { addr, share, pendingJettons } of investors) {
    html += `<tr>
      <td>${addr.toString()}</td>
      <td>${share.toString()}</td>
      <td>${pendingJettons.toString()}</td>
    </tr>`;
  }

  html += `<tr style="font-weight:bold;">
    <td>Total (calculated)</td>
    <td>${totalSharesCalc.toString()}</td>
    <td>${totalPendingJettonsCalc.toString()}</td>
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
  const address = (document.getElementById("addressInput") as HTMLInputElement).value.trim();
  if (!address) return;
  const viewerUrl = `https://testnet.tonviewer.com/${address}`;
  window.open(viewerUrl, "_blank");
};

document.getElementById("checkStatusBtn")!.onclick = async () => {
  const address = (document.getElementById("addressInput") as HTMLInputElement).value.trim();
  const statusDiv = document.getElementById("statusBalance")!;
  statusDiv.textContent = "Loading...";
  statusDiv.classList.remove("error");
  if (!address) {
    statusDiv.textContent = "Please enter a contract address";
    statusDiv.classList.add("error");
    return;
  }
  const info = await getAccountInfoREST(address);
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

document.getElementById("autoDecodeBtn")!.onclick = async () => {
  const address = (document.getElementById("addressInput") as HTMLInputElement).value.trim();
  if (!address) {
    createCollapsibleResult("Auto Decode Treasury State", `<p style="color:red;">Please enter a contract address</p>`);
    return;
  }
  try {
    const addr = Address.parse(address);
    const { int1: totalShares, int2: totalPendingJettons, int3: investorCount, cell } = await getAccountDataBoc(addr);

    const bocBase64 = Buffer.from(cell.toBoc()).toString("base64");
    console.log('Fetched BOC:', bocBase64);

    const buffer = Buffer.from(bocBase64, "base64");
    const combinedHtml = parseBoc(buffer, totalShares, totalPendingJettons, investorCount);

    createCollapsibleResult("Parsed Treasury State", combinedHtml);

    createCollapsibleResult("Raw BOC (base64) from Account State", `<textarea rows="6" style="width:100%;">${bocBase64}</textarea>`);

  } catch (e: any) {
    createCollapsibleResult("Auto Decode Treasury State", `<p style="color:red;">Error: ${e.message}</p>`);
  }
};

document.getElementById('processWalletBtn')?.addEventListener('click', async () => {
  const treasuryAddressRaw = (document.getElementById('addressInput') as HTMLInputElement).value.trim();
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

    const info = await getInvestorInfoData(treasuryAddress, investorAddress);

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
});



