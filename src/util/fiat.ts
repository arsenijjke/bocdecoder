import { updatePieChart } from "./chart";

    /** Fetch live TON→USD rate from CoinGecko */
  async function getTonUsdPrice(): Promise<number> {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd"
    );
    const json = await res.json();
    return json["the-open-network"]?.usd ?? 0;
  }
  
  /** Update table with USDT + TON values and totals */
  export async function updateValues(tonBalance: number): Promise<void> {
    const usdtValueEl       = document.getElementById("usdtValue")!;
    const tonRateEl         = document.getElementById("tonRate")!;
    const tonValueEl        = document.getElementById("tonValue")!;
    const totalFiatValueEl  = document.getElementById("totalFiatValue")!;
  
    /* ---------- USDT (always 1 USDT = $1) ---------- */
    const usdtRaw  = document.getElementById("jettonBalance")?.textContent ?? "";
    const usdt     = parseFloat(usdtRaw.replace(/[^0-9.]/g, ""));
    if (isNaN(usdt)) return;          // still loading – do nothing
    usdtValueEl.textContent = `$${usdt.toFixed(2)}`;
  
    /* ---------- TON ---------- */
    try {
      const tonPriceRaw = await getTonUsdPrice();          // whatever your fetch is
      const tonPrice    = Number(tonPriceRaw);
  
      if (!Number.isFinite(tonPrice)) {
        throw new Error(`Bad TON price: ${tonPriceRaw}`);
      }
  
      tonRateEl.textContent = `$${tonPrice.toFixed(2)}`;
  
      const tonUsd = tonBalance * tonPrice;
      tonValueEl.textContent = `$${tonUsd.toFixed(2)}`;
  
      /* ---------- TOTAL ---------- */
      const total = usdt + tonUsd;
      totalFiatValueEl.textContent = `$${total.toFixed(2)}`;
  
      updatePieChart();               // always inside try when data are valid
    } catch (err) {
      console.error("updateValues → TON part failed:", err);
      /* Do NOT overwrite good numbers — leave the previous ones
         or show a subtle warning instead of 'Error'. */
      tonRateEl.textContent  = "—";
      tonValueEl.textContent = "—";
    }
  }
  