import { Order } from '@ticketflow/types';

/**
 * Triggers a browser print dialog for the given order, presenting it as a beautifully styled
 * thermal receipt ticket.
 *
 * @param order The order details to print
 * @param showGuide If true, displays a helper banner indicating how to save as PDF if a printer is offline
 */
export const printKot = (order: Order, showGuide = false) => {
  const shortId = order.id.slice(-6).toUpperCase();
  const dateStr = new Date(order.createdAt).toLocaleString();
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print KOT #${shortId}</title>
        <style>
          body {
            margin: 0;
            padding: 10px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            color: #000;
            background-color: #fff;
          }
          .receipt {
            width: 100%;
            max-width: 280px;
            margin: 0 auto;
          }
          .guide-banner {
            background-color: #eff6ff;
            border: 1px solid #bfdbfe;
            color: #1e40af;
            padding: 10px;
            margin-bottom: 12px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 11px;
            line-height: 1.4;
            text-align: left;
          }
          .guide-banner-title {
            font-weight: bold;
            margin-bottom: 2px;
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .header {
            text-align: center;
            margin-bottom: 8px;
          }
          .brand {
            font-size: 15px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .address {
            font-size: 9px;
            color: #444;
            margin-top: 2px;
            line-height: 1.2;
          }
          .line {
            border-top: 1px dashed #000;
            margin: 5px 0;
          }
          .double-line {
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            height: 3px;
            margin: 5px 0;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
            font-weight: bold;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 5px;
          }
          .items-header {
            border-bottom: 1px dashed #000;
            font-weight: bold;
            text-transform: uppercase;
          }
          .items-header th {
            padding-bottom: 3px;
          }
          .item-row td {
            padding: 3px 0;
            vertical-align: top;
          }
          .notes {
            font-size: 10px;
            font-style: italic;
            padding-left: 8px;
            margin-top: 1px;
            color: #333;
          }
          .footer {
            text-align: center;
            margin-top: 8px;
            font-weight: bold;
          }
          @media print {
            body {
              padding: 0;
            }
            .receipt {
              width: 100%;
              max-width: 100%;
            }
            .guide-banner {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          ${showGuide ? `
            <div class="guide-banner">
              <div class="guide-banner-title">💡 Printer not connected?</div>
              <div>Change the Destination option in the print dialog to <strong>"Save as PDF"</strong> to download this KOT receipt as a PDF document.</div>
            </div>
          ` : ''}

          <div class="header">
            <div style="font-weight: bold; font-size: 10px; letter-spacing: 2px;">KOT RECEIPT</div>
            <div class="line"></div>
            <div class="brand">The Wesee Pizzas</div>
            <div class="address">
              Vijay Nagar, Near by C21 Mall, Indore,<br>
              Madhya Pradesh, India.<br>
              Mobile No.: 9876543210
            </div>
          </div>
          
          <div class="double-line"></div>
          
          <div class="meta-row">
            <span>Bill No:</span>
            <span style="background-color: #eee; padding: 0 4px; border: 1px solid #999;">#${shortId}</span>
          </div>
          <div class="meta-row">
            <span>Date:</span>
            <span>${dateStr}</span>
          </div>
          <div class="meta-row">
            <span>Customer:</span>
            <span>${order.customerName}</span>
          </div>
          <div class="meta-row">
            <span>Priority:</span>
            <span>${order.priority}</span>
          </div>
          
          <div class="line"></div>
          
          <table class="items-table">
            <thead>
              <tr class="items-header">
                <th style="text-align: left; width: 15%;">S.N</th>
                <th style="text-align: left; width: 65%;">ITEM NAME</th>
                <th style="text-align: right; width: 20%;">QTY</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item, idx) => `
                <tr class="item-row">
                  <td>${idx + 1}</td>
                  <td>
                    <div style="font-weight: bold;">${item.name}</div>
                    ${item.notes ? `<div class="notes">* Note: ${item.notes}</div>` : ''}
                  </td>
                  <td style="text-align: right; font-weight: bold;">${item.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="double-line"></div>
          
          <div class="footer">
            <div>Thank You!!!</div>
          </div>
          <div class="line"></div>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            // Close tab automatically after printing has been finalized/canceled
            setTimeout(function() {
              window.close();
            }, 500);
          };
        </script>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=600,height=600');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    console.warn('[KOT Print] Window popup blocked. Failed to trigger print dialog.');
  }
};

/**
 * Triggers printing of a KOT receipt, showing saving as PDF advice for offline printers.
 */
export const downloadKot = (order: Order) => {
  printKot(order, true);
};
