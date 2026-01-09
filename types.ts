
export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface AnalysisResult {
  skinToneHex: string;
  undertone: 'Warm' | 'Cool' | 'Neutral';
  confidence: number;
  description: string;
}

export interface Product {
  id: string;
  name: string;
  nameJp: string;
  brand: string;
  category: 'eyeshadow' | 'blush' | 'foundation';
  colorHex: string;
  opacity: number; // 0.0 to 1.0 (pigment density)
}

export interface SimulationResult {
  product: Product;
  resultantHex: string;
  deltaE: number; // Color difference
}