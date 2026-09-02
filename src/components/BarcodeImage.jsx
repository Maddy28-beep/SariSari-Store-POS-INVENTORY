import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function BarcodeImage({ value, width = 2, height = 60, fontSize = 14 }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'EAN13',
        width,
        height,
        fontSize,
        margin: 4,
      });
    } catch {
      // Not a valid EAN-13 (e.g. a manufacturer barcode with a different length) — fall back to Code128.
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        width,
        height,
        fontSize,
        margin: 4,
      });
    }
  }, [value, width, height, fontSize]);

  if (!value) return null;

  return <svg ref={svgRef}></svg>;
}
