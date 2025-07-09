import { Cell, Address, Dictionary, Slice } from "@ton/ton";

// Parse the BOC of the dictionary of investors and render a HTML table
export function parseBoc2(buffer: Buffer): string {
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
export function createCollapsibleResult(title: string, htmlContent: string) {
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

export async function renderInvestorTable(buffer: Buffer) {
  const html = parseBoc2(buffer);
  const container = document.getElementById("investorTableContainer");
  if (container) {
    container.innerHTML = html;
  }
}