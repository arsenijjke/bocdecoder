import { Chart, Tooltip, Legend } from 'chart.js';
import {LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, } from 'chart.js';

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

  const dataPoints = [
    { date: '2024-01-01', totalShares: 1000 },
    { date: '2024-02-01', totalShares: 1800 },
    { date: '2024-03-01', totalShares: 2500 },
    { date: '2024-04-01', totalShares: 3100 },
    { date: '2024-05-01', totalShares: 4000 },
    { date: '2024-06-01', totalShares: 5500 },
    { date: '2024-07-01', totalShares: 7000 },
  ];
  
  // Извлекаем данные
  const labels = dataPoints.map(p => p.date);
  const values = dataPoints.map(p => p.totalShares);
  
  // Получаем контекст canvas
  const growthCtx = (document.getElementById("growthChart") as HTMLCanvasElement).getContext("2d")!;
  if (!growthCtx) {
    console.error("Canvas element with ID 'sharesGrowthChart' not found.");
  } else {
    new Chart(growthCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Shares Over Time',
          data: values,
          fill: false,
          borderColor: 'rgb(17, 255, 0)',
          tension: 0.1,
          pointRadius: 4,
          pointBackgroundColor: 'rgb(75, 192, 192)',
        }]
      },
      options: {
        scales: {
          x: {
            display: false,
            title: { display: false, text: 'Date' }
          },
          y: {
            display: false,
            title: { display: false, text: 'Total Shares' },
            beginAtZero: true
          }
        },
        plugins: {
          title: {
            display: false,
            text: 'Distribution Growth: Total Shares Over Time',
            font: { size: 14 }
          }
        }
      }
    });
  }