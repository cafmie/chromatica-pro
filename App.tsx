import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RefreshCcw, Check, Palette, Sparkles, Share, Image as ImageIcon, Crosshair, Pipette, Sliders, Target } from 'lucide-react';
import { AnalysisResult, SimulationResult } from './types';
import { analyzeSkinToneLocal, generateLocalAdvice } from './services/analysisService';
import { hexToRgb, rgbToHex, blendColors, calculateColorDifference, hsvToRgb, detectUndertone } from './utils/colorMath';
import { MOCK_PRODUCTS } from './constants';

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [targetImage, setTargetImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [targetColor, setTargetColor] = useState<string>('#E6B8A2');
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [isSampling, setIsSampling] = useState(false);
  const [isSamplingSource, setIsSamplingSource] = useState(false);
  const [pickerMode, setPickerMode] = useState<'presets' | 'custom' | 'image'>('presets');
  const [pickPosition, setPickPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingPick, setIsDraggingPick] = useState(false);
  
  // Custom Color Picker States (HSV)
  const [hue, setHue] = useState(0.05);
  const [sat, setSat] = useState(0.3);
  const [val, setVal] = useState(0.8);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const svPanelRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setImage(base64);
        const img = new Image();
        img.onload = async () => {
          setAnalyzing(true);
          try {
            const result = await analyzeSkinToneLocal(img);
            setAnalysis(result);
            setIsSamplingSource(true); // 画像アップロード後は自動的にサンプリングモードをオンに
            // 画像の中央にピックを配置
            setPickPosition({ x: 0.5, y: 0.5 });
          } catch (err) {
            console.error(err);
          } finally {
            setAnalyzing(false);
          }
        };
        img.src = base64;
      };
      reader.readAsDataURL(file);
    }
  };

  // Fix: Added missing handleTargetImageUpload function to handle target color reference images
  const handleTargetImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setTargetImage(base64);
        setPickerMode('image');
        setIsSampling(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const sampleColorFromSource = (e: React.MouseEvent | React.TouchEvent) => {
    if (!sourceCanvasRef.current || !image) return;
    const canvas = sourceCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e ? e.touches[0] : e;
    const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
    const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
    
    // ピック位置を更新（正規化された座標として保存）
    setPickPosition({ 
      x: x / canvas.width, 
      y: y / canvas.height 
    });
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const rgb = { r: pixel[0], g: pixel[1], b: pixel[2] };
      const hex = rgbToHex(rgb);
      const undertone = detectUndertone(rgb);
      setAnalysis({
        skinToneHex: hex,
        undertone,
        confidence: 1.0,
        description: "手動サンプリングによる解析結果です。"
      });
    }
  };

  const sampleColorFromCanvas = (e: any) => {
    if (!canvasRef.current || !isSampling) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
    const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const hex = rgbToHex({ r: pixel[0], g: pixel[1], b: pixel[2] });
      setTargetColor(hex);
    }
  };

  const updateCustomColor = (h: number, s: number, v: number) => {
    setHue(h); setSat(s); setVal(v);
    const rgb = hsvToRgb(h, s, v);
    setTargetColor(rgbToHex(rgb));
  };

  const handleSVMove = (e: any) => {
    if (!svPanelRef.current) return;
    const rect = svPanelRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const s = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (touch.clientY - rect.top) / rect.height));
    updateCustomColor(hue, s, v);
  };

  const handlePickDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsDraggingPick(true);
  };

  useEffect(() => {
    if (isDraggingPick) {
      const handleMouseUp = () => setIsDraggingPick(false);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchend', handleMouseUp);
      return () => {
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDraggingPick]);

  useEffect(() => {
    if (image && sourceCanvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const canvas = sourceCanvasRef.current!;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const maxWidth = 800;
          const scale = Math.min(1, maxWidth / img.width);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
      };
      img.src = image;
    }
  }, [image]);

  useEffect(() => {
    if (targetImage && canvasRef.current && pickerMode === 'image') {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = img.width; canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
        }
      };
      img.src = targetImage;
    }
  }, [targetImage, pickerMode]);

  const findBestProduct = useCallback(() => {
    if (!analysis) return;
    const baseRgb = hexToRgb(analysis.skinToneHex);
    const targetRgb = hexToRgb(targetColor);
    let bestResult: SimulationResult | null = null;
    let minDiff = Infinity;

    MOCK_PRODUCTS.forEach(product => {
      const pigmentRgb = hexToRgb(product.colorHex);
      const resultantRgb = blendColors(baseRgb, pigmentRgb, product.opacity);
      const diff = calculateColorDifference(resultantRgb, targetRgb);
      if (diff < minDiff) {
        minDiff = diff;
        bestResult = { product, resultantHex: rgbToHex(resultantRgb), deltaE: diff };
      }
    });
    setSimulation(bestResult);
    if (bestResult) {
      setAdvice(generateLocalAdvice(analysis.skinToneHex, targetColor, (bestResult as SimulationResult).product.name));
    }
  }, [analysis, targetColor]);

  useEffect(() => {
    if (analysis) findBestProduct();
  }, [analysis, targetColor, findBestProduct]);

  return (
    <div className="min-h-screen pb-24 bg-[#FDFCFA] safe-area-bottom">
      <header className="bg-white/90 backdrop-blur-xl border-b border-stone-100 sticky top-0 z-50 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-stone-900 p-2 rounded-xl">
            <Palette className="text-white w-5 h-5" />
          </div>
          <h1 className="text-lg serif tracking-tight text-stone-800">Chromatica <span className="text-[10px] font-sans font-bold text-stone-300 uppercase ml-1">Pro</span></h1>
        </div>
        <button className="p-2 bg-stone-50 rounded-full text-stone-400">
          <Share className="w-4 h-4" />
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        {/* Step 1: Skin Capture & Area Selection */}
        <section className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-stone-100 overflow-hidden">
          {!image ? (
            <div onClick={() => fileInputRef.current?.click()} className="aspect-square border-2 border-dashed border-stone-100 rounded-[2rem] flex flex-col items-center justify-center gap-4 bg-stone-50/50 cursor-pointer active:scale-95 transition-all">
              <Camera className="w-10 h-10 text-stone-300" />
              <div className="text-center px-6">
                <p className="text-stone-800 font-bold">肌色を撮影・選択</p>
                <p className="text-stone-400 text-[10px] mt-1">明るい場所で正面から撮影してください</p>
              </div>
              <input type="file" className="hidden" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} />
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-stone-900 text-white text-[10px] flex items-center justify-center">1</div>
                  肌色の解析エリアを選択
                </h2>
                <button onClick={() => { setImage(null); setAnalysis(null); setIsSamplingSource(false); setPickPosition(null); }} className="text-[10px] font-bold text-stone-400 flex items-center gap-1">
                  <RefreshCcw className="w-3 h-3" /> 画像を変更
                </button>
              </div>

              <div className="relative rounded-[2rem] overflow-hidden border border-stone-100 shadow-inner group">
                <canvas 
                  ref={sourceCanvasRef} 
                  onMouseDown={sampleColorFromSource}
                  onMouseMove={(e) => {
                    if (e.buttons === 1) {
                      sampleColorFromSource(e);
                    }
                  }}
                  onTouchMove={sampleColorFromSource}
                  className="w-full h-auto cursor-crosshair touch-none" 
                />
                {/* Pick marker */}
                {pickPosition && (
                  <div 
                    className="absolute cursor-move z-10"
                    style={{ 
                      left: `${pickPosition.x * 100}%`, 
                      top: `${pickPosition.y * 100}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    onMouseDown={handlePickDragStart}
                    onTouchStart={handlePickDragStart}
                  >
                    <div className="relative">
                      {/* Outer glow */}
                      <div className="absolute inset-0 w-12 h-12 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full opacity-30 animate-ping" />
                      {/* Main pick circle */}
                      <div className="relative w-10 h-10 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full border-4 border-amber-400 shadow-lg flex items-center justify-center">
                        <Target className="w-5 h-5 text-amber-500" />
                      </div>
                      {/* Crosshair lines */}
                      <div className="absolute w-8 h-0.5 bg-amber-400 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60" />
                      <div className="absolute w-0.5 h-8 bg-amber-400 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60" />
                    </div>
                  </div>
                )}
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-[9px] px-3 py-1.5 rounded-full font-bold flex items-center gap-2 shadow-lg">
                  <Target className="w-3 h-3 text-amber-400" /> {isDraggingPick ? 'ピックを移動中...' : 'ピックをドラッグして位置を調整'}
                </div>
              </div>

              <div className="flex items-center gap-4 bg-stone-50 p-4 rounded-3xl border border-stone-100">
                <div className="w-12 h-12 rounded-full border-4 border-white shadow-md transition-colors duration-300" style={{ backgroundColor: analysis?.skinToneHex }} />
                <div className="flex-1">
                  <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Selected Skin Tone</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-mono font-bold text-stone-800">{analysis?.skinToneHex || '---'}</span>
                    {analysis && <span className="text-[10px] font-bold text-stone-500 bg-stone-200 px-2 py-0.5 rounded-md">{analysis.undertone}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Step 2: Ideal Color Selection */}
        {analysis && (
          <section className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-stone-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-stone-900 text-white text-[10px] flex items-center justify-center">2</div>
                理想の色を創る
              </h2>
              <div className="flex bg-stone-100 p-1 rounded-full scale-90">
                <button onClick={() => setPickerMode('presets')} className={`p-2 rounded-full transition-all ${pickerMode === 'presets' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'}`}><Palette className="w-4 h-4" /></button>
                <button onClick={() => setPickerMode('custom')} className={`p-2 rounded-full transition-all ${pickerMode === 'custom' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'}`}><Sliders className="w-4 h-4" /></button>
                <button onClick={() => targetInputRef.current?.click()} className={`p-2 rounded-full transition-all ${pickerMode === 'image' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'}`}><ImageIcon className="w-4 h-4" /></button>
                <input type="file" className="hidden" ref={targetInputRef} accept="image/*" onChange={handleTargetImageUpload} />
              </div>
            </div>

            {pickerMode === 'custom' ? (
              <div className="space-y-6">
                <div 
                  ref={svPanelRef}
                  onMouseDown={handleSVMove}
                  onMouseMove={(e) => e.buttons === 1 && handleSVMove(e)}
                  onTouchMove={handleSVMove}
                  className="aspect-video rounded-3xl relative overflow-hidden cursor-crosshair border border-stone-100 shadow-inner"
                  style={{ backgroundColor: `hsl(${hue * 360}, 100%, 50%)` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                  <div 
                    className="absolute w-6 h-6 border-4 border-white rounded-full shadow-lg -translate-x-1/2 translate-y-1/2 pointer-events-none"
                    style={{ left: `${sat * 100}%`, bottom: `${val * 100}%` }}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-widest"><span>Hue Selection</span><span>{Math.round(hue * 360)}°</span></div>
                  <input 
                    type="range" min="0" max="1" step="0.01" value={hue} 
                    onChange={(e) => updateCustomColor(parseFloat(e.target.value), sat, val)}
                    className="w-full h-3 rounded-full appearance-none color-picker-h cursor-pointer"
                  />
                </div>
              </div>
            ) : pickerMode === 'image' && targetImage ? (
              <div className="space-y-4">
                <div className="relative rounded-3xl overflow-hidden cursor-crosshair border border-stone-100 shadow-inner">
                  <canvas ref={canvasRef} onMouseDown={sampleColorFromCanvas} onTouchMove={sampleColorFromCanvas} className="w-full touch-none" />
                  <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white text-[9px] px-3 py-1.5 rounded-full font-bold flex items-center gap-2">
                    <Pipette className="w-3 h-3" /> 理想の色をなぞる
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-3">
                {['#FAD4D8', '#FF8B8B', '#E6B8A2', '#D2B48C', '#8E3B46', '#F5E6CC', '#D9A066', '#BC8F8F', '#DEB887', '#E9967A'].map(c => (
                  <button key={c} onClick={() => setTargetColor(c)} className={`aspect-square rounded-full border-4 transition-all ${targetColor === c ? 'border-stone-800 scale-110 shadow-lg' : 'border-white shadow-sm opacity-60'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            )}

            <div className="mt-8 flex items-center gap-6 bg-stone-50 p-4 rounded-3xl border border-stone-100">
              <div className="relative w-16 h-16 shrink-0">
                <div className="absolute inset-0 rounded-full border-4 border-white shadow-lg overflow-hidden flex flex-col">
                   <div className="flex-1" style={{ backgroundColor: analysis.skinToneHex }} />
                   <div className="flex-1" style={{ backgroundColor: targetColor }} />
                </div>
                <Crosshair className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              </div>
              <div className="flex-1">
                 <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-1">Target Color</p>
                 <span className="text-xl font-mono font-bold text-stone-800">{targetColor}</span>
              </div>
            </div>
          </section>
        )}

        {/* Step 3: Simulation */}
        {simulation && (
          <section className="bg-stone-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-6 duration-700">
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <span className="text-[9px] font-black text-stone-500 uppercase tracking-[0.3em]">Pigment Simulation</span>
                <h3 className="text-2xl serif text-white">ベスト・マッチ</h3>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex flex-col items-end">
                <p className="text-[8px] text-stone-400 font-bold uppercase tracking-widest">Similarity</p>
                <p className="text-xl font-mono font-bold text-green-400">{(100 - simulation.deltaE).toFixed(1)}%</p>
              </div>
            </div>

            <div className="space-y-8 relative z-10">
              <div className="flex items-center gap-6 bg-white/5 p-4 rounded-3xl border border-white/5">
                <div className="w-16 h-16 rounded-2xl shadow-2xl ring-4 ring-white/10 shrink-0" style={{ backgroundColor: simulation.product.colorHex }} />
                <div>
                  <h4 className="font-bold text-lg leading-tight">{simulation.product.name}</h4>
                  <p className="text-[10px] text-stone-400 font-medium uppercase tracking-widest">{simulation.product.brand}</p>
                </div>
              </div>

              <div className="bg-white/5 rounded-[2rem] p-5 border border-white/10">
                 <p className="text-[9px] text-stone-500 font-black uppercase mb-3">Color Expert's Insight</p>
                 <p className="text-[11px] text-stone-300 leading-relaxed font-medium">
                   {advice?.split('\n\n')[1] || "解析中..."}
                 </p>
              </div>

              <button className="w-full bg-white text-stone-900 py-5 rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl">
                公式ストアで詳細を見る
                <Sparkles className="w-4 h-4 text-amber-500" />
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default App;