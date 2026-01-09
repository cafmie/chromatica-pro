import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RefreshCcw, Palette, Share, Image as ImageIcon, Crosshair, Pipette, Sliders, Target, ChevronRight, Layers, X, Search } from 'lucide-react';
import { AnalysisResult, SimulationResult } from './types';
import { analyzeSkinToneLocal, generateLocalAdvice } from './services/analysisService';
import { hexToRgb, rgbToHex, blendColors, calculateColorDifference, hsvToRgb, detectUndertone, calculateRequiredPigment } from './utils/colorMath';
import { MOCK_PRODUCTS } from './constants';

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [targetImage, setTargetImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [targetColor, setTargetColor] = useState<string>('#E6B8A2');
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [idealPigment, setIdealPigment] = useState<string | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [isSampling, setIsSampling] = useState(false);
  const [pickerMode, setPickerMode] = useState<'presets' | 'custom' | 'image'>('presets');
  const [zoomedColor, setZoomedColor] = useState<string | null>(null);
  
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

  const handleTargetImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTargetImage(e.target?.result as string);
        setPickerMode('image');
        setIsSampling(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const sampleColorFromSource = (e: any) => {
    if (!sourceCanvasRef.current || !image) return;
    const canvas = sourceCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
    const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const rgb = { r: pixel[0], g: pixel[1], b: pixel[2] };
      setAnalysis({
        skinToneHex: rgbToHex(rgb),
        undertone: detectUndertone(rgb),
        confidence: 1.0,
        description: "手動サンプリング結果"
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
      setTargetColor(rgbToHex({ r: pixel[0], g: pixel[1], b: pixel[2] }));
    }
  };

  const updateCustomColor = (h: number, s: number, v: number) => {
    setHue(h); setSat(sat); setVal(val);
    setTargetColor(rgbToHex(hsvToRgb(h, s, v)));
  };

  const handleSVMove = (e: any) => {
    if (!svPanelRef.current) return;
    const rect = svPanelRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const s = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (touch.clientY - rect.top) / rect.height));
    updateCustomColor(hue, s, v);
  };

  useEffect(() => {
    if (image && sourceCanvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const canvas = sourceCanvasRef.current!;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const maxWidth = 800;
          const scale = Math.min(1, maxWidth / img.width);
          canvas.width = img.width * scale; canvas.height = img.height * scale;
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
    
    const idealRgb = calculateRequiredPigment(baseRgb, targetRgb, 0.6);
    setIdealPigment(rgbToHex(idealRgb));

    let bestResult: SimulationResult | null = null;
    let minDiff = Infinity;

    MOCK_PRODUCTS.forEach(product => {
      const productRgb = hexToRgb(product.colorHex);
      const diff = calculateColorDifference(productRgb, idealRgb);
      if (diff < minDiff) {
        minDiff = diff;
        const resultantRgb = blendColors(baseRgb, productRgb, 0.6);
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

  const handleGoogleSearch = () => {
    if (simulation) {
      const query = encodeURIComponent(`${simulation.product.brand} ${simulation.product.name} ${simulation.product.nameJp}`);
      window.open(`https://www.google.com/search?q=${query}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-[#FDFCFA] safe-area-bottom">
      {/* Color Zoom Overlay */}
      {zoomedColor && (
        <div 
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 backdrop-blur-3xl bg-black/40"
          onClick={() => setZoomedColor(null)}
        >
          <button 
            className="absolute top-10 right-6 p-3 bg-white/20 hover:bg-white/40 backdrop-blur-xl rounded-full text-white shadow-2xl transition-all active:scale-90"
            onClick={(e) => { e.stopPropagation(); setZoomedColor(null); }}
          >
            <X className="w-8 h-8" />
          </button>
          <div 
            className="w-[85%] aspect-[3/4] rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.3)] border-[12px] border-white flex flex-col items-center justify-end p-12 transition-transform duration-500"
            style={{ backgroundColor: zoomedColor }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg">
              <span className="text-2xl font-mono font-black text-stone-900 tracking-wider uppercase">{zoomedColor}</span>
            </div>
          </div>
        </div>
      )}

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
        {/* Step 1: Skin Capture */}
        <section className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-stone-100 overflow-hidden">
          {!image ? (
            <div onClick={() => fileInputRef.current?.click()} className="aspect-square border-2 border-dashed border-stone-100 rounded-[2rem] flex flex-col items-center justify-center gap-4 bg-stone-50/50 cursor-pointer active:scale-95 transition-all">
              <Camera className="w-10 h-10 text-stone-300" />
              <div className="text-center px-6">
                <p className="text-stone-800 font-bold">肌色を撮影・解析</p>
                <input type="file" className="hidden" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} />
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-stone-900 text-white text-[9px] flex items-center justify-center">1</div>
                  Skin Analysis
                </h2>
                <button onClick={() => { setImage(null); setAnalysis(null); }} className="text-[10px] font-bold text-stone-400">変更</button>
              </div>
              <div className="relative rounded-[2rem] overflow-hidden border border-stone-100 shadow-inner">
                <canvas ref={sourceCanvasRef} onMouseDown={sampleColorFromSource} onTouchMove={sampleColorFromSource} className="w-full h-auto cursor-crosshair touch-none" />
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-[9px] px-3 py-1.5 rounded-full font-bold flex items-center gap-2 shadow-lg">
                  <Target className="w-3 h-3 text-amber-400" /> 正確な肌の場所をタップ
                </div>
              </div>
              <div className="flex items-center gap-4 bg-stone-50 p-4 rounded-3xl border border-stone-100">
                <div className="w-10 h-10 rounded-full border-4 border-white shadow-md cursor-zoom-in active:scale-90 transition-transform" style={{ backgroundColor: analysis?.skinToneHex }} onClick={() => setZoomedColor(analysis?.skinToneHex || null)} />
                <div className="flex-1">
                  <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Selected Skin Tone</p>
                  <span className="text-lg font-mono font-bold text-stone-800">{analysis?.skinToneHex || '---'}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Step 2: Goal Selection */}
        {analysis && (
          <section className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-stone-100 overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-stone-900 text-white text-[9px] flex items-center justify-center">2</div>
                Goal Color
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
                <div ref={svPanelRef} onMouseDown={handleSVMove} onMouseMove={(e) => e.buttons === 1 && handleSVMove(e)} onTouchMove={handleSVMove} className="aspect-video rounded-3xl relative overflow-hidden cursor-crosshair border border-stone-100 shadow-inner" style={{ backgroundColor: `hsl(${hue * 360}, 100%, 50%)` }}>
                  <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" /><div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                  <div className="absolute w-6 h-6 border-4 border-white rounded-full shadow-lg -translate-x-1/2 translate-y-1/2 pointer-events-none" style={{ left: `${sat * 100}%`, bottom: `${val * 100}%` }} />
                </div>
                <input type="range" min="0" max="1" step="0.01" value={hue} onChange={(e) => updateCustomColor(parseFloat(e.target.value), sat, val)} className="w-full h-3 rounded-full appearance-none color-picker-h cursor-pointer" />
              </div>
            ) : pickerMode === 'image' && targetImage ? (
              <div className="relative rounded-3xl overflow-hidden cursor-crosshair border border-stone-100 shadow-inner">
                <canvas ref={canvasRef} onMouseDown={sampleColorFromCanvas} onTouchMove={sampleColorFromCanvas} className="w-full touch-none" />
                <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white text-[9px] px-3 py-1.5 rounded-full font-bold flex items-center gap-2"><Pipette className="w-3 h-3" /> 目標の色をなぞる</div>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-3">
                {['#FAD4D8', '#FF8B8B', '#E6B8A2', '#D2B48C', '#8E3B46', '#F5E6CC', '#D9A066', '#BC8F8F', '#DEB887', '#E9967A'].map(c => (
                  <button key={c} onClick={() => setTargetColor(c)} className={`aspect-square rounded-full border-4 transition-all ${targetColor === c ? 'border-stone-800 scale-110 shadow-lg' : 'border-white shadow-sm opacity-60'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            )}
            
            <div className="mt-8 flex items-center gap-6 bg-stone-50 p-4 rounded-3xl border border-stone-100">
              <div className="relative w-16 h-16 shrink-0 cursor-zoom-in active:scale-90 transition-transform" onClick={() => setZoomedColor(targetColor)}>
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

        {/* Step 3: Layering Analysis */}
        {analysis && simulation && (
          <section className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-stone-100 overflow-hidden animate-in slide-in-from-bottom-4">
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Layering Simulation
            </h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-bold text-stone-400 uppercase tracking-widest px-1">
                  <span>0% (Skin)</span><span>50%</span><span>100% (Pigment)</span>
                </div>
                <div className="h-10 w-full rounded-2xl overflow-hidden flex shadow-inner border border-stone-100">
                  {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((op) => {
                    const color = rgbToHex(blendColors(hexToRgb(analysis.skinToneHex), hexToRgb(simulation.product.colorHex), op));
                    return (
                      <div 
                        key={op} 
                        className="flex-1 transition-colors duration-500 cursor-zoom-in active:opacity-70" 
                        style={{ backgroundColor: color }}
                        onClick={() => setZoomedColor(color)}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="bg-stone-50 p-5 rounded-[2rem] border border-stone-100 space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Required Pigment (60% Opacity)</p>
                  <div 
                    className="w-8 h-8 rounded-full shadow-md border-2 border-white cursor-zoom-in active:scale-90 transition-transform" 
                    style={{ backgroundColor: idealPigment || '#fff' }} 
                    onClick={() => setZoomedColor(idealPigment)}
                  />
                </div>
                <div className="flex items-center gap-4">
                   <div className="text-center">
                     <div className="w-12 h-12 rounded-xl mb-1 shadow-sm border border-white cursor-zoom-in" style={{ backgroundColor: analysis.skinToneHex }} onClick={() => setZoomedColor(analysis.skinToneHex)} />
                     <p className="text-[8px] font-bold text-stone-400">肌色</p>
                   </div>
                   <div className="text-stone-300"><ChevronRight className="w-4 h-4" /></div>
                   <div className="text-center">
                     <div className="w-12 h-12 rounded-xl mb-1 shadow-sm border border-white cursor-zoom-in" style={{ backgroundColor: idealPigment || '#fff' }} onClick={() => setZoomedColor(idealPigment)} />
                     <p className="text-[8px] font-bold text-stone-400">理想顔料</p>
                   </div>
                   <div className="text-stone-300"><ChevronRight className="w-4 h-4" /></div>
                   <div className="text-center">
                     <div className="w-12 h-12 rounded-xl mb-1 shadow-md border-2 border-stone-800 cursor-zoom-in" style={{ backgroundColor: targetColor }} onClick={() => setZoomedColor(targetColor)} />
                     <p className="text-[8px] font-bold text-stone-800">目標</p>
                   </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Best Match Result */}
        {simulation && (
          <section className="bg-stone-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-6">
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <span className="text-[9px] font-black text-stone-500 uppercase tracking-[0.3em]">Pigment Recommendation</span>
                <h3 className="text-2xl serif text-white">ベスト・マッチ製品</h3>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex flex-col items-end">
                <p className="text-[8px] text-stone-400 font-bold uppercase tracking-widest">Accuracy</p>
                <p className="text-xl font-mono font-bold text-green-400">{(100 - simulation.deltaE).toFixed(1)}%</p>
              </div>
            </div>

            <div className="space-y-8 relative z-10">
              <div className="flex items-center gap-6 bg-white/5 p-4 rounded-3xl border border-white/5">
                <div 
                  className="w-16 h-16 rounded-2xl shadow-2xl ring-4 ring-white/10 shrink-0 cursor-zoom-in active:scale-90 transition-transform" 
                  style={{ backgroundColor: simulation.product.colorHex }} 
                  onClick={() => setZoomedColor(simulation.product.colorHex)}
                />
                <div>
                  <h4 className="font-bold text-lg leading-tight">{simulation.product.nameJp}</h4>
                  <p className="text-[12px] text-stone-300 font-medium mb-1">{simulation.product.name}</p>
                  <p className="text-[10px] text-stone-400 font-medium uppercase tracking-widest">{simulation.product.brand}</p>
                </div>
              </div>

              <div className="bg-white/5 rounded-[2rem] p-5 border border-white/10">
                 <p className="text-[9px] text-stone-500 font-black uppercase mb-3">Color Expert's Insight</p>
                 <p className="text-[11px] text-stone-300 leading-relaxed font-medium italic">
                   "この製品は理想の補正色に極めて近く、あなたの肌の上で重ねた際に、目標の{targetColor}を最も忠実に再現します。タップして実際の発色を大きく確認してみてください。"
                 </p>
              </div>

              <button 
                onClick={handleGoogleSearch}
                className="w-full bg-white text-stone-900 py-5 rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl"
              >
                この色をGoogleで検索 <Search className="w-4 h-4" />
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default App;