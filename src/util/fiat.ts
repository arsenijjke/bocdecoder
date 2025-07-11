export function updateValues() {
    const jettonBalanceEl = document.getElementById("jettonBalance");
  if (!jettonBalanceEl) return;

  const rawUsdtText = jettonBalanceEl.textContent ?? "";
  const usdtAmount = parseFloat(rawUsdtText.replace(/[^0-9.]/g, ""));
  if (isNaN(usdtAmount)) {
    // Not ready yet, don't update, or show 0 instead
    console.log("Waiting for jettonBalance to update");
    return;
  }
    const usdtValueEl = document.getElementById("usdtValue");
    const tonRateEl = document.getElementById("tonRate");
    const tonValueEl = document.getElementById("tonValue");
    const totalFiatValueEl = document.getElementById("totalFiatValue");
  
    if (!jettonBalanceEl || !usdtValueEl || !tonRateEl || !tonValueEl || !totalFiatValueEl) {
      console.error("One or more required elements are missing");
      return;
    }
  
    // Parse USDT amount
    const usdtValue = usdtAmount * 1.0;
    usdtValueEl.textContent = `$${usdtValue.toFixed(2)}`;
  
    // Parse TON rate
    const tonRate = parseFloat(tonRateEl.textContent?.replace(/[^0-9.]/g, "") ?? "0");
  
    // Parse TON value (TON amount × rate)
    const tonValue = parseFloat(tonValueEl.textContent?.replace(/[^0-9.]/g, "") ?? "0");
  
    // Calculate total
    const totalFiatValue = usdtValue + tonValue;
    totalFiatValueEl.textContent = `$${totalFiatValue.toFixed(2)}`;
  }