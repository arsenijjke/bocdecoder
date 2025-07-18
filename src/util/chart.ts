import { Chart, Tooltip, Legend } from 'chart.js';
import { LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, PieController, ArcElement } from 'chart.js';
import { fetchStakeGrowthFromToncenter } from './tab.ts'
import { TonClient, Address } from "@ton/ton";

type Holder = {
  address: string;
  balance: number;
};

let jettonHoldersCache: {
  [address: string]: {
    timestamp: number;
    data: Holder[];
  };
} = {};

const CACHE_TTL_MS = 60_000; // Cache for 60 seconds

export async function fetchJettonHolders(masterAddress: string): Promise<Holder[]> {
  const now = Date.now();

  const cached = jettonHoldersCache[masterAddress];
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    console.log('✅ Using cached holders data');
    return cached.data;
  }

  const url = `https://testnet.tonapi.io/v2/jettons/${masterAddress}/holders?limit=100`;

  try {
    const response = await fetch(url);

    // Explicitly check for rate limit
    if (response.status === 429) {
      throw new Error('Rate limit exceeded: Please wait before retrying.');
    }

    if (!response.ok) {
      const errorJson = await response.json();
      throw new Error(errorJson.error ?? 'Failed to fetch holders');
    }

    const json = await response.json();
    console.log("Raw JSON response:", json);

    if (!json.addresses || !Array.isArray(json.addresses)) {
      throw new Error(json.error ?? 'Invalid holders response structure');
    }

    if (json.addresses.length === 0) {
      console.warn('No holders found for this jetton.');
    }

    const holders = json.addresses.map((holder: any) => {
      const address = holder.address;
      const rawBalance = holder.balance;

      if (!address || rawBalance === undefined) {
        throw new Error('Missing holder address or balance');
      }

      return {
        address,
        balance: Number(rawBalance) / 1e9,
      };
    });

    jettonHoldersCache[masterAddress] = {
      timestamp: now,
      data: holders,
    };

    return holders;
  } catch (error: any) {
    console.error('❌ Error fetching jetton holders:', error.message);
    throw new Error(`Failed to display jetton distribution: ${error.message}`);
  }
}

async function fetchMaxSupply(address: string,
  client: TonClient,
): Promise<bigint> {
  const addr = Address.parse(address);

  // Call the getter – empty params array for a no‑arg get‑method
  const res = await client.callGetMethod(addr, "get_jetton_data", []);

  // The very first stack item is uint256 total_supply
  const totalSupply = res.stack.readBigNumber();   // bigint
  return totalSupply;
}

// --- Calculate total bought (sum balances) ---
async function fetchTotalBought(masterAddress: string): Promise<number> {
  const holders = await fetchJettonHolders(masterAddress);
  return holders.reduce((sum, h) => sum + h.balance, 0);
}

// --- Calculate unclaimed tokens ---
async function calculateUnclaimed(master: string, client: TonClient): Promise<number> {
  const maxSupplyAtomic = await fetchMaxSupply(master, client);   // bigint
  const totalBought     = await fetchTotalBought(master);         // number (float)

  // convert maxSupply to *number* before the subtraction
  const maxSupplyFloat  = Number(maxSupplyAtomic) / 1e9;          // 9 decimals
  const unclaimedFloat  = maxSupplyFloat - totalBought;           // both numbers

  document.getElementById("unclaimedBalance")!.textContent =
    unclaimedFloat.toLocaleString();

  return unclaimedFloat;
}

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend);

export async function renderUnclaimedChart(masterAddress: string, client: TonClient) {
  const unclaimedNow = await calculateUnclaimed(masterAddress, client);

  // Mock some historical data based on current unclaimed amount
  // You can replace with your real historical data
  const pendingData = [
    { date: "2024-06-01", pendingJettons: unclaimedNow },
    { date: "2024-06-05", pendingJettons: unclaimedNow },
    { date: "2024-06-10", pendingJettons: unclaimedNow },
    { date: "2024-06-15", pendingJettons: unclaimedNow },
  ];

  const ctx = (document.getElementById("unclaimedChart") as HTMLCanvasElement).getContext("2d")!;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: pendingData.map(d => d.date),
      datasets: [{
        label: 'Unclaimed Jettons',
        data: pendingData.map(d => d.pendingJettons),
        borderColor: 'rgb(188, 2, 255)',
        backgroundColor: 'rgba(188, 2, 255, 0.2)',
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Jettons' }
        },
        x: {
          
        }
      }
    }
  });
}

Chart.register(PieController, ArcElement, Tooltip, Legend);

// --- Utility: Generate distinct colors ---
function generateColors(count: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 137.508) % 360; // golden angle to avoid repetition
    colors.push(`hsl(${hue}, 65%, 60%)`);
  }
  return colors;
}

// --- Utility: Limit dataset to top N and group others ---
function preparePieData(
  rawData: { label: string; value: number }[],
  limit: number = 10
): { label: string; value: number }[] {
  const sorted = [...rawData].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, limit);
  const rest = sorted.slice(limit);

  const othersTotal = rest.reduce((sum, d) => sum + d.value, 0);
  if (othersTotal > 0) {
    top.push({ label: 'Others', value: othersTotal });
  }

  return top;
}

// --- Main function: Render the pie chart ---
export function renderPieChart(data: { label: string; value: number }[]) {
  const canvas = document.getElementById('investorPieChart') as HTMLCanvasElement;
  if (!canvas) {
    console.error("Canvas element with id 'investorPieChart' not found");
    return;
  }

  // Clean up old chart if it exists
  if ((window as any).investorChart) {
    (window as any).investorChart.destroy();
  }

  const filteredData = preparePieData(data, 10);
  const labels = filteredData.map(d => d.label);
  const values = filteredData.map(d => d.value);
  const colors = generateColors(filteredData.length);

  (window as any).investorChart = new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        label: 'Investor Shares',
        data: values,
        backgroundColor: colors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = ctx.label || '';
              const value = ctx.raw as number;
              const total = values.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value.toLocaleString()} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

  // rendering tabs content zone
  export async function renderStakeGrowthChart(transactions: any[]) {
    const data = await fetchStakeGrowthFromToncenter(transactions);
  
    const labels = data.map(point => point.date);
    const values = data.map(point => point.totalShares);
  
    const ctx = (document.getElementById("stakeGrowthChart") as HTMLCanvasElement).getContext("2d")!;
  
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total Shares',
          data: values,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Stake Growth Over Time'
          }
        }
      }
    });
  }

  let profitChart: Chart | null = null;  // declare outside the function, in module/global scope

  export function updatePieChart() {
    const usdtValueText = document.getElementById("usdtValue")?.innerText.replace('$', '') ?? "0";
    const tonValueText = document.getElementById("tonValue")?.innerText.replace('$', '') ?? "0";
  
    const usdtValue = parseFloat(usdtValueText);
    const tonValue = parseFloat(tonValueText);
  
    const ctx = (document.getElementById("profitPieChart") as HTMLCanvasElement).getContext("2d")!;
  
    // Destroy old chart if exists
    if (profitChart) {
      profitChart.destroy();
    }
  
    // Create new chart instance
    profitChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['USDT', 'TON'],
        datasets: [{
          data: [usdtValue, tonValue],
          backgroundColor: ['#4caf50', '#2196f3'],
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
          },
          title: {
            display: true,
            text: 'Contribution to Total Profit'
          }
        }
      }
    });
  }
