import { chromium } from "playwright";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const svgPath = path.resolve(root, "docs", "GIOM-BIG-TECH-POSTER.svg");
const pngPath = path.resolve(root, "docs", "GIOM-BIG-TECH-POSTER-A3-300DPI.png");
const pdfPath = path.resolve(root, "docs", "GIOM-BIG-TECH-POSTER-A3.pdf");

const A3_PX = { width: 3508, height: 4961 };

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: A3_PX });

  await page.goto(pathToFileURL(svgPath).href, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  await page.screenshot({
    path: pngPath,
    type: "png",
    timeout: 0,
    omitBackground: false,
  });

  // A3 portrait in millimeters for print-ready PDF.
  await page.pdf({
    path: pdfPath,
    printBackground: true,
    width: "297mm",
    height: "420mm",
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });

  await browser.close();

  console.log("POSTER_RENDERED", JSON.stringify({ pngPath, pdfPath }, null, 2));
}

run().catch((error) => {
  console.error("POSTER_RENDER_FAILED", error);
  process.exitCode = 1;
});
