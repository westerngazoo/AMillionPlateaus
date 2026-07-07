import { qrMatrix } from "./vendor/qr/index.js";

export function drawQR(canvas, text) {
  const matrix = qrMatrix(text);
  const ctx = canvas.getContext("2d");
  const size = matrix.length;
  const cellSize = Math.floor(canvas.width / size);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (matrix[y][x]) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }
}
