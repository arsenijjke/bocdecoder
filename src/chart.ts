import { Chart, Tooltip, Legend } from 'chart.js';
import { LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, PieController, ArcElement } from 'chart.js';
import { fetchStakeGrowthFromToncenter } from './main.ts'

type Holder = {
  address: string;
  balance: number;
};

export async function fetchJettonHolders(masterAddress: string): Promise<Holder[]> {
  const url = `https://testnet.tonapi.io/v2/jettons/${masterAddress}/holders?limit=100`;
  const response = await fetch(url);
  const json = await response.json();

  console.log("Raw JSON response:", json);

  if (!json.addresses || !Array.isArray(json.addresses)) {
    const msg = json.error ? json.error : 'Invalid holders response structure';
    throw new Error(msg);
  }

  if (json.addresses.length === 0) {
    console.warn('No holders found for this jetton.');
  }

  return json.addresses.map((holder: any) => {
    const address = holder.address;
    const rawBalance = holder.balance;

    if (!address || rawBalance === undefined) {
      throw new Error('Missing holder address or balance');
    }

    return {
      address,
      balance: Number(rawBalance) / 1e9,  // convert from nano units
    };
  });
}
// --- Fetch max supply (mock example) ---
async function fetchMaxSupply(masterAddress: string): Promise<number> {
  // TODO: Replace this with actual contract call to get total supply if available
  // For demo, return fixed value
  return 282000;
}

// --- Calculate total bought (sum balances) ---
async function fetchTotalBought(masterAddress: string): Promise<number> {
  const holders = await fetchJettonHolders(masterAddress);
  return holders.reduce((sum, h) => sum + h.balance, 0);
}

// --- Calculate unclaimed tokens ---
async function calculateUnclaimed(masterAddress: string): Promise<number> {
  const maxSupply = await fetchMaxSupply(masterAddress);
  const totalBought = await fetchTotalBought(masterAddress);
  return maxSupply - totalBought;
}

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend);

export async function renderUnclaimedChart(masterAddress: string) {
  const unclaimedNow = await calculateUnclaimed(masterAddress);

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
  
  export function renderPieChart(data: { label: string; value: number }[]) {
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
