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
      throw new Error(json.error ?? 'Invalid holders response structure');
    }
  
    return json.addresses.map((holder: any) => {
      const address = holder.address;
      const rawBalance = holder.balance;
  
      if (!address || rawBalance === undefined) {
        throw new Error('Missing holder address or balance');
      }
  
      return {
        address,
        balance: Number(rawBalance) / 1e9,  // Convert from nano
      };
    });
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
