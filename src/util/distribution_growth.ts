import {
    Chart,
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    Title
  } from 'chart.js';
  
  Chart.register(
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    Title
  );

interface Holder {
  address: string;
  balance: number;
}

/* ------------ simple in‑memory cache + cooldown tracker ------------ */
let jettonHoldersCache: {
  [master: string]: { data: Holder[]; timestamp: number }
} = {};

let nextAllowedFetch = 0;                      // global cooldown (ms)

/* ------------------------------------------------------------------- */
export async function fetchJettonHolders(masterAddress: string): Promise<Holder[]> {
  const now = Date.now();

  /* 1️⃣  use fresh cache (≤60 s old) */
  const cached = jettonHoldersCache[masterAddress];
  if (cached && now - cached.timestamp < 60_000) {
    console.log("✅ returning cached jetton holders");
    return cached.data;
  }

  /* 2️⃣  respect global cooldown set after a 429                       */
  if (now < nextAllowedFetch) {
    console.warn("⏳ still in cooldown – serving stale data");
    if (cached) return cached.data;            // may be >60 s old – better than nothing
    throw new Error("API rate‑limit active, please wait and reload.");
  }

  /* 3️⃣  make the network call                                         */
  const url = `https://testnet.tonapi.io/v2/jettons/${masterAddress}/holders?limit=100`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (e) {
    console.error("Network error:", e);
    if (cached) return cached.data;
    throw new Error("Network error fetching jetton holders");
  }

  /* 4️⃣  handle HTTP errors                                            */
  if (response.status === 429) {
    // ─── update cooldown ───
    const retry = Number(response.headers.get("Retry-After") ?? 60) * 1000;
    nextAllowedFetch = Date.now() + retry;
    console.warn(`🚦 rate‑limited, next fetch allowed in ${retry/1000}s`);

    if (cached) return cached.data;            // serve what we have
    throw new Error("Rate limit exceeded: please wait a minute and try again.");
  }

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const msg = errJson.error ?? `HTTP ${response.status}`;
    console.error("Server error:", msg);
    if (cached) return cached.data;
    throw new Error(`Failed to fetch holders: ${msg}`);
  }

  /* 5️⃣  normal happy‑path                                             */
  const json = await response.json();

  if (!Array.isArray(json.addresses)) {
    const msg = json.error ?? "Invalid response structure";
    throw new Error(msg);
  }

  const holders: Holder[] = json.addresses.map((h: any) => ({
    address: h.address,
    balance: Number(h.balance) / 1e9,
  }));

  // cache & return
  jettonHoldersCache[masterAddress] = { data: holders, timestamp: now };
  return holders;
}

  export async function displayJettonDistribution(masterAddress: string) {
    try {
      const holders = await fetchJettonHolders(masterAddress);
  
      const labels = holders.map((_, ) => ``);
  
      // Calculate cumulative sums of balances
      const cumulativeData: number[] = [];
      holders.reduce((acc, holder) => {
        const newSum = acc + holder.balance;
        cumulativeData.push(newSum * 1000);
        return newSum;
      }, 0);
  
      const canvas = document.getElementById("growthChart") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not found");
  
      if ((window as any).jettonChartInstance) {
        (window as any).jettonChartInstance.destroy();
      }
  
      (window as any).jettonChartInstance = new Chart(ctx, {
        type: 'line',   // Use 'line' chart to show the growth
        data: {
          labels,
          datasets: [{
            label: 'Distribution growth',
            data: cumulativeData,
            borderColor: 'rgb(0, 123, 255)',
            backgroundColor: 'rgba(0, 123, 255, 0.2)',
            fill: true,
            tension: 0.3,
            pointRadius: 5,
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              
            },
            x: {
              
            }
          },
        }
      });
  
      // Display total balance separately if needed
      const total = holders.reduce((sum, h) => sum + h.balance * 1000, 0);
      const balanceElem = document.getElementById('jettonBalance');
      if (balanceElem) {
        balanceElem.innerText = `${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
      }
  
    } catch (err) {
      console.error('Failed to display jetton distribution:', err);
      const balanceElem = document.getElementById('jettonBalance');
      if (balanceElem) balanceElem.innerText = 'Error loading data';
    }
  }
