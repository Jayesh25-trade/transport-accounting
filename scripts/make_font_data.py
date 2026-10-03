import base64
import os

reg_path = r"d:\TRANSPORT ACC\transport-app\src\lib\fonts\Arial-Subset.ttf"
bold_path = r"d:\TRANSPORT ACC\transport-app\src\lib\fonts\ArialBold-Subset.ttf"
out_path = r"d:\TRANSPORT ACC\transport-app\src\lib\fonts\font-data.ts"

with open(reg_path, "rb") as f:
    reg_b64 = base64.b64encode(f.read()).decode("utf-8")

with open(bold_path, "rb") as f:
    bold_b64 = base64.b64encode(f.read()).decode("utf-8")

ts_content = f"""// Auto-generated font data file for jsPDF with full ASCII + Rupee (₹) symbol support
export const ARIAL_REGULAR_BASE64 = "{reg_b64}";
export const ARIAL_BOLD_BASE64 = "{bold_b64}";
"""

with open(out_path, "w", encoding="utf-8") as f:
    f.write(ts_content)

print("Successfully created font-data.ts")
