import fs from 'fs';
import puppeteer from 'puppeteer';
import { InvoiceRenderService, InvoiceRenderData } from './InvoiceRenderService';
import { uploadBufferToCloudinary } from './cloudinary';

function getBrowserLaunchOptions() {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
  ];
  
  let executablePath: string | undefined = undefined;
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    if (fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      console.warn(`⚠️ PUPPETEER_EXECUTABLE_PATH was set to '${process.env.PUPPETEER_EXECUTABLE_PATH}' but file does not exist. Falling back to default browser.`);
    }
  }

  return {
    headless: true,
    args,
    ...(executablePath ? { executablePath } : {}),
  };
}

export class DocumentGenerationService {
  public static async generateDocuments(
    businessId: string,
    invoiceId: string,
    renderData: InvoiceRenderData
  ): Promise<{
    snapshot: { publicId: string; secureUrl: string; width: number; height: number };
    pdf: { secureUrl: string };
  }> {
    const html = InvoiceRenderService.render(renderData);

    let browser;
    try {
      browser = await puppeteer.launch(getBrowserLaunchOptions());

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });

      // Set standard A4 portrait width in pixels at standard device Scale factor
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

      // 1. Generate PNG snapshot
      const pngRawBuffer = await page.screenshot({
        type: 'png',
        fullPage: true,
      });
      const pngBuffer = Buffer.from(pngRawBuffer);

      // 2. Generate PDF
      const pdfRawBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      });
      const pdfBuffer = Buffer.from(pdfRawBuffer);

      await browser.close();

      // 3. Upload to Cloudinary
      const folderPath = `businesses/${businessId}/invoices/${invoiceId}`;

      const pngUpload = await uploadBufferToCloudinary(pngBuffer, {
        folder: folderPath,
        public_id: 'original',
        resource_type: 'image',
      });

      const pdfUpload = await uploadBufferToCloudinary(pdfBuffer, {
        folder: folderPath,
        public_id: 'invoice.pdf',
        resource_type: 'raw',
      });

      return {
        snapshot: {
          publicId: pngUpload.public_id,
          secureUrl: pngUpload.secure_url,
          width: 794,
          height: 1123,
        },
        pdf: {
          secureUrl: pdfUpload.secure_url,
        },
      };
    } catch (error: any) {
      if (browser) {
        try {
          await browser.close();
        } catch (_) {}
      }
      console.error('⚠️ Document generation error:', error.message);
      throw error;
    }
  }
  public static async generateBuffers(
    renderData: InvoiceRenderData
  ): Promise<{ pngBuffer: Buffer; pdfBuffer: Buffer }> {
    const html = InvoiceRenderService.render(renderData);

    const browser = await puppeteer.launch(getBrowserLaunchOptions());

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

      const pngRawBuffer = await page.screenshot({
        type: 'png',
        fullPage: true,
      });
      const pngBuffer = Buffer.from(pngRawBuffer);

      const pdfRawBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      });
      const pdfBuffer = Buffer.from(pdfRawBuffer);

      return { pngBuffer, pdfBuffer };
    } finally {
      await browser.close();
    }
  }
}
