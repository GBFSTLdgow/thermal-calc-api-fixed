// thermal_calc_api/index.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); 


const app = express();
app.use(cors()); 
app.use(bodyParser.json());
const PORT = 3000;

// --- Material Thermal Conductivity Database (k in Btu·in/hr·ft²·°F) ---
const materialDB = {
  "Gypsum": 1.1,
  "Mineral Fiber": 0.24,
  "Fiber Cement Panel": 1.7,
  "Air Film (Inside)": 0.68,
  "Air Film (Outside)": 0.17
};

// --- IECC Code Maximum U-Values (example for Climate Zone 5A) ---
const codeTable = {
  "IECC2021": {
    "5A": {
      "wood-framed wall": 0.060,
      "metal-framed wall": 0.064
    }
  }
};

// --- Framing Correction Factors ---
const framingCorrection = {
  "wood": 1.0, // no adjustment
  "metal": 1.2  // assume 20% performance loss
};

app.post('/calculate', (req, res) => {
  const { climateZone, buildingType, layers, framing, code } = req.body;

  let RTotal = 0;
  for (const layer of layers) {
    const k = materialDB[layer.material];
    if (!k) return res.status(400).json({ error: `Unknown material: ${layer.material}` });
    const R = layer.thicknessInches / k;
    RTotal += R;
  }

  // Apply framing correction
  const correctionFactor = framingCorrection[framing] || 1.0;
  const UValue = +(1 / RTotal * correctionFactor).toFixed(3);

  // Get code max U-value
  const codeMaxU = codeTable[code]?.[climateZone]?.[buildingType];
  if (!codeMaxU) return res.status(400).json({ error: 'Unsupported climate zone or building type' });

  const compliance = UValue <= codeMaxU;
  const margin = +(((codeMaxU - UValue) / codeMaxU) * 100).toFixed(2);

  // Simplified condensation risk (low if RTotal > 15)
  const condensationRisk = RTotal > 15 ? 'Low' : 'Moderate';

  // Recommendations
  const recommendations = [];
  if (!compliance) recommendations.push("Add continuous insulation to reduce U-value");
  else if (margin < 10) recommendations.push("Consider CI to improve condensation resistance");

  return res.json({ RTotal: +RTotal.toFixed(2), UValue, codeMaxU, compliance, margin, condensationRisk, recommendations });
});

app.listen(PORT, () => {
  console.log(`Thermal calc API running at http://localhost:${PORT}`);
});
