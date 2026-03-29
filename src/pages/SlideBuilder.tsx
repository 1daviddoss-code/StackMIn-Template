import React, { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Download, Type, List, Search, LayoutTemplate, ChevronLeft, ChevronRight, BookOpen, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { toJpeg } from "html-to-image";
import pptxgen from "pptxgenjs";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import useFitText from "use-fit-text";
import { parseXMLBible, BibleTranslation } from "@/lib/bibleParser";
import { layoutBackgrounds } from "@/data/templates";

type SlideTemplate = "Title" | "Big Idea 1" | "Big Idea 2" | "Scripture" | "Bullet Points";

interface SlideData {
  template: SlideTemplate;
  title?: string;
  subtitle?: string;
  mainText?: string;
  reference?: string;
  bullets?: string[];
}

const AutoFitContainer = ({ children, className, maxFontSize = 100, minFontSize = 16, align = 'center' }: { children: React.ReactNode, className?: string, maxFontSize?: number, minFontSize?: number, align?: 'center' | 'left' | 'right' }) => {
  const { fontSize, ref } = useFitText({ maxFontSize, minFontSize });
  
  const alignItems = align === 'left' ? 'items-start' : align === 'right' ? 'items-end' : 'items-center';
  
  return (
    <div ref={ref} className={`w-full h-full overflow-hidden flex flex-col justify-center ${alignItems} ${className}`} style={{ fontSize, textAlign: align, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {children}
    </div>
  );
};

export function SlideBuilder() {
  const slideRef = useRef<HTMLDivElement>(null);
  const [activeTemplate, setActiveTemplate] = useState<SlideTemplate>("Title");
  
  // Content State
  const [titleText, setTitleText] = useState("Sermon Title");
  const [subtitleText, setSubtitleText] = useState("Subtitle or Date");
  const [mainText, setMainText] = useState("Your Big Idea here...");
  const [scriptureRef, setScriptureRef] = useState("Genesis 1:1");
  const [scriptureText, setScriptureText] = useState("In the beginning God created the heaven and the earth.");
  const [bulletText, setBulletText] = useState("Point 1\nPoint 2\nPoint 3");
  
  // Scripture Splitting State
  const [splitMethod, setSplitMethod] = useState<"none" | "text" | "verses">("none");
  const [splitValue, setSplitValue] = useState(150); // chars or verses
  
  // Bible State
  const [bibles, setBibles] = useState<BibleTranslation[]>([]);
  const [selectedBible, setSelectedBible] = useState<string>("");
  const [selectedBook, setSelectedBook] = useState<string>("");
  const [selectedChapter, setSelectedChapter] = useState<string>("1");
  const [selectedStartVerse, setSelectedStartVerse] = useState<string>("1");
  const [selectedEndVerse, setSelectedEndVerse] = useState<string>("1");
  
  // Grid Selection State
  const [selectedTestament, setSelectedTestament] = useState<'OT'|'NT'>('OT');
  const [selectionStep, setSelectionStep] = useState<'book'|'chapter'|'verse'>('book');

  // Export Settings
  const [animateBullets, setAnimateBullets] = useState(false);
  
  // Generated Slides State
  const [generatedSlides, setGeneratedSlides] = useState<SlideData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  
  // Presentation State
  const [presentationSlides, setPresentationSlides] = useState<SlideData[]>([]);
  
  const handleVerseClick = (vnumber: string) => {
    if (!selectedStartVerse || (selectedStartVerse && selectedEndVerse !== selectedStartVerse)) {
      setSelectedStartVerse(vnumber);
      setSelectedEndVerse(vnumber);
    } else {
      const startIndex = availableVerses.indexOf(selectedStartVerse);
      const clickedIndex = availableVerses.indexOf(vnumber);
      
      if (clickedIndex >= startIndex) {
        setSelectedEndVerse(vnumber);
      } else {
        setSelectedStartVerse(vnumber);
        setSelectedEndVerse(vnumber);
      }
    }
  };

  const isVerseSelected = (vnumber: string) => {
    if (!selectedStartVerse) return false;
    const startIndex = availableVerses.indexOf(selectedStartVerse);
    const endIndex = availableVerses.indexOf(selectedEndVerse);
    const currentIndex = availableVerses.indexOf(vnumber);
    
    if (startIndex === -1 || currentIndex === -1) return false;
    if (endIndex === -1) return currentIndex === startIndex;
    
    return currentIndex >= startIndex && currentIndex <= endIndex;
  };

// Load Bibles on mount
  useEffect(() => {
    const loadBibles = async () => {
      try {
        const loadedBibles: BibleTranslation[] = [];
        
        // Updated list to include all your uploaded translations
        const bibleFiles = [
          'NIV.xml', 
          'ESV.xml', 
          'KJV.xml', 
          'NLT.xml', 
          'NKJV.xml', 
          'NASB.xml', 
          'CSB.xml', 
          'MSG.xml', 
          'NRSV.xml'
        ];
        
        for (const file of bibleFiles) {
          const name = file.replace('.xml', '');
          // Make sure your files are in the /public/bibles/ folder
          const response = await fetch(`/bibles/${file}`);
          
          if (response.ok) {
            const xmlString = await response.text();
            try {
              const parsed = parseXMLBible(xmlString, name);
              loadedBibles.push(parsed);
            } catch (parseError) {
              console.error(`Error parsing ${file}:`, parseError);
            }
          } else {
            console.warn(`Could not find Bible file: ${file} at /bibles/`);
          }
        }
        
        if (loadedBibles.length > 0) {
          setBibles(loadedBibles);
          // Set a default (ESV or NIV are usually best for church defaults)
          const defaultBible = loadedBibles.find(b => b.name === "ESV") || loadedBibles[0];
          setSelectedBible(defaultBible.name);
          
          if (defaultBible.books.length > 0) {
            setSelectedBook(defaultBible.books[0].bname);
          }
        }
      } catch (err) {
        console.error("Failed to load bibles:", err);
      }
    };
    loadBibles();
  }, []);

  const currentBibleObj = useMemo(() => bibles.find(b => b.name === selectedBible), [bibles, selectedBible]);
  const availableChapters = useMemo(() => currentBibleObj && selectedBook ? currentBibleObj.getChapters(selectedBook) : [], [currentBibleObj, selectedBook]);
  const availableVerses = useMemo(() => currentBibleObj && selectedBook && selectedChapter ? currentBibleObj.getVersesList(selectedBook, parseInt(selectedChapter)) : [], [currentBibleObj, selectedBook, selectedChapter]);

  // Update scripture text when selection changes
  useEffect(() => {
    if (currentBibleObj && selectedBook && selectedChapter && selectedStartVerse && selectedEndVerse) {
      const verses = currentBibleObj.getVerses(selectedBook, parseInt(selectedChapter), selectedStartVerse, selectedEndVerse);
      if (verses.length > 0) {
        setScriptureText(verses.map(v => v.text).join(" "));
        setScriptureRef(`${selectedBook} ${selectedChapter}:${selectedStartVerse}${selectedEndVerse !== selectedStartVerse ? `-${selectedEndVerse}` : ''} (${currentBibleObj.name})`);
      }
    }
  }, [currentBibleObj, selectedBook, selectedChapter, selectedStartVerse, selectedEndVerse]);

  // Generate slides based on current inputs and splitting logic
  useEffect(() => {
    let slides: SlideData[] = [];
    
    if (activeTemplate === "Title") {
      slides.push({ template: "Title", title: titleText, subtitle: subtitleText });
    } else if (activeTemplate === "Big Idea 1" || activeTemplate === "Big Idea 2") {
      slides.push({ template: activeTemplate, mainText: mainText });
    } else if (activeTemplate === "Bullet Points") {
      const bullets = bulletText.split('\n').filter(b => b.trim() !== '');
      slides.push({ template: "Bullet Points", title: titleText, bullets });
    } else if (activeTemplate === "Scripture") {
      if (splitMethod === "none") {
        slides.push({ template: "Scripture", reference: scriptureRef, mainText: scriptureText });
      } else if (splitMethod === "text") {
        const words = scriptureText.split(' ');
        let currentChunk = "";
        let chunks = [];
        for (const word of words) {
          if ((currentChunk + " " + word).length > splitValue && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = word;
          } else {
            currentChunk += (currentChunk ? " " : "") + word;
          }
        }
        if (currentChunk) chunks.push(currentChunk.trim());
        
        slides = chunks.map((chunk, i) => ({
          template: "Scripture",
          reference: `${scriptureRef} (Part ${i + 1})`,
          mainText: chunk
        }));
      } else if (splitMethod === "verses") {
        // If splitting by verses, we re-fetch the verses to split them accurately
        if (currentBibleObj && selectedBook && selectedChapter && selectedStartVerse && selectedEndVerse) {
          const verses = currentBibleObj.getVerses(selectedBook, parseInt(selectedChapter), selectedStartVerse, selectedEndVerse);
          
          let currentChunk = "";
          let chunks = [];
          let vCount = 0;
          let currentRefStart = selectedStartVerse;
          
          for (let i = 0; i < verses.length; i++) {
            currentChunk += (currentChunk ? " " : "") + verses[i].text;
            vCount++;
            if (vCount >= splitValue || i === verses.length - 1) {
              const currentRefEnd = verses[i].verse;
              chunks.push({
                text: currentChunk.trim(),
                ref: `${selectedBook} ${selectedChapter}:${currentRefStart}${currentRefEnd !== currentRefStart ? `-${currentRefEnd}` : ''} (${currentBibleObj.name})`
              });
              currentChunk = "";
              vCount = 0;
              if (i + 1 < verses.length) {
                currentRefStart = verses[i + 1].verse;
              }
            }
          }
          
          slides = chunks.map(chunk => ({
            template: "Scripture",
            reference: chunk.ref,
            mainText: chunk.text
          }));
        } else {
          slides.push({ template: "Scripture", reference: scriptureRef, mainText: scriptureText });
        }
      }
    }
    
    setGeneratedSlides(slides.length > 0 ? slides : [{ template: activeTemplate }]);
    if (currentSlideIndex >= slides.length) {
      setCurrentSlideIndex(0);
    }
  }, [activeTemplate, titleText, subtitleText, mainText, scriptureRef, scriptureText, bulletText, splitMethod, splitValue, currentBibleObj, selectedBook, selectedChapter, selectedStartVerse, selectedEndVerse]);

  const exportJpeg = async () => {
    if (!slideRef.current) return;
    
    if (generatedSlides.length === 1) {
      try {
        const dataUrl = await toJpeg(slideRef.current, { quality: 0.95 });
        saveAs(dataUrl, 'slide.jpg');
      } catch (err) {
        console.error('Failed to export image', err);
      }
    } else {
      alert("Multi-slide JPEG export requires off-screen rendering. Exporting current slide only for now.");
      try {
        const dataUrl = await toJpeg(slideRef.current, { quality: 0.95 });
        saveAs(dataUrl, `slide_${currentSlideIndex + 1}.jpg`);
      } catch (err) {
        console.error('Failed to export image', err);
      }
    }
  };

  const exportAllJpegs = async () => {
    if (presentationSlides.length === 0) {
      alert("No slides in presentation to export.");
      return;
    }
    
    alert("Exporting all slides as JPEGs is a complex operation that requires rendering each slide off-screen. For now, this button will just export the currently visible slide in the preview pane.");
    exportJpeg();
  };

  const exportPptx = async () => {
    const pres = new pptxgen();
    const slidesToExport = presentationSlides.length > 0 ? presentationSlides : generatedSlides;
    
    for (const slideData of slidesToExport) {
      const bgUrl = layoutBackgrounds[slideData.template];
      
      if (slideData.template === "Bullet Points" && animateBullets && slideData.bullets && slideData.bullets.length > 0) {
        // Create multiple slides for animated bullet build
        for (let i = 1; i <= slideData.bullets.length; i++) {
          const slide = pres.addSlide();
          if (bgUrl) slide.background = { path: bgUrl };
          
          slide.addText(slideData.title || "", { x: "10%", y: "10%", w: "80%", h: "15%", color: "FFFFFF", fontSize: 40, fontFace: "CustomChurchFont", align: "left", bold: true, autoFit: true });
          const visibleBullets = slideData.bullets.slice(0, i);
          const bulletString = visibleBullets.map(b => `• ${b}`).join('\n');
          slide.addText(bulletString, { x: "10%", y: "30%", w: "80%", h: "60%", color: "E5E7EB", fontSize: 28, fontFace: "CustomChurchFont", align: "left", valign: "top", bullet: true, autoFit: true });
        }
      } else {
        const slide = pres.addSlide();
        if (bgUrl) slide.background = { path: bgUrl };
        
        if (slideData.template === "Title") {
          slide.addText(slideData.title || "", { x: "10%", y: "30%", w: "80%", h: "20%", color: "FFFFFF", fontSize: 48, fontFace: "CustomChurchFont", align: "center", bold: true, autoFit: true });
          slide.addText(slideData.subtitle || "", { x: "10%", y: "50%", w: "80%", h: "10%", color: "CCCCCC", fontSize: 24, fontFace: "CustomChurchFont", align: "center", autoFit: true });
        } else if (slideData.template === "Big Idea 1") {
          slide.addText(slideData.mainText || "", { x: "10%", y: "10%", w: "80%", h: "80%", color: "FFFFFF", fontSize: 40, fontFace: "CustomChurchFont", align: "center", valign: "middle", bold: true, autoFit: true });
        } else if (slideData.template === "Big Idea 2") {
          slide.addText(slideData.mainText || "", { x: "10%", y: "10%", w: "80%", h: "80%", color: "FCD34D", fontSize: 44, fontFace: "CustomChurchFont", align: "left", valign: "middle", bold: true, italic: true, autoFit: true });
        } else if (slideData.template === "Scripture") {
          slide.addText(`"${slideData.mainText}"`, { x: "10%", y: "15%", w: "80%", h: "60%", color: "FFFFFF", fontSize: 32, fontFace: "CustomChurchFont", align: "left", valign: "middle", autoFit: true });
          slide.addText(slideData.reference || "", { x: "10%", y: "75%", w: "80%", h: "10%", color: "9CA3AF", fontSize: 24, fontFace: "CustomChurchFont", align: "right", bold: true, autoFit: true });
        } else if (slideData.template === "Bullet Points") {
          slide.addText(slideData.title || "", { x: "10%", y: "10%", w: "80%", h: "15%", color: "FFFFFF", fontSize: 40, fontFace: "CustomChurchFont", align: "left", bold: true, autoFit: true });
          const bulletString = (slideData.bullets || []).map(b => `• ${b}`).join('\n');
          slide.addText(bulletString, { x: "10%", y: "30%", w: "80%", h: "60%", color: "E5E7EB", fontSize: 28, fontFace: "CustomChurchFont", align: "left", valign: "top", bullet: true, autoFit: true });
        }
      }
    }

    pres.writeFile({ fileName: "Sermon_Slides.pptx" });
  };

  const currentSlide = generatedSlides[currentSlideIndex] || { template: activeTemplate };

  const addToPresentation = () => {
    setPresentationSlides([...presentationSlides, ...generatedSlides]);
  };

  const moveSlideUp = (index: number) => {
    if (index === 0) return;
    const newSlides = [...presentationSlides];
    [newSlides[index - 1], newSlides[index]] = [newSlides[index], newSlides[index - 1]];
    setPresentationSlides(newSlides);
  };

  const moveSlideDown = (index: number) => {
    if (index === presentationSlides.length - 1) return;
    const newSlides = [...presentationSlides];
    [newSlides[index + 1], newSlides[index]] = [newSlides[index], newSlides[index + 1]];
    setPresentationSlides(newSlides);
  };

  const deleteSlide = (index: number) => {
    const newSlides = presentationSlides.filter((_, i) => i !== index);
    setPresentationSlides(newSlides);
  };

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden bg-[#1f2024]">
      
      {/* Left Pane: Preview */}
      <div className="w-full md:w-1/2 lg:w-[45%] bg-[#1f2024] p-8 flex flex-col h-full border-r border-zinc-800">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Live Preview</h2>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center bg-[#1f2024] rounded-none border border-zinc-800 overflow-hidden p-4 relative">
          
          {/* Slide Navigation (if multiple) */}
          {generatedSlides.length > 1 && (
            <div className="absolute top-4 left-0 right-0 flex justify-center items-center gap-4 z-20">
              <Button variant="secondary" size="icon" onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))} disabled={currentSlideIndex === 0} className="rounded-none">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-none">
                Slide {currentSlideIndex + 1} of {generatedSlides.length}
              </span>
              <Button variant="secondary" size="icon" onClick={() => setCurrentSlideIndex(Math.min(generatedSlides.length - 1, currentSlideIndex + 1))} disabled={currentSlideIndex === generatedSlides.length - 1} className="rounded-none">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Canvas Container - 16:9 Aspect Ratio */}
          <div 
            ref={slideRef}
            className="relative w-full max-w-3xl aspect-video bg-zinc-800 rounded-none overflow-hidden shadow-2xl flex items-center justify-center p-12"
            style={{
              backgroundImage: layoutBackgrounds[currentSlide.template] ? `url(${layoutBackgrounds[currentSlide.template]})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>
            
            {/* Dynamic Content based on Template */}
            <div className="relative z-10 w-full h-full flex flex-col" style={{ fontFamily: "'CustomChurchFont', 'Inter', sans-serif" }}>
              
              {currentSlide.template === "Title" && (
                <div className="flex-1 flex flex-col items-center justify-center text-center w-full h-full">
                  <div className="w-full h-2/3">
                    <AutoFitContainer className="text-white font-bold drop-shadow-lg" maxFontSize={120}>
                      {currentSlide.title}
                    </AutoFitContainer>
                  </div>
                  <div className="w-full h-1/3">
                    <AutoFitContainer className="text-zinc-300 drop-shadow-md" maxFontSize={60}>
                      {currentSlide.subtitle}
                    </AutoFitContainer>
                  </div>
                </div>
              )}

              {currentSlide.template === "Big Idea 1" && (
                <div className="flex-1 flex items-center justify-center text-center w-full h-full">
                  <AutoFitContainer className="text-white font-bold leading-tight drop-shadow-lg" maxFontSize={150}>
                    {currentSlide.mainText}
                  </AutoFitContainer>
                </div>
              )}

              {currentSlide.template === "Big Idea 2" && (
                <div className="flex-1 flex items-center justify-start text-left pl-8 border-l-8 border-amber-400 w-full h-full">
                  <AutoFitContainer className="text-amber-400 font-bold italic leading-tight drop-shadow-lg" maxFontSize={150} align="left">
                    {currentSlide.mainText}
                  </AutoFitContainer>
                </div>
              )}

              {currentSlide.template === "Scripture" && (
                <div className="flex-1 flex flex-col justify-center text-left w-full h-full">
                  <div className="w-full h-3/4">
                    <AutoFitContainer className="text-white leading-relaxed drop-shadow-lg" maxFontSize={100} align="left">
                      "{currentSlide.mainText}"
                    </AutoFitContainer>
                  </div>
                  <div className="w-full h-1/4 flex items-end justify-end">
                    <AutoFitContainer className="text-zinc-400 font-bold drop-shadow-md" maxFontSize={60} align="right">
                      — {currentSlide.reference}
                    </AutoFitContainer>
                  </div>
                </div>
              )}

              {currentSlide.template === "Bullet Points" && (
                <div className="flex-1 flex flex-col justify-start text-left w-full h-full">
                  <div className="w-full h-1/4 mb-4">
                    <AutoFitContainer className="text-white font-bold drop-shadow-lg" maxFontSize={80} align="left">
                      {currentSlide.title}
                    </AutoFitContainer>
                  </div>
                  <div className="w-full h-3/4">
                    <AutoFitContainer className="text-zinc-200 drop-shadow-md" maxFontSize={60} align="left">
                      <ul className="list-disc list-inside ml-4">
                        {currentSlide.bullets?.map((bullet, idx) => (
                          <li key={idx} style={{ marginBottom: '0.5em' }}>{bullet}</li>
                        ))}
                      </ul>
                    </AutoFitContainer>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Middle Pane: Editor */}
      <div className="w-full md:w-1/2 lg:w-[35%] bg-[#1f2024] flex flex-col h-full overflow-y-auto border-r border-zinc-800">
        <div className="p-6 space-y-8 pb-24">
          
          {/* Template Selection */}
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-white text-lg font-bold flex items-center"><LayoutTemplate className="w-5 h-5 mr-2"/> Slide Layout</Label>
              <Select value={activeTemplate} onValueChange={(v) => setActiveTemplate(v as SlideTemplate)}>
                <SelectTrigger className="w-full bg-[#1f2024] border-zinc-800 text-white rounded-none">
                  <SelectValue placeholder="Select a layout" />
                </SelectTrigger>
                <SelectContent className="bg-[#1f2024] border-zinc-800 text-white rounded-none">
                  <SelectItem value="Title">Title Slide</SelectItem>
                  <SelectItem value="Big Idea 1">Big Idea (Centered)</SelectItem>
                  <SelectItem value="Big Idea 2">Big Idea (Accent)</SelectItem>
                  <SelectItem value="Scripture">Scripture</SelectItem>
                  <SelectItem value="Bullet Points">Bullet Points</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="h-px bg-zinc-800 w-full" />

          {/* Dynamic Editor Fields */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white mb-4">Content Editor</h3>
            
            {activeTemplate === "Title" && (
              <>
                <div className="space-y-2">
                  <Label className="text-zinc-300">Main Title</Label>
                  <Input className="bg-[#1f2024] border-zinc-800 text-white rounded-none" value={titleText} onChange={e => setTitleText(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">Subtitle / Date</Label>
                  <Input className="bg-[#1f2024] border-zinc-800 text-white rounded-none" value={subtitleText} onChange={e => setSubtitleText(e.target.value)} />
                </div>
              </>
            )}

            {(activeTemplate === "Big Idea 1" || activeTemplate === "Big Idea 2") && (
              <div className="space-y-2">
                <Label className="text-zinc-300">Main Text</Label>
                <Textarea className="min-h-[150px] bg-[#1f2024] border-zinc-800 text-white text-lg rounded-none" value={mainText} onChange={e => setMainText(e.target.value)} />
              </div>
            )}

            {activeTemplate === "Bullet Points" && (
              <>
                <div className="space-y-2">
                  <Label className="text-zinc-300">Slide Title</Label>
                  <Input className="bg-[#1f2024] border-zinc-800 text-white rounded-none" value={titleText} onChange={e => setTitleText(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">Bullet Points (One per line)</Label>
                  <Textarea className="min-h-[200px] bg-[#1f2024] border-zinc-800 text-white text-lg rounded-none" value={bulletText} onChange={e => setBulletText(e.target.value)} />
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                  <Label htmlFor="animate-bullets" className="text-sm text-zinc-300 cursor-pointer">Animate Bullets on Export (PPTX)</Label>
                  <Switch id="animate-bullets" checked={animateBullets} onCheckedChange={setAnimateBullets} />
                </div>
                <p className="text-xs text-zinc-500">When enabled, exporting to PPTX will create multiple slides to simulate bullets appearing one by one.</p>
              </>
            )}

            {activeTemplate === "Scripture" && (
              <div className="space-y-6">
                <Tabs defaultValue="bible" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-[#1f2024] rounded-none">
                    <TabsTrigger value="bible" className="rounded-none data-[state=active]:bg-[#1800ad] data-[state=active]:text-white"><BookOpen className="w-4 h-4 mr-2"/> Bible Selection</TabsTrigger>
                    <TabsTrigger value="edit" className="rounded-none data-[state=active]:bg-[#1800ad] data-[state=active]:text-white"><Type className="w-4 h-4 mr-2"/> Manual Edit</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="bible" className="mt-4 space-y-4">
                    {bibles.length === 0 ? (
                      <div className="p-4 bg-[#1f2024] border border-zinc-800 rounded-none text-center">
                        <p className="text-zinc-400 text-sm mb-2">No XML Bibles found.</p>
                        <p className="text-zinc-500 text-xs">Upload XML bibles to the <code className="bg-zinc-800 px-1 rounded-none">/public/bibles</code> folder in the code to use this feature.</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label className="text-zinc-300">Translation</Label>
                          <Select value={selectedBible} onValueChange={(v) => {
                            setSelectedBible(v);
                            const b = bibles.find(x => x.name === v);
                            if (b && b.books.length > 0) {
                              setSelectedBook(b.books[0].bname);
                              setSelectionStep('book');
                            }
                          }}>
                            <SelectTrigger className="w-full bg-[#1f2024] border-zinc-800 text-white rounded-none">
                              <SelectValue placeholder="Select Translation" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1f2024] border-zinc-800 text-white rounded-none">
                              {bibles.map(b => (
                                <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex gap-2 border-b border-zinc-800 pb-2">
                             <Button 
                               onClick={() => setSelectionStep('book')} 
                               className={`flex-1 rounded-none ${selectionStep === 'book' ? 'bg-[#1800ad] text-white hover:bg-[#1800ad]/90' : 'bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                             >
                               Book
                             </Button>
                             <Button 
                               onClick={() => setSelectionStep('chapter')} 
                               disabled={!selectedBook} 
                               className={`flex-1 rounded-none ${selectionStep === 'chapter' ? 'bg-[#1800ad] text-white hover:bg-[#1800ad]/90' : 'bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                             >
                               Chapter
                             </Button>
                             <Button 
                               onClick={() => setSelectionStep('verse')} 
                               disabled={!selectedChapter} 
                               className={`flex-1 rounded-none ${selectionStep === 'verse' ? 'bg-[#1800ad] text-white hover:bg-[#1800ad]/90' : 'bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                             >
                               Verse
                             </Button>
                          </div>

                          {selectionStep === 'book' && (
                            <div className="space-y-2">
                               <div className="flex gap-2 mb-2">
                                 <Button 
                                   onClick={() => setSelectedTestament('OT')} 
                                   className={`flex-1 rounded-none ${selectedTestament === 'OT' ? 'bg-[#1800ad] text-white hover:bg-[#1800ad]/90' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                                 >
                                   Old Testament
                                 </Button>
                                 <Button 
                                   onClick={() => setSelectedTestament('NT')} 
                                   className={`flex-1 rounded-none ${selectedTestament === 'NT' ? 'bg-[#1800ad] text-white hover:bg-[#1800ad]/90' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                                 >
                                   New Testament
                                 </Button>
                               </div>
                               <div className="grid grid-cols-3 gap-1 max-h-[250px] overflow-y-auto pr-1">
                                 {currentBibleObj?.books.filter(b => b.testament === selectedTestament).map(b => (
                                   <Button 
                                     key={b.bname} 
                                     onClick={() => { 
                                       setSelectedBook(b.bname); 
                                       setSelectedChapter("1");
                                       setSelectedStartVerse("1");
                                       setSelectedEndVerse("1");
                                       setSelectionStep('chapter'); 
                                     }} 
                                     className={`rounded-none text-xs h-10 ${selectedBook === b.bname ? 'bg-[#1800ad] text-white hover:bg-[#1800ad]/90' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                                   >
                                     {b.bname}
                                   </Button>
                                 ))}
                               </div>
                            </div>
                          )}

                          {selectionStep === 'chapter' && (
                             <div className="grid grid-cols-5 gap-1 max-h-[250px] overflow-y-auto pr-1">
                               {availableChapters.map(c => (
                                 <Button 
                                   key={c} 
                                   onClick={() => { 
                                     setSelectedChapter(c.toString()); 
                                     setSelectedStartVerse("1");
                                     setSelectedEndVerse("1");
                                     setSelectionStep('verse'); 
                                   }} 
                                   className={`rounded-none h-10 ${selectedChapter === c.toString() ? 'bg-[#1800ad] text-white hover:bg-[#1800ad]/90' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                                 >
                                   {c}
                                 </Button>
                               ))}
                             </div>
                          )}

                          {selectionStep === 'verse' && (
                             <div className="grid grid-cols-5 gap-1 max-h-[250px] overflow-y-auto pr-1">
                               {availableVerses.map(v => (
                                 <Button 
                                   key={v} 
                                   onClick={() => handleVerseClick(v)} 
                                   className={`rounded-none h-10 ${isVerseSelected(v) ? 'bg-[#1800ad] text-white hover:bg-[#1800ad]/90' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                                 >
                                   {v}
                                 </Button>
                               ))}
                             </div>
                          )}
                        </div>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="edit" className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-zinc-300">Reference</Label>
                      <Input className="bg-[#1f2024] border-zinc-800 text-white rounded-none" value={scriptureRef} onChange={e => setScriptureRef(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-300">Verse Text</Label>
                      <Textarea className="min-h-[150px] bg-[#1f2024] border-zinc-800 text-white text-lg rounded-none" value={scriptureText} onChange={e => setScriptureText(e.target.value)} />
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Splitting Options */}
                <Card className="bg-[#1f2024] border-zinc-800 p-4 space-y-4 rounded-none">
                  <h4 className="text-sm font-bold text-white">Long Passage Splitting</h4>
                  
                  <div className="space-y-3">
                    <Label className="text-xs text-zinc-400">Split Method</Label>
                    <Select value={splitMethod} onValueChange={(v) => {
                      setSplitMethod(v as any);
                      if (v === "verses") setSplitValue(2);
                      else if (v === "text") setSplitValue(150);
                    }}>
                      <SelectTrigger className="w-full bg-[#1f2024] border-zinc-800 text-white text-sm rounded-none">
                        <SelectValue placeholder="Don't split" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1f2024] border-zinc-800 text-white rounded-none">
                        <SelectItem value="none">Don't split (Fit on one slide)</SelectItem>
                        <SelectItem value="text">By Text Length (Characters)</SelectItem>
                        <SelectItem value="verses">By Number of Verses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {splitMethod !== "none" && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-zinc-400">
                          {splitMethod === "text" ? "Max Characters per Slide" : "Verses per Slide"}
                        </Label>
                        <span className="text-xs text-white font-mono">{splitValue}</span>
                      </div>
                      <Input 
                        type="range" 
                        min={splitMethod === "text" ? 50 : 1} 
                        max={splitMethod === "text" ? 300 : 5} 
                        step={splitMethod === "text" ? 10 : 1}
                        value={splitValue} 
                        onChange={e => setSplitValue(parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  )}
                </Card>
              </div>
            )}

            <div className="pt-4">
              <Button className="w-full bg-[#1800ad] hover:bg-[#1800ad]/90 text-white font-bold py-6 text-lg shadow-lg rounded-none" onClick={addToPresentation}>
                <Plus className="w-5 h-5 mr-2" />
                Add to Presentation ({generatedSlides.length} slide{generatedSlides.length > 1 ? 's' : ''})
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane: Presentation Slide List */}
      <div className="w-full lg:w-[20%] bg-[#1f2024] flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-zinc-800 space-y-3 bg-[#1f2024]">
          <h2 className="text-lg font-bold text-white flex items-center">
            <List className="w-5 h-5 mr-2" />
            Presentation
          </h2>
          <Button className="w-full bg-[#1800ad] hover:bg-[#1800ad]/90 text-white font-bold rounded-none" onClick={exportPptx}>
            Export .pptx
          </Button>
          <Button className="w-full bg-[#1800ad] hover:bg-[#1800ad]/90 text-white font-bold rounded-none" onClick={exportAllJpegs}>
            <Download className="w-4 h-4 mr-2" />
            Export All JPEGs
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {presentationSlides.length === 0 ? (
            <div className="text-center text-zinc-500 text-sm mt-10 p-4 border border-dashed border-zinc-800 rounded-none">
              No slides added yet. Build a slide and click "Add to Presentation".
            </div>
          ) : (
            presentationSlides.map((slide, idx) => (
              <Card key={idx} className="bg-[#1f2024] border-zinc-800 p-3 flex flex-col gap-2 shadow-md rounded-none">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{idx + 1}. {slide.template}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-white" onClick={() => moveSlideUp(idx)} disabled={idx === 0}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-white" onClick={() => moveSlideDown(idx)} disabled={idx === presentationSlides.length - 1}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={() => deleteSlide(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-white truncate font-medium">
                  {slide.title || slide.mainText || slide.reference || "Slide"}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

