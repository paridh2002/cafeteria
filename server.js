const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const weatherTypes = ['Sunny', 'Cloudy', 'Rainy', 'Windy', 'Stormy'];
const weatherWeightMap = {
  Sunny: 0,
  Cloudy: -2,
  Windy: -3,
  Rainy: -8,
  Stormy: -15,
};

function weatherWeight(weather) {
  return weatherWeightMap[weather] ?? 0;
}

function buildFeatures(point) {
  return [
    1,
    point.temp,
    point.isLunchHour ? 1 : 0,
    weatherWeight(point.weather),
  ];
}

function predict(point, coeffs) {
  const features = buildFeatures(point);
  return features.reduce((sum, value, index) => sum + value * coeffs[index], 0);
}

function transpose(matrix) {
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

function multiplyMatrix(A, B) {
  return A.map(row => B[0].map((_, j) => row.reduce((sum, v, i) => sum + v * B[i][j], 0)));
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map(row => row.reduce((sum, value, idx) => sum + value * vector[idx], 0));
}

function invertMatrix(matrix) {
  const n = matrix.length;
  const A = matrix.map(row => row.slice());
  const I = matrix.map((row, i) => row.map((_, j) => (i === j ? 1 : 0)));

  for (let i = 0; i < n; i += 1) {
    let pivot = i;
    for (let j = i + 1; j < n; j += 1) {
      if (Math.abs(A[j][i]) > Math.abs(A[pivot][i])) {
        pivot = j;
      }
    }

    if (Math.abs(A[pivot][i]) < 1e-12) {
      throw new Error('Matrix is singular and cannot be inverted');
    }

    [A[i], A[pivot]] = [A[pivot], A[i]];
    [I[i], I[pivot]] = [I[pivot], I[i]];

    const divisor = A[i][i];
    for (let j = 0; j < n; j += 1) {
      A[i][j] /= divisor;
      I[i][j] /= divisor;
    }

    for (let j = 0; j < n; j += 1) {
      if (j === i) continue;
      const factor = A[j][i];
      for (let k = 0; k < n; k += 1) {
        A[j][k] -= factor * A[i][k];
        I[j][k] -= factor * I[i][k];
      }
    }
  }

  return I;
}

function computeRegressionCoefficients(points) {
  const X = points.map(buildFeatures);
  const y = points.map(point => point.actual);
  const Xt = transpose(X);
  const XtX = multiplyMatrix(Xt, X);
  const XtXInv = invertMatrix(XtX);
  const XtY = multiplyMatrixVector(Xt, y);
  return multiplyMatrixVector(XtXInv, XtY);
}

function getDayFactor(date) {
  const day = date.getDay();
  const dayPremium = [2, 1, 1, 2, 4, 6, 3];
  return dayPremium[day] || 0;
}

function normalizeTemperature(temp) {
  return Math.max(5, Math.min(35, temp));
}

function pickNextWeather(current) {
  const change = Math.random();
  if (change < 0.3) {
    return current;
  }
  const nextIndex = (weatherTypes.indexOf(current) + (Math.random() < 0.5 ? 1 : -1) + weatherTypes.length) % weatherTypes.length;
  return weatherTypes[nextIndex];
}

function makePoint(date, temp, weather) {
  const hour = date.getHours();
  const isLunchHour = hour >= 11 && hour <= 13;
  const weatherImpact = weatherWeight(weather);
  const base = 30 + temp * 2.2 + (isLunchHour ? 40 : 0) + weatherImpact + getDayFactor(date);
  const actual = Math.max(5, Math.round(base + (Math.random() * 16 - 8)));

  return {
    timestamp: date.toISOString(),
    hour,
    temp,
    weather,
    actual,
    isLunchHour,
  };
}

function generateHistoricalData(count) {
  const history = [];
  const now = new Date();
  const baseDate = new Date(now.getTime() - count * 60 * 60 * 1000);
  let currentWeather = 'Sunny';
  let currentTemp = 18;

  for (let i = 0; i < count; i += 1) {
    const date = new Date(baseDate.getTime() + i * 60 * 60 * 1000);
    const hour = date.getHours();
    const dailyCycle = 12 + 10 * Math.sin((hour / 24) * Math.PI * 2);
    currentTemp = normalizeTemperature(dailyCycle + (Math.random() * 5 - 2));
    currentWeather = pickNextWeather(currentWeather);
    history.push(makePoint(date, currentTemp, currentWeather));
  }

  return history;
}

function buildSurgeLabel(predicted) {
  if (predicted >= 90) return 'High surge';
  if (predicted >= 75) return 'Moderate surge';
  return 'Normal flow';
}

const history = generateHistoricalData(72);
let coefficients = computeRegressionCoefficients(history);

app.use(express.static('public'));

io.on('connection', socket => {
  socket.emit('init', {
    history,
    predictions: history.map(point => Math.round(predict(point, coefficients))),
    coefficients,
  });
});

function scheduleUpdate() {
  const last = history[history.length - 1];
  const lastDate = new Date(last.timestamp);
  const nextDate = new Date(lastDate.getTime() + 60 * 60 * 1000);
  const hour = nextDate.getHours();
  const dailyCycle = 12 + 10 * Math.sin((hour / 24) * Math.PI * 2);
  const temp = normalizeTemperature(dailyCycle + (Math.random() * 4 - 2));
  const weather = pickNextWeather(last.weather);
  const point = makePoint(nextDate, temp, weather);

  history.push(point);
  if (history.length > 72) {
    history.shift();
  }

  coefficients = computeRegressionCoefficients(history);
  const predicted = Math.round(predict(point, coefficients));
  const surge = buildSurgeLabel(predicted);

  io.emit('update', { point, predicted, surge, coefficients });
}

setInterval(scheduleUpdate, 5000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Cafeteria surge predictor running on http://localhost:${PORT}`);
});
