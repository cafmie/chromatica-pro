
import { AnalysisResult, RGB } from "../types";
import { rgbToHex, detectUndertone, hexToRgb } from "../utils/colorMath";

/**
 * 画像の中央付近のピクセルをサンプリングして平均的な肌色を算出
 */
export const analyzeSkinToneLocal = (imageElement: HTMLImageElement): Promise<AnalysisResult> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error("Could not get canvas context");

    // 解析を高速化するためにリサイズ
    const size = 100;
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(imageElement, 0, 0, size, size);

    // 中央領域(40x40)のピクセルを取得して平均化
    const scanSize = 40;
    const offset = (size - scanSize) / 2;
    const imageData = ctx.getImageData(offset, offset, scanSize, scanSize);
    const data = imageData.data;

    let r = 0, g = 0, b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }

    const count = data.length / 4;
    const avgRgb: RGB = { r: r / count, g: g / count, b: b / count };
    const hex = rgbToHex(avgRgb);
    const undertone = detectUndertone(avgRgb);

    let description = "";
    if (undertone === 'Warm') {
      description = "黄みよりの健康的な暖色系トーンです。ゴールドやオレンジが映える特徴があります。";
    } else if (undertone === 'Cool') {
      description = "青みを感じる透明感のある寒色系トーンです。シルバーやピンク、パープルが馴染みやすいです。";
    } else {
      description = "赤みと黄みのバランスが取れた中間的なトーンです。幅広い色調のメイクアップが可能です。";
    }

    resolve({
      skinToneHex: hex,
      undertone,
      confidence: 0.95,
      description
    });
  });
};

/**
 * 色彩理論に基づいたローカルアドバイス生成
 */
export const generateLocalAdvice = (baseHex: string, targetHex: string, productName: string): string => {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);

  const rDiff = target.r - base.r;
  const gDiff = target.g - base.g;
  const bDiff = target.b - base.b;

  let advice = `色彩シミュレーションに基づき、${productName}を推奨します。\n\n`;

  if (rDiff > 20) {
    advice += "目標の色には血色感が必要なため、赤みの強いピグメントを重ねることで肌のトーンを暖色側にシフトさせます。";
  } else if (bDiff > 20) {
    advice += "透明感を出すために、青み寄りのニュアンスを加えることで黄みを抑え、理想的なコントラストを実現します。";
  } else {
    advice += "現在の肌色に近い明度を維持しつつ、彩度のみを微調整することで、自然で一体感のある仕上がりになります。";
  }

  advice += "\nこの製品の不透明度は光を適度に通すため、元の肌色を活かした自然な発色が期待できます。";

  return advice;
};
