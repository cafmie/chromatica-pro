
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RefreshCcw, Check, Info, Palette, Sparkles, AlertCircle, Eye, Share } from 'lucide-react';
import { AnalysisResult, SimulationResult } from './types';
import { analyzeSkinToneLocal, generateLocalAdvice } from './services/analysisService';
import { hexToRgb, rgbToHex, blendColors, calculateColorDifference } from './utils/colorMath';
import { MOCK_PRODUCTS } from './constants';

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [targetColor, setTargetColor] = useState<string>('#E6B8A2');
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
            setError("解析に失敗しました。");
          } finally {
            setAnalyzing(false);
          }
        };
        img.src = base64;
      };
      reader.readAsDataURL(file);
    }
  };

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
        bestResult = {
          product,
          resultantHex: rgbToHex(resultantRgb),
          deltaE: diff
        };
      }
    });

    setSimulation(bestResult);
    if (bestResult) {
      const localAdvice = generateLocalAdvice(
        analysis.skinToneHex, 
        targetColor, 
        (bestResult as SimulationResult).product.name
      );
      setAdvice(localAdvice);
    }
  }, [analysis, targetColor]);

  useEffect(() => {
    if (analysis) {
      findBestProduct();
    }
  }, [analysis, targetColor, findBestProduct]);

  return (
    <div className="min-h-screen pb-24 bg-[#FDFCFA] safe-area-bottom">
      {/* Mobile-Friendly Header */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-stone-100 sticky top-0 z-50 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-stone-900 p-2 rounded-xl">
            <Palette className="text-white w-5 h-5" />
          </div>
          <h1 className="text-lg serif tracking-tight text-stone-800">Chromatica <span className="text-[10px] font-sans font-bold text-stone-300 uppercase ml-1">Pro</span></h1>
        </div>
        <button 
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: 'Chromatica Pro', url: window.location.href });
            }
          }}
          className="p-2 bg-stone-50 rounded-full text-stone-400"
        >
          <Share className="w-4 h-4" />
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        {/* Step 1: Capture */}
        <section className="bg-white rounded-[2rem] p-6 shadow-sm border border-stone-100">
          {!image ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square border-2 border-dashed border-stone-100 rounded-[1.5rem] flex flex-col items-center justify-center gap-4 bg-stone-50/50 active:scale-95 transition-all cursor-pointer"
            >
              <div className="bg-white p-6 rounded-full shadow-sm">
                <Camera className="w-8 h-8 text-stone-300" />
              </div>
              <div className="text-center px-6">
                <p className="text-stone-800 font-bold">肌色を撮影・アップロード</p>
                <p className="text-stone-400 text-xs mt-1">端末内のみで解析されるため安心です</p>
              </div>
              <input type="file" className="hidden" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24 shrink-0">
                  <img src={image} className="w-full h-full object-cover rounded-2xl shadow-inner" />
                  <button 
                    onClick={() => { setImage(null); setAnalysis(null); setSimulation(null); }}
                    className="absolute -top-2 -right-2 bg-white shadow-lg p-1.5 rounded-full border border-stone-100"
                  >
                    <RefreshCcw className="w-3 h-3 text-stone-500" />
                  </button>
                </div>
                <div className="flex-1">
                  {analyzing ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-3 bg-stone-100 rounded w-1/2" />
                      <div className="h-8 bg-stone-50 rounded" />
                    </div>
                  ) : analysis ? (
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest">Skin Tone Detected</p>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border border-stone-100 shadow-sm" style={{ backgroundColor: analysis.skinToneHex }} />
                        <span className="text-xl font-mono font-bold text-stone-800">{analysis.skinToneHex}</span>
                      </div>
                      <p className="text-xs text-stone-500 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-500" />
                        {analysis.undertone === 'Warm' ? 'イエベ' : analysis.undertone === 'Cool' ? 'ブルベ' : 'ニュートラル'}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
              {analysis && (
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <p className="text-xs text-stone-600 leading-relaxed italic">"{analysis.description}"</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Step 2: Target Selection */}
        {analysis && (
          <section className="bg-white rounded-[2rem] p-6 shadow-sm border border-stone-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-sm font-bold text-stone-800 mb-4 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-stone-100 text-[10px] flex items-center justify-center">2</div>
              目標の色を選択
            </h2>
            <div className="flex justify-between items-center gap-4">
               <div className="flex-1 grid grid-cols-5 gap-2">
                 {['#E6B8A2', '#FF8B8B', '#FAD4D8', '#6D4C41', '#3E2723'].map(c => (
                   <button 
                     key={c}
                     onClick={() => setTargetColor(c)}
                     className={`aspect-square rounded-xl border-2 transition-all ${targetColor === c ? 'border-stone-800 scale-105 shadow-md' : 'border-transparent opacity-60'}`}
                     style={{ backgroundColor: c }}
                   />
                 ))}
               </div>
               <div className="shrink-0">
                  <input 
                    type="color" 
                    value={targetColor} 
                    onChange={(e) => setTargetColor(e.target.value)}
                    className="w-12 h-12 rounded-xl bg-transparent border-none cursor-pointer"
                  />
               </div>
            </div>
          </section>
        )}

        {/* Step 3: Result */}
        {simulation && (
          <section className="bg-stone-900 text-white rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden animate-in zoom-in-95 duration-700">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16" />
            
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <span className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em]">Simulation</span>
                <h3 className="text-xl serif text-white mt-1">おすすめの塗料</h3>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5">
                <p className="text-[8px] text-stone-400 font-bold uppercase leading-none">Match</p>
                <p className="text-sm font-mono text-green-400">{(100 - simulation.deltaE).toFixed(1)}%</p>
              </div>
            </div>

            <div className="space-y-8 relative z-10">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl shadow-2xl ring-4 ring-white/5" style={{ backgroundColor: simulation.product.colorHex }} />
                <div>
                  <h4 className="font-bold text-lg leading-tight">{simulation.product.name}</h4>
                  <p className="text-xs text-stone-400">{simulation.product.brand}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1 aspect-[4/3] rounded-2xl overflow-hidden relative border border-white/10">
                  <div className="absolute inset-0 flex flex-col">
                    <div className="flex-1" style={{ backgroundColor: analysis?.skinToneHex }} />
                    <div className="flex-1" style={{ backgroundColor: simulation.resultantHex }} />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/40 backdrop-blur-sm px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest">Blend Result</div>
                  </div>
                </div>
                <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col justify-center">
                   <p className="text-[9px] text-stone-500 font-bold uppercase mb-2">Colorist Tip</p>
                   <p className="text-[11px] text-stone-200 leading-relaxed">
                     {advice?.split('\n\n')[1] || "解析中..."}
                   </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Persistent Status Bar */}
      {!image && (
        <div className="fixed bottom-8 left-6 right-6 z-40 bg-white/80 backdrop-blur-2xl border border-stone-100 shadow-2xl rounded-[2rem] p-5 flex items-center justify-between animate-in slide-in-from-bottom-10 duration-700">
           <div className="flex items-center gap-3">
             <div className="bg-stone-900 p-2.5 rounded-2xl shadow-lg">
               <Sparkles className="text-white w-5 h-5" />
             </div>
             <div>
               <p className="text-xs font-bold text-stone-800">準備完了</p>
               <p className="text-[10px] text-stone-400">カメラを起動してスタート</p>
             </div>
           </div>
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="bg-stone-900 text-white px-6 py-3 rounded-2xl text-xs font-bold shadow-xl active:scale-90 transition-all"
           >
             解析を開始
           </button>
        </div>
      )}
    </div>
  );
};

export default App;
