/* Practice-round numbers for Green Day (U5T1), read from Cesim Results on 27 Oct 2026.
   Used by "Load practice-round demo". Practice rounds do not count for the real game. */
const PRACTICE_DEMO = {
  team: "Green Day",
  rounds: [
    {
      id: "P1", label: "Practice 1", practice: true, team: "Green Day",
      kpi: {
        tsr: 27.73, sharePrice: 56.80, eps: 2.60, ebitdaPct: 18.13, roce: 27.1, equityRatio: 49.5, esg: 2.95,
        shares: 1625000, revenue: 42909417, profit: 4222463, cash: 9791903, ltDebt: 8900000, stDebt: 4236419,
        inventoryValue: 4918845, invUnits: 468, capUSA: 70, rdHybridPct: 28.8,
        price_USA_Combustion: 18500, feat_USA_Combustion: 3, dem_USA_Combustion: 557,
        price_China_Combustion: 122000, feat_China_Combustion: 5, dem_China_Combustion: 437,
        price_Europe_Combustion: 21500, feat_Europe_Combustion: 2, dem_Europe_Combustion: 620,
        price_USA_Hybrid: 22500, feat_USA_Hybrid: 1, sold_USA_Hybrid: 0, dem_USA_Hybrid: 415,
        price_China_Hybrid: 150000, feat_China_Hybrid: 1, sold_China_Hybrid: 367, dem_China_Hybrid: 367,
        price_Europe_Hybrid: 25000, feat_Europe_Hybrid: 1, sold_Europe_Hybrid: 42, dem_Europe_Hybrid: 526,
      },
      teams: {
        "Green Day": { tsr: 27.73, sharePrice: 56.80 }, "RedBull": { tsr: 24.53 },
        "U5T3 - Blue": { tsr: -13.20 }, "U5T4 - Orange": { tsr: -7.37 }, "U5T5 - Grey": { tsr: -35.05 },
      },
      rivalPrices: {},
    },
    {
      id: "P2", label: "Practice 2", practice: true, team: "Green Day",
      kpi: {
        tsr: 29.53, sharePrice: 69.77, eps: 4.18, ebitdaPct: 16.65, roce: 37.53, equityRatio: 54.52, esg: 2.99,
        shares: 1625000, revenue: 62295388, profit: 6788561, cash: 9098735, ltDebt: 8900000, stDebt: 0, inventoryValue: 0,
        dividends: 8000000, invUnits: 0, capUSA: 85, capChina: 90, rdHybridPct: 61.5, rdEfficiency: 1.05, turnover: 2.98,
        shareUSA: 26.82, shareChina: 36.57, shareEurope: 20.19,
        price_USA_Combustion: 19000, feat_USA_Combustion: 4, sold_USA_Combustion: 611, dem_USA_Combustion: 611,
        price_China_Combustion: 123000, feat_China_Combustion: 6, sold_China_Combustion: 522, dem_China_Combustion: 522,
        price_Europe_Combustion: 20600, feat_Europe_Combustion: 3, sold_Europe_Combustion: 652, dem_Europe_Combustion: 836,
        price_USA_Hybrid: 25500, feat_USA_Hybrid: 2, sold_USA_Hybrid: 408, dem_USA_Hybrid: 537,
        price_China_Hybrid: 170000, feat_China_Hybrid: 2, sold_China_Hybrid: 539, dem_China_Hybrid: 567,
        price_Europe_Hybrid: 25500, feat_Europe_Hybrid: 2, sold_Europe_Hybrid: 0, dem_Europe_Hybrid: 704,
      },
      teams: {
        "Green Day": { tsr: 29.53, sharePrice: 69.77 }, "RedBull": { tsr: 27.50, sharePrice: 69.18 },
        "U5T3 - Blue": { tsr: 16.79, sharePrice: 60.37 }, "U5T4 - Orange": { tsr: -2.44, sharePrice: 42.55 },
        "U5T5 - Grey": { tsr: -29.57, sharePrice: 22.18 },
      },
      rivalPrices: {
        USA: { "RedBull": 28300, "U5T3 - Blue": 28000, "U5T5 - Grey": 35000 },
        China: { "RedBull": 143000, "U5T3 - Blue": 220000 },
        Europe: { "RedBull": 25000, "U5T3 - Blue": 27000 },
      },
    },
  ],
};
