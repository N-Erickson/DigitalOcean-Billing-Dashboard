# Digital Ocean FinOps Dashboard

A React-based dashboard for visualizing DigitalOcean billing data.

All you need is an API token from Digital Ocean with Read permissions scoped to Billing.

## Features

- Connect with your DigitalOcean API token
- View summary of your billing data
- Visualize monthly spend trends
- Analyze spend by category, project, and product
- Download invoice data as CSV
- Filter data by time range

## Getting Started

### Prerequisites

- Node.js (version 14 or later)
- npm or yarn
- DigitalOcean API token (with read access to billing data)

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/N-Erickson/DigitalOcean-Billing-Dashboard.git
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Enter your DigitalOcean API token on the login screen
2. The dashboard will load your billing data automatically
3. Use the time range selector to filter data
4. Download CSV data for further analysis
5. Click individual invoice CSV buttons to download specific invoices

## CORS Considerations

This application connects directly to the DigitalOcean API from the browser, which may result in CORS (Cross-Origin Resource Sharing) issues depending on your browser and configuration. If you encounter CORS errors, consider:

1. Using a CORS browser extension (for development only)
2. Setting up a simple proxy server
3. Deploying the application to a DigitalOcean App Platform or similar service

## Project Structure

- `src/App.js` - Main application component
- `src/components/` - React components
  - `LoginForm.js` - API token input form
  - `Dashboard.js` - Main dashboard layout
  - `SummaryCards.js` - Summary metrics display
  - `InvoiceTable.js` - Invoice listing with CSV export
  - `charts/` - Chart components
    - `MonthlyChart.js` - Monthly spend trend chart
    - `CategoryChart.js` - Category breakdown chart
    - `ProjectChart.js` - Project breakdown chart
    - `ProductChart.js` - Product breakdown chart
- `src/utils/dataUtils.js` - Data processing utilities

## License
Attribution-NonCommercial 4.0 International
