import { Chart, Tooltip, Legend } from 'chart.js';
import { LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, PieController, ArcElement } from 'chart.js';
import { fetchStakeGrowthFromToncenter } from './main.ts'

Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Title,
    Tooltip,
    Legend
  );
  
  const pendingData = [
    { date: "2024-06-01", pendingJettons: 10500 },
    { date: "2024-06-05", pendingJettons: 11200 },
    { date: "2024-06-10", pendingJettons: 8900 },
    { date: "2024-06-15", pendingJettons: 9700 },
    { date: "2024-06-20", pendingJettons: 10100 },
  ];
  
  const unclaimedCtx = (document.getElementById("unclaimedChart") as HTMLCanvasElement).getContext("2d")!;
  
  new Chart(unclaimedCtx, {
    type: 'line',
    data: {
      labels: pendingData.map(d => d.date),
      datasets: [{
        label: 'Unclaimed Jettons',
        data: pendingData.map(d => d.pendingJettons),
        borderColor: 'rgb(188, 2, 255)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Pending Jettons Over Time'
        }
      },
      scales: {
        y: {
          display: false,
          beginAtZero: true,
          title: { display: false, text: 'Jettons' }
        },
        x: {
          display: false,
          title: { display: false, text: 'Date' }
        }
      }
    }
  });

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
