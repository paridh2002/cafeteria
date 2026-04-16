const socket = io();

const labels = [];
const actualData = [];
const predictedData = [];
const tempData = [];

const chartContext = document.getElementById('demandChart').getContext('2d');
const demandChart = new Chart(chartContext, {
  type: 'line',
  data: {
    labels,
    datasets: [
      {
        label: 'Actual demand',
        data: actualData,
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25, 118, 210, 0.12)',
        tension: 0.25,
        fill: false,
        yAxisID: 'y-demand',
      },
      {
        label: 'Predicted demand',
        data: predictedData,
        borderColor: '#d32f2f',
        backgroundColor: 'rgba(211, 47, 47, 0.12)',
        borderDash: [6, 4],
        tension: 0.25,
        fill: false,
        yAxisID: 'y-demand',
      },
      {
        label: 'Temperature (°C)',
        data: tempData,
        borderColor: '#f9a825',
        backgroundColor: 'rgba(249, 168, 37, 0.12)',
        tension: 0.25,
        fill: false,
        yAxisID: 'y-temp',
      },
    ],
  },
  options: {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    stacked: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      'y-demand': {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: 'Demand (customers)',
        },
        beginAtZero: true,
      },
      'y-temp': {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: 'Temperature (°C)',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  },
});

const currentTempEl = document.getElementById('current-temp');
const currentWeatherEl = document.getElementById('current-weather');
const predictedDemandEl = document.getElementById('predicted-demand');
const surgeLabelEl = document.getElementById('surge-label');

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });
}

function updateSummary(point, predicted, surge) {
  currentTempEl.textContent = `${point.temp.toFixed(1)} °C`;
  currentWeatherEl.textContent = point.weather;
  predictedDemandEl.textContent = `${predicted} customers`;
  surgeLabelEl.textContent = surge;
}

function addData(point, predicted) {
  labels.push(formatTimestamp(point.timestamp));
  actualData.push(point.actual);
  predictedData.push(predicted);
  tempData.push(point.temp);

  if (labels.length > 36) {
    labels.shift();
    actualData.shift();
    predictedData.shift();
    tempData.shift();
  }

  demandChart.update();
}

socket.on('init', payload => {
  payload.history.forEach((point, index) => {
    const predicted = payload.predictions?.[index] ?? 0;
    addData(point, predicted);
  });

  const latestPoint = payload.history[payload.history.length - 1];
  const latestPrediction = payload.predictions[payload.predictions.length - 1];
  const surge = latestPrediction >= 90 ? 'High surge' : latestPrediction >= 75 ? 'Moderate surge' : 'Normal flow';
  updateSummary(latestPoint, latestPrediction, surge);
});

socket.on('update', data => {
  addData(data.point, data.predicted);
  updateSummary(data.point, data.predicted, data.surge);
});
