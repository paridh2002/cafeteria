# Cafeteria Lunch Surge Predictor

A lightweight Node.js app that predicts lunch-hour demand surges using temperature and weather data.

## Features

- Historical synthetic weather and demand data
- Linear regression model trained on temperature + lunch hour + weather conditions
- Real-time WebSocket updates using Socket.IO
- Live line chart showing actual demand, predicted demand, and temperature

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

3. Open `http://localhost:3000` in your browser.

## Notes

- The app generates synthetic weather/demand data for demo purposes.
- Predictions update every 5 seconds to simulate a live lunch-hour surge forecast.
